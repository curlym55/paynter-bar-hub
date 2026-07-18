'use client';
import { useState, useEffect } from 'react';
import {
  getVolunteers,
  addVolunteer,
  updateVolunteer,
  deleteVolunteerDB,
  getSessionsForMonth,
  generateSessionsForMonth,
  addExtraSessionDB,
  deleteSessionDB,
  updateSession as updateSessionDB,
  addVolunteerToSession,
  removeVolunteerFromSession,
  getDeletedDates,
  addDeletedDate,
  getAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncementDB,
  getAllSessions
} from '../../lib/supabase';

// FIX: Don't evaluate IS_LIVE at module level for state initialization
// It causes hydration mismatch (server=false, client=true)
function getIsLive() {
  return !!(typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TIME_OPTIONS = ["10:00","10:30","11:00","11:30","12:00","12:30","1:00","1:30","2:00","2:30","3:00","3:30","4:00","4:30","5:00","5:30","6:00","6:30","7:00","7:30","8:00","8:30"];

const EVENT_STYLES = {
  australia_day: { label: "#FF5252", icon: "🇦🇺" },
  trivia: { label: "#9C27B0", icon: "🧠" },
  bingo: { label: "#FF9800", icon: "🎱" },
  melbourne_cup: { label: "#4CAF50", icon: "🏇" },
  social: { label: "#2196F3", icon: "🎉" },
  xmas_july: { label: "#F44336", icon: "🎅" }
};

const INITIAL_VOLUNTEERS = [
  { id: "1", name: "Jane Smith", villa: 42, rsa: true, dm: true, active: true },
  { id: "2", name: "Bob Johnson", villa: 87, rsa: false, dm: false, active: true },
  { id: "3", name: "Alice Williams", villa: 15, rsa: true, dm: true, active: true },
  { id: "4", name: "Tom Brown", villa: 64, rsa: false, dm: false, active: true },
];

// Skip dates - holidays where bar is closed
const SKIP_DATES = [
  '2025-04-18', // Good Friday 2025
  '2025-12-25', // Christmas 2025
  '2026-04-03', // Good Friday 2026
];

// Deleted dates cache - permanently deleted days from Supabase
let deletedDatesCache = [];

// Load deleted dates from Supabase
async function loadDeletedDates() {
  if (!getIsLive()) return;
  try {
    const dates = await getDeletedDates();
    deletedDatesCache = dates;
  } catch (err) {
    console.warn('Failed to load deleted dates:', err);
    deletedDatesCache = [];
  }
}

// Check if a date should be skipped (holiday or permanently deleted)
function shouldSkipDate(date) {
  let dateStr;
  
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  } else if (typeof date === 'string') {
    dateStr = date;
  } else {
    return false;
  }
  
  if (SKIP_DATES.includes(dateStr)) return true;
  if (deletedDatesCache.includes(dateStr)) return true;
  
  return false;
}

// Date helpers
function getLastWednesday(y, m) {
  const last = new Date(y, m + 1, 0);
  const dow = last.getDay();
  return last.getDate() - ((dow >= 3) ? (dow - 3) : (7 - 3 + dow));
}
function getSecondWednesday(y, m) {
  const dow = new Date(y, m, 1).getDay();
  return (dow <= 3 ? 4 - dow : 11 - dow) + 7;
}
function getThirdWednesday(y, m) { return getSecondWednesday(y, m) + 7; }
function getSpecialEvent(y, m, d) {
  if (m === 0 && d === 26) return "australia_day";
  if (m === 10 && d === 3) return "melbourne_cup";
  if (m === 6 && d === 17) return "xmas_july";
  const dow = new Date(y, m, d).getDay();
  if (dow === 3) {
    if (d === getLastWednesday(y, m)) return "trivia";
    if (d === getThirdWednesday(y, m) && m >= 1) return "bingo";
    if (d === getSecondWednesday(y, m) && m >= 1 && (y < 2026 || (y === 2026 && m < 4))) return "social";
  }
  return null;
}

function generateSessions(year, month) {
  const sessions = [];
  const end = new Date(year, month + 1, 0);
  const days = end.getDate();

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    
    if (shouldSkipDate(date)) continue;

    if (dow === 3 || dow === 5 || dow === 0) {
      let dayType = dow === 3 ? "wednesday" : (dow === 5 ? "friday" : "sunday");
      let eventType = getSpecialEvent(year, month, d);
      let eventName = "";
      if (eventType) {
        eventName = eventType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
      const fromMay26 = (year > 2026 || (year === 2026 && month >= 4));
      let defaultTime = "4:30 - 6:30";
      if (fromMay26) {
        if (eventType === "bingo") defaultTime = "5:00 - 6:30";
        else if (eventType === "trivia") defaultTime = "5:00 - 6:30";
        else defaultTime = "5:00 - 7:00";
      }
      sessions.push({
        id: `${year}-${month}-${d}`,
        date,
        dayType,
        eventType,
        eventName,
        time: defaultTime,
        needed: 2,
        volunteers: [],
        dutyManager: null,
        morningClean: null,
        morningCleanOverride: false,
        isExtra: false,
        shiftLabel: ""
      });
      // Trivia: add second shift from May 2026
      if (eventType === "trivia" && fromMay26) {
        sessions.push({
          id: `${year}-${month}-${d}-late`,
          date,
          dayType,
          eventType,
          eventName,
          time: "6:30 - 8:00",
          needed: 2,
          volunteers: [],
          dutyManager: null,
          morningClean: null,
          morningCleanOverride: false,
          isExtra: false,
          shiftLabel: ""
        });
      }
    }
  }
  return sessions;
}

function formatDate(d) {
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()].substring(0, 3);
  return `${dow} ${day} ${month}`;
}

function getAutoMorningClean(session) {
  return session.dutyManager || null;
}

export default function PaynterBarRoster() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sessions, setSessions] = useState([]);
  // FIX: Always start with consistent state for hydration
  // Both server and client start with loading=true and empty volunteers
  const [volunteers, setVolunteers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("roster");
  const [showVolForm, setShowVolForm] = useState(false);
  const [editVol, setEditVol] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showIdentify, setShowIdentify] = useState(false);
  const [showExtraShift, setShowExtraShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showNewDay, setShowNewDay] = useState(false);
  const [scrollTarget, setScrollTarget] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [mobileInIframe, setMobileInIframe] = useState(false);
  // FIX: Track whether we've initialized (client-only)
  const [isLive, setIsLive] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [allSessions, setAllSessions] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsTab, setStatsTab] = useState('alltime');
  const [statsSort, setStatsSort] = useState('shifts');
  const [editNotice, setEditNotice] = useState(null);
  const [showPastSessions, setShowPastSessions] = useState(false);
  
  // Toast and loading states
  const [toasts, setToasts] = useState([]);
  const [savingStates, setSavingStates] = useState({});
  
  const ADMIN_PIN = "3838";

  // Toast management
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const setSaving = (key, value) => {
    setSavingStates(prev => ({ ...prev, [key]: value }));
  };

  // Detect mobile in iframe (Wix blocks touch events)
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const inIframe = window.self !== window.top;
    if (isMobile && inIframe) setMobileInIframe(true);
  }, []);

  // FIX: Initialize on client mount — this runs only on client, avoiding hydration mismatch
  useEffect(() => {
    const live = getIsLive();
    setIsLive(live);
    
    if (live) {
      Promise.all([
        getVolunteers(),
        loadDeletedDates(),
        getAnnouncements()
      ]).then(([vols, , anns]) => {
        setVolunteers(vols);
        setAnnouncements(anns || []);
        setLoading(false);
      }).catch(err => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
    } else {
      // Demo mode
      setVolunteers(INITIAL_VOLUNTEERS);
      setLoading(false);
    }
  }, []);

  // Load sessions — Supabase or in-memory
  useEffect(() => {
    // FIX: Don't load sessions until client initialization is done
    if (loading) return;
    
    if (isLive) {
      generateSessionsForMonth(year, month + 1).then(() => {
        getSessionsForMonth(year, month + 1).then(data => {
          const filtered = data.filter(s => !shouldSkipDate(s.date));
          setSessions(filtered);
        });
      });
    } else {
      setSessions(prev => {
        const key = `${year}-${month}`;
        const existing = prev.filter(s => `${s.date.getFullYear()}-${s.date.getMonth()}` === key);
        if (existing.length > 0) return prev;
        return [...prev, ...generateSessions(year, month)];
      });
    }
  }, [year, month, loading, isLive]);

  // Broadcast height to parent for seamless iframe embedding
  useEffect(() => {
    const sendHeight = () => {
      const h = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: 'roster-height', height: h }, '*');
    };
    sendHeight();
    window.addEventListener('resize', sendHeight);
    const obs = new ResizeObserver(sendHeight);
    obs.observe(document.body);
    return () => {
      window.removeEventListener('resize', sendHeight);
      obs.disconnect();
    };
  }, [sessions, view, showVolForm, showIdentify, showExtraShift, showPinDialog, showNewDay, showCalendar, showInstructions, showPrint, showNoticeForm, announcements]);

  // Auto-scroll to volunteer form when editing
  useEffect(() => {
    if (showVolForm) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [showVolForm]);

  // Auto-scroll to add-shift form when opened from a session card's ➕ button
  useEffect(() => {
    if (showNewDay) {
      setTimeout(() => {
        const el = document.getElementById('add-shift-form');
        if (el) {
          window.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' });
          window.parent.postMessage({ type: 'roster-scroll-top' }, '*');
        }
      }, 100);
    }
  }, [showNewDay]);

  // Auto-scroll to target date
  useEffect(() => {
    if (scrollTarget) {
      setTimeout(() => {
        const el = document.getElementById(`session-${scrollTarget}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setScrollTarget(null);
      }, 300);
    }
  }, [scrollTarget]);

  // Collapse past sessions again whenever the viewed month changes,
  // so returning to the current month always starts collapsed
  useEffect(() => {
    setShowPastSessions(false);
  }, [year, month]);

  function showStatus(msg) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(""), 2000);
  }

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const toggleAdmin = () => {
    if (!isAdmin) {
      setShowPinDialog(true);
      setPinInput("");
      setPinError("");
    } else {
      setIsAdmin(false);
      showToast("Admin mode disabled");
    }
  };

  const handlePinSubmit = () => {
    if (pinInput === ADMIN_PIN) {
      setIsAdmin(true);
      setShowPinDialog(false);
      setPinInput("");
      setPinError("");
      showToast("Admin mode enabled");
    } else {
      setPinError("Incorrect PIN");
      setPinInput("");
    }
  };

  const addVolunteerToSessionLocal = async (sessionId, volunteerId) => {
    const key = `add-vol-${sessionId}-${volunteerId}`;
    setSaving(key, true);
    
    if (isLive) {
      const updated = await addVolunteerToSession(sessionId, volunteerId);
      if (updated) {
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        showToast("Volunteer added");
      } else {
        showToast("Failed to add volunteer", "error");
      }
    } else {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, volunteers: [...s.volunteers, volunteerId] } : s
      ));
      showToast("Volunteer added");
    }
    
    setSaving(key, false);
  };

  const removeVolunteerFromSessionLocal = async (sessionId, volunteerId) => {
    const key = `remove-vol-${sessionId}-${volunteerId}`;
    setSaving(key, true);
    
    if (isLive) {
      const updated = await removeVolunteerFromSession(sessionId, volunteerId);
      if (updated) {
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        showToast("Volunteer removed");
      } else {
        showToast("Failed to remove volunteer", "error");
      }
    } else {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, volunteers: s.volunteers.filter(v => v !== volunteerId) } : s
      ));
      showToast("Volunteer removed");
    }
    
    setSaving(key, false);
  };

  const setDutyManager = async (sessionId, volunteerId) => {
    const key = `dm-${sessionId}`;
    setSaving(key, true);
    
    if (isLive) {
      const updated = await updateSessionDB(sessionId, { dutyManager: volunteerId });
      if (updated) {
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        showToast("Duty manager assigned");
      } else {
        showToast("Failed to assign duty manager", "error");
      }
    } else {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, dutyManager: volunteerId } : s
      ));
      showToast("Duty manager assigned");
    }
    
    setSaving(key, false);
  };

  const setMorningClean = async (sessionId, volunteerId) => {
    const key = `mc-${sessionId}`;
    setSaving(key, true);
    
    if (isLive) {
      const updated = await updateSessionDB(sessionId, { morningClean: volunteerId });
      if (updated) {
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        showToast("Morning clean assigned");
      } else {
        showToast("Failed to assign morning clean", "error");
      }
    } else {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, morningClean: volunteerId } : s
      ));
      showToast("Morning clean assigned");
    }
    
    setSaving(key, false);
  };

  const clearMorningClean = async (sessionId) => {
    const key = `mc-${sessionId}`;
    setSaving(key, true);
    
    if (isLive) {
      const updated = await updateSessionDB(sessionId, { morningClean: null });
      if (updated) {
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        showToast("Morning clean cleared");
      } else {
        showToast("Failed to clear morning clean", "error");
      }
    } else {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, morningClean: null } : s
      ));
      showToast("Morning clean cleared");
    }
    
    setSaving(key, false);
  };

  const saveVolunteer = async (vol) => {
    setSaving('volunteer', true);
    
    if (editVol) {
      if (isLive) {
        const updated = await updateVolunteer(vol.id, vol);
        if (updated) {
          setVolunteers(prev => prev.map(v => v.id === vol.id ? updated : v));
          showToast("Volunteer updated");
        } else {
          showToast("Failed to update volunteer", "error");
        }
      } else {
        setVolunteers(prev => prev.map(v => v.id === vol.id ? vol : v));
        showToast("Volunteer updated");
      }
    } else {
      if (isLive) {
        const added = await addVolunteer(vol);
        if (added) {
          setVolunteers(prev => [...prev, added]);
          showToast("Volunteer added");
        } else {
          showToast("Failed to add volunteer", "error");
        }
      } else {
        const newVol = { ...vol, id: Date.now().toString() };
        setVolunteers(prev => [...prev, newVol]);
        showToast("Volunteer added");
      }
    }
    
    setShowVolForm(false);
    setEditVol(null);
    setSaving('volunteer', false);
  };

  const deleteVolunteer = async (id) => {
    if (!confirm("Delete this volunteer?")) return;
    
    setSaving(`del-vol-${id}`, true);
    
    if (isLive) {
      const success = await deleteVolunteerDB(id);
      if (success) {
        setVolunteers(prev => prev.filter(v => v.id !== id));
        showToast("Volunteer deleted");
      } else {
        showToast("Failed to delete volunteer", "error");
      }
    } else {
      setVolunteers(prev => prev.filter(v => v.id !== id));
      showToast("Volunteer deleted");
    }
    
    setSaving(`del-vol-${id}`, false);
  };

  const deleteSession = async (se) => {
    if (!confirm(`Delete this session (${formatDate(se.date)})?`)) return;
    
    setSaving(`del-session-${se.id}`, true);
    
    const yr = se.date.getFullYear();
    const mo = String(se.date.getMonth() + 1).padStart(2, '0');
    const dy = String(se.date.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${dy}`;
    
    if (isLive) {
      const success = await deleteSessionDB(se.id);
      if (success) {
        await addDeletedDate(dateStr);
        deletedDatesCache = [...deletedDatesCache, dateStr];
        setSessions(prev => prev.filter(s => s.id !== se.id));
        showToast("Session deleted");
      } else {
        showToast("Failed to delete session", "error");
      }
    } else {
      setSessions(prev => prev.filter(s => s.id !== se.id));
      showToast("Session deleted");
    }
    
    setSaving(`del-session-${se.id}`, false);
  };

  const addExtraSession = async (newSession) => {
    setSaving('add-session', true);
    
    if (isLive) {
      console.log('Adding session:', newSession);
      const added = await addExtraSessionDB(newSession);
      console.log('Result from addExtraSessionDB:', added);
      if (added) {
        setSessions(prev => [...prev, added].sort((a, b) => a.date - b.date));
        showToast("Session added");
      } else {
        console.error('Failed to add session - addExtraSessionDB returned null/falsy');
        showToast("Failed to add session", "error");
      }
    } else {
      const id = Date.now().toString();
      setSessions(prev => [...prev, { ...newSession, id }].sort((a, b) => a.date - b.date));
      showToast("Session added");
    }
    
    setShowNewDay(false);
    setSaving('add-session', false);
  };

  // ─── Styles ─────────────────────────────────────
  const c = {
    page: { fontFamily: "system-ui, -apple-system, sans-serif", background: "#f5f7fa", minHeight: "100vh", padding: "calc(12px + env(safe-area-inset-top)) 10px 12px" },
    header: { maxWidth: 1000, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
    logo: { fontSize: 22, fontWeight: 800, color: "#1a237e", letterSpacing: "-0.5px" },
    nav: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
    navBtn: { background: "white", border: "2px solid #1a237e", borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#1a237e", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" },
    pBtn: { background: "#1a237e", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" },
    container: { maxWidth: 1000, margin: "0 auto" },
    monthHead: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", padding: "10px 16px", borderRadius: 12, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
    monthTxt: { fontSize: 18, fontWeight: 700, color: "#1a237e" },
    card: (dayType, eventType) => {
      let bg = "#E3F2FD", border = "#64B5F6";
      if (eventType) { bg = "#F3E5F5"; border = "#CE93D8"; }
      else if (dayType === "wednesday") { bg = "#E8F5E9"; border = "#81C784"; }
      else if (dayType === "friday") { bg = "#FFF3E0"; border = "#FFB74D"; }
      return { background: bg, border: `2px solid ${border}`, borderRadius: 10, padding: "8px 10px", marginBottom: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" };
    },
    cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
    dateTxt: (dayType, eventType) => {
      let color = "#1976D2";
      if (eventType) color = "#9C27B0";
      else if (dayType === "wednesday") color = "#388E3C";
      else if (dayType === "friday") color = "#F57C00";
      return { fontSize: 14, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" };
    },
    badge: (bg) => ({ background: bg, color: "white", fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 6px", marginLeft: 3, textTransform: "uppercase" }),
    section: { marginBottom: 5 },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: "#777", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.3px" },
    volGrid: { display: "flex", flexWrap: "wrap", gap: 4 },
    volChip: (selected, past) => ({
      background: selected ? "#1a237e" : "white",
      color: selected ? "white" : "#333",
      border: selected ? "2px solid #1a237e" : "2px solid #ddd",
      borderRadius: 6,
      padding: "4px 10px",
      fontSize: 12,
      fontWeight: 600,
      cursor: past ? "default" : "pointer",
      opacity: past ? 0.5 : 1,
      transition: "all 0.2s"
    }),
    dmSelect: { width: "100%", padding: "6px", fontSize: 12, border: "2px solid #ddd", borderRadius: 6, background: "white", color: "#333", cursor: "pointer" },
    mcRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", background: "#f8f9fa", borderRadius: 6 },
    mcTxt: { fontSize: 12, color: "#666" },
    smBtn: (bg) => ({ background: bg, color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
    modal: { background: "white", borderRadius: 14, padding: 24, width: "90%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
    mTitle: { fontSize: 20, fontWeight: 700, color: "#1a237e", marginBottom: 16 },
    fg: { marginBottom: 14 },
    fl: { display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 },
    fi: { width: "100%", padding: "10px", fontSize: 14, border: "2px solid #ddd", borderRadius: 8, outline: "none" },
    fc: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14 },
    fb: { display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" },
    volListItem: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "white", borderRadius: 10, marginBottom: 8, boxShadow: "0 2px 4px rgba(0,0,0,0.06)" },
    volName: { fontSize: 15, fontWeight: 600, color: "#333" },
    volInfo: { fontSize: 12, color: "#888", marginTop: 2 },
    volBadges: { display: "flex", gap: 4, flexWrap: "wrap" },
    myShiftsCard: { background: "white", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
    statusBar: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#1a237e", color: "white", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 10000 },
    toastContainer: { position: "fixed", top: 20, right: 20, zIndex: 10001, display: "flex", flexDirection: "column", gap: 10 },
    toast: (type) => ({
      background: type === 'error' ? '#ef5350' : '#4caf50',
      color: 'white',
      padding: '12px 20px',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      animation: 'slideIn 0.3s ease-out',
      minWidth: 200
    }),
    spinner: { display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginLeft: 6 }
  };

  // ─── Calendar Component ─────────────────────────
  const CalendarPicker = () => {
    const [calYear, setCalYear] = useState(year);
    const [calMonth, setCalMonth] = useState(month);

    const calPrev = () => {
      if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
      else { setCalMonth(calMonth - 1); }
    };
    const calNext = () => {
      if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
      else { setCalMonth(calMonth + 1); }
    };

    const selectDate = (d) => {
      setYear(calYear);
      setMonth(calMonth);
      setShowCalendar(false);
    };

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const offset = (firstDay + 6) % 7;

    const cells = [];
    for (let i = 0; i < offset; i++) {
      cells.push(<div key={`empty-${i}`} style={{ padding: 8 }} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calYear, calMonth, d);
      const dow = date.getDay();
      const isBarDay = dow === 3 || dow === 5 || dow === 0;
      const eventType = getSpecialEvent(calYear, calMonth, d);
      const isSkipped = shouldSkipDate(date);

      let bg = "#f0f0f0";
      let color = "#999";
      let border = "2px solid transparent";

      if (isSkipped) {
        bg = "#ffebee"; color = "#999"; border = "2px solid #ef9a9a";
      } else if (eventType) {
        bg = "#F3E5F5"; border = "2px solid #CE93D8"; color = "#9C27B0";
      } else if (isBarDay) {
        if (dow === 0) { bg = "#E3F2FD"; border = "2px solid #64B5F6"; color = "#1976D2"; }
        else if (dow === 3) { bg = "#E8F5E9"; border = "2px solid #81C784"; color = "#388E3C"; }
        else if (dow === 5) { bg = "#FFF3E0"; border = "2px solid #FFB74D"; color = "#F57C00"; }
      }

      cells.push(
        <div key={d} onClick={() => selectDate(d)}
          style={{ padding: 8, textAlign: "center", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, background: bg, border, color }}>
          {d}
        </div>
      );
    }

    return (
      <div style={c.overlay} onClick={() => setShowCalendar(false)}>
        <div style={{ background: "white", borderRadius: 14, padding: 20, width: "90%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={calPrev} style={{ ...c.navBtn, width: 32, height: 32, fontSize: 14 }}>◀</button>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a237e" }}>{MONTH_NAMES[calMonth]} {calYear}</span>
            <button onClick={calNext} style={{ ...c.navBtn, width: 32, height: 32, fontSize: 14 }}>▶</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", marginBottom: 8 }}>
            {["M","T","W","T","F","S","S"].map((d,i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: "#999", padding: "4px 0" }}>{d}</div>
            ))}
            {cells}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" }}>
            {[
              ["Sun", "#E3F2FD", "#64B5F6"],
              ["Wed", "#E8F5E9", "#81C784"],
              ["Fri", "#FFF3E0", "#FFB74D"],
              ["Event", "#F3E5F5", "#CE93D8"],
              ["Extra", "#FFF8E1", "#FFD54F"],
            ].map(([lbl, bg, bdr]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#666" }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `2px solid ${bdr}` }} />
                {lbl}
              </div>
            ))}
          </div>
          <button onClick={() => setShowCalendar(false)} style={{ ...c.smBtn("#999"), width: "100%", marginTop: 12, padding: "8px" }}>Close</button>
        </div>
      </div>
    );
  };

  const VolunteerForm = () => {
    const [f, setF] = useState(editVol || { name: "", villa: "", email: "", rsa: false, dm: false, active: true });
    const isSaving = savingStates['volunteer'];
    const fi = { width: "100%", padding: "8px", fontSize: 13, border: "2px solid #ddd", borderRadius: 8, outline: "none", boxSizing: "border-box" };
    const fl = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 3 };
    
    return (
      <div id="vol-form" style={{ background: "white", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.1)", border: "2px solid #1a237e" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a237e", marginBottom: 12 }}>{editVol ? "Edit Volunteer" : "Add Volunteer"}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: "1 1 180px" }}><label style={fl}>Name</label><input style={fi} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Full name" /></div>
          <div style={{ flex: "0 0 100px" }}><label style={fl}>Villa</label><input style={fi} type="number" value={f.villa} onChange={e => setF({ ...f, villa: Number(e.target.value) })} placeholder="#" /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={fl}>Email</label><input style={fi} type="email" value={f.email || ""} onChange={e => setF({ ...f, email: e.target.value })} placeholder="email@example.com" />
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="checkbox" checked={f.rsa} onChange={e => setF({ ...f, rsa: e.target.checked })} />RSA</label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="checkbox" checked={f.dm} onChange={e => setF({ ...f, dm: e.target.checked })} />Duty Manager</label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active</label>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={{ background: "#999", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => { setShowVolForm(false); setEditVol(null); }} disabled={isSaving}>Cancel</button>
          <button 
            style={{ background: "#1a237e", color: "white", border: "none", borderRadius: 10, padding: "6px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isSaving ? 0.7 : 1 }} 
            onClick={() => { if (!f.name.trim() || isSaving) return; saveVolunteer(f); }}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : (editVol ? "Update" : "Add")}
          </button>
        </div>
      </div>
    );
  };

  // ─── Session Card Component ─────────────────────
  const SessionCard = ({ se, isLastOfDay }) => {
    const meIn = currentUserId && se.volunteers.includes(currentUserId);
    const meDM = currentUserId && se.dutyManager === currentUserId;
    const volsFull = se.volunteers.length >= se.needed;
    const full = volsFull && se.dutyManager;
    const past = se.date < new Date(new Date().setHours(0,0,0,0));
    const autoMC = getAutoMorningClean(se);
    const effectiveMC = se.morningCleanOverride ? se.morningClean : autoMC;
    const mcVol = effectiveMC ? volunteers.find(v => v.id === effectiveMC) : null;

    return (
      <div style={{ ...c.card(se.dayType, se.eventType), opacity: past ? 0.5 : 1 }} className="card-container" id={`session-${se.id}`}>
        <div style={c.cardHead}>
          <div>
            <span style={c.dateTxt(se.dayType, se.eventType)} className="date-header">
              {se.eventType && EVENT_STYLES[se.eventType] ? EVENT_STYLES[se.eventType].icon + " " : ""}
              {formatDate(se.date)}
              {past && <span style={{ background: "#9e9e9e", color: "white", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px", marginLeft: 4, textTransform: "uppercase" }}>✓ Done</span>}
              {isAdmin && se.eventName ? (
                <input
                  style={{ border: "1px solid #CE93D8", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700, background: "#F3E5F5", color: "#9C27B0", width: Math.max(60, se.eventName.length * 7), textTransform: "uppercase" }}
                  defaultValue={se.eventName}
                  onBlur={e => {
                    const newName = e.target.value.trim();
                    if (newName !== se.eventName) {
                      setSessions(prev => prev.map(s => s.id === se.id ? { ...s, eventName: newName || null } : s));
                      if (isLive) updateSessionDB(se.id, { eventName: newName || null });
                      showToast(newName ? "Event name updated" : "Event name removed");
                    }
                  }}
                  onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                />
              ) : isAdmin && !se.eventName ? (
                <button style={{ border: "1px dashed #bbb", borderRadius: 4, padding: "1px 6px", fontSize: 9, background: "transparent", color: "#999", cursor: "pointer" }}
                  onClick={e => {
                    const name = prompt("Event name:");
                    if (name && name.trim()) {
                      setSessions(prev => prev.map(s => s.id === se.id ? { ...s, eventName: name.trim() } : s));
                      if (isLive) updateSessionDB(se.id, { eventName: name.trim() });
                      showToast("Event name added");
                    }
                  }}>+ event</button>
              ) : se.isExtra && se.eventName ? (
                <span style={c.badge("#9C27B0")} className="shift-badge">{se.eventName}</span>
              ) : !se.isExtra && se.eventName ? (
                <span style={c.badge(EVENT_STYLES[se.eventType]?.label || "#666")} className="shift-badge">{se.eventName}</span>
              ) : se.isExtra && !se.eventName ? (
                <span style={c.badge("#FF9800")} className="shift-badge">Extra</span>
              ) : null}
            </span>
            <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
              ⏰ {isAdmin ? (() => {
                const parts = se.time.split(/\s*-\s*/);
                const startT = parts[0] || "4:30";
                const endT = parts[1] || "6:30";
                const tStyle = { border: "1px solid #ddd", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#f8f8ff", fontWeight: 600 };
                const updateTime = (newStart, newEnd) => {
                  const newTime = `${newStart} - ${newEnd}`;
                  setSessions(prev => prev.map(s => s.id === se.id ? { ...s, time: newTime } : s));
                  if (isLive) updateSessionDB(se.id, { time: newTime });
                  showToast("Shift time updated");
                };
                return (<>
                  <select style={tStyle} value={startT} onChange={e => updateTime(e.target.value, endT)}>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ color: "#888", fontSize: 11 }}> to </span>
                  <select style={tStyle} value={endT} onChange={e => updateTime(startT, e.target.value)}>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </>);
              })() : se.time} • {isAdmin ? (
                <select
                  style={{ border: "1px solid #ddd", borderRadius: 4, padding: "2px 4px", fontSize: 12, background: "#f8f8ff" }}
                  value={se.needed}
                  onChange={e => {
                    const newNeeded = Number(e.target.value);
                    setSessions(prev => prev.map(s => s.id === se.id ? { ...s, needed: newNeeded } : s));
                    if (isLive) updateSessionDB(se.id, { needed: newNeeded });
                    showToast("Volunteers needed updated");
                  }}
                >
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                se.volunteers.length === 0 
                  ? se.needed 
                  : se.volunteers.length >= se.needed 
                    ? se.needed 
                    : se.needed - se.volunteers.length
              )} {
                se.volunteers.length >= se.needed 
                  ? 'volunteers assigned' 
                  : se.volunteers.length === 0 
                    ? 'volunteers needed'
                    : `more ${se.needed - se.volunteers.length === 1 ? 'volunteer' : 'volunteers'} needed`
              }
              {se.volunteers.length >= se.needed && se.dutyManager && (
                <span style={{ 
                  marginLeft: 8, padding: "2px 8px", background: "#4caf50", color: "white", 
                  fontSize: 10, fontWeight: 700, borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.3px"
                }} className="shift-full-badge">
                  ✓ SHIFT FULL
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button style={{ ...c.smBtn("#d32f2f"), fontSize: 16, padding: "6px 10px" }} className="icon-button"
                onClick={() => deleteSession(se)} disabled={savingStates[`del-session-${se.id}`]} title="Delete session">
                {savingStates[`del-session-${se.id}`] ? "..." : "🗑️"}
              </button>
              <button style={{ ...c.smBtn("#1a237e"), fontSize: 14, padding: "6px 10px" }} className="icon-button"
                onClick={() => {
                  const d = se.date;
                  const yr = d.getFullYear();
                  const mo = String(d.getMonth() + 1).padStart(2, '0');
                  const dy = String(d.getDate()).padStart(2, '0');
                  setShowNewDay({ date: `${yr}-${mo}-${dy}`, dayType: se.dayType });
                }}
                title="Add another shift to this day">
                ➕
              </button>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <input type="date" title="Move session to another date"
                  style={{ border: "1px solid #ddd", borderRadius: 4, padding: "3px 4px", fontSize: 11, background: "#f8f8ff", width: 120, cursor: "pointer" }}
                  defaultValue={`${se.date.getFullYear()}-${String(se.date.getMonth()+1).padStart(2,'0')}-${String(se.date.getDate()).padStart(2,'0')}`}
                  onChange={e => {
                    const newDateStr = e.target.value;
                    if (!newDateStr) return;
                    const [yr, mo, dy] = newDateStr.split('-').map(Number);
                    const newDate = new Date(yr, mo - 1, dy, 0, 0, 0, 0);
                    if (!confirm(`Move this session to ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][newDate.getDay()]} ${dy}/${mo}/${yr}?`)) {
                      e.target.value = `${se.date.getFullYear()}-${String(se.date.getMonth()+1).padStart(2,'0')}-${String(se.date.getDate()).padStart(2,'0')}`;
                      return;
                    }
                    setSessions(prev => prev.map(s => s.id === se.id ? { ...s, date: newDate } : s).sort((a, b) => a.date - b.date));
                    if (isLive) updateSessionDB(se.id, { sessionDate: newDateStr });
                    showToast(`Session moved to ${newDateStr}`);
                  }}
                />
                <span style={{ fontSize: 9, color: "#999", fontWeight: 600 }}>Move date</span>
              </div>
            </div>
          )}
        </div>

        <div style={c.section}>
          <div style={c.sectionTitle}>📋 Duty Manager</div>
          {isAdmin ? (
            <select style={c.dmSelect} value={se.dutyManager || ""}
              onChange={e => setDutyManager(se.id, e.target.value || null)}
              disabled={past || savingStates[`dm-${se.id}`]}>
              <option value="">Select Duty Manager</option>
              {volunteers.filter(v => v.dm && v.active).map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: se.dutyManager ? "#333" : "#999", fontStyle: se.dutyManager ? "normal" : "italic" }}>
                {se.dutyManager ? volunteers.find(v => v.id === se.dutyManager)?.name : "No duty manager assigned"}
                {meDM && <span style={{ marginLeft: 6, color: "#1a237e", fontWeight: 700 }}>✓ You</span>}
              </div>
              {/* DM self-assign: show if logged in, user is DM-qualified, session not past */}
              {currentUserId && !past && (() => {
                const currentVol = volunteers.find(v => v.id === currentUserId);
                if (!currentVol || !currentVol.dm) return null;
                const isSavingDM = savingStates[`dm-${se.id}`];
                if (meDM) {
                  return (
                    <button
                      style={{ ...c.smBtn("#d32f2f"), marginTop: 4, padding: "3px 10px", fontSize: 11 }}
                      onClick={() => setDutyManager(se.id, null)}
                      disabled={isSavingDM}>
                      {isSavingDM ? "..." : "❌ Remove Me as DM"}
                    </button>
                  );
                }
                if (!se.dutyManager) {
                  return (
                    <button
                      style={{ ...c.pBtn, marginTop: 4, padding: "3px 10px", fontSize: 11 }}
                      onClick={() => setDutyManager(se.id, currentUserId)}
                      disabled={isSavingDM}>
                      {isSavingDM ? "..." : "📋 Sign Up as DM"}
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          )}
          {savingStates[`dm-${se.id}`] && <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Saving...</div>}
        </div>

        <div style={c.section}>
          <div style={c.sectionTitle} className="session-title">
            👥 Volunteers ({se.volunteers.length}/{se.needed})
            {se.volunteers.length >= se.needed && <span style={{ color: "#4caf50", marginLeft: 6 }} className="checkmark-icon">✓</span>}
          </div>
          {isAdmin ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {se.volunteers.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>No volunteers assigned yet</span>
                ) : (
                  se.volunteers.map(vid => {
                    const v = volunteers.find(vol => vol.id === vid);
                    if (!v) return null;
                    const key = `remove-vol-${se.id}-${vid}`;
                    const isSavingVol = savingStates[key];
                    return (
                      <div key={vid} style={{ background: "#1a237e", color: "white", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }} className="volunteer-chip">
                        <span>{v.name}</span>
                        <button onClick={() => removeVolunteerFromSessionLocal(se.id, vid)} disabled={past || isSavingVol}
                          style={{ background: "transparent", border: "none", color: "white", cursor: past || isSavingVol ? "default" : "pointer", fontSize: 14, padding: 0, opacity: past || isSavingVol ? 0.5 : 1 }}
                          title="Remove volunteer">
                          {isSavingVol ? "..." : "×"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
              {!past && (
                <select style={{ width: "100%", padding: "6px", fontSize: 12, border: "2px solid #ddd", borderRadius: 6, background: "white", color: "#333", cursor: "pointer" }}
                  value="" onChange={e => { if (e.target.value) { addVolunteerToSessionLocal(se.id, e.target.value); e.target.value = ""; } }}>
                  <option value="">+ Add Volunteer</option>
                  {volunteers.filter(v => v.active && !se.volunteers.includes(v.id)).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={c.volGrid}>
                {se.volunteers.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>No volunteers assigned yet</span>
                ) : (
                  se.volunteers.map(vid => {
                    const v = volunteers.find(vol => vol.id === vid);
                    if (!v) return null;
                    const isMe = currentUserId === vid;
                    return (
                      <span key={vid} style={{ fontSize: 12, color: isMe ? "#1a237e" : "#333", fontWeight: isMe ? 700 : 400 }}>
                        {v.name}{isMe && " ✓"}
                      </span>
                    );
                  })
                )}
              </div>
              {currentUserId && !past && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {meIn ? (
                    <button style={{ ...c.smBtn("#d32f2f"), padding: "4px 10px", fontSize: 12, fontWeight: 600 }}
                      onClick={() => removeVolunteerFromSessionLocal(se.id, currentUserId)}
                      disabled={savingStates[`remove-vol-${se.id}-${currentUserId}`]}>
                      {savingStates[`remove-vol-${se.id}-${currentUserId}`] ? "..." : "❌ Remove Me"}
                    </button>
                  ) : se.volunteers.length < se.needed ? (
                    <button style={{ ...c.pBtn, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}
                      onClick={() => addVolunteerToSessionLocal(se.id, currentUserId)}
                      disabled={savingStates[`add-vol-${se.id}-${currentUserId}`]}>
                      {savingStates[`add-vol-${se.id}-${currentUserId}`] ? "..." : "✋ Sign Me Up"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: "#ff9800", fontWeight: 600, fontStyle: "italic" }}>Shift Full</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={c.section}>
          <div style={c.sectionTitle}>🧹 Morning Clean (Next Day)</div>
          {isAdmin ? (
            <>
              <div style={c.mcRow}>
                <span style={c.mcTxt}>
                  {se.morningCleanOverride
                    ? (mcVol ? `Manual: ${mcVol.name}` : "Manual: Not set")
                    : (mcVol ? `Auto: ${mcVol.name}` : "Auto: None (no DM assigned)")}
                </span>
                {se.morningCleanOverride ? (
                  <button style={c.smBtn("#999")} onClick={() => clearMorningClean(se.id)} disabled={savingStates[`mc-${se.id}`]}>
                    {savingStates[`mc-${se.id}`] ? "..." : "Clear"}
                  </button>
                ) : (
                  <button style={c.smBtn("#1a237e")} onClick={() => setShowExtraShift(se.id)} disabled={savingStates[`mc-${se.id}`]}>
                    {savingStates[`mc-${se.id}`] ? "..." : "Override"}
                  </button>
                )}
              </div>
              {savingStates[`mc-${se.id}`] && <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Saving...</div>}
            </>
          ) : (
            <div style={{ fontSize: 12, color: mcVol ? "#333" : "#999", fontStyle: mcVol ? "normal" : "italic" }}>
              {mcVol ? mcVol.name : "None assigned"}
            </div>
          )}
        </div>

        {showExtraShift === se.id && (
          <div style={c.overlay} onClick={() => setShowExtraShift(null)}>
            <div style={c.modal} onClick={e => e.stopPropagation()}>
              <div style={c.mTitle}>Override Morning Clean</div>
              <select style={{ ...c.dmSelect, marginBottom: 16 }} defaultValue=""
                onChange={e => { if (e.target.value) { setMorningClean(se.id, e.target.value); setShowExtraShift(null); } }}>
                <option value="">Select volunteer</option>
                {volunteers.filter(v => v.active).map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <button style={{ ...c.smBtn("#999"), width: "100%", padding: "8px" }} onClick={() => setShowExtraShift(null)}>Cancel</button>
            </div>
          </div>
        )}

        {!isLastOfDay && <div style={{ height: 1, background: "#ddd", margin: "16px 0" }} />}
      </div>
    );
  };

  // ─── Render Logic ───────────────────────────────
  if (loading) {
    return (
      <div style={c.page}>
        <div style={c.container}>
          <div style={{ textAlign: "center", padding: 60, fontSize: 16, color: "#666" }}>
            <div style={{ fontSize: 24, marginBottom: 16 }}>🍺</div>
            Loading roster...
          </div>
        </div>
      </div>
    );
  }

  // ─── Views ──────────────────────────────────────

  if (view === "volunteers") {
    const activeVols = volunteers.filter(v => v.active);
    const inactiveVols = volunteers.filter(v => !v.active);

    return (
      <div style={c.page}>
        <div style={c.toastContainer}>
          {toasts.map(toast => (
            <div key={toast.id} style={c.toast(toast.type)}>{toast.message}</div>
          ))}
        </div>
        <div style={c.header}>
          <div style={c.logo}>👥 Volunteers</div>
          <div style={c.nav}>
            <button style={c.navBtn} onClick={() => setView("roster")}>Back to Roster</button>
            {isAdmin && <button style={c.pBtn} onClick={() => { setEditVol(null); setShowVolForm(true); }}>+ Add Volunteer</button>}
            {isAdmin && (() => {
              const bccEmails = volunteers.filter(v => v.active && v.email).map(v => v.email).join(',');
              return bccEmails ? (<>
                <a href={`mailto:?cc=paynterbar@gemwoods.com.au&bcc=${encodeURIComponent(bccEmails)}&subject=${encodeURIComponent('Paynter Bar Volunteers')}`}
                  style={{ ...c.pBtn, textDecoration: "none", display: "inline-block", background: "#388E3C" }}>
                  ✉️ Email All
                </a>
                <button style={{ ...c.pBtn, background: "#1565C0" }} onClick={() => {
                  const list = bccEmails.replace(/,/g, '; ');
                  navigator.clipboard.writeText(list).then(() => showToast("BCC list copied to clipboard")).catch(() => {
                    const ta = document.createElement('textarea'); ta.value = list; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast("BCC list copied to clipboard");
                  });
                }}>📋 Copy BCC</button>
              </>) : null;
            })()}
          </div>
        </div>
        <div style={c.container}>
          {showVolForm && <VolunteerForm />}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a237e", marginBottom: 12 }}>Active Volunteers ({activeVols.length})</div>
            {activeVols.map(v => (
              <div key={v.id} style={c.volListItem}>
                <div>
                  <div style={c.volName}>{v.name}</div>
                  <div style={c.volInfo}>Villa {v.villa}</div>
                  {isAdmin && v.email && <div style={{ fontSize: 11, color: "#1a237e", marginTop: 1 }}><a href={`mailto:${v.email}`} style={{ color: "#1a237e", textDecoration: "none" }}>{v.email}</a></div>}
                  <div style={c.volBadges}>
                    {v.rsa && <span style={c.badge("#4CAF50")}>RSA</span>}
                    {v.dm && <span style={c.badge("#2196F3")}>DM</span>}
                  </div>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={c.smBtn("#1a237e")} onClick={() => { setEditVol(v); setShowVolForm(true); }} disabled={savingStates[`del-vol-${v.id}`]}>Edit</button>
                    <button style={c.smBtn("#d32f2f")} onClick={() => deleteVolunteer(v.id)} disabled={savingStates[`del-vol-${v.id}`]}>
                      {savingStates[`del-vol-${v.id}`] ? "..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {inactiveVols.length > 0 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#999", marginBottom: 12 }}>Inactive Volunteers ({inactiveVols.length})</div>
              {inactiveVols.map(v => (
                <div key={v.id} style={{ ...c.volListItem, opacity: 0.6 }}>
                  <div>
                    <div style={c.volName}>{v.name}</div>
                    <div style={c.volInfo}>Villa {v.villa}</div>
                    {isAdmin && v.email && <div style={{ fontSize: 11, color: "#1a237e", marginTop: 1 }}><a href={`mailto:${v.email}`} style={{ color: "#1a237e", textDecoration: "none" }}>{v.email}</a></div>}
                    <div style={c.volBadges}>
                      {v.rsa && <span style={c.badge("#4CAF50")}>RSA</span>}
                      {v.dm && <span style={c.badge("#2196F3")}>DM</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={c.smBtn("#1a237e")} onClick={() => { setEditVol(v); setShowVolForm(true); }} disabled={savingStates[`del-vol-${v.id}`]}>Edit</button>
                      <button style={c.smBtn("#d32f2f")} onClick={() => deleteVolunteer(v.id)} disabled={savingStates[`del-vol-${v.id}`]}>
                        {savingStates[`del-vol-${v.id}`] ? "..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "notices") {
    const NoticeForm = ({ existing, onSave, onCancel }) => {
      const [title, setTitle] = useState(existing ? existing.title : "");
      const [content, setContent] = useState(existing ? existing.content : "");
      const [saving, setSavingForm] = useState(false);
      const fi = { width: "100%", padding: "8px", fontSize: 13, border: "2px solid #ddd", borderRadius: 8, outline: "none", boxSizing: "border-box" };
      const fl = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 3 };
      return (
        <div style={{ background: "white", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.1)", border: "2px solid #1a237e" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a237e", marginBottom: 12 }}>{existing ? "Edit Notice" : "New Notice"}</div>
          <div style={{ marginBottom: 10 }}><label style={fl}>Title</label><input style={fi} value={title} onChange={e => setTitle(e.target.value)} placeholder="Notice title" /></div>
          <div style={{ marginBottom: 10 }}><label style={fl}>Content</label><textarea style={{ ...fi, minHeight: 80, resize: "vertical" }} value={content} onChange={e => setContent(e.target.value)} placeholder="Notice details..." /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button style={{ background: "#999", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={onCancel} disabled={saving}>Cancel</button>
            <button style={{ background: "#1a237e", color: "white", border: "none", borderRadius: 10, padding: "6px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
              disabled={!title.trim() || !content.trim() || saving}
              onClick={async () => {
                setSavingForm(true);
                if (existing) {
                  const updated = await updateAnnouncement(existing.id, { title, content });
                  if (updated) { setAnnouncements(prev => prev.map(a => a.id === existing.id ? updated : a)); showToast("Notice updated"); }
                  else showToast("Failed to update notice", "error");
                } else {
                  const added = await addAnnouncement(title, content);
                  if (added) { setAnnouncements(prev => [added, ...prev]); showToast("Notice added"); }
                  else showToast("Failed to add notice", "error");
                }
                setSavingForm(false);
                onSave();
              }}>
              {saving ? "Saving..." : (existing ? "Update" : "Post")}
            </button>
          </div>
        </div>
      );
    };

    const handleDeleteNotice = async (id) => {
      if (!confirm("Delete this notice?")) return;
      const success = await deleteAnnouncementDB(id);
      if (success) { setAnnouncements(prev => prev.filter(a => a.id !== id)); showToast("Notice deleted"); }
      else showToast("Failed to delete notice", "error");
    };

    const formatNoticeDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div style={c.page}>
        <div style={c.toastContainer}>
          {toasts.map(toast => (
            <div key={toast.id} style={c.toast(toast.type)}>{toast.message}</div>
          ))}
        </div>
        <div style={c.header}>
          <div style={c.logo}>📢 Notices</div>
          <div style={c.nav}>
            <button style={c.navBtn} onClick={() => setView("roster")}>Back to Roster</button>
            {isAdmin && <button style={c.pBtn} onClick={() => { setEditNotice(null); setShowNoticeForm(true); }}>+ New Notice</button>}
          </div>
        </div>
        <div style={c.container}>
          {showNoticeForm && (
            <NoticeForm
              existing={editNotice}
              onSave={() => { setShowNoticeForm(false); setEditNotice(null); }}
              onCancel={() => { setShowNoticeForm(false); setEditNotice(null); }}
            />
          )}
          {announcements.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, fontSize: 15, color: "#999" }}>No notices at this time.</div>
          ) : (
            announcements.map(a => (
              <div key={a.id} style={{ background: "white", borderRadius: 10, padding: "12px 16px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: "4px solid #1a237e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a237e" }}>{a.title}</div>
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button style={c.smBtn("#1a237e")} onClick={() => { setEditNotice(a); setShowNoticeForm(true); }}>Edit</button>
                      <button style={c.smBtn("#d32f2f")} onClick={() => handleDeleteNotice(a.id)}>Delete</button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#444", whiteSpace: "pre-wrap", marginBottom: 6 }}>{a.content}</div>
                <div style={{ fontSize: 11, color: "#999" }}>
                  Posted {formatNoticeDate(a.created_at)}
                  {a.updated_at !== a.created_at && ` • Updated ${formatNoticeDate(a.updated_at)}`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "instructions") {
    const sections = [
      { title: "🔧 Enabling Admin Mode", items: [
        "Tap the 🔧 Admin button in the top nav bar",
        "Enter the 4-digit admin PIN to unlock",
        "Tap 🔧 Admin ON again to disable admin mode",
        "Admin features are only visible while admin mode is active"
      ]},
      { title: "📋 Session Cards (Roster View)", items: [
        "Each card shows a bar session with date, time, volunteers and duty manager",
        "Colour coding: Green = Wednesday, Orange = Friday, Blue = Sunday, Purple = Special Event",
        "Past sessions show a grey ✓ Done badge and are faded out",
        "✓ SHIFT FULL badge appears when all volunteer spots are filled and a DM is assigned"
      ]},
      { title: "⏰ Editing Shift Times", items: [
        "In admin mode, the time shows as two dropdowns (Start and End)",
        "Select from 30-minute intervals between 10:00 AM and 8:00 PM",
        "Changes save automatically when you select a new time"
      ]},
      { title: "👥 Managing Volunteers on Shifts", items: [
        "In admin mode, use the '+ Add Volunteer' dropdown on each session card to assign volunteers",
        "Click the × next to a volunteer's name to remove them from a shift",
        "The volunteers needed count can be changed via the dropdown (1-4)"
      ]},
      { title: "📋 Duty Manager", items: [
        "In admin mode, select a duty manager from the dropdown on each session card",
        "Only volunteers flagged as DM-qualified appear in the dropdown",
        "Non-admin DM-qualified volunteers can self-assign via the 📋 Sign Up as DM button"
      ]},
      { title: "🧹 Morning Clean", items: [
        "Automatically assigned to the duty manager (Auto mode)",
        "Use the Override button to manually assign a different volunteer",
        "Use Clear to return to automatic assignment"
      ]},
      { title: "📅 Moving a Session Date", items: [
        "In admin mode, each session card has a date picker on the right",
        "Select a new date to move the session — a confirmation dialog will appear",
        "The session will re-sort into the correct position after moving"
      ]},
      { title: "➕ Adding Extra Sessions", items: [
        "Tap '+ Add Extra Day' at the top of the roster in admin mode",
        "Set the date, event name (optional), start/end time, and volunteers needed",
        "You can also tap the ➕ button on any session card to add another shift on the same day"
      ]},
      { title: "🗑️ Deleting Sessions", items: [
        "Tap the 🗑️ button on a session card in admin mode",
        "Confirm the deletion — the date is permanently removed and won't regenerate"
      ]},
      { title: "👥 Managing Volunteers List", items: [
        "Tap 👥 Volunteers in the nav to see all volunteers",
        "In admin mode: Add, Edit, or Delete volunteers",
        "Each volunteer has: Name, Villa, Email, RSA status, DM qualification, Active/Inactive",
        "Email addresses are shown in admin mode and are clickable (opens mail client)",
        "Inactive volunteers are shown separately at the bottom"
      ]},
      { title: "✉️ Email All Volunteers", items: [
        "In admin mode on the Volunteers page, tap the green '✉️ Email All' button",
        "Opens your mail client with all active volunteer emails in BCC",
        "CC is set to paynterbar@gemwoods.com.au",
        "Subject line pre-filled as 'Paynter Bar Volunteers'"
      ]},
      { title: "👤 Volunteer Sign-In (Non-Admin)", items: [
        "Volunteers can sign in using the dropdown bar below the header",
        "Once signed in, they can view their upcoming shifts via 📅 My Shifts",
        "Signed-in volunteers can tap ✋ Sign Me Up or ❌ Remove Me on future sessions",
        "DM-qualified volunteers can self-assign as duty manager"
      ]},
      { title: "💾 Export Backup", items: [
        "In admin mode, tap the green '💾 Export' button in the top nav",
        "Downloads a JSON file containing all volunteers, sessions, and announcements",
        "File is named roster-backup-YYYY-MM-DD.json with today's date",
        "Save the downloaded file to: OneDrive > Roster > Backup",
        "Recommended: export weekly as a safeguard against data loss",
        "The JSON file can be used to restore the roster if anything goes wrong in Supabase"
      ]},
      { title: "📅 Calendar Picker", items: [
        "Tap the 📅 icon next to the month name to open the calendar view",
        "Colour-coded to show bar days, events, and skipped dates",
        "Tap any date to navigate to that month"
      ]},
    ];

    return (
      <div style={c.page}>
        <div style={c.header}>
          <div style={c.logo}>❓ Admin Guide</div>
          <div style={c.nav}>
            <button style={c.navBtn} onClick={() => setView("roster")}>Back to Roster</button>
          </div>
        </div>
        <div style={c.container}>
          {sections.map((s, i) => (
            <div key={i} style={{ background: "white", borderRadius: 10, padding: "12px 16px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a237e", marginBottom: 8 }}>{s.title}</div>
              {s.items.map((item, j) => (
                <div key={j} style={{ fontSize: 13, color: "#444", padding: "3px 0 3px 16px", position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "#999" }}>•</span>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "stats") {
    // Load all sessions on first visit
    if (allSessions.length === 0 && !statsLoading && isLive) {
      setStatsLoading(true);
      getAllSessions().then(data => { setAllSessions(data); setStatsLoading(false); });
    }

    const statsSessions = statsTab === 'alltime' ? allSessions : sessions;
    const today = new Date(new Date().setHours(0,0,0,0));
    const volStats = volunteers.filter(v => v.active).map(vol => {
      const shifts = statsSessions.filter(s => s.volunteers && s.volunteers.includes(vol.id));
      const dmShifts = statsSessions.filter(s => s.dutyManager === vol.id);
      const upcoming = shifts.filter(s => s.date >= today);
      const past = shifts.filter(s => s.date < today);
      return { ...vol, totalShifts: shifts.length, dmShifts: dmShifts.length, upcoming: upcoming.length, past: past.length };
    });
    if (statsSort === 'shifts') volStats.sort((a, b) => b.totalShifts - a.totalShifts);
    else if (statsSort === 'dm') volStats.sort((a, b) => b.dmShifts - a.dmShifts || b.totalShifts - a.totalShifts);
    else if (statsSort === 'name') volStats.sort((a, b) => a.name.localeCompare(b.name));
    else if (statsSort === 'villa') volStats.sort((a, b) => a.villa - b.villa);
    else if (statsSort === 'upcoming') volStats.sort((a, b) => b.upcoming - a.upcoming || b.totalShifts - a.totalShifts);

    const maxShifts = Math.max(...volStats.map(v => v.totalShifts), 1);
    const tabStyle = (active) => ({ padding: "6px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", background: active ? "#1a237e" : "#e0e0e0", color: active ? "white" : "#666" });

    return (
      <div style={c.page}>
        <div style={c.toastContainer}>
          {toasts.map(toast => (
            <div key={toast.id} style={c.toast(toast.type)}>{toast.message}</div>
          ))}
        </div>
        <div style={c.header}>
          <div style={c.logo}>📊 Volunteer Stats</div>
          <div style={c.nav}>
            <button style={c.navBtn} onClick={() => setView("roster")}>Back to Roster</button>
          </div>
        </div>
        <div style={c.container}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button style={tabStyle(statsTab === 'alltime')} onClick={() => setStatsTab('alltime')}>All Time</button>
            <button style={tabStyle(statsTab === 'month')} onClick={() => setStatsTab('month')}>This Month</button>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#999", fontWeight: 600, marginRight: 4 }}>Sort by:</span>
            {[["shifts", "Most Shifts"], ["dm", "Most DM"], ["upcoming", "Upcoming"], ["name", "Name"], ["villa", "Villa"]].map(([key, label]) => (
              <button key={key} style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: statsSort === key ? "#1a237e" : "#f0f0f0", color: statsSort === key ? "white" : "#666" }} onClick={() => setStatsSort(key)}>{label}</button>
            ))}
          </div>
          {statsLoading ? (
            <div style={{ textAlign: "center", padding: 40, fontSize: 15, color: "#999" }}>Loading stats...</div>
          ) : (
          <>
          <div style={{ background: "white", borderRadius: 10, padding: "12px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", marginBottom: 8, padding: "0 4px" }}>
              <span>{volStats.length} active volunteers</span>
              <span>{statsSessions.length} sessions {statsTab === 'month' ? 'this month' : 'total'}</span>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ textAlign: "center", padding: "8px 16px", background: "#E8F5E9", borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#388E3C" }}>{volStats.reduce((sum, v) => sum + v.totalShifts, 0)}</div>
                <div style={{ fontSize: 11, color: "#666" }}>Total assignments</div>
              </div>
              <div style={{ textAlign: "center", padding: "8px 16px", background: "#E3F2FD", borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1976D2" }}>{volStats.reduce((sum, v) => sum + v.dmShifts, 0)}</div>
                <div style={{ fontSize: 11, color: "#666" }}>DM assignments</div>
              </div>
              <div style={{ textAlign: "center", padding: "8px 16px", background: "#FFF3E0", borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#F57C00" }}>{volStats.filter(v => v.totalShifts === 0).length}</div>
                <div style={{ fontSize: 11, color: "#666" }}>No shifts yet</div>
              </div>
            </div>
          </div>
          {volStats.map((v, i) => (
            <div key={v.id} style={{ background: "white", borderRadius: 8, padding: "8px 12px", marginBottom: 4, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#999", width: 20, textAlign: "right" }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{v.name} <span style={{ fontSize: 11, color: "#999", fontWeight: 400 }}>V{v.villa}</span></div>
                  <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                    <span style={{ color: "#388E3C", fontWeight: 700 }}>{v.totalShifts} shifts</span>
                    {v.dmShifts > 0 && <span style={{ color: "#1976D2", fontWeight: 600 }}>{v.dmShifts} DM</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(v.totalShifts / maxShifts) * 100}%`, height: "100%", background: v.totalShifts === 0 ? "#eee" : "#66BB6A", borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#999", whiteSpace: "nowrap" }}>{v.past} done · {v.upcoming} upcoming</div>
                </div>
              </div>
            </div>
          ))}
          </>
          )}
        </div>
      </div>
    );
  }

  if (view === "myshifts") {
    if (!currentUserId) {
      return (
        <div style={c.page}>
          <div style={c.header}>
            <div style={c.logo}>📅 My Shifts</div>
            <div style={c.nav}>
              <button style={c.navBtn} onClick={() => setView("roster")}>Back to Roster</button>
            </div>
          </div>
          <div style={c.container}>
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 18, color: "#666", marginBottom: 20 }}>You need to identify yourself first to see your shifts.</div>
              <button style={c.pBtn} onClick={() => { setShowIdentify(true); setView("roster"); }}>Identify Yourself</button>
            </div>
          </div>
        </div>
      );
    }

    const myFutureSessions = sessions
      .filter(se => {
        const meIn = se.volunteers.includes(currentUserId);
        const meDM = se.dutyManager === currentUserId;
        const future = se.date >= new Date(new Date().setHours(0,0,0,0));
        return (meIn || meDM) && future;
      })
      .sort((a, b) => a.date - b.date);

    const currentUser = volunteers.find(v => v.id === currentUserId);

    return (
      <div style={c.page}>
        <div style={c.toastContainer}>
          {toasts.map(toast => (
            <div key={toast.id} style={c.toast(toast.type)}>{toast.message}</div>
          ))}
        </div>
        <div style={c.header}>
          <div style={c.logo}>📅 My Shifts</div>
          <div style={c.nav}>
            <button style={c.navBtn} onClick={() => setView("roster")}>Back to Roster</button>
          </div>
        </div>
        <div style={c.container}>
          <div style={{ background: "white", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a237e", marginBottom: 4 }}>{currentUser?.name}</div>
            <div style={{ fontSize: 13, color: "#888" }}>Villa {currentUser?.villa}</div>
            <button style={{ ...c.smBtn("#999"), marginTop: 12, padding: "6px 16px" }} onClick={() => { setCurrentUserId(null); setView("roster"); }}>Change Identity</button>
          </div>
          {myFutureSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, fontSize: 15, color: "#999" }}>You have no upcoming shifts.</div>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a237e", marginBottom: 16 }}>Upcoming Shifts ({myFutureSessions.length})</div>
              {myFutureSessions.map(se => {
                const meIn = se.volunteers.includes(currentUserId);
                const meDM = se.dutyManager === currentUserId;
                return (
                  <div key={se.id} style={c.myShiftsCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a237e", marginBottom: 4 }}>
                          {formatDate(se.date)}
                          {se.eventName && <span style={{ ...c.badge("#9C27B0"), marginLeft: 6 }}>{se.eventName}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "#666" }}>⏰ {se.time}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {meDM && <div style={c.badge("#2196F3")}>Duty Manager</div>}
                        {meIn && !meDM && <div style={c.badge("#4CAF50")}>Volunteer</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#888" }}>{se.volunteers.length} of {se.needed} volunteers assigned</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Roster View ───────────────────────────
  const monthSessions = sessions.filter(s => s.date.getFullYear() === year && s.date.getMonth() === month).sort((a, b) => a.date - b.date);
  const groupedByDay = monthSessions.reduce((acc, se) => {
    const key = se.date.toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(se);
    return acc;
  }, {});

  const parseTime = (timeStr) => {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  };
  
  Object.keys(groupedByDay).forEach(day => {
    groupedByDay[day].sort((a, b) => parseTime(a.time) - parseTime(b.time));
  });

  // Collapse past days in the current month by default (less scrolling to reach today)
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const isCurrentMonthView = year === now.getFullYear() && month === now.getMonth();
  const dayKeys = Object.keys(groupedByDay);
  const pastDayKeys = isCurrentMonthView ? dayKeys.filter(day => new Date(day) < todayMidnight) : [];
  const visibleDayKeys = (isCurrentMonthView && !showPastSessions) ? dayKeys.filter(day => !pastDayKeys.includes(day)) : dayKeys;

  return (
    <div style={c.page} className="page-container">
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .page-container { padding: calc(8px + env(safe-area-inset-top)) 6px 8px !important; }
          .header-container { margin-bottom: 8px !important; gap: 6px !important; padding: 0 4px; }
          .logo-text { font-size: 18px !important; }
          .nav-container { gap: 6px !important; }
          .nav-button { padding: 6px 10px !important; font-size: 12px !important; }
          .month-header { padding: 8px 12px !important; margin-bottom: 8px !important; }
          .month-title { font-size: 16px !important; }
          .card-container { padding: 10px !important; margin-bottom: 10px !important; }
          .shift-badge { padding: 3px 8px !important; font-size: 11px !important; }
          .shift-full-badge { padding: 4px 8px !important; font-size: 10px !important; top: 8px !important; right: 8px !important; }
          .volunteer-chip { padding: 3px 8px !important; font-size: 11px !important; }
          .date-header { font-size: 15px !important; margin-bottom: 8px !important; }
          .session-title { font-size: 14px !important; }
          .icon-button { padding: 6px !important; width: 32px !important; height: 32px !important; }
          .checkmark-icon { font-size: 16px !important; }
        }
      `}</style>

      <div style={c.toastContainer}>
        {toasts.map(toast => (
          <div key={toast.id} style={c.toast(toast.type)}>{toast.message}</div>
        ))}
      </div>

      <div style={c.header} className="header-container">
        <div style={c.logo} className="logo-text">🍺 Paynter Bar</div>
        <div style={c.nav} className="nav-container">
          <button style={c.navBtn} className="nav-button" onClick={async () => { showToast("Refreshing..."); const [vols, , anns] = await Promise.all([getVolunteers(), loadDeletedDates(), getAnnouncements()]); setVolunteers(vols); setAnnouncements(anns || []); const data = await getSessionsForMonth(year, month + 1); setSessions(data.map(s => ({...s, date: new Date(s.date)}))); showToast("Data refreshed"); }}>🔄</button>
          <button style={c.navBtn} className="nav-button" onClick={() => setView("volunteers")}>👥 Volunteers</button>
          <button style={c.navBtn} className="nav-button" onClick={() => setView("notices")}>📢 Notices{announcements.length > 0 ? ` (${announcements.length})` : ""}</button>
          <button style={c.navBtn} className="nav-button" onClick={() => { if (currentUserId) setView("myshifts"); else setShowIdentify(true); }}>📅 My Shifts</button>
          <button style={{ ...c.navBtn, ...(isAdmin ? { background: "#1a237e", color: "white" } : {}) }} className="nav-button" onClick={toggleAdmin}>
            🔧 {isAdmin ? "Admin ON" : "Admin"}
          </button>
          {isAdmin && <button style={c.navBtn} className="nav-button" onClick={() => setView("instructions")}>❓ Help</button>}
          {isAdmin && <button style={c.navBtn} className="nav-button" onClick={() => setView("stats")}>📊 Stats</button>}
          {isAdmin && <button style={{ ...c.navBtn, background: "#388E3C", color: "white" }} className="nav-button" onClick={() => {
            const data = { exportDate: new Date().toISOString(), volunteers, sessions: sessions.map(s => ({ ...s, date: s.date.toISOString().split('T')[0] })), announcements };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `roster-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click(); URL.revokeObjectURL(url);
            showToast('Backup downloaded');
          }}>💾 Export</button>}
        </div>
      </div>

      {/* Volunteer Sign-In Bar */}
      <div style={c.container}>
        <div style={{
          background: currentUserId ? "#e8eaf6" : "white",
          borderRadius: 10,
          padding: "8px 14px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          border: currentUserId ? "2px solid #1a237e" : "2px solid #ddd",
          flexWrap: "wrap"
        }}>
          {currentUserId ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1a237e" }}>
                👤 {volunteers.find(v => v.id === currentUserId)?.name}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...c.navBtn, padding: "4px 12px", fontSize: 12 }} onClick={() => setView("myshifts")}>📅 My Shifts</button>
                <button style={{ background: "#999", color: "white", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  onClick={() => { setCurrentUserId(null); showToast("Signed out"); }}>
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "#888" }}>👤 Sign in to manage your shifts</span>
              <select
                style={{ padding: "6px 10px", fontSize: 13, border: "2px solid #1a237e", borderRadius: 8, background: "white", color: "#1a237e", fontWeight: 600, cursor: "pointer", minWidth: 160 }}
                value=""
                onChange={e => {
                  if (e.target.value) {
                    setCurrentUserId(e.target.value);
                    const vol = volunteers.find(v => v.id === e.target.value);
                    if (vol) showToast(`Welcome, ${vol.name}!`);
                  }
                }}
              >
                <option value="">Select your name...</option>
                {volunteers.filter(v => v.active).map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div style={c.container}>
        <div style={c.monthHead} className="month-header">
          <button onClick={prevMonth} style={c.navBtn} className="nav-button">◀</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={c.monthTxt} className="month-title">{MONTH_NAMES[month]} {year}</span>
            <button style={{ ...c.navBtn, padding: "6px 12px", fontSize: 12 }} className="nav-button" onClick={() => setShowCalendar(true)}>📅</button>
          </div>
          <button onClick={nextMonth} style={c.navBtn} className="nav-button">▶</button>
        </div>

        {isAdmin && (
          <div style={{ marginBottom: 20 }} id="add-shift-form">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: showNewDay ? 12 : 0 }}>
              <button style={c.pBtn} onClick={() => setShowNewDay(showNewDay ? false : true)} disabled={savingStates['add-session']}>
                {savingStates['add-session'] ? <span>Adding<span style={c.spinner} /></span> : showNewDay ? "✕ Cancel" : "+ Add Extra Day"}
              </button>
            </div>
            {showNewDay && (
              <InlineNewDayForm
                onClose={() => setShowNewDay(false)}
                onAdd={addExtraSession}
                isSaving={savingStates['add-session']}
                initialDate={typeof showNewDay === 'object' ? showNewDay.date : (typeof showNewDay === 'string' ? showNewDay : "")}
                initialDayType={typeof showNewDay === 'object' ? showNewDay.dayType : null}
                styles={c}
              />
            )}
          </div>
        )}

        {monthSessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, fontSize: 16, color: "#999" }}>No sessions this month.</div>
        ) : (
          <>
            {isCurrentMonthView && pastDayKeys.length > 0 && (
              <button
                onClick={() => setShowPastSessions(s => !s)}
                style={{ ...c.navBtn, width: "100%", marginBottom: 12, textAlign: "center", color: "#666", borderColor: "#ccc" }}
              >
                {showPastSessions ? `▲ Hide earlier sessions (${pastDayKeys.length})` : `▼ Show earlier sessions this month (${pastDayKeys.length})`}
              </button>
            )}
            {visibleDayKeys.map(day => {
              const daySessions = groupedByDay[day];
              return (
                <div key={day}>
                  {daySessions.map((se, idx) => (
                    <SessionCard key={se.id} se={se} isLastOfDay={idx === daySessions.length - 1} />
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>

      {showPinDialog && (
        <div style={c.overlay} onClick={() => setShowPinDialog(false)}>
          <div style={c.modal} onClick={e => e.stopPropagation()}>
            <div style={c.mTitle}>Enter Admin PIN</div>
            <input type="password" style={{ ...c.fi, marginBottom: 16 }} value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handlePinSubmit(); }}
              placeholder="Enter PIN" autoFocus />
            {pinError && <div style={{ color: "#d32f2f", fontSize: 13, marginBottom: 12 }}>{pinError}</div>}
            <div style={c.fb}>
              <button style={{ ...c.smBtn("#999"), padding: "8px 16px" }} onClick={() => setShowPinDialog(false)}>Cancel</button>
              <button style={{ ...c.pBtn, padding: "8px 20px" }} onClick={handlePinSubmit}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {showIdentify && (
        <div style={c.overlay} onClick={() => setShowIdentify(false)}>
          <div style={c.modal} onClick={e => e.stopPropagation()}>
            <div style={c.mTitle}>Who are you?</div>
            <div style={{ marginBottom: 16, fontSize: 14, color: "#666" }}>Select your name to see your shifts</div>
            {volunteers.filter(v => v.active).map(v => (
              <button key={v.id}
                style={{ ...c.navBtn, width: "100%", marginBottom: 8, padding: "12px", textAlign: "left" }}
                onClick={() => { setCurrentUserId(v.id); setShowIdentify(false); showToast(`Welcome, ${v.name}!`); }}>
                {v.name}
              </button>
            ))}
            <button style={{ ...c.smBtn("#999"), width: "100%", marginTop: 8, padding: "8px" }} onClick={() => setShowIdentify(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showCalendar && <CalendarPicker />}
      {statusMsg && <div style={c.statusBar}>{statusMsg}</div>}
    </div>
  );
}

function InlineNewDayForm({ onClose, onAdd, isSaving, initialDate = "", initialDayType = null, styles }) {
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("5:00");
  const [endTime, setEndTime] = useState("7:00");
  const [needed, setNeeded] = useState(2);
  const [eventName, setEventName] = useState("");

  const EVENT_OPTIONS = [
    "",
    "Trivia",
    "Bingo",
    "Social",
    "Melbourne Cup",
    "Australia Day",
    "Christmas in July",
    "Live Music",
    "Special Event",
    "Private Function",
    "Other"
  ];
  const [customEvent, setCustomEvent] = useState("");

  const handleAdd = () => {
    if (!date) return;
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dow = initialDayType || ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];
    const finalName = eventName === "Other" ? customEvent.trim() : eventName;
    onAdd({
      date: d, dayType: dow, eventType: null, eventName: finalName,
      time: `${startTime} - ${endTime}`, needed, volunteers: [], dutyManager: null, morningClean: null,
      morningCleanOverride: false, isExtra: true, shiftLabel: finalName || formatDate(d)
    });
  };

  const fi = { width: "100%", padding: "8px", fontSize: 13, border: "2px solid #ddd", borderRadius: 8, outline: "none", boxSizing: "border-box", background: "white" };
  const fl = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 3 };

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.1)", border: "2px solid #1a237e" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 140px" }}><label style={fl}>Date</label><input type="date" style={fi} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div style={{ flex: "1 1 140px" }}>
          <label style={fl}>Event (optional)</label>
          <select style={fi} value={eventName} onChange={e => setEventName(e.target.value)}>
            {EVENT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt || "— None —"}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 80px" }}>
          <label style={fl}>Start</label>
          <select style={fi} value={startTime} onChange={e => setStartTime(e.target.value)}>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 80px" }}>
          <label style={fl}>End</label>
          <select style={fi} value={endTime} onChange={e => setEndTime(e.target.value)}>
            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 80px" }}>
          <label style={fl}>Needed</label>
          <select style={fi} value={needed} onChange={e => setNeeded(Number(e.target.value))}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {eventName === "Other" && (
        <div style={{ marginBottom: 12 }}>
          <input type="text" style={fi} value={customEvent} onChange={e => setCustomEvent(e.target.value)} placeholder="Enter custom event name" />
        </div>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={{ background: "#999", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={onClose} disabled={isSaving}>Cancel</button>
        <button style={{ background: "#1a237e", color: "white", border: "none", borderRadius: 10, padding: "6px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isSaving ? 0.7 : 1 }} onClick={handleAdd} disabled={!date || isSaving}>
          {isSaving ? "Adding..." : "Add Shift"}
        </button>
      </div>
    </div>
  );
}
