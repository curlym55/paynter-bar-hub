import { createClient } from '@supabase/supabase-js'
import { kvGet, kvSet } from '../../../lib/redis'
import { createRosterSessionCookie, clearRosterSessionCookie } from '../../../lib/rosterSession'
import { safeCompare } from '../../../lib/session'
import { verifyPin } from '../../../lib/rosterPin'

const MAX_ATTEMPTS   = 10
const LOCKOUT_WINDOW = 15 * 60 // seconds

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
}

async function getStoredPinHash() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data } = await supabase.from('roster_settings').select('pin_hash').eq('id', 1).maybeSingle()
  return data?.pin_hash || null
}

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearRosterSessionCookie())
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { pin } = req.body || {}
  if (!pin) return res.status(400).json({ ok: false })

  // Rate limit — lock this IP out after too many failures so a 4-digit PIN
  // can't be brute-forced by a script.
  const ip = clientIp(req)
  const attemptsKey = `rosterAuthAttempts:${ip}`
  const attempts = (await kvGet(attemptsKey).catch(() => null)) || 0
  if (attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({ ok: false, error: 'Too many attempts — please wait 15 minutes and try again.' })
  }

  // Prefer the in-app-changeable PIN stored (hashed) in Supabase — see
  // pages/api/roster/pin.js. PIN_ROSTER_ADMIN (the env var) is only a
  // bootstrap value: it's used until the first time anyone changes the PIN
  // via Settings, at which point the Supabase hash takes over permanently.
  // This is what lets a non-technical admin rotate their own PIN without
  // ever needing Vercel dashboard access.
  const storedHash = await getStoredPinHash().catch(() => null)
  let valid = false

  if (storedHash) {
    valid = verifyPin(pin, storedHash)
  } else {
    const PIN_ROSTER_ADMIN = process.env.PIN_ROSTER_ADMIN
    // Fail closed — if neither a Supabase hash nor the env var is configured,
    // refuse to log anyone in rather than falling back to any hardcoded value.
    if (!PIN_ROSTER_ADMIN) {
      console.error('[roster/auth] No PIN configured — neither roster_settings.pin_hash nor PIN_ROSTER_ADMIN env var is set')
      return res.status(500).json({ ok: false, error: 'Roster admin login is not configured. Contact the Bar Manager.' })
    }
    valid = safeCompare(pin, PIN_ROSTER_ADMIN)
  }

  if (!valid) {
    await kvSet(attemptsKey, attempts + 1, LOCKOUT_WINDOW).catch(() => {})
    return res.status(401).json({ ok: false })
  }

  // Success — clear the counter and issue the session cookie
  await kvSet(attemptsKey, 0, 1).catch(() => {})
  res.setHeader('Set-Cookie', createRosterSessionCookie())
  return res.status(200).json({ ok: true })
}
