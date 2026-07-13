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

  const { days = '90', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 90, 730)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Fetch invoice_unit_price and gst_included so we can recompute per-unit price
    // using Hub pack sizes rather than whatever Haiku extracted as units_per_pack
    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, invoice_unit_price, gst_included, qty_units, invoice_ref, invoice_date')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    if (error) return res.status(500).json({ error: error.message })

    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}

    // Aggregate — weighted average of invoice_unit_price (before any pack division)
    const map = {}
    for (const r of rows || []) {
      const hubName = r.item_name_hub
      if (!hubName || hubName === r.item_name_raw) continue
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      const invPrice = Number(r.invoice_unit_price) || 0
      if (!invPrice) continue
      if (!map[hubName]) map[hubName] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: normSup, gst: !!r.gst_included }
      const qty = Number(r.qty_units) || 1
      map[hubName].tc += invPrice * qty
      map[hubName].tu += qty
      map[hubName].inv.add(r.invoice_ref)
      map[hubName].prices.push(invPrice)
      map[hubName].gst = !!r.gst_included  // use last row's GST flag (consistent per supplier)
    }

    const items = Object.entries(map).map(([name, d]) => {
      // avg invoice price — this is the price per line item as it appears on the invoice
      // (could be per case, per bottle, per pack — depends on how supplier invoices)
      const avgInvoicePrice = d.tu > 0 ? Math.round(d.tc / d.tu * 10000) / 10000 : null

      const hubItem  = settings[name] || {}
      const category = hubItem.category || defaultCategory(name)
      const isSpirit = ['Spirits', 'Fortified & Liqueurs'].includes(category)

      // Hub pack sizes — the authoritative source
      const bottleML     = hubItem.bottleML ? Number(hubItem.bottleML) : (isSpirit ? 700 : null)
      const nipML        = hubItem.nipML    ? Number(hubItem.nipML)    : (isSpirit ? 30  : null)
      const nipsPerBottle = (isSpirit && bottleML && nipML && nipML > 0)
        ? Math.round(bottleML / nipML * 10) / 10 : null
      const hubPack = hubItem.pack ? Number(hubItem.pack) : 1

      // Convert avg invoice price → per sellable unit inc GST
      // Step 1: divide by hub pack to get per-bottle/can price ex GST
      // Step 2: for spirits, further divide by nips per bottle
      // Step 3: add GST if not already included
      const perBottleExGst = avgInvoicePrice != null
        ? (d.gst ? avgInvoicePrice / hubPack / 1.10 : avgInvoicePrice / hubPack)
        : null

      const buyPriceIncGst = perBottleExGst != null
        ? Math.round((nipsPerBottle ? perBottleExGst / nipsPerBottle : perBottleExGst) * 1.10 * 1000) / 1000
        : null

      const minInv = d.prices.length ? Math.min(...d.prices) : null
      const maxInv = d.prices.length ? Math.max(...d.prices) : null
      const toIncGst = (p) => p != null
        ? Math.round((nipsPerBottle
            ? (d.gst ? p / hubPack / 1.10 : p / hubPack) / nipsPerBottle
            : (d.gst ? p / hubPack / 1.10 : p / hubPack)) * 1.10 * 1000) / 1000
        : null

      return {
        item_name:         name,
        matched_hub_key:   name,
        category,
        supplier:          d.sup,
        buy_price_inc_gst: buyPriceIncGst,
        min_price_inc_gst: toIncGst(minInv),
        max_price_inc_gst: toIncGst(maxInv),
        invoice_count:     d.inv.size,
        total_units:       d.tu,
        current_buy_price: hubItem.buyPrice != null ? Number(hubItem.buyPrice) : null,
        is_spirit:         isSpirit,
        nips_per_bottle:   nipsPerBottle,
        unit_label:        nipsPerBottle
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
