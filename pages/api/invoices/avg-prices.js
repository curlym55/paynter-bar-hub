import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { days = '90', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 90, 365)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    let q = sb
      .from('buy_price_history')
      .select('item_name_hub, supplier, unit_price_ex_gst, qty_units, invoice_ref')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    if (supplier !== 'all') q = q.eq('supplier', supplier)

    const { data: rows, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    // Aggregate in JS
    const map = {}
    for (const r of rows || []) {
      const k = r.item_name_hub
      if (!map[k]) map[k] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: r.supplier }
      const qty = Number(r.qty_units) || 1
      const price = Number(r.unit_price_ex_gst) || 0
      map[k].tc += price * qty
      map[k].tu += qty
      map[k].inv.add(r.invoice_ref)
      map[k].prices.push(price)
    }

    const items = Object.entries(map).map(([name, d]) => ({
      item_name: name,
      supplier: d.sup,
      avg_unit_price_ex_gst: d.tu > 0 ? Math.round(d.tc / d.tu * 10000) / 10000 : null,
      invoice_count: d.inv.size,
      min_price: Math.round(Math.min(...d.prices) * 10000) / 10000,
      max_price: Math.round(Math.max(...d.prices) * 10000) / 10000,
      total_units: d.tu,
    })).sort((a, b) => a.item_name.localeCompare(b.item_name))

    return res.status(200).json({ items, period_days: daysInt, cutoff: cutoffStr })
  } catch (e) {
    console.error('[avg-prices]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
