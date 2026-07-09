// lib/cache.js
//
// The items payload (stock levels, weekly averages, order quantities) is cached
// in Redis under `itemsCache_{daysBack}` with no expiry, so it survives until
// something explicitly clears it.
//
// Anything that changes Square's stock must clear it, otherwise the Dashboard
// and the order wizard keep working from pre-change numbers — e.g. you receive a
// delivery, the cache still shows the old on-hand figure, and the wizard
// recommends re-ordering stock that just arrived.
//
// We delete by pattern rather than a hardcoded list of daysBack values, because
// /api/items accepts any `?days=` value, not just the 30/60/90 the UI offers.

import { getRedis } from './redis'

export async function invalidateItemsCache() {
  try {
    const redis = getRedis()
    const keys = await redis.keys('itemsCache_*')
    if (keys.length) await redis.del(...keys)
    return keys.length
  } catch (e) {
    // Never let a cache-clearing failure break the operation that triggered it.
    // Worst case the user hits "Refresh from Square" manually.
    console.error('[cache] invalidateItemsCache failed:', e.message)
    return 0
  }
}
