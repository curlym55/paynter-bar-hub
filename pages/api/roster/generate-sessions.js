// pages/api/roster/generate-sessions.js
//
// Auto-provisions session rows for a given month, driven entirely by the
// admin-configurable schedule in roster_settings + roster_recurring_events
// (see Admin ▸ Settings in the roster UI) instead of a hardcoded day/event
// pattern. Runs on every visitor's page load (not just admins) to lazily
// ensure sessions exist for whatever month is being viewed — not a
// privileged action, so unlike write.js this does NOT require the admin PIN.
//
// Replaces the previous approach of calling a Postgres RPC
// (generate_monthly_sessions) that had Palmwoods' schedule hardcoded in SQL.
// That RPC is no longer called and can be dropped later if wanted.
//
// Known simplification: the old logic auto-added a second Trivia shift
// (6:30-8pm) from May 2026 onward — a one-off scheduling change, not a
// general "events can have two shifts a night" feature. Not reproduced here;
// add a second shift manually via "+ Add Extra Day" if still needed.

import { createClient } from '@supabase/supabase-js'

function nthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
  // occurrence: '1'..'4' or 'last'. monthIndex is 0-based (Jan=0).
  if (occurrence === 'last') {
    const last = new Date(year, monthIndex + 1, 0)
    const diff = (last.getDay() - weekday + 7) % 7
    return last.getDate() - diff
  }
  const first = new Date(year, monthIndex, 1)
  const firstOccurrence = 1 + ((weekday - first.getDay() + 7) % 7)
  return firstOccurrence + (Number(occurrence) - 1) * 7
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { year, month } = req.body || {} // month is 1-based, matching the existing caller
  if (!year || !month) return res.status(400).json({ error: 'year and month required' })
  const monthIndex = month - 1
  const mm = String(month).padStart(2, '0')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const [{ data: settings }, { data: events }, { data: deletedRows }, { data: existingRows }] = await Promise.all([
      supabase.from('roster_settings').select('days').eq('id', 1).maybeSingle(),
      supabase.from('roster_recurring_events').select('*').eq('active', true),
      supabase.from('deleted_dates').select('date'),
      supabase.from('sessions')
        .select('session_date, shift_label')
        .gte('session_date', `${year}-${mm}-01`)
        .lte('session_date', `${year}-${mm}-31`),
    ])

    const days = settings?.days || {}
    const deletedDates = new Set((deletedRows || []).map(r => r.date))
    // Auto-generated (non-extra) rows are inserted with an empty shift_label
    // — see below — so this key only collides with other auto-generated
    // rows on the same date, never with manually-added extra shifts.
    const existingKeys = new Set((existingRows || []).map(r => `${r.session_date}|${r.shift_label || ''}`))

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const rowsToInsert = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, monthIndex, d).getDay()
      const dd = String(d).padStart(2, '0')
      const dateStr = `${year}-${mm}-${dd}`
      if (deletedDates.has(dateStr)) continue

      const dayCfg = days[String(dow)]
      const fixedEvent = (events || []).find(e => e.fixed_date === `${mm}-${dd}`)
      const weekdayEvent = (events || []).find(e =>
        e.weekday === dow && e.occurrence &&
        d === nthWeekdayOfMonth(year, monthIndex, dow, e.occurrence)
      )
      const matchedEvent = fixedEvent || weekdayEvent

      // A day gets a session if it's a regular enabled weekday, OR a
      // fixed-date event lands on it even outside the usual weekly pattern
      // (e.g. Australia Day falling on a day the bar doesn't normally open).
      if (!dayCfg?.enabled && !fixedEvent) continue

      const key = `${dateStr}|`
      if (existingKeys.has(key)) continue

      rowsToInsert.push({
        session_date: dateStr,
        day_type: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dow],
        event_type: matchedEvent ? matchedEvent.label.toLowerCase().replace(/\s+/g, '_') : null,
        event_name: matchedEvent ? matchedEvent.label : null,
        time_slot: matchedEvent?.time_slot || dayCfg?.time || '4:30 - 6:30',
        volunteers_needed: 2,
        is_extra: false,
        shift_label: '',
      })
    }

    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('sessions').insert(rowsToInsert)
      if (error) throw error
    }

    return res.json({ ok: true, created: rowsToInsert.length })
  } catch (err) {
    console.error('[roster/generate-sessions]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
