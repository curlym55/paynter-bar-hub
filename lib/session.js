// lib/session.js
//
// Lightweight signed-cookie session using only Node's built-in crypto — no
// extra npm packages. A cookie is issued when the correct PIN is entered at
// login, and any API route that shouldn't be callable without logging in
// checks it via requireAuth().
//
// This does NOT change the PIN login experience. It closes the gap where API
// routes previously had no server-side check at all and could be called
// directly (e.g. with curl) without ever passing the PIN screen.

import crypto from 'crypto'

const COOKIE_NAME     = 'bar_session'
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

export function createSessionCookie(role) {
  const token = sign({ role, exp: Date.now() + MAX_AGE_SECONDS * 1000 })
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secureFlag}`
}

export function clearSessionCookie() {
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

/**
 * safeCompare
 * Constant-time string comparison for PINs -- crypto.timingSafeEqual
 * requires equal-length buffers, so a length mismatch is handled by still
 * running a same-cost comparison rather than returning early (an early
 * return on length alone would leak the correct PIN's length via timing).
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

export function getSession(req) {
  return verify(parseCookies(req)[COOKIE_NAME])
}

/**
 * Call at the top of any API route that requires a logged-in session:
 *   if (!requireAuth(req, res)) return
 * Sends the 401/403 itself and returns false when not authorised.
 *
 * allowReadOnly: true  → any valid session (committee or read-only) passes
 * allowReadOnly: false → only the committee (write-access) role passes
 */
export function requireAuth(req, res, { allowReadOnly = true } = {}) {
  const session = getSession(req)
  if (!session) {
    res.status(401).json({ error: 'Not authenticated — please log in again.' })
    return false
  }
  if (!allowReadOnly && session.role === 'readonly') {
    res.status(403).json({ error: 'Read-only access — this action is not permitted.' })
    return false
  }
  return true
}
