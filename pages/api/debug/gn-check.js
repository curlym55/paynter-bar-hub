import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'

export default async function handler(req, res) {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // 1. Invoice/purchase history for GN SuperCrisp over the last ~90 days
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: history, error: histErr } = await sb
      .from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, invoice_ref, invoice_date, qty_units, units_per_pack, unit_price_ex_gst')
      .ilike('item_name_hub', '%supercrisp%')
      .gte('invoice_date', since)
      .order('invoice_date', { ascending: true })

    // 2. Wastage log entries for the item
    const wastageLog = (await kvGet('wastageLog').catch(() => null)) || []
    const wastageMatches = wastageLog.filter(w =>
      (w.itemName || w.name || '').toLowerCase().includes('supercrisp')
    )

    // 3. Bar documents (PO records) mentioning ACW/relevant supplier in the window, for cross-reference
    const { data: docs, error: docsErr } = await sb
      .from('bar_documents')
      .select('po_ref, supplier, order_date, receive_date, item_count, status')
      .gte('order_date', since)
      .order('order_date', { ascending: true })

    return res.json({
      ok: true,
      invoiceHistory: history || [],
      invoiceError: histErr?.message || null,
      wastageEntries: wastageMatches,
      recentDocuments: docs || [],
      documentsError: docsErr?.message || null,
    })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}
