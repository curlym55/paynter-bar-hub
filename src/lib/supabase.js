import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Every write (insert/update/delete) goes through this instead of hitting
// Supabase directly from the browser. The server checks the roster admin
// session cookie and uses the SERVICE_ROLE key — RLS for anon/public is
// locked to read-only, so this is the only path that can write.
// See pages/api/roster/write.js.
async function rosterWrite(action, payload) {
  const res = await fetch('/api/roster/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`${action}:`, err.error || res.statusText);
    return null;
  }
  const { result } = await res.json();
  // Session objects carry a `date` field that was a JS Date on the server —
  // JSON has no Date type, so it crosses the wire as an ISO string. Re-hydrate
  // it here so every caller still gets a real Date object, exactly as before
  // when these functions talked to Supabase directly in the browser.
  if (result && typeof result === 'object' && typeof result.date === 'string') {
    result.date = new Date(result.date);
  }
  return result;
}

// ========================================
// VOLUNTEERS
// ========================================

export async function getVolunteers() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('volunteers')
    .select('*')
    .order('name');
  if (error) {
    console.error('getVolunteers:', error);
    return [];
  }
  return data.map(v => ({
    id: v.id,
    name: v.name,
    villa: v.villa,
    phone: v.phone,
    email: v.email,
    rsa: v.rsa,
    dm: v.duty_manager,
    active: v.active
  }));
}

export async function addVolunteer(volunteer) {
  return await rosterWrite('addVolunteer', volunteer);
}

export async function updateVolunteer(id, updates) {
  return await rosterWrite('updateVolunteer', { id, updates });
}

export async function deleteVolunteerDB(id) {
  const result = await rosterWrite('deleteVolunteer', { id });
  return result === true;
}

// ========================================
// SESSIONS
// ========================================

export async function getSessionsForMonth(year, month) {
  if (!supabase) return [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('session_date', startStr)
    .lte('session_date', endStr)
    .order('session_date');

  if (error) {
    console.error('getSessionsForMonth:', error);
    return [];
  }

  const sessionIds = data.map(s => s.id);

  let volunteersMap = {};
  if (sessionIds.length > 0) {
    const { data: volunteerData, error: volError } = await supabase
      .from('session_volunteers')
      .select('session_id, volunteer_id')
      .in('session_id', sessionIds);

    if (volError) {
      console.error('getSessionsForMonth volunteers:', volError);
    }

    if (volunteerData) {
      volunteerData.forEach(sv => {
        if (!volunteersMap[sv.session_id]) {
          volunteersMap[sv.session_id] = [];
        }
        volunteersMap[sv.session_id].push(sv.volunteer_id);
      });
    }
  }

  return data.map(s => {
    const [year, month, day] = s.session_date.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return {
      id: s.id,
      date: date,
      dayType: s.day_type,
      eventType: s.event_type,
      eventName: s.event_name,
      time: s.time_slot || '4:30 - 6:30',
      needed: s.volunteers_needed || 2,
      dutyManager: s.duty_manager_id,
      morningClean: s.morning_clean_id,
      morningCleanOverride: s.morning_clean_override || false,
      volunteers: volunteersMap[s.id] || [],
      isExtra: s.is_extra || false,
      shiftLabel: s.shift_label
    };
  });
}

export async function generateSessionsForMonth(year, month) {
  try {
    await fetch('/api/roster/generate-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month }),
    });
  } catch (e) {
    console.error('generateSessionsForMonth:', e);
  }
}

export async function addExtraSessionDB(session) {
  // Compute the calendar date string client-side (correct local timezone)
  // before it ever crosses the network — JSON has no Date type, so sending
  // a Date object and reconstructing it server-side is timezone-fragile
  // (Vercel functions run in UTC, not Brisbane time, and would land on the
  // wrong day for anything after 2pm local).
  const localDate = new Date(session.date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  return await rosterWrite('addExtraSession', { ...session, dateStr });
}

export async function deleteSessionDB(id) {
  const result = await rosterWrite('deleteSession', { id });
  return result === true;
}

export async function updateSession(id, updates) {
  return await rosterWrite('updateSession', { id, updates });
}

// FIX: Now returns full updated session object instead of just true/false
export async function addVolunteerToSession(sessionId, volunteerId) {
  return await rosterWrite('addVolunteerToSession', { sessionId, volunteerId });
}

// FIX: Now returns full updated session object instead of just true/false
export async function removeVolunteerFromSession(sessionId, volunteerId) {
  return await rosterWrite('removeVolunteerFromSession', { sessionId, volunteerId });
}

// ========================================
// DELETED DATES MANAGEMENT
// ========================================

export async function getDeletedDates() {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('deleted_dates')
      .select('date');

    if (error) {
      console.warn('getDeletedDates: table may not exist yet', error.message);
      return [];
    }

    return data.map(row => row.date);
  } catch (err) {
    console.warn('getDeletedDates failed:', err);
    return [];
  }
}

export async function addDeletedDate(dateStr) {
  const result = await rosterWrite('addDeletedDate', { dateStr });
  return result === true;
}

export async function removeDeletedDate(dateStr) {
  const result = await rosterWrite('removeDeletedDate', { dateStr });
  return result === true;
}

// ========================================
// ANNOUNCEMENTS
// ========================================

export async function getAnnouncements() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getAnnouncements:', error);
    return [];
  }
  return data;
}

export async function addAnnouncement(title, content) {
  return await rosterWrite('addAnnouncement', { title, content });
}

export async function updateAnnouncement(id, updates) {
  return await rosterWrite('updateAnnouncement', { id, updates });
}

export async function deleteAnnouncementDB(id) {
  const result = await rosterWrite('deleteAnnouncement', { id });
  return result === true;
}


export async function getAllSessions() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('session_date');

  if (error) {
    console.error('getAllSessions:', error);
    return [];
  }

  const sessionIds = data.map(s => s.id);

  let volunteersMap = {};
  if (sessionIds.length > 0) {
    const { data: volunteerData, error: volError } = await supabase
      .from('session_volunteers')
      .select('session_id, volunteer_id')
      .in('session_id', sessionIds);

    if (volError) {
      console.error('getAllSessions volunteers:', volError);
    }

    if (volunteerData) {
      volunteerData.forEach(sv => {
        if (!volunteersMap[sv.session_id]) {
          volunteersMap[sv.session_id] = [];
        }
        volunteersMap[sv.session_id].push(sv.volunteer_id);
      });
    }
  }

  return data.map(s => {
    const [year, month, day] = s.session_date.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return {
      id: s.id,
      date: date,
      dayType: s.day_type,
      eventType: s.event_type,
      eventName: s.event_name,
      time: s.time_slot || '4:30 - 6:30',
      needed: s.volunteers_needed || 2,
      dutyManager: s.duty_manager_id,
      morningClean: s.morning_clean_id,
      morningCleanOverride: s.morning_clean_override || false,
      volunteers: volunteersMap[s.id] || [],
      isExtra: s.is_extra || false,
      shiftLabel: s.shift_label
    };
  });
}
