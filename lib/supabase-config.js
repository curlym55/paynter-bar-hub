/**
 * lib/supabase-config.js
 * Supabase backup for Redis config keys.
 * Used as fallback when Redis is empty, and as background mirror on every write.
 */
import { createClient } from '@supabase/supabase-js'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/** Read a value from Supabase bar_config. Returns null if missing or error. */
export async function sbConfigGet(key) {
  try {
    const { data, error } = await sb()
      .from('bar_config')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) return null
    return data?.value ?? null
  } catch {
    return null
  }
}

/** Write a value to Supabase bar_config. Fire-and-forget safe. */
export async function sbConfigSet(key, value) {
  try {
    await sb()
      .from('bar_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  } catch (e) {
    console.warn('[supabase-config] write failed for', key, e.message)
  }
}
