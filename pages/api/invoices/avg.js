import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { days = '90', supplier = 'all' } = req.query
  const daysInt = parseInt(days) || 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  let query = sb.from('buy_price_history')
    .select('item_name_hub, item_name_raw, supplier, unit_price_ex_gst, qty_units, invoice_date, invoice_ref')
    .gte('invoice_date', cutoffStr)
    .not('item_name_hub', 'is', null)

  if (supplier !== 'all') query = query.eq('supplier', supplier)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Weighted average per item
  const itemMap = {}
  for (const row of data) {
    const key = row.item_name_hub
    if (!itemMap[key]) itemMap[key] = { total_cost: 0, total_units: 0, invoices: new Set(), prices: [], supplier: row.supplier }
    const cost = row.unit_price_ex_gst * row.qty_units
    itemMap[key].total_cost += cost
    itemMap[key].total_units += row.qty_units
    itemMap[key].invoices.add(row.invoice_ref)
    itemMap[key].prices.push(row.unit_price_ex_gst)
  }

  const results = Object.entries(itemMap).map(([name, d]) => ({
    item_name: name,
    supplier: d.supplier,
    avg_unit_price_ex_gst: d.total_units > 0 ? Math.round(d.total_cost / d.total_units * 1000) / 1000 : null,
    invoice_count: d.invoices.size,
    min_price: Math.round(Math.min(...d.prices) * 1000) / 1000,
    max_price: Math.round(Math.max(...d.prices) * 1000) / 1000,
    total_units: d.total_units,
  })).sort((a, b) => a.item_name.localeCompare(b.item_name))

  return res.json({ items: results, period_days: daysInt, cutoff: cutoffStr })
}
