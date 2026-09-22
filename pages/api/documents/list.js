import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  // Purchase order records. Requires a valid session — no anonymous access.
  if (!requireAuth(req, res)) return

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Ordered by updated_at, not created_at — an order placed a while ago that
  // only gets its invoice attached later (a common gap: order today, invoice
  // attached days later when it's picked up, received later still) needs to
  // stay within this window based on when it was last touched, not when it
  // was first created, or the Receive modal's "already attached" check can
  // miss it even though the invoice genuinely saved.
  const { data, error } = await sb.from('bar_documents').select('*').order('updated_at', { ascending: false }).limit(300)
  if (error) return res.status(500).json({ error: error.message })

  // Generate 1-hour signed download URLs for Supabase Storage files
  const docs = await Promise.all(data.map(async doc => {
    const urls = {}
    if (doc.receive_report_path) {
      const { data: s } = await sb.storage.from('bar-documents').createSignedUrl(doc.receive_report_path, 3600)
      if (s?.signedUrl) urls.receive_url = s.signedUrl
    }
    if (doc.invoice_path) {
      const { data: s } = await sb.storage.from('bar-documents').createSignedUrl(doc.invoice_path, 3600)
      if (s?.signedUrl) urls.invoice_url = s.signedUrl
    }
    return { ...doc, ...urls }
  }))

  return res.json({ documents: docs })
}
