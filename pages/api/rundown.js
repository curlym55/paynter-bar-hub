import { kvGet, kvSet } from '../../lib/redis'
import { sbConfigGet, sbConfigSet } from '../../lib/supabase-config'
import { requireAuth } from '../../lib/session'

const KEY = 'rundownItems'

async function get(key, fallback = null) {
  let val = await kvGet(key).catch(() => null)
  if (val === null || val === undefined) {
    val = await sbConfigGet(key)
    if (val !== null && val !== undefined) await kvSet(key, val).catch(() => {})
  }
  return val ?? fallback
}
async function set(key, value) {
  await kvSet(key, value)
  sbConfigSet(key, value).catch(() => {})
}


export default async function handler(req, res) {
  // Rundown flags are read on every page load; writing is management-only.
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (!requireAuth(req, res, { allowReadOnly: false })) return
  } else if (!requireAuth(req, res)) return

  if (req.method === 'GET') {
    const data = (await get(KEY, {})) || {}
    return res.json({ rundown: data })
  }
  if (req.method === 'POST') {
    const { name, value } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const data = (await get(KEY, {})) || {}
    if (value) { data[name] = true } else { delete data[name] }
    await set(KEY, data)
    return res.json({ ok: true, rundown: data })
  }
  res.status(405).json({ error: 'Method not allowed' })
}
