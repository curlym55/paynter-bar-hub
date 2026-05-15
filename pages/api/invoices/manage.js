import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (req.method === 'GET') {
    // Return distinct items grouped by item_name_raw
    const { data, error } = await sb
      .from('buy_price_history')
      .select('item_name_raw, item_name_hub, units_per_pack, invoice_unit_price, unit_price_ex_gst, gst_included, supplier, invoice_date')
      .order('item_name_hub')

    if (error) return res.status(500).json({ error: error.message })

    // Group by item_name_raw — pick most recent values
    const map = {}
    for (const r of data || []) {
      if (!map[r.item_name_raw] || r.invoice_date > map[r.item_name_raw].invoice_date) {
        map[r.item_name_raw] = r
        map[r.item_name_raw].count = (map[r.item_name_raw]?.count || 0) + 1
      }
    }
    // Fix count
    for (const r of data || []) {
      if (map[r.item_name_raw]) map[r.item_name_raw].count = (map[r.item_name_raw].count || 1)
    }
    const counts = {}
    for (const r of data || []) counts[r.item_name_raw] = (counts[r.item_name_raw] || 0) + 1

    const items = Object.values(map).map(r => ({ ...r, count: counts[r.item_name_raw] || 1 }))
      .sort((a, b) => (a.item_name_hub || a.item_name_raw).localeCompare(b.item_name_hub || b.item_name_raw))

    return res.json({ items })
  }

  if (req.method === 'PATCH') {
    // Update all rows matching item_name_raw
    const { item_name_raw, item_name_hub, units_per_pack } = req.body
    if (!item_name_raw || !units_per_pack) return res.status(400).json({ error: 'item_name_raw and units_per_pack required' })

    // Fetch rows to recalculate
    const { data: rows, error: fetchErr } = await sb
      .from('buy_price_history')
      .select('id, invoice_unit_price, gst_included')
      .eq('item_name_raw', item_name_raw)

    if (fetchErr) return res.status(500).json({ error: fetchErr.message })

    // Update each row with recalculated unit_price_ex_gst
    const updates = (rows || []).map(r => ({
      id: r.id,
      item_name_hub,
      units_per_pack,
      unit_price_ex_gst: Math.round((r.invoice_unit_price / units_per_pack / (r.gst_included ? 1.10 : 1.0)) * 10000) / 10000,
    }))

    for (const u of updates) {
      const { error } = await sb.from('buy_price_history').update({
        item_name_hub: u.item_name_hub,
        units_per_pack: u.units_per_pack,
        unit_price_ex_gst: u.unit_price_ex_gst,
      }).eq('id', u.id)
      if (error) return res.status(500).json({ error: error.message })
    }

    return res.json({ ok: true, updated: updates.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
