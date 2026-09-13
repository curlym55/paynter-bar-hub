// lib/rosterPin.js
//
// Scrypt-based PIN hashing for the roster admin PIN, using only Node's
// built-in crypto (matches the no-extra-packages approach used everywhere
// else in this app's auth code — see lib/session.js, lib/rosterSession.js).
// A random salt is stored alongside the hash as "salt:hash" in a single
// text column, so no separate salt column is needed.

import crypto from 'crypto'

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(pin), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  let candidate
  try {
    candidate = crypto.scryptSync(String(pin), salt, 64).toString('hex')
  } catch {
    return false
  }
  const a = Buffer.from(candidate, 'hex')
  const b = Buffer.from(hash, 'hex')
  // Same length-leak precaution as lib/session.js's safeCompare — still run
  // a same-cost comparison on mismatched lengths rather than short-circuiting.
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}
