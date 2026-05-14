import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { days = '90', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 90, 365)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'public' } }
  )

  // Aggregate in Supabase SQL for speed
  let query = `
    SELECT
      item_name_hub,
      supplier,
      ROUND(SUM(unit_price_ex_gst * qty_units)::numeric / NULLIF(SUM(qty_units),0), 4) AS avg_unit_price_ex_gst,
      COUNT(DISTINCT invoice_ref) AS invoice_count,
      ROUND(MIN(unit_price_ex_gst)::numeric, 4) AS min_price,
      ROUND(MAX(unit_price_ex_gst)::numeric, 4) AS max_price,
      SUM(qty_units) AS total_units
    FROM buy_price_history
    WHERE invoice_date >= '${cutoffStr}'
      AND item_name_hub IS NOT NULL
  `
  if (supplier !== 'all') query += ` AND supplier = '${supplier.replace(/'/g, "''")}'`
  query += ` GROUP BY item_name_hub, supplier ORDER BY item_name_hub`

  const { data, error } = await sb.rpc('exec_sql', { sql: query }).catch(() => ({ data: null, error: { message: 'RPC not available' } }))

  // Fallback: direct query if RPC not available
  if (error || !data) {
    let q = sb.from('buy_price_history')
      .select('item_name_hub, supplier, unit_price_ex_gst, qty_units, invoice_ref')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    if (supplier !== 'all') q = q.eq('supplier', supplier)

    const { data: rows, error: err2 } = await q
    if (err2) return res.status(500).json({ error: err2.message })

    const map = {}
    for (const r of (rows || [])) {
      const k = r.item_name_hub
      if (!map[k]) map[k] = { tc: 0, tu: 0, inv: new Set(), prices: [], sup: r.supplier }
      map[k].tc += (r.unit_price_ex_gst || 0) * (r.qty_units || 1)
      map[k].tu += (r.qty_units || 1)
      map[k].inv.add(r.invoice_ref)
      map[k].prices.push(r.unit_price_ex_gst || 0)
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
  }

  const items = (data || []).map(r => ({ item_name: r.item_name_hub, supplier: r.supplier,
    avg_unit_price_ex_gst: r.avg_unit_price_ex_gst, invoice_count: Number(r.invoice_count),
    min_price: r.min_price, max_price: r.max_price, total_units: Number(r.total_units) }))

  return res.status(200).json({ items, period_days: daysInt, cutoff: cutoffStr })
}
