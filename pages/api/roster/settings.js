// pages/api/roster/settings.js
//
// GET: returns the current schedule config - which weekdays the bar is
// open (with default times) plus the list of recurring events. Read is
// public/unauthenticated, same as generate-sessions.js and the volunteer/
// session data fetched elsewhere - this just describes the schedule shape,
// not anyone's personal data. If the config can't be read it returns a 500
// (the client already treats a failed response as "no settings loaded")
// instead of pretending the schedule is simply empty.
//
// PUT: replaces the schedule config. Admin-only (requires the roster
// session cookie from a valid PIN login).

import { createClient } from '@supabase/supabase-js'
import { requireRosterAuth } from '../../../lib/rosterSession'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req, res) {
  const supabase = sb()

  if (req.method === 'GET') {
    const [
      { data: settings, error: settingsError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      supabase.from('roster_settings').select('days').eq('id', 1).maybeSingle(),
      supabase.from('roster_recurring_events').select('*').eq('active', true).order('label'),
    ])
    if (settingsError || eventsError) {
      console.error('[roster/settings] GET:', (settingsError || eventsError).message)
      return res.status(500).json({ error: 'Could not read schedule settings' })
    }
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
      // Save every event FIRST, and only switch off the removed ones once
      // every save has succeeded. (The old order - deactivate everything,
      // then re-add - left ALL events switched off if a save failed halfway.
      // Now a failure part-way leaves the previous events exactly as they
      // were, apart from any that were already updated.)
      // This never touches sessions already generated in past months - each
      // of those rows keeps its own saved event_name/time_slot.
      const keepIds = []

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
          if (UUID_RE.test(String(ev.id))) keepIds.push(ev.id)
        } else {
          const { data, error } = await supabase
            .from('roster_recurring_events').insert([row]).select('id').single()
          if (error) return res.status(500).json({ ok: false, error: error.message })
          keepIds.push(data.id)
        }
      }

      // Everything saved - now retire any event that was removed in the UI.
      let deactivate = supabase
        .from('roster_recurring_events')
        .update({ active: false })
        .eq('active', true)
      if (keepIds.length > 0) {
        deactivate = deactivate.not('id', 'in', `(${keepIds.join(',')})`)
      }
      const { error: deactivateErr } = await deactivate
      if (deactivateErr) return res.status(500).json({ ok: false, error: deactivateErr.message })
    }

    return res.json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
