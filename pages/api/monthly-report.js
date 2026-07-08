// pages/api/monthly-report.js
//
// Assembles a single month's bar report from every data source:
//   • Sales      — Square Orders API (units + revenue, by item and category)
//   • Purchases  — bar_documents (POs placed / received in the month)
//   • Wastage    — Redis wastageLog, valued at each item's CURRENT buy price
//   • Markup     — current buy vs sell prices from itemSettings
//
// GET /api/monthly-report?year=2026&month=6      (month is 1-12)
//
// Note on wastage cost: entries store quantity only, not the price paid at the
// time. We value them at the item's current buyPrice, so the figure is
// "what that wastage would cost to replace today" rather than historical cost.
// The response flags this via `wastage.valuationBasis` so the UI can say so.

import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../lib/redis'
import { fetchSalesReport, fetchSquareData } from '../../lib/square'
import { defaultCategory } from '../../lib/calculations'
import { requireAuth } from '../../lib/session'

const TZ = 'Australia/Brisbane'

// First instant of the given month, and the first instant of the next month,
// both as UTC ISO strings anchored to Brisbane local time.
function monthBounds(year, month) {
  // Brisbane is UTC+10 year-round (no DST), so a fixed offset is safe here.
  const pad = n => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01T00:00:00+10:00`
  const nextY = month === 12 ? year + 1 : year
  const nextM = month === 12 ? 1 : month + 1
  const end   = `${nextY}-${pad(nextM)}-01T00:00:00+10:00`
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

function prevMonth(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res)) return

  const year  = Number(req.query.year)
  const month = Number(req.query.month)
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year and month (1-12) are required' })
  }

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const { start, end } = monthBounds(year, month)
    const pm = prevMonth(year, month)
    const { start: pStart, end: pEnd } = monthBounds(pm.year, pm.month)

    const settings = (await kvGet('itemSettings').catch(() => null)) || {}

    // ── Sales (this month + previous, for comparison) ──────────────────────
    const [sold, prevSold] = await Promise.all([
      fetchSalesReport(token, start, end),
      fetchSalesReport(token, pStart, pEnd),
    ])

    const itemRows = []
    for (const name of new Set([...Object.keys(sold), ...Object.keys(prevSold)])) {
      const s = settings[name] || {}
      const cur  = sold[name]     || { units: 0, revenue: 0 }
      const prev = prevSold[name] || { units: 0, revenue: 0 }
      if (!cur.units && !prev.units) continue
      itemRows.push({
        name,
        category: s.category || defaultCategory(name),
        units:    cur.units || 0,
        revenue:  +(cur.revenue || 0).toFixed(2),
        prevUnits: prev.units || 0,
        prevRevenue: +(prev.revenue || 0).toFixed(2),
      })
    }
    itemRows.sort((a, b) => b.revenue - a.revenue)

    const byCategory = {}
    for (const r of itemRows) {
      const c = byCategory[r.category] || (byCategory[r.category] = { category: r.category, units: 0, revenue: 0, prevRevenue: 0 })
      c.units += r.units
      c.revenue += r.revenue
      c.prevRevenue += r.prevRevenue
    }
    const categories = Object.values(byCategory)
      .map(c => ({ ...c, revenue: +c.revenue.toFixed(2), prevRevenue: +c.prevRevenue.toFixed(2) }))
      .sort((a, b) => b.revenue - a.revenue)

    const revenue     = +itemRows.reduce((s, r) => s + r.revenue, 0).toFixed(2)
    const prevRevenue = +itemRows.reduce((s, r) => s + r.prevRevenue, 0).toFixed(2)
    const unitsSold   = itemRows.reduce((s, r) => s + r.units, 0)

    // ── Purchases (POs placed or received within the month) ────────────────
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const startDate = start.slice(0, 10)
    const endDate   = end.slice(0, 10)
    const { data: docs } = await sb
      .from('bar_documents')
      .select('po_ref, supplier, order_date, receive_date, item_count, status')
      .gte('order_date', startDate)
      .lt('order_date', endDate)
      .order('order_date', { ascending: true })

    const orders = docs || []
    const ordersBySupplier = {}
    for (const d of orders) {
      const k = d.supplier || 'Unknown'
      ordersBySupplier[k] = (ordersBySupplier[k] || 0) + 1
    }

    // ── Wastage (valued at current buy price) ──────────────────────────────
    const log = (await kvGet('wastageLog').catch(() => null)) || []
    const startMs = new Date(start).getTime()
    const endMs   = new Date(end).getTime()
    const monthWaste = log.filter(e => e.date >= startMs && e.date < endMs)

    let wasteCost = 0
    let wasteUnvalued = 0
    const wasteByReason = {}
    const wasteRows = []
    for (const e of monthWaste) {
      const buy = Number(settings[e.itemName]?.buyPrice)
      const qty = Number(e.qty) || 0
      const cost = buy > 0 ? +(buy * qty).toFixed(2) : null
      if (cost === null) wasteUnvalued++
      else wasteCost += cost
      wasteByReason[e.reason] = +(((wasteByReason[e.reason] || 0) + (cost || 0))).toFixed(2)
      wasteRows.push({ name: e.itemName, category: e.category || '', qty, unit: e.unit || 'units', reason: e.reason, cost, date: e.date })
    }
    wasteRows.sort((a, b) => (b.cost || 0) - (a.cost || 0))

    // ── Markup (current pricing snapshot, not historical) ──────────────────
    //
    // The sell price for most items lives in SQUARE, not in itemSettings —
    // settings only hold a sell price when it's been manually overridden. So we
    // fetch live Square prices and fall back to any override.
    //
    // Units differ by category, so a naive (sell-buy)/buy is wrong:
    //   spirits    → buy per nip,    sell per nip     → (sell − buy) / buy
    //   wine glass → buy per bottle, sell per glass   → (sell × serves − buy) / buy
    //   wine btl   → buy per bottle, sell per bottle  → (sell − buy) / buy
    //   beer/other → buy per unit,   sell per unit    → (sell − buy) / buy
    // This mirrors the Pricing tab exactly.
    const WINE_CATS   = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']
    const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']

    const squareItems = await fetchSquareData(token, 90).catch(() => [])
    const markups = []
    let markupSkipped = 0

    for (const item of squareItems) {
      const s        = settings[item.name] || {}
      const category = s.category || defaultCategory(item.name)
      const isWine   = WINE_CATS.includes(category)
      const isSpirit = SPIRIT_CATS.includes(category)

      // buyPrice units by type:
      //   spirits → per NIP (the invoice bottle price is divided by nips/bottle
      //             before it's ever stored, so it's already per-nip here)
      //   others  → per bottle / per unit
      const buy = s.buyPrice !== '' && s.buyPrice != null ? Number(s.buyPrice) : null

      // Sell price must come from the matching Square VARIATION, not the
      // item's "primary" price — for a spirit the primary variation is often
      // the bottle, and comparing a ~$60 bottle against a ~$1.20 nip cost
      // yields a nonsense markup. This mirrors the Pricing tab exactly.
      const vars      = item.variations || []
      const glassVar  = vars.find(v => (v.name || '').toLowerCase().includes('glass'))
      const bottleVar = vars.find(v => { const n = (v.name || '').toLowerCase(); return n.includes('bottle') || n === 'regular' })
      const nipVar    = vars.find(v => { const n = (v.name || '').toLowerCase(); return n.includes('nip') || n.includes('30ml') || n.includes('60ml') })

      const forceBottle = category === 'Sparkling' || s.bottleOnly === true || s.bottleOnly === 'yes'
      const sellUnit = isSpirit ? 'nip'
                     : forceBottle ? 'bottle'
                     : isWine ? (s.sellUnit || 'glass')
                     : 'bottle'

      const pick = v => (v && v.price != null ? Number(v.price) : null)
      let sell
      if (isSpirit) {
        sell = pick(nipVar) ?? pick(bottleVar) ?? pick(glassVar)
              ?? (s.sellPrice !== '' && s.sellPrice != null ? Number(s.sellPrice) : null)
      } else if (isWine && sellUnit === 'bottle') {
        sell = pick(bottleVar) ?? (item.squareSellPriceBottle != null ? Number(item.squareSellPriceBottle) : null)
      } else {
        sell = pick(glassVar) ?? pick(bottleVar)
              ?? (item.squareSellPrice != null ? Number(item.squareSellPrice) : null)
      }

      if (!(buy > 0) || !(sell > 0)) { markupSkipped++; continue }

      // Unit-matched markup:
      //   spirits    → buy per nip,    sell per nip    → (sell − buy) / buy
      //   wine glass → buy per bottle, sell per glass  → (sell × serves − buy) / buy
      //   wine btl   → buy per bottle, sell per bottle → (sell − buy) / buy
      //   beer/other → same unit both sides            → (sell − buy) / buy
      let pct
      if (isSpirit) {
        pct = ((sell - buy) / buy) * 100
      } else if (isWine && sellUnit === 'glass') {
        // 165ml = Square's true glass portion (11/50 of a 750ml bottle,
        // includes the overpour buffer) → 4.545 glasses per bottle.
        const serves = Number(s.servesPerBottle) || (750 / 165)
        pct = ((sell * serves - buy) / buy) * 100
      } else {
        pct = ((sell - buy) / buy) * 100
      }
      markups.push({ name: item.name, category, pct, isSpirit })
    }

    // Spirits price at several hundred percent by nature (a ~$1.20 nip sells
    // for ~$6), so averaging them alongside beer/wine would badly distort the
    // headline figure. Report the two separately.
    const nonSpirit = markups.filter(m => !m.isSpirit).map(m => m.pct)
    const spiritOnly = markups.filter(m => m.isSpirit).map(m => m.pct)
    const avgOf = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null

    const avgMarkup       = avgOf(nonSpirit)
    const avgSpiritMarkup = avgOf(spiritOnly)

    const grossProfit = revenue > 0 ? +(revenue - wasteCost).toFixed(2) : 0

    return res.status(200).json({
      ok: true,
      period: {
        year, month, start, end,
        label: new Date(start).toLocaleDateString('en-AU', { timeZone: TZ, month: 'long', year: 'numeric' }),
        prevLabel: new Date(pStart).toLocaleDateString('en-AU', { timeZone: TZ, month: 'long', year: 'numeric' }),
      },
      sales: {
        revenue, prevRevenue, unitsSold,
        changePct: prevRevenue > 0 ? +(((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null,
        categories,
        topItems: itemRows.slice(0, 15),
        itemCount: itemRows.length,
      },
      purchases: {
        orderCount: orders.length,
        received: orders.filter(o => o.status === 'received').length,
        pending: orders.filter(o => o.status !== 'received').length,
        bySupplier: ordersBySupplier,
        orders,
      },
      wastage: {
        entryCount: monthWaste.length,
        totalCost: +wasteCost.toFixed(2),
        unvaluedEntries: wasteUnvalued,
        valuationBasis: 'Valued at each item\'s current buy price — wastage entries do not record the price paid at the time.',
        byReason: wasteByReason,
        entries: wasteRows,
      },
      pricing: {
        avgMarkupPct: avgMarkup,
        avgSpiritMarkupPct: avgSpiritMarkup,
        itemsPriced: nonSpirit.length,
        spiritsPriced: spiritOnly.length,
        itemsSkipped: markupSkipped,
      },
      summary: { revenue, wasteCost: +wasteCost.toFixed(2), grossProfit, unitsSold, orderCount: orders.length },
    })
  } catch (err) {
    console.error('[monthly-report]', err)
    return res.status(500).json({ error: err.message })
  }
}
