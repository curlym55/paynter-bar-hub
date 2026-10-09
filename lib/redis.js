import Redis from 'ioredis'
import { randomUUID } from 'crypto'

let client = null

export function getRedis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: 3,
    })
  }
  return client
}

export async function kvGet(key) {
  const redis = getRedis()
  const val = await redis.get(key)
  return val ? JSON.parse(val) : null
}

export async function kvSet(key, value, ttlSeconds = null) {
  const redis = getRedis()
  if (ttlSeconds) {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } else {
    await redis.set(key, JSON.stringify(value))
  }
}

export async function kvDelete(key) {
  const redis = getRedis()
  await redis.del(key)
}

// ── Atomic counters (used for login rate limiting) ───────────────────────────
// INCR is atomic in Redis, so a burst of simultaneous requests each get their
// OWN number. (A read-then-write counter lets every request in the burst see
// the same old value.) The expiry is set when the counter is created, and is
// NOT extended by later increments, so the window can't be stretched forever.
export async function kvIncr(key, ttlSeconds) {
  const redis = getRedis()
  const n = await redis.incr(key)
  if (n === 1 || (await redis.ttl(key)) === -1) await redis.expire(key, ttlSeconds)
  return n
}

// Give back one count (a successful login refunds the attempt it reserved).
export async function kvDecr(key) {
  const redis = getRedis()
  const n = await redis.decr(key)
  if (n <= 0) await redis.del(key)
  return n
}

// ── Simple distributed lock ──────────────────────────────────────────────────
// Runs fn() while holding a lock in Redis, so only one request at a time can
// run it - across ALL serverless instances, not just one process. Used for
// read-modify-write of whole settings blobs, where two overlapping saves would
// otherwise each read the old copy and the last write would erase the other.
// The lock expires on its own (ttlMs) if a request dies while holding it, and
// is only ever released by the request that took it.
export async function withLock(name, fn, { ttlMs = 15000, waitMs = 6000 } = {}) {
  const redis = getRedis()
  const lockKey = `lock:${name}`
  const token = randomUUID()
  const deadline = Date.now() + waitMs
  while ((await redis.set(lockKey, token, 'PX', ttlMs, 'NX')) !== 'OK') {
    if (Date.now() >= deadline) throw new Error('Settings are busy - please try again in a moment')
    await new Promise(r => setTimeout(r, 75))
  }
  try {
    return await fn()
  } finally {
    await redis
      .eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, lockKey, token)
      .catch(() => {})
  }
}
