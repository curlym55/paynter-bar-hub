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

    // unit_price_ex_gst is the price PER BOTTLE/UNIT, ex GST, already correctly
    // divided by THAT invoice line's own units_per_pack at save time (see
    // pages/api/invoices/save.js) — it accounts for whatever pack size Haiku
    // actually read off that specific invoice (single bottle, 6-bottle case,
    // 24-carton, etc.), invoice by invoice. This used to be ignored in favour
    // of re-deriving a per-unit price from the raw invoice_unit_price divided
    // by the Hub's static, item-level "pack" setting — which has no way to
    // know that, say, a Port normally bought one bottle at a time was on THIS
    // invoice bought as a 6-bottle case. That mismatch inflated the average by
    // roughly the case size whenever an item's actual invoiced pack differed
    // from the Hub default (confirmed against real data: Galway Pipe Port
    // averaged ~6x its current buy price — exactly a 6-bottle case ratio).
    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, unit_price_ex_gst, qty_units, invoice_ref, invoice_date')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    if (error) return res.status(500).json({ error: error.message })

    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}

    // Aggregate — weighted average of unit_price_ex_gst (already per-bottle, ex GST)
    const map = {}
    for (const r of rows || []) {
      // Use hub name if properly matched, otherwise try to match raw name to Hub items
      let hubName = r.item_name_hub
      if (!hubName) continue
      // If hub name was never matched (equals raw), try to find the Hub item by exact match
      if (hubName === r.item_name_raw) {
        // Check if raw name exactly matches a Hub item name
        if (!settings[hubName]) continue  // no Hub item with this name — skip
        // Raw name matches a Hub item exactly — use it
      }
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      const unitExGst = Number(r.unit_price_ex_gst) || 0
      if (!unitExGst) continue
      if (!map[hubName]) map[hubName] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: normSup }
      const qty = Number(r.qty_units) || 1
      map[hubName].tc += unitExGst * qty
      map[hubName].tu += qty
      map[hubName].inv.add(r.invoice_ref)
      map[hubName].prices.push(unitExGst)
    }

    const items = Object.entries(map).map(([name, d]) => {
      // Weighted average per-bottle/unit price, EX GST — already correctly
      // normalized per invoice line at save time, so no further pack-size
      // division is needed or applied here.
      const avgUnitExGst = d.tu > 0 ? Math.round(d.tc / d.tu * 10000) / 10000 : null

      const hubItem  = settings[name] || {}
      const category = hubItem.category || defaultCategory(name)
      const isSpirit = ['Spirits', 'Fortified & Liqueurs'].includes(category)

      // Hub bottle/nip sizes — still needed to convert a per-bottle price to
      // a per-nip one for spirits/fortified. Unrelated to the pack-size bug
      // above; these describe the bottle itself, not how many came per case.
      const bottleML     = hubItem.bottleML ? Number(hubItem.bottleML) : (isSpirit ? 700 : null)
      const nipML        = hubItem.nipML    ? Number(hubItem.nipML)    : (isSpirit ? 30  : null)
      const nipsPerBottle = (isSpirit && bottleML && nipML && nipML > 0)
        ? Math.round(bottleML / nipML * 10) / 10 : null

      // Convert a per-bottle ex-GST price → per sellable unit inc GST:
      // divide by nips-per-bottle for spirits, then add GST back.
      const toIncGst = (exGst) => exGst != null
        ? Math.round((nipsPerBottle ? exGst / nipsPerBottle : exGst) * 1.10 * 1000) / 1000
        : null

      const buyPriceIncGst = toIncGst(avgUnitExGst)
      const minInv = d.prices.length ? Math.min(...d.prices) : null
      const maxInv = d.prices.length ? Math.max(...d.prices) : null

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
