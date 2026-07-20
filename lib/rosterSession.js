// lib/rosterSession.js
//
// Signed-cookie session for the Bar Roster app (/roster), separate from the
// main Hub's session (lib/session.js) so the two logins never interfere with
// each other. Same crypto approach — HMAC-signed, no extra npm packages.
//
// The roster only has one privileged tier (no read-only split like the Hub),
// so the payload just carries a role of 'admin' plus an expiry.

import crypto from 'crypto'

const COOKIE_NAME     = 'roster_session'
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12 hours

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not set in environment variables')
  return s
}

function sign(payload) {
  const json = JSON.stringify(payload)
  const b64  = Buffer.from(json).toString('base64url')
  const sig  = crypto.createHmac('sha256', secret()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function verify(token) {
  if (!token || !token.includes('.')) return null
  const [b64, sig] = token.split('.')
  let expected
  try { expected = crypto.createHmac('sha256', secret()).update(b64).digest('base64url') }
  catch { return null }
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'))
    if (!payload.exp || Date.now() > payload.exp) return null
    return payload
  } catch { return null }
}

export function createRosterSessionCookie() {
  const token = sign({ role: 'admin', exp: Date.now() + MAX_AGE_SECONDS * 1000 })
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secureFlag}`
}

export function clearRosterSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx === -1) return
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim())
  })
  return out
}

export function getRosterSession(req) {
  return verify(parseCookies(req)[COOKIE_NAME])
}

/**
 * Call at the top of any roster API route that requires the admin PIN:
 *   if (!requireRosterAuth(req, res)) return
 * Sends the 401 itself and returns false when not authorised.
 */
export function requireRosterAuth(req, res) {
  const session = getRosterSession(req)
  if (!session) {
    res.status(401).json({ error: 'Not authenticated — please enter the admin PIN again.' })
    return false
  }
  return true
}
