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

  // Generate 1-hour signed download URLs for Supabase Storage files.
  // One batched createSignedUrls call per 100 paths instead of one request per
  // file (up to 600 Storage requests for 300 records before).
  const paths = [...new Set(data.flatMap(doc => [doc.receive_report_path, doc.invoice_path]).filter(Boolean))]
  const signed = {}
  const BATCH = 100
  for (let i = 0; i < paths.length; i += BATCH) {
    const { data: batch, error: signErr } = await sb.storage.from('bar-documents').createSignedUrls(paths.slice(i, i + BATCH), 3600)
    if (signErr) continue // same behaviour as before: a failed signing just leaves the URL off
    for (const row of batch || []) {
      if (row?.signedUrl && row.path) signed[row.path] = row.signedUrl
    }
  }
  const docs = data.map(doc => {
    const urls = {}
    if (doc.receive_report_path && signed[doc.receive_report_path]) urls.receive_url = signed[doc.receive_report_path]
    if (doc.invoice_path && signed[doc.invoice_path]) urls.invoice_url = signed[doc.invoice_path]
    return { ...doc, ...urls }
  })

  return res.json({ documents: docs })
}
