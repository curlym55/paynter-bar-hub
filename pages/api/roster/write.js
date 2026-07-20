// pages/api/roster/write.js
//
// Single dispatcher for every roster write operation (volunteers, sessions,
// session_volunteers, deleted_dates, announcements). Requires a valid roster
// admin session (see lib/rosterSession.js) and uses the Supabase
// SERVICE_ROLE key, which bypasses RLS — this is intentional: RLS is locked
// down to read-only for anon/public, and this endpoint is the only path
// allowed to write, gated by the PIN-issued session cookie instead.
//
// Mirrors the logic that used to live directly in src/lib/supabase.js (which
// called Supabase straight from the browser with the public anon key).

import { createClient } from '@supabase/supabase-js'
import { requireRosterAuth } from '../../../lib/rosterSession'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function loadSessionById(supabase, sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) { console.error('loadSessionById:', error); return null }

  const { data: volunteerData } = await supabase
    .from('session_volunteers')
    .select('volunteer_id')
    .eq('session_id', sessionId)

  const volunteers = volunteerData ? volunteerData.map(sv => sv.volunteer_id) : []
  const [year, month, day] = data.session_date.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return {
    id: data.id,
    date,
    dayType: data.day_type,
    eventType: data.event_type,
    eventName: data.event_name,
    time: data.time_slot || '4:30 - 6:30',
    needed: data.volunteers_needed || 2,
    dutyManager: data.duty_manager_id,
    morningClean: data.morning_clean_id,
    morningCleanOverride: data.morning_clean_override || false,
    volunteers,
    isExtra: data.is_extra || false,
    shiftLabel: data.shift_label,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireRosterAuth(req, res)) return

  const { action, payload } = req.body || {}
  if (!action) return res.status(400).json({ error: 'action required' })

  const supabase = sb()

  try {
    switch (action) {

      // ── VOLUNTEERS ──────────────────────────────────────────────────────
      case 'addVolunteer': {
        const v = payload
        const dbVolunteer = {
          name: v.name, villa: v.villa, phone: v.phone, email: v.email,
          rsa: v.rsa, duty_manager: v.dm, active: v.active,
        }
        const { data, error } = await supabase.from('volunteers').insert([dbVolunteer]).select().single()
        if (error) throw error
        return res.json({ result: {
          id: data.id, name: data.name, villa: data.villa, phone: data.phone,
          email: data.email, rsa: data.rsa, dm: data.duty_manager, active: data.active,
        }})
      }

      case 'updateVolunteer': {
        const { id, updates } = payload
        const dbUpdates = {}
        if (updates.name !== undefined) dbUpdates.name = updates.name
        if (updates.villa !== undefined) dbUpdates.villa = updates.villa
        if (updates.phone !== undefined) dbUpdates.phone = updates.phone
        if (updates.email !== undefined) dbUpdates.email = updates.email
        if (updates.rsa !== undefined) dbUpdates.rsa = updates.rsa
        if (updates.dm !== undefined) dbUpdates.duty_manager = updates.dm
        if (updates.active !== undefined) dbUpdates.active = updates.active
        const { data, error } = await supabase.from('volunteers').update(dbUpdates).eq('id', id).select().single()
        if (error) throw error
        return res.json({ result: {
          id: data.id, name: data.name, villa: data.villa, phone: data.phone,
          email: data.email, rsa: data.rsa, dm: data.duty_manager, active: data.active,
        }})
      }

      case 'deleteVolunteer': {
        const { error } = await supabase.from('volunteers').delete().eq('id', payload.id)
        if (error) throw error
        return res.json({ result: true })
      }

      // ── SESSIONS ─────────────────────────────────────────────────────────
      case 'addExtraSession': {
        const session = payload
        const localDate = new Date(session.date)
        const y = localDate.getFullYear()
        const m = String(localDate.getMonth() + 1).padStart(2, '0')
        const d = String(localDate.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${d}`

        await supabase.from('deleted_dates').delete().eq('date', dateStr)

        const { data, error } = await supabase.from('sessions').insert([{
          session_date: dateStr,
          day_type: session.dayType,
          event_type: session.eventType,
          event_name: session.eventName,
          time_slot: session.time,
          volunteers_needed: session.needed,
          duty_manager_id: session.dutyManager,
          morning_clean_id: session.morningClean,
          morning_clean_override: session.morningCleanOverride,
          is_extra: true,
          shift_label: session.shiftLabel,
        }]).select().single()
        if (error) throw error

        const [yy, mm, dd] = data.session_date.split('-').map(Number)
        return res.json({ result: {
          id: data.id, date: new Date(yy, mm - 1, dd), dayType: data.day_type,
          eventType: data.event_type, eventName: data.event_name,
          time: data.time_slot || '4:30 - 6:30', needed: data.volunteers_needed || 2,
          dutyManager: data.duty_manager_id, morningClean: data.morning_clean_id,
          morningCleanOverride: data.morning_clean_override || false,
          volunteers: [], isExtra: data.is_extra || false, shiftLabel: data.shift_label,
        }})
      }

      case 'deleteSession': {
        const { error } = await supabase.from('sessions').delete().eq('id', payload.id)
        if (error) throw error
        return res.json({ result: true })
      }

      case 'updateSession': {
        const { id, updates } = payload
        const dbUpdates = {}
        if (updates.dutyManager !== undefined) dbUpdates.duty_manager_id = updates.dutyManager
        if (updates.morningClean !== undefined) dbUpdates.morning_clean_id = updates.morningClean
        if (updates.morningCleanOverride !== undefined) dbUpdates.morning_clean_override = updates.morningCleanOverride
        if (updates.dayType !== undefined) dbUpdates.day_type = updates.dayType
        if (updates.eventType !== undefined) dbUpdates.event_type = updates.eventType
        if (updates.eventName !== undefined) dbUpdates.event_name = updates.eventName
        if (updates.time !== undefined) dbUpdates.time_slot = updates.time
        if (updates.needed !== undefined) dbUpdates.volunteers_needed = updates.needed
        if (updates.isExtra !== undefined) dbUpdates.is_extra = updates.isExtra
        if (updates.shiftLabel !== undefined) dbUpdates.shift_label = updates.shiftLabel
        if (updates.sessionDate !== undefined) dbUpdates.session_date = updates.sessionDate

        const { data, error } = await supabase.from('sessions').update(dbUpdates).eq('id', id).select().single()
        if (error) throw error

        const { data: volunteerData } = await supabase.from('session_volunteers').select('volunteer_id').eq('session_id', id)
        const volunteers = volunteerData ? volunteerData.map(sv => sv.volunteer_id) : []
        const [yy, mm, dd] = data.session_date.split('-').map(Number)

        return res.json({ result: {
          id: data.id, date: new Date(yy, mm - 1, dd), dayType: data.day_type,
          eventType: data.event_type, eventName: data.event_name,
          time: data.time_slot || '4:30 - 6:30', needed: data.volunteers_needed || 2,
          dutyManager: data.duty_manager_id, morningClean: data.morning_clean_id,
          morningCleanOverride: data.morning_clean_override || false,
          volunteers, isExtra: data.is_extra || false, shiftLabel: data.shift_label,
        }})
      }

      // ── SESSION_VOLUNTEERS ───────────────────────────────────────────────
      case 'addVolunteerToSession': {
        const { sessionId, volunteerId } = payload
        const { data: existing } = await supabase
          .from('session_volunteers').select('id')
          .eq('session_id', sessionId).eq('volunteer_id', volunteerId).maybeSingle()
        if (!existing) {
          const { error } = await supabase.from('session_volunteers').insert([{
            session_id: sessionId, volunteer_id: volunteerId, signup_date: new Date().toISOString(),
          }])
          if (error) throw error
        }
        return res.json({ result: await loadSessionById(supabase, sessionId) })
      }

      case 'removeVolunteerFromSession': {
        const { sessionId, volunteerId } = payload
        const { error } = await supabase.from('session_volunteers').delete()
          .eq('session_id', sessionId).eq('volunteer_id', volunteerId)
        if (error) throw error
        return res.json({ result: await loadSessionById(supabase, sessionId) })
      }

      // ── DELETED_DATES ────────────────────────────────────────────────────
      case 'addDeletedDate': {
        const { error } = await supabase.from('deleted_dates').insert([{ date: payload.dateStr }])
        if (error && error.code !== '23505') throw error // 23505 = unique violation, treat as success
        return res.json({ result: true })
      }

      case 'removeDeletedDate': {
        const { error } = await supabase.from('deleted_dates').delete().eq('date', payload.dateStr)
        if (error) throw error
        return res.json({ result: true })
      }

      // ── ANNOUNCEMENTS ────────────────────────────────────────────────────
      case 'addAnnouncement': {
        const { title, content } = payload
        const { data, error } = await supabase.from('announcements').insert([{ title, content }]).select().single()
        if (error) throw error
        return res.json({ result: data })
      }

      case 'updateAnnouncement': {
        const { id, updates } = payload
        const { data, error } = await supabase.from('announcements')
          .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
        if (error) throw error
        return res.json({ result: data })
      }

      case 'deleteAnnouncement': {
        const { error } = await supabase.from('announcements').delete().eq('id', payload.id)
        if (error) throw error
        return res.json({ result: true })
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(`[roster/write] ${action}:`, err.message)
    return res.status(500).json({ error: err.message })
  }
}
