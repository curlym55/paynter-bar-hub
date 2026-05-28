/**
 * pages/api/invoices/delete-items.js
 *
 * Deletes invoice item name records (and their price history) from the DB.
 * Body: { raw_names: string[] }
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const { raw_names } = req.body ?? {}
  if (!Array.isArray(raw_names) || raw_names.length === 0) {
    return res.status(400).json({ error: 'raw_names array required' })
  }

  try {
    // Delete price history rows for these item names
    const { error: histErr } = await supabase
      .from('buy_price_history')
      .delete()
      .in('item_name_raw', raw_names)
    if (histErr) throw histErr

    // Delete the item name mapping records
    const { error: mapErr } = await supabase
      .from('invoice_item_names')
      .delete()
      .in('item_name_raw', raw_names)
    if (mapErr) throw mapErr

    return res.status(200).json({ ok: true, deleted: raw_names.length })
  } catch (err) {
    console.error('[delete-items]', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
