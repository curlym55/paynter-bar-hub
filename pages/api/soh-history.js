import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../lib/session'

// Service-role key (server-side only) rather than the public anon key — the
// anon key would require soh_reports to allow anonymous reads/deletes.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const { data, error } = await supabase
      .from('soh_reports')
      .select('id, report_date, generated_at, items_count, total_value, data')
      .order('report_date', { ascending: false })
      .limit(24)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ reports: data })
  }

  if (req.method === 'DELETE') {
    if (!requireAuth(req, res, { allowReadOnly: false })) return
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })

    const { error } = await supabase
      .from('soh_reports')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
