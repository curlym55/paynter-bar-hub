import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { days = '180', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 180, 730)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    let q = sb.from('buy_price_history')
      .select('item_name_hub, supplier, unit_price_ex_gst, qty_units, invoice_ref, invoice_date')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    const { data: rows, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    const [rawSettings] = await Promise.all([
      kvGet('itemSettings').catch(() => null).then(v => v || sbConfigGet('itemSettings').catch(() => null))
    ])
    const settings = rawSettings || {}
    const settingsNorm = {}
    for (const [k, v] of Object.entries(settings)) {
      settingsNorm[norm(k)] = { originalKey: k, ...v }
    }

    // Aggregate — filter by normalised supplier if needed
    const map = {}
    for (const r of rows || []) {
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      const k = r.item_name_hub
      if (!map[k]) map[k] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: normSup }
      const qty = Number(r.qty_units) || 1
      const price = Number(r.unit_price_ex_gst) || 0
      map[k].tc += price * qty
      map[k].tu += qty
      map[k].inv.add(r.invoice_ref)
      map[k].prices.push(price)
    }

    const items = Object.entries(map).map(([name, d]) => {
      const avg = d.tu > 0 ? Math.round(d.tc / d.tu * 10000) / 10000 : null
      const exactMatch = settings[name]
      const fuzzyMatch = !exactMatch ? settingsNorm[norm(name)] : null
      const matched = exactMatch || fuzzyMatch
      const currentBuy = matched?.buyPrice != null ? Number(matched.buyPrice) : null

      // For spirits: convert per-bottle invoice price to per-nip
      const bottleML = matched?.bottleML ? Number(matched.bottleML) : null
      const nipML = matched?.nipML ? Number(matched.nipML) : null
      const isSpirit = matched?.isSpirit || (bottleML && nipML)
      const nipsPerBottle = (bottleML && nipML && nipML > 0) ? bottleML / nipML : null
      const avgPerNip = (nipsPerBottle && avg) ? Math.round(avg / nipsPerBottle * 10000) / 10000 : null
      const minPerNip = (nipsPerBottle) ? Math.round(Math.min(...d.prices) / nipsPerBottle * 10000) / 10000 : null
      const maxPerNip = (nipsPerBottle) ? Math.round(Math.max(...d.prices) / nipsPerBottle * 10000) / 10000 : null

      return {
        item_name: name,
        supplier: d.sup,
        avg_unit_price_ex_gst: avgPerNip ?? avg,
        invoice_count: d.inv.size,
        min_price: minPerNip ?? Math.round(Math.min(...d.prices) * 10000) / 10000,
        max_price: maxPerNip ?? Math.round(Math.max(...d.prices) * 10000) / 10000,
        total_units: d.tu,
        current_buy_price: currentBuy,
        matched_hub_key: exactMatch ? name : fuzzyMatch?.originalKey || null,
        is_spirit: !!nipsPerBottle,
        nips_per_bottle: nipsPerBottle,
        unit_label: nipsPerBottle ? `per nip (${nipML}ml, ${Math.round(nipsPerBottle*10)/10}/btl)` : 'per unit',
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
