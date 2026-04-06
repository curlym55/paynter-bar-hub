import Redis from 'ioredis'

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
