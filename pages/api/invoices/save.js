import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { invoice_ref, supplier, invoice_date, gst_included, items } = req.body

  // Diagnostics
  console.log('[save] received:', {
    invoice_ref, supplier, invoice_date, gst_included,
    items_count: items?.length,
    items_include_count: items?.filter(i => i.include !== false).length,
    first_item: items?.[0],
  })

  if (!items?.length) {
    return res.status(400).json({ error: `No items received. invoice_ref=${invoice_ref}` })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const rows = items.filter(i => i.include !== false).map(item => {
    const invPrice = Number(item.invoice_unit_price) || 0
    const units = Number(item.units_per_pack) || 1
    const unitPrice = gst_included ? invPrice / units / 1.10 : invPrice / units
    return {
      invoice_ref: String(invoice_ref),
      supplier: String(supplier),
      invoice_date: String(invoice_date),
      item_name_raw: String(item.item_name_raw || ''),
      item_name_hub: String(item.item_name_hub || item.item_name_raw || ''),
      invoice_qty: Number(item.invoice_qty) || 1,
      units_per_pack: units,
      qty_units: Math.round((Number(item.invoice_qty) || 1) * units),
      invoice_unit_price: invPrice,
      unit_price_ex_gst: Math.round(unitPrice * 10000) / 10000,
      gst_included: !!gst_included,
    }
  })

  console.log('[save] rows to insert:', rows.length, rows[0])

  if (!rows.length) {
    return res.status(400).json({ error: 'All items were excluded (include=false)' })
  }

  const { data, error } = await sb.from('buy_price_history').insert(rows).select('id')

  if (error) {
    console.error('[save] Supabase error:', error)
    return res.status(500).json({ error: error.message, detail: error.details })
  }

  console.log('[save] inserted:', data?.length)
  return res.json({ ok: true, saved: data?.length ?? rows.length })
}
