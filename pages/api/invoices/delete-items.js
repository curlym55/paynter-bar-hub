/**
 * pages/api/invoices/delete-items.js
 *
 * Deletes all buy_price_history rows for the given raw invoice item names.
 * Body: { raw_names: string[] }
 */
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  // Deletes invoice line items. Management access only.
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const { raw_names } = req.body ?? {}
  if (!Array.isArray(raw_names) || raw_names.length === 0) {
    return res.status(400).json({ error: 'raw_names array required' })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { error, count } = await sb
      .from('buy_price_history')
      .delete({ count: 'exact' })
      .in('item_name_raw', raw_names)

    if (error) throw new Error(error.message)

    return res.status(200).json({ ok: true, deleted: raw_names.length, rows: count })
  } catch (err) {
    console.error('[delete-items]', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
