import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../lib/session'
import { deleteFileByShareUrl } from '../../../lib/onedrive'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  const { id } = req.body
  if (!id) return res.status(400).json({ error: 'id required' })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Fetch the full row first -- the client only ever sends { id }, so the
  // actual file paths/URLs to clean up have to come from the stored record
  // itself, not the request body.
  const { data: doc, error: fetchErr } = await sb
    .from('bar_documents')
    .select('receive_report_path, invoice_path, po_onedrive_url, receipt_onedrive_url, invoice_onedrive_url')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) return res.status(500).json({ error: fetchErr.message })

  // Supabase Storage files
  if (doc) {
    const filesToDelete = [doc.receive_report_path, doc.invoice_path].filter(Boolean)
    if (filesToDelete.length) {
      await sb.storage.from('bar-documents').remove(filesToDelete).catch(() => null)
    }

    // OneDrive files -- best-effort per file, never blocks the record deletion below.
    const oneDriveUrls = [doc.po_onedrive_url, doc.receipt_onedrive_url, doc.invoice_onedrive_url].filter(Boolean)
    for (const url of oneDriveUrls) {
      try {
        await deleteFileByShareUrl(url)
      } catch (e) {
        console.warn('[documents/delete] could not remove OneDrive file:', e.message)
      }
    }
  }

  // Delete the record
  const { error } = await sb.from('bar_documents').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}