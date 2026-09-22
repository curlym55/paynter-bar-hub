// lib/persist.js
//
// Dual read/write helpers: Redis is the working store, Supabase `bar_config` is
// the durable backup.
//
// Redis is fast but has no backup of its own — if that instance is lost, so is
// everything held only there. Supabase is backed up nightly. These helpers write
// to both, and transparently restore from Supabase if Redis comes back empty.
//
// This mirrors the pattern already used in pages/api/settings.js, extracted so
// the wastage log, stocktake history and bar notes get the same protection.

import { kvGet, kvSet } from './redis'
import { sbConfigGet, sbConfigSet } from './supabase-config'

/**
 * Read a key. Falls back to the Supabase copy if Redis has nothing, and
 * repopulates Redis so the next read is fast.
 */
export async function persistGet(key, fallback = null) {
  let val = await kvGet(key).catch(() => null)

  if (val === null || val === undefined) {
    val = await sbConfigGet(key)
    if (val !== null && val !== undefined) {
      await kvSet(key, val).catch(() => {}) // warm Redis back up
      console.log('[persist] restored', key, 'from Supabase backup')
    }
  }

  return val ?? fallback
}

/**
 * Write a key to Redis, then mirror to Supabase.
 *
 * The Redis write is awaited because the caller's response depends on it. The
 * Supabase mirror is ALSO awaited, but its failure is caught and logged, so a
 * backup failure still never breaks the operation that triggered it
 * (recording wastage, saving a stocktake, etc). It used to be un-awaited, but
 * on Vercel a function can be frozen the moment it responds — killing an
 * in-flight backup — and back-to-back un-awaited writes can land out of order,
 * leaving an OLDER value as the backup. Costs ~100ms per write.
 */
export async function persistSet(key, value) {
  await kvSet(key, value)
  await sbConfigSet(key, value).catch(e =>
    console.warn('[persist] backup failed for', key, e?.message)
  )
}
