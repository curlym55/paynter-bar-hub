import { kvGet, kvSet } from '../../lib/redis'
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
  const ip = clientIp(req)
  const attemptsKey = `authAttempts:${ip}`
  const attempts = (await kvGet(attemptsKey).catch(() => null)) || 0
  if (attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many attempts — please wait 15 minutes and try again.' })
  }

  let role = null
  if (safeCompare(pin, PIN_COMMITTEE)) role = 'bmt'
  else if (safeCompare(pin, PIN_READONLY)) role = 'readonly'

  if (!role) {
    await kvSet(attemptsKey, attempts + 1, LOCKOUT_WINDOW).catch(() => {})
    return res.status(401).json({ ok: false })
  }

  // Success — clear the counter and issue the session cookie
  await kvSet(attemptsKey, 0, 1).catch(() => {})
  res.setHeader('Set-Cookie', createSessionCookie(role))
  return res.status(200).json({ ok: true, readonly: role === 'readonly' })
}
