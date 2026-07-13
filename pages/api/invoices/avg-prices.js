import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'

// Normalize supplier names to match Hub suppliers
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

  const { days = '90', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 180, 730)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, unit_price_ex_gst, qty_units, invoice_ref, invoice_date')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    if (error) return res.status(500).json({ error: error.message })

    // Load Hub item settings — these have pack, bottleML, nipML, category, buyPrice
    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}

    // Aggregate — only properly matched rows (item_name_hub differs from item_name_raw)
    const map = {}
    for (const r of rows || []) {
      const hubName = r.item_name_hub
      if (!hubName || hubName === r.item_name_raw) continue
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      if (!map[hubName]) map[hubName] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: normSup }
      const qty   = Number(r.qty_units)        || 1
      const price = Number(r.unit_price_ex_gst) || 0
      map[hubName].tc += price * qty
      map[hubName].tu += qty
      map[hubName].inv.add(r.invoice_ref)
      map[hubName].prices.push(price)
    }

    const items = Object.entries(map).map(([name, d]) => {
      // unit_price_ex_gst in the DB is already per single unit (bottle for wine/beer, nip for spirits)
      // because save.js divides invoice_unit_price by units_per_pack
      // So avg is simply the weighted average of those per-unit ex-GST prices
      const avgExGst = d.tu > 0 ? Math.round(d.tc / d.tu * 10000) / 10000 : null

      // Use exactly what's in stock items settings — no defaults, no guessing
      const hubItem      = settings[name] || {}
      const isSpirit     = ['Spirits', 'Fortified & Liqueurs'].includes(hubItem.category)
      const bottleML     = hubItem.bottleML ? Number(hubItem.bottleML) : null
      const nipML        = hubItem.nipML    ? Number(hubItem.nipML)    : null
      const nipsPerBottle = (isSpirit && bottleML && nipML && nipML > 0)
        ? Math.round(bottleML / nipML * 10) / 10
        : null

      // Convert avg ex-GST per unit → inc-GST per sellable unit
      // For spirits: unit_price_ex_gst in DB is per BOTTLE → divide by nips
      // For everything else: unit_price_ex_gst is per bottle/can/unit already
      const buyPriceIncGst = avgExGst != null
        ? Math.round((nipsPerBottle ? avgExGst / nipsPerBottle : avgExGst) * 1.10 * 1000) / 1000
        : null

      const minExGst = d.prices.length ? Math.min(...d.prices) : null
      const maxExGst = d.prices.length ? Math.max(...d.prices) : null
      const minBuyIncGst = minExGst != null
        ? Math.round((nipsPerBottle ? minExGst / nipsPerBottle : minExGst) * 1.10 * 1000) / 1000
        : null
      const maxBuyIncGst = maxExGst != null
        ? Math.round((nipsPerBottle ? maxExGst / nipsPerBottle : maxExGst) * 1.10 * 1000) / 1000
        : null

      return {
        item_name:            name,
        matched_hub_key:      name,
        supplier:             d.sup,
        avg_unit_price_ex_gst: avgExGst,        // ex-GST per bottle/unit (kept for compat)
        buy_price_inc_gst:    buyPriceIncGst,    // inc-GST per sellable unit — use this
        min_price_inc_gst:    minBuyIncGst,
        max_price_inc_gst:    maxBuyIncGst,
        invoice_count:        d.inv.size,
        total_units:          d.tu,
        current_buy_price:    hubItem.buyPrice != null ? Number(hubItem.buyPrice) : null,
        is_spirit:            isSpirit,
        nips_per_bottle:      nipsPerBottle,
        unit_label:           nipsPerBottle
          ? `per nip (${nipML}ml, ${nipsPerBottle}/btl)`
          : 'per unit',
      }
    }).sort((a, b) => a.item_name.localeCompare(b.item_name))

    const dbSuppliers = [...new Set((rows || []).map(r => normalizeSupplier(r.supplier)).filter(Boolean))].sort()
    return res.status(200).json({ items, period_days: daysInt, cutoff: cutoffStr, db_suppliers: dbSuppliers })
  } catch (e) {
    console.error('[avg-prices]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
