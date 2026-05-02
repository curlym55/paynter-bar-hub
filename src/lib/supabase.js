import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
  if (!supabase) return null;
  
  const dbVolunteer = {
    name: volunteer.name,
    villa: volunteer.villa,
    phone: volunteer.phone,
    email: volunteer.email,
    rsa: volunteer.rsa,
    duty_manager: volunteer.dm,
    active: volunteer.active
  };
  
  const { data, error } = await supabase
    .from('volunteers')
    .insert([dbVolunteer])
    .select()
    .single();
  if (error) {
    console.error('addVolunteer:', error);
    return null;
  }
  
  return {
    id: data.id,
    name: data.name,
    villa: data.villa,
    phone: data.phone,
    email: data.email,
    rsa: data.rsa,
    dm: data.duty_manager,
    active: data.active
  };
}

export async function updateVolunteer(id, updates) {
  if (!supabase) return null;
  
  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.villa !== undefined) dbUpdates.villa = updates.villa;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.rsa !== undefined) dbUpdates.rsa = updates.rsa;
  if (updates.dm !== undefined) dbUpdates.duty_manager = updates.dm;
  if (updates.active !== undefined) dbUpdates.active = updates.active;
  
  const { data, error } = await supabase
    .from('volunteers')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('updateVolunteer:', error);
    return null;
  }
  
  return {
    id: data.id,
    name: data.name,
    villa: data.villa,
    phone: data.phone,
    email: data.email,
    rsa: data.rsa,
    dm: data.duty_manager,
    active: data.active
  };
}

export async function deleteVolunteerDB(id) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('volunteers')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteVolunteer:', error);
    return false;
  }
  return true;
}

// ========================================
// HELPER: Load full session by ID
// ========================================

async function loadSessionById(sessionId) {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  
  if (error) {
    console.error('loadSessionById:', error);
    return null;
  }
  
  // Load volunteers for this session
  const { data: volunteerData } = await supabase
    .from('session_volunteers')
    .select('volunteer_id')
    .eq('session_id', sessionId);
  
  const volunteers = volunteerData ? volunteerData.map(sv => sv.volunteer_id) : [];
  
  // Parse date in local timezone
  const [year, month, day] = data.session_date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  return {
    id: data.id,
    date: date,
    dayType: data.day_type,
    eventType: data.event_type,
    eventName: data.event_name,
    time: data.time_slot || '4:30 - 6:30',
    needed: data.volunteers_needed || 2,
    dutyManager: data.duty_manager_id,
    morningClean: data.morning_clean_id,
    morningCleanOverride: data.morning_clean_override || false,
    volunteers: volunteers,
    isExtra: data.is_extra || false,
    shiftLabel: data.shift_label
  };
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
  if (!supabase) return;
  
  const { data, error } = await supabase.rpc('generate_monthly_sessions', {
    p_year: year,
    p_month: month
  });
  
  if (error) {
    console.error('generateSessionsForMonth:', error);
  }
}

export async function addExtraSessionDB(session) {
  if (!supabase) return null;
  
  const localDate = new Date(session.date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  // Remove this date from deleted_dates if it exists
  await supabase
    .from('deleted_dates')
    .delete()
    .eq('date', dateStr);
  
  const { data, error } = await supabase
    .from('sessions')
    .insert([{
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
      shift_label: session.shiftLabel
    }])
    .select()
    .single();
  
  if (error) {
    console.error('addExtraSessionDB:', error);
    return null;
  }
  
  // Parse date back in local timezone
  const [y, m, d] = data.session_date.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  
  return {
    id: data.id,
    date: date,
    dayType: data.day_type,
    eventType: data.event_type,
    eventName: data.event_name,
    time: data.time_slot || '4:30 - 6:30',
    needed: data.volunteers_needed || 2,
    dutyManager: data.duty_manager_id,
    morningClean: data.morning_clean_id,
    morningCleanOverride: data.morning_clean_override || false,
    volunteers: [],
    isExtra: data.is_extra || false,
    shiftLabel: data.shift_label
  };
}

export async function deleteSessionDB(id) {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('deleteSession:', error);
    return false;
  }
  
  return true;
}

export async function updateSession(id, updates) {
  if (!supabase) return null;
  
  const dbUpdates = {};
  if (updates.dutyManager !== undefined) dbUpdates.duty_manager_id = updates.dutyManager;
  if (updates.morningClean !== undefined) dbUpdates.morning_clean_id = updates.morningClean;
  if (updates.morningCleanOverride !== undefined) dbUpdates.morning_clean_override = updates.morningCleanOverride;
  if (updates.dayType !== undefined) dbUpdates.day_type = updates.dayType;
  if (updates.eventType !== undefined) dbUpdates.event_type = updates.eventType;
  if (updates.eventName !== undefined) dbUpdates.event_name = updates.eventName;
  if (updates.time !== undefined) dbUpdates.time_slot = updates.time;
  if (updates.needed !== undefined) dbUpdates.volunteers_needed = updates.needed;
  if (updates.isExtra !== undefined) dbUpdates.is_extra = updates.isExtra;
  if (updates.shiftLabel !== undefined) dbUpdates.shift_label = updates.shiftLabel;
  if (updates.sessionDate !== undefined) dbUpdates.session_date = updates.sessionDate;
  
  const { data, error } = await supabase
    .from('sessions')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('updateSession:', error);
    return null;
  }
  
  // Load volunteers for this session
  const { data: volunteerData } = await supabase
    .from('session_volunteers')
    .select('volunteer_id')
    .eq('session_id', id);
  
  const volunteers = volunteerData ? volunteerData.map(sv => sv.volunteer_id) : [];
  
  const [year, month, day] = data.session_date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  return {
    id: data.id,
    date: date,
    dayType: data.day_type,
    eventType: data.event_type,
    eventName: data.event_name,
    time: data.time_slot || '4:30 - 6:30',
    needed: data.volunteers_needed || 2,
    dutyManager: data.duty_manager_id,
    morningClean: data.morning_clean_id,
    morningCleanOverride: data.morning_clean_override || false,
    volunteers: volunteers,
    isExtra: data.is_extra || false,
    shiftLabel: data.shift_label
  };
}

// FIX: Now returns full updated session object instead of just true/false
export async function addVolunteerToSession(sessionId, volunteerId) {
  if (!supabase) return null;
  
  // Check if already exists
  const { data: existing } = await supabase
    .from('session_volunteers')
    .select('id')
    .eq('session_id', sessionId)
    .eq('volunteer_id', volunteerId)
    .maybeSingle();
  
  if (!existing) {
    // Insert into session_volunteers table
    const { error } = await supabase
      .from('session_volunteers')
      .insert([{
        session_id: sessionId,
        volunteer_id: volunteerId,
        signup_date: new Date().toISOString()
      }]);
    
    if (error) {
      console.error('addVolunteerToSession:', error);
      return null;
    }
  }
  
  // Return the full updated session object
  return await loadSessionById(sessionId);
}

// FIX: Now returns full updated session object instead of just true/false
export async function removeVolunteerFromSession(sessionId, volunteerId) {
  if (!supabase) return null;
  
  const { error } = await supabase
    .from('session_volunteers')
    .delete()
    .eq('session_id', sessionId)
    .eq('volunteer_id', volunteerId);
  
  if (error) {
    console.error('removeVolunteerFromSession:', error);
    return null;
  }
  
  // Return the full updated session object
  return await loadSessionById(sessionId);
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
  if (!supabase) return false;
  
  try {
    const { error } = await supabase
      .from('deleted_dates')
      .insert([{ date: dateStr }]);
    
    if (error && error.code !== '23505') {
      console.warn('addDeletedDate:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.warn('addDeletedDate failed:', err);
    return false;
  }
}

export async function removeDeletedDate(dateStr) {
  if (!supabase) return false;
  
  try {
    const { error } = await supabase
      .from('deleted_dates')
      .delete()
      .eq('date', dateStr);
    
    if (error) {
      console.warn('removeDeletedDate:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.warn('removeDeletedDate failed:', err);
    return false;
  }
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
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('announcements')
    .insert([{ title, content }])
    .select()
    .single();
  if (error) {
    console.error('addAnnouncement:', error);
    return null;
  }
  return data;
}

export async function updateAnnouncement(id, updates) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('announcements')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('updateAnnouncement:', error);
    return null;
  }
  return data;
}

export async function deleteAnnouncementDB(id) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteAnnouncement:', error);
    return false;
  }
  return true;
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
