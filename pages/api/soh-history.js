import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data, error } = await supabase
    .from('soh_reports')
    .select('id, report_date, generated_at, items_count, total_value, data')
    .order('report_date', { ascending: false })
    .limit(24)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ reports: data })
}