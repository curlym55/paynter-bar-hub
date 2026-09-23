import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'
import { defaultCategory } from '../../../lib/calculations'

function normalizeSupplier(s) {
  const l = (s || '').toLowerCase()
  if (l.includes('dan murphy')) return "Dan Murphy's"
  if (l.includes('acw') || l.includes('sunshine') || l.includes('confectionery')) return 'ACW'
  if (l.includes('coles') || l.includes('woolies') || l.includes('woolworths')) return 'Coles Woolies'
  return s
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { supplier = 'all' } = req.query

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Deliberately simplified: the MOST RECENT invoice per item, not a
    // weighted average across the whole year. Averaging blended together
    // invoices with inconsistent AI-extracted pack sizes (a bottle sometimes
    // recorded as a whole case, or vice versa) — and the automatic
    // "correction" that tried to fix that kept going wrong in new ways every
    // time. A single recent price is something a person can actually verify
    // by opening that one invoice, which fits how this report is used: a
    // periodic manual sanity check (see the Help tab), not something the app
    // relies on for pricing decisions. No pack-size guessing happens here at
    // all — the price is taken at face value from that one invoice line,
    // and only flagged (not corrected) if it looks implausible.
    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, invoice_unit_price, units_per_pack, gst_included, invoice_ref, invoice_date')
      .not('item_name_hub', 'is', null)
      .order('invoice_date', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}

    // Rows are newest-first, so the first row seen for an item is its most
    // recent invoice — everything else for that item is simply skipped.
    const latestByItem = {}
    for (const r of rows || []) {
      const hubName = r.item_name_hub
      if (!hubName) continue
      if (hubName === r.item_name_raw && !settings[hubName]) continue
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      if (latestByItem[hubName]) continue
      const rawPrice = Number(r.invoice_unit_price) || 0
      if (!rawPrice) continue
      latestByItem[hubName] = { ...r, normSup, rawPrice }
    }

    const items = Object.entries(latestByItem).map(([name, r]) => {
      const hubItem  = settings[name] || {}
      const category = hubItem.category || defaultCategory(name)
      const isSpirit = ['Spirits', 'Fortified & Liqueurs'].includes(category)

      const bottleML = hubItem.bottleML ? Number(hubItem.bottleML) : (isSpirit ? 700 : null)
      const nipML    = hubItem.nipML    ? Number(hubItem.nipML)    : (isSpirit ? 30  : null)
      const nipsPerBottle = (isSpirit && bottleML && nipML && nipML > 0)
        ? Math.round(bottleML / nipML * 10) / 10 : null

      // Taken at face value from this one invoice's own recorded pack size —
      // no cross-checking against other invoices, no category-based guessing.
      const pack = Number(r.units_per_pack) || 1
      const exGst = r.gst_included ? r.rawPrice / 1.10 : r.rawPrice
      const perUnitExGst = exGst / pack
      const latestBuyIncGst = Math.round(
        (nipsPerBottle ? perUnitExGst / nipsPerBottle : perUnitExGst) * 1.10 * 1000
      ) / 1000

      const currentBuy = hubItem.buyPrice != null ? Number(hubItem.buyPrice) : null

      // Flag, don't fix. A wildly different price could be a genuine change,
      // or it could be one invoice's pack size read wrong by the AI extractor
      // — either way, a human glancing at that one invoice is more reliable
      // than the app silently guessing a "corrected" number.
      let plausible = true
      if (currentBuy != null && currentBuy > 0 && latestBuyIncGst != null) {
        const ratio = latestBuyIncGst / currentBuy
        plausible = ratio >= 0.6 && ratio <= 1.6
      }

      const daysAgo = Math.floor((Date.now() - new Date(r.invoice_date).getTime()) / 86400000)

      return {
        item_name:          name,
        category,
        supplier:           r.normSup,
        latest_buy_inc_gst: latestBuyIncGst,
        current_buy_price:  currentBuy,
        invoice_date:       r.invoice_date,
        days_ago:           daysAgo,
        invoice_ref:        r.invoice_ref,
        plausible,
        is_spirit:          isSpirit,
        nips_per_bottle:    nipsPerBottle,
        unit_label:         nipsPerBottle
          ? `per nip (${nipML}ml, ${nipsPerBottle}/btl)`
          : 'per unit',
      }
    }).sort((a, b) => a.item_name.localeCompare(b.item_name))

    const dbSuppliers = [...new Set((rows || []).map(r => normalizeSupplier(r.supplier)).filter(Boolean))].sort()
    return res.status(200).json({ items, db_suppliers: dbSuppliers })
  } catch (e) {
    console.error('[avg-prices]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
