import { createClient } from '@supabase/supabase-js'
import { buildReceiveCsv } from '../../../lib/onedrive'

const supabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function uploadFile(sb, path, buffer, mime) {
  const { error } = await sb.storage.from('bar-documents').upload(path, buffer, { contentType: mime, upsert: true })
  if (error) throw new Error(error.message)
}

async function upsertDoc(sb, po_ref, updates) {
  const { data: existing } = await sb.from('bar_documents').select('id').eq('po_ref', po_ref).maybeSingle()
  if (existing) {
    const { error } = await sb.from('bar_documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('po_ref', po_ref)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await sb.from('bar_documents').insert({ po_ref, ...updates })
    if (error) throw new Error(error.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const sb = supabase()
  const { action, po_ref, supplier, order_date, receive_date, item_count, items, file_base64, file_name, file_mime } = req.body

  if (!po_ref) return res.status(400).json({ error: 'po_ref required' })

  try {
    if (action === 'order') {
      await upsertDoc(sb, po_ref, {
        supplier,
        order_date: order_date || new Date().toISOString().split('T')[0],
        status: 'ordered',
        item_count,
      })
    }

    else if (action === 'receive') {
      // Generate CSV receipt and upload
      let receive_report_path = null
      if (items?.length) {
        const csv = buildReceiveCsv({ reference: po_ref, receivedBy: 'Bar Manager', locationName: 'Paynter Bar', items })
        const buf = Buffer.from(csv, 'utf8')
        receive_report_path = `receipts/${po_ref.replace(/\s/g, '_')}-Receipt.csv`
        await uploadFile(sb, receive_report_path, buf, 'text/csv')
      }
      await upsertDoc(sb, po_ref, {
        supplier,
        receive_date: receive_date || new Date().toISOString().split('T')[0],
        status: 'received',
        item_count,
        ...(receive_report_path ? { receive_report_path } : {}),
      })
    }

    else if (action === 'invoice') {
      if (!file_base64 || !file_name) return res.status(400).json({ error: 'file required for invoice action' })
      const buffer = Buffer.from(file_base64, 'base64')
      const invoice_path = `invoices/${po_ref.replace(/\s/g, '_')}-Invoice.${file_name.split('.').pop()}`
      await uploadFile(sb, invoice_path, buffer, file_mime || 'application/octet-stream')
      await upsertDoc(sb, po_ref, { invoice_path, supplier })
    }

    return res.json({ ok: true })
  } catch (e) {
    console.error('[documents/save]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
