// rosterTime.js — turn the roster's session time strings into something sortable.
//
// Session times are stored as text like "4:30 - 6:30" with NO AM/PM, because every
// bar session happens in the afternoon or evening. Reading the bare hour as-is
// sorts wrongly: 11:00 (late morning) became 660 and 4:30 (afternoon) became 270,
// so a late-morning or lunchtime session always landed AFTER an afternoon one on
// the same day. Bare times are read with the same 12-hour wrap the time dropdowns
// use (their option lists run 10:00 … 12:30, 1:00 … 8:30, then explicit PM):
//   10, 11  → morning          (10:00, 11:30)
//   12      → midday           (12:00, 12:30)
//   1 – 9   → afternoon/evening (1:00 → 13:00 … 9:00 → 21:00)
// Times that DO carry AM/PM (the late-night options, "9:00 PM" … "12:00 AM") use
// it. 12:xx AM counts as the END of the day (24:xx) rather than the start, so a
// session beginning at midnight sorts last, not alongside noon.

const TIME_RE = /(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/g

function toMinutes(h, m, suffix) {
  let hour = parseInt(h, 10)
  const min = parseInt(m, 10)
  if (suffix) {
    if (suffix.toLowerCase() === 'pm') { if (hour !== 12) hour += 12 }
    else if (hour === 12) hour = 24
  } else if (hour >= 1 && hour <= 9) {
    hour += 12
  }
  return hour * 60 + min
}

// Minutes since midnight for the START (which = 0) or END (which = 1) of a
// session time string such as "4:30 - 6:30". null if that part isn't present.
export function sessionTimeMinutes(timeStr, which = 0) {
  if (!timeStr) return null
  const tokens = [...String(timeStr).matchAll(TIME_RE)]
  const t = tokens[which]
  return t ? toMinutes(t[1], t[2], t[3]) : null
}

// Comparator for sorting a day's sessions: earliest start first, then earliest
// end. A session with no readable time counts as 0 (first), as it always did.
export function compareSessionTimes(a, b) {
  const as = sessionTimeMinutes(a, 0) ?? 0
  const bs = sessionTimeMinutes(b, 0) ?? 0
  if (as !== bs) return as - bs
  return (sessionTimeMinutes(a, 1) ?? as) - (sessionTimeMinutes(b, 1) ?? bs)
}
