// pages/api/roster/generate-sessions.js
//
// Auto-provisions session rows for a given month, driven entirely by the
// admin-configurable schedule in roster_settings + roster_recurring_events
// (see Admin > Settings in the roster UI) instead of a hardcoded day/event
// pattern. Runs on every visitor's page load (not just admins) to lazily
// ensure sessions exist for whatever month is being viewed - not a
// privileged action, so unlike write.js this does NOT require the admin PIN.
//
// Because it is public, it validates its inputs (month 1-12, and only a
// sensible window around today) so it can't be used to create sessions for
// arbitrary years.
//
// Replaces the previous approach of calling a Postgres RPC
// (generate_monthly_sessions) that had Palmwoods' schedule hardcoded in SQL.
// That RPC is no longer called and can be dropped later if wanted.
//
// Known simplification: the old logic auto-added a second Trivia shift
// (6:30-8pm) from May 2026 onward - a one-off scheduling change, not a
// general "events can have two shifts a night" feature. Not reproduced here;
// add a second shift manually via "+ Add Extra Day" if still needed.

import { createClient } from '@supabase/supabase-js'

// How far from today a month may be requested. Past months are allowed so
// browsing back never errors; future months are capped.
const MONTHS_BACK = 12
const MONTHS_AHEAD = 24

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

  const body = req.body || {}
  const year = Number(body.year)
  const month = Number(body.month) // 1-based, matching the existing caller

  // Input validation: whole numbers only, real month, sensible window.
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return res.status(400).json({ error: 'year and month must be whole numbers' })
  }
  if (month < 1 || month > 12) {
    return res.status(400).json({ error: 'month must be 1-12' })
  }
  const now = new Date()
  const monthsFromNow = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth())
  if (monthsFromNow < -MONTHS_BACK || monthsFromNow > MONTHS_AHEAD) {
    return res.status(400).json({ error: 'month is outside the allowed range' })
  }

  const monthIndex = month - 1
  const mm = String(month).padStart(2, '0')

  // First day of the following month. Used as an exclusive upper bound so the
  // lookup works for 28/29/30/31-day months (a hardcoded "-31" is an invalid
  // date in Feb, Apr, Jun, Sep and Nov and makes the query fail silently).
  const nextMonthStart = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const [
      { data: settings, error: settingsError },
      { data: events, error: eventsError },
      { data: deletedRows, error: deletedError },
      { data: existingRows, error: existingError },
    ] = await Promise.all([
      supabase.from('roster_settings').select('days').eq('id', 1).maybeSingle(),
      supabase.from('roster_recurring_events').select('*').eq('active', true),
      supabase.from('deleted_dates').select('date'),
      supabase.from('sessions')
        .select('session_date, shift_label')
        .gte('session_date', `${year}-${mm}-01`)
        .lt('session_date', nextMonthStart),
    ])

    // If any lookup fails, STOP and report it. Carrying on with missing data
    // is what previously created duplicate sessions, and treating a missing
    // schedule as "nothing to generate" hid a setup problem.
    const lookupError = settingsError || eventsError || deletedError || existingError
    if (lookupError) throw lookupError
    if (!settings) {
      console.error('[roster/generate-sessions] roster_settings row (id=1) not found')
      return res.status(503).json({ error: 'Schedule settings not found - run the roster settings migration.' })
    }

    const days = settings.days || {}
    const deletedDates = new Set((deletedRows || []).map(r => r.date))
    // Any existing session on a date (regular or extra) blocks auto-generation
    // for that date, so we never add a regular shift beside an extra one.
    const existingKeys = new Set((existingRows || []).map(r => `${r.session_date}|`))

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
        time_slot: matchedEvent?.time_slot || dayCfg?.time || '5:00 - 7:00',
        volunteers_needed: 2,
        is_extra: false,
        shift_label: '',
      })
    }

    let created = 0
    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('sessions').insert(rowsToInsert)
      if (!error) {
        created = rowsToInsert.length
      } else if (error.code === '23505') {
        // Unique-violation: another visitor's request created some of these
        // sessions at the same moment, and the database rejected the whole
        // batch. Add the remaining ones one at a time, skipping the clashes.
        for (const row of rowsToInsert) {
          const { error: rowError } = await supabase.from('sessions').insert([row])
          if (!rowError) created++
          else if (rowError.code !== '23505') throw rowError
        }
      } else {
        throw error
      }
    }

    return res.json({ ok: true, created })
  } catch (err) {
    console.error('[roster/generate-sessions]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
