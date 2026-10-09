// pages/api/roster/pin.js
//
// Lets a logged-in roster admin change their own PIN, entirely in-app — no
// Vercel dashboard or env var access needed. This is what makes a new
// village's admin genuinely self-sufficient: PIN_ROSTER_ADMIN (the env var)
// is only ever a bootstrap value now — the moment anyone changes the PIN
// here, the hash stored in Supabase takes over and the env var is ignored
// from then on (see pages/api/roster/auth.js).
//
// Requires the CURRENT PIN to be re-entered, not just a valid session — so
// someone who left themselves logged in on a shared/kiosk device can't
// silently change the PIN and lock everyone else out.

import { createClient } from '@supabase/supabase-js'
import { kvIncr, kvDecr } from '../../../lib/redis'
import { requireRosterAuth } from '../../../lib/rosterSession'
import { safeCompare } from '../../../lib/session'
import { hashPin, verifyPin } from '../../../lib/rosterPin'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// The current-PIN check below is itself a PIN guess, so it gets the same
// lockout as the login: 10 wrong tries per 15 minutes per address.
const MAX_ATTEMPTS   = 10
const LOCKOUT_WINDOW = 15 * 60 // seconds

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireRosterAuth(req, res)) return

  const { currentPin, newPin } = req.body || {}
  if (!currentPin || !newPin) {
    return res.status(400).json({ ok: false, error: 'Current and new PIN are required' })
  }
  if (!/^\d{4,8}$/.test(String(newPin))) {
    return res.status(400).json({ ok: false, error: 'PIN must be 4-8 digits' })
  }

  // Count this attempt first, atomically (see pages/api/auth.js for why).
  const attemptsKey = `rosterPinChangeAttempts:${clientIp(req)}`
  let attempts = 0
  try {
    attempts = await kvIncr(attemptsKey, LOCKOUT_WINDOW)
  } catch (e) {
    console.error('[roster/pin] rate-limit counter unavailable:', e.message)
  }
  if (attempts > MAX_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many attempts — please wait 15 minutes and try again.' })
  }

  const supabase = sb()
  const { data } = await supabase.from('roster_settings').select('pin_hash').eq('id', 1).maybeSingle()
  const storedHash = data?.pin_hash || null

  const currentValid = storedHash
    ? verifyPin(currentPin, storedHash)
    : safeCompare(currentPin, process.env.PIN_ROSTER_ADMIN || '')

  if (!currentValid) {
    return res.status(401).json({ ok: false, error: 'Current PIN is incorrect' })
  }
  await kvDecr(attemptsKey).catch(() => {}) // correct PIN - refund the attempt

  const newHash = hashPin(newPin)
  const { error } = await supabase
    .from('roster_settings')
    .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) {
    console.error('[roster/pin]', error.message)
    return res.status(500).json({ ok: false, error: 'Failed to save new PIN' })
  }

  return res.json({ ok: true })
}
