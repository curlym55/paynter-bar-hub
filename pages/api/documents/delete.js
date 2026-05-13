import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const { id, receive_report_path, invoice_path } = req.body
  if (!id) return res.status(400).json({ error: 'id required' })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Delete storage files if they exist
  const filesToDelete = [receive_report_path, invoice_path].filter(Boolean)
  if (filesToDelete.length) {
    await sb.storage.from('bar-documents').remove(filesToDelete).catch(() => null)
  }

  // Delete the record
  const { error } = await sb.from('bar_documents').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
