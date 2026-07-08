import { createClient } from '@supabase/supabase-js'
import { buildReceiveCsv } from '../../../lib/onedrive'
import { requireAuth } from '../../../lib/session'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function uploadFile(client, path, buffer, mime) {
  const { error } = await client.storage.from('bar-documents').upload(path, buffer, { contentType: mime, upsert: true })
  if (error) throw new Error(error.message)
}

async function upsertDoc(client, po_ref, updates) {
  // Match on the specific row's id once found, not po_ref again — this way,
  // even if po_ref somehow isn't unique (e.g. legacy data from before refs
  // were always generated uniquely), an update can only ever touch the ONE
  // row it originally matched rather than every row sharing that po_ref.
  const { data: existing } = await client.from('bar_documents').select('id').eq('po_ref', po_ref).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existing) {
    const { error } = await client.from('bar_documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await client.from('bar_documents').insert({ po_ref, ...updates })
    if (error) throw new Error(error.message)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return
  const client = sb()
  const { action, po_ref, supplier, order_date, receive_date, item_count, items,
          file_base64, file_name, file_mime,
          po_onedrive_url, receipt_onedrive_url, invoice_onedrive_url } = req.body

  if (!po_ref) return res.status(400).json({ error: 'po_ref required' })

  try {
    if (action === 'order') {
      await upsertDoc(client, po_ref, {
        supplier,
        order_date: order_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }),
        status: 'ordered',
        item_count,
        ...(po_onedrive_url ? { po_onedrive_url } : {}),
      })
    }

    else if (action === 'receive') {
      let receive_report_path = null
      if (items?.length) {
        const csv = buildReceiveCsv({ reference: po_ref, receivedBy: 'Bar Manager', locationName: 'Paynter Bar', items })
        const buf = Buffer.from(csv, 'utf8')
        receive_report_path = `receipts/${po_ref.replace(/\s/g, '_')}-Receipt.csv`
        await uploadFile(client, receive_report_path, buf, 'text/csv')
      }
      await upsertDoc(client, po_ref, {
        supplier,
        receive_date: receive_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }),
        status: 'received',
        item_count,
        ...(receive_report_path ? { receive_report_path } : {}),
        ...(receipt_onedrive_url ? { receipt_onedrive_url } : {}),
      })
    }

    else if (action === 'invoice') {
      if (!file_base64 || !file_name) return res.status(400).json({ error: 'file required for invoice action' })
      const buffer = Buffer.from(file_base64, 'base64')
      const invoice_path = `invoices/${po_ref.replace(/\s/g, '_')}-Invoice.${file_name.split('.').pop()}`
      await uploadFile(client, invoice_path, buffer, file_mime || 'application/octet-stream')
      await upsertDoc(client, po_ref, {
        invoice_path,
        supplier,
        ...(invoice_onedrive_url ? { invoice_onedrive_url } : {}),
      })
    }

    else if (action === 'update_urls') {
      // Just update OneDrive URLs without touching files
      const urlUpdates = {}
      if (po_onedrive_url) urlUpdates.po_onedrive_url = po_onedrive_url
      if (receipt_onedrive_url) urlUpdates.receipt_onedrive_url = receipt_onedrive_url
      if (invoice_onedrive_url) urlUpdates.invoice_onedrive_url = invoice_onedrive_url
      if (Object.keys(urlUpdates).length) await upsertDoc(client, po_ref, urlUpdates)
    }
    else if (action === 'clear_invoice') {
      // Remove invoice links (file on OneDrive/Supabase storage is NOT deleted)
      await upsertDoc(client, po_ref, { invoice_path: null, invoice_onedrive_url: null })
    }

    return res.json({ ok: true })
  } catch (e) {
    console.error('[documents/save]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
