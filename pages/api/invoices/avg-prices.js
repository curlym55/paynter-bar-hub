import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'

const norm = s => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')

// Normalize supplier names to match Hub suppliers
function normalizeSupplier(s) {
  const l = (s || '').toLowerCase()
  if (l.includes('dan murphy')) return "Dan Murphy's"
  if (l.includes('acw') || l.includes('sunshine') || l.includes('confectionery')) return 'ACW'
  if (l.includes('coles') || l.includes('woolies') || l.includes('woolworths')) return 'Coles Woolies'
  return s
}

export default async function handler(req, res) {
  // Average buy prices. Requires a valid session — no anonymous access.
  if (!requireAuth(req, res)) return

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { days = '90', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 180, 730)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    let q = sb.from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, unit_price_ex_gst, qty_units, units_per_pack, invoice_unit_price, gst_included, invoice_ref, invoice_date')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    const { data: rows, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    const settings = await kvGet('itemSettings').catch(() => null) || await sbConfigGet('itemSettings').catch(() => null) || {}
    // Aggregate — only rows with item_name_hub set (properly matched)
    const map = {}
    for (const r of rows || []) {
      const hubName = r.item_name_hub
      if (!hubName || hubName === r.item_name_raw) continue  // skip unmatched rows
      // Sanity-check units_per_pack against category default — catch pack-price errors
      // e.g. beer stored at $45/unit when it should be $1.87/unit (units_per_pack was 1 instead of 24)
      const DEFAULT_PACK = { Beer:24, Cider:24, PreMix:24, 'White Wine':6, 'Red Wine':6, Rose:6, Sparkling:6, Spirits:1, 'Fortified & Liqueurs':1, 'Soft Drinks':24, Snacks:18 }
      const hubCat = (settings[hubName]?.category) || ''
      const expectedPack = DEFAULT_PACK[hubCat] || 1
      const storedPack = Number(r.units_per_pack) || 1
      let unitPriceExGst = Number(r.unit_price_ex_gst) || 0
      // If stored pack is 1 but we'd expect >1 AND the invoice_unit_price suggests a full pack price,
      // recompute using the expected pack size
      if (storedPack === 1 && expectedPack > 1 && r.invoice_unit_price && unitPriceExGst > 0) {
        const recomputed = (r.gst_included ? r.invoice_unit_price / expectedPack / 1.10 : r.invoice_unit_price / expectedPack)
        // Only correct if recomputed is plausibly smaller (i.e. the stored price looks like a pack price)
        if (recomputed < unitPriceExGst * 0.6) unitPriceExGst = Math.round(recomputed * 10000) / 10000
      }
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      if (!map[hubName]) map[hubName] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: normSup }
      const qty = Number(r.qty_units) || 1
      map[hubName].tc += unitPriceExGst * qty
      map[hubName].tu += qty
      map[hubName].inv.add(r.invoice_ref)
      map[hubName].prices.push(unitPriceExGst)
    }

    const items = Object.entries(map).map(([name, d]) => {
      // avg_unit_price_ex_gst is always per-bottle (ex GST) as stored in buy_price_history
      const avgExGstPerBottle = d.tu > 0 ? Math.round(d.tc / d.tu * 10000) / 10000 : null

      // Use Hub item settings as the authoritative source for spirit conversion
      // isSpirit is not stored in itemSettings — derive from category (same as calculations.js)
      const hubItem = settings[name]
      const SPIRIT_CATS = new Set(['Spirits', 'Fortified & Liqueurs'])
      const isSpirit = SPIRIT_CATS.has(hubItem?.category)
      // bottleML/nipML default to 700/30 if not explicitly set (same as calculations.js)
      const bottleML = hubItem?.bottleML ? Number(hubItem.bottleML) : (isSpirit ? 700 : null)
      const nipML    = hubItem?.nipML    ? Number(hubItem.nipML)    : (isSpirit ? 30  : null)
      const nipsPerBottle = (isSpirit && bottleML && nipML && nipML > 0) ? bottleML / nipML : null

      // Convert to inc-GST per sellable unit once — this is what buyPrice should be
      // Spirits: per nip inc GST. Everything else: per bottle/unit inc GST.
      const buyPriceIncGst = avgExGstPerBottle != null
        ? Math.round((nipsPerBottle ? avgExGstPerBottle / nipsPerBottle : avgExGstPerBottle) * 1.10 * 1000) / 1000
        : null

      const minBuyIncGst = d.prices.length
        ? Math.round((nipsPerBottle ? Math.min(...d.prices) / nipsPerBottle : Math.min(...d.prices)) * 1.10 * 1000) / 1000
        : null
      const maxBuyIncGst = d.prices.length
        ? Math.round((nipsPerBottle ? Math.max(...d.prices) / nipsPerBottle : Math.max(...d.prices)) * 1.10 * 1000) / 1000
        : null

      const currentBuy = hubItem?.buyPrice != null ? Number(hubItem.buyPrice) : null

      return {
        item_name:           name,          // always the Hub name (matched_hub_key = item_name)
        matched_hub_key:     name,
        supplier:            d.sup,
        avg_unit_price_ex_gst: avgExGstPerBottle,  // kept for backward compat — ex GST per bottle
        buy_price_inc_gst:   buyPriceIncGst,        // NEW: inc GST per sellable unit — use this
        min_price_inc_gst:   minBuyIncGst,
        max_price_inc_gst:   maxBuyIncGst,
        invoice_count:       d.inv.size,
        total_units:         d.tu,
        current_buy_price:   currentBuy,
        is_spirit:           isSpirit,
        nips_per_bottle:     nipsPerBottle,
        unit_label:          nipsPerBottle ? `per nip (${nipML}ml, ${Math.round(nipsPerBottle*10)/10}/btl)` : 'per unit',
      }
    }).sort((a, b) => a.item_name.localeCompare(b.item_name))

    // Distinct normalised suppliers for filter dropdown
    const dbSuppliers = [...new Set((rows || []).map(r => normalizeSupplier(r.supplier)).filter(Boolean))].sort()

    return res.status(200).json({ items, period_days: daysInt, cutoff: cutoffStr, db_suppliers: dbSuppliers })
  } catch (e) {
    console.error('[avg-prices]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
