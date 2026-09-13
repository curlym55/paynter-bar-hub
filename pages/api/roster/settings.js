// pages/api/roster/settings.js
//
// GET: returns the current schedule config — which weekdays the bar is
// open (with default times) plus the list of recurring events. Read is
// public/unauthenticated, same as generate-sessions.js and the volunteer/
// session data fetched elsewhere — this just describes the schedule shape,
// not anyone's personal data.
//
// PUT: replaces the schedule config. Admin-only (requires the roster
// session cookie from a valid PIN login).

import { createClient } from '@supabase/supabase-js'
import { requireRosterAuth } from '../../../lib/rosterSession'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const supabase = sb()

  if (req.method === 'GET') {
    const [{ data: settings }, { data: events }] = await Promise.all([
      supabase.from('roster_settings').select('days').eq('id', 1).maybeSingle(),
      supabase.from('roster_recurring_events').select('*').eq('active', true).order('label'),
    ])
    return res.json({ days: settings?.days || {}, events: events || [] })
  }

  if (req.method === 'PUT') {
    if (!requireRosterAuth(req, res)) return

    const { days, events } = req.body || {}

    if (days) {
      const { error } = await supabase
        .from('roster_settings')
        .update({ days, updated_at: new Date().toISOString() })
        .eq('id', 1)
      if (error) return res.status(500).json({ ok: false, error: error.message })
    }

    if (Array.isArray(events)) {
      // Simplest reliable approach for a short, admin-edited list: deactivate
      // everything, then upsert what was sent. This never touches sessions
      // already generated in past months — each of those rows keeps its own
      // saved event_name/time_slot regardless of later config changes.
      const { error: deactivateErr } = await supabase
        .from('roster_recurring_events')
        .update({ active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000')
      if (deactivateErr) return res.status(500).json({ ok: false, error: deactivateErr.message })

      for (const ev of events) {
        const row = {
          label: ev.label,
          weekday: ev.weekday ?? null,
          occurrence: ev.occurrence ?? null,
          fixed_date: ev.fixed_date || null,
          time_slot: ev.time_slot || null,
          icon: ev.icon || null,
          color: ev.color || null,
          active: true,
        }
        if (ev.id) {
          const { error } = await supabase.from('roster_recurring_events').update(row).eq('id', ev.id)
          if (error) return res.status(500).json({ ok: false, error: error.message })
        } else {
          const { error } = await supabase.from('roster_recurring_events').insert([row])
          if (error) return res.status(500).json({ ok: false, error: error.message })
        }
      }
    }

    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
