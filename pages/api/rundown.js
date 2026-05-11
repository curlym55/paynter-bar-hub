import { kvGet, kvSet } from '../../lib/redis'

const KEY = 'rundownItems'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = (await kvGet(KEY).catch(() => null)) || {}
    return res.json({ rundown: data })
  }
  if (req.method === 'POST') {
    const { name, value } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const data = (await kvGet(KEY).catch(() => null)) || {}
    if (value) { data[name] = true } else { delete data[name] }
    await kvSet(KEY, data)
    return res.json({ ok: true, rundown: data })
  }
  res.status(405).json({ error: 'Method not allowed' })
}
