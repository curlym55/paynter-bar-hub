import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { invoice_ref, supplier, invoice_date, gst_included, items } = req.body
  if (!items?.length) return res.status(400).json({ error: 'items required' })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const rows = items.filter(i => i.include !== false).map(item => {
    const unitPrice = gst_included
      ? item.invoice_unit_price / item.units_per_pack / 1.10
      : item.invoice_unit_price / item.units_per_pack
    return {
      invoice_ref,
      supplier,
      invoice_date,
      item_name_raw: item.item_name_raw,
      item_name_hub: item.item_name_hub || item.item_name_raw,
      invoice_qty: item.invoice_qty,
      units_per_pack: item.units_per_pack,
      qty_units: Math.round(item.invoice_qty * item.units_per_pack),
      invoice_unit_price: item.invoice_unit_price,
      unit_price_ex_gst: Math.round(unitPrice * 10000) / 10000,
      gst_included: !!gst_included,
    }
  })

  const { error } = await sb.from('buy_price_history').insert(rows)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true, saved: rows.length })
}
