import { kvIncr, kvDecr } from '../../lib/redis'
import { createSessionCookie, safeCompare } from '../../lib/session'

const MAX_ATTEMPTS   = 10
const LOCKOUT_WINDOW = 15 * 60 // seconds

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const PIN_COMMITTEE = process.env.PIN_COMMITTEE
  const PIN_READONLY  = process.env.PIN_READONLY

  // Fail closed — if the PINs aren't configured in Vercel env vars, refuse to
  // log anyone in rather than silently falling back to a PIN hardcoded in the
  // (public) repo.
  if (!PIN_COMMITTEE || !PIN_READONLY) {
    console.error('[auth] PIN_COMMITTEE / PIN_READONLY not set in environment variables')
    return res.status(500).json({ ok: false, error: 'Login is not configured. Contact the Bar Manager.' })
  }

  const { pin } = req.body || {}
  if (!pin) return res.status(400).json({ ok: false })

  // Rate limit — lock this IP out after too many failures so a 4-digit PIN
  // can't be brute-forced by a script.
  //
  // The attempt is counted FIRST, atomically (INCR), and only then is the PIN
  // checked. The previous order (read the counter, check the PIN, write the
  // counter) let a burst of parallel guesses all see "0 failures so far" and
  // all get checked, so the limit could be sidestepped. A successful login
  // refunds the attempt it reserved, instead of resetting the whole counter -
  // otherwise anyone who knows the read-only PIN could log in between guesses
  // at the committee PIN and never reach the limit.
  const ip = clientIp(req)
  const attemptsKey = `authAttempts:${ip}`
  let attempts = 0
  try {
    attempts = await kvIncr(attemptsKey, LOCKOUT_WINDOW)
  } catch (e) {
    console.error('[auth] rate-limit counter unavailable:', e.message)
  }
  if (attempts > MAX_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many attempts — please wait 15 minutes and try again.' })
  }

  let role = null
  if (safeCompare(pin, PIN_COMMITTEE)) role = 'bmt'
  else if (safeCompare(pin, PIN_READONLY)) role = 'readonly'

  if (!role) {
    // The failed attempt was already counted above.
    return res.status(401).json({ ok: false })
  }

  // Success — refund this attempt and issue the session cookie
  await kvDecr(attemptsKey).catch(() => {})
  res.setHeader('Set-Cookie', createSessionCookie(role))
  return res.status(200).json({ ok: true, readonly: role === 'readonly' })
}
