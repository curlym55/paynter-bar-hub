// pages/api/roster/generate-sessions.js
//
// Auto-provisions the recurring Wed/Fri/Sun session rows for a given month.
// This runs on every visitor's page load (not just admins) to lazily ensure
// sessions exist for whatever month is being viewed — it's not a privileged
// action, so unlike pages/api/roster/write.js this does NOT require the
// admin PIN. It still uses the service-role key server-side so it keeps
// working once RLS is locked down to read-only for anon/public.

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { year, month } = req.body || {}
  if (!year || !month) return res.status(400).json({ error: 'year and month required' })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { error } = await supabase.rpc('generate_monthly_sessions', { p_year: year, p_month: month })
    if (error) throw error
    return res.json({ ok: true })
  } catch (err) {
    console.error('[roster/generate-sessions]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
