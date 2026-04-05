// Timezone utilities for server-side date calculations
// Vercel runs UTC; Brisbane is UTC+10 with no DST (Queensland)

const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000

/**
 * Returns a Date object representing the current moment in Brisbane time.
 * Use for date/month/year logic that must reflect AEST, not UTC.
 * Note: the underlying ms value is still absolute UTC — only the
 * getFullYear/getMonth/getDate/getHours methods return AEST values.
 */
export function nowAEST() {
  return new Date(Date.now() + BRISBANE_OFFSET_MS)
}

/**
 * Returns a UTC ISO string for "midnight AEST on the given year/month/day".
 * e.g. startOfDayAEST(2026, 3, 1) → '2026-03-31T14:00:00.000Z'
 */
export function startOfDayAEST(year, month, day) {
  // midnight AEST = 14:00 UTC previous day (UTC+10)
  return new Date(Date.UTC(year, month, day) - BRISBANE_OFFSET_MS).toISOString()
}

/**
 * Returns a UTC ISO string for "end of day AEST on the given year/month/day".
 * e.g. endOfDayAEST(2026, 3, 31) → '2026-04-01T13:59:59.999Z'
 */
export function endOfDayAEST(year, month, day) {
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - BRISBANE_OFFSET_MS).toISOString()
}
