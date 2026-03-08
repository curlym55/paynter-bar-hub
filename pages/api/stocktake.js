import { kvGet, kvSet } from '../../lib/redis'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const counts = (await kvGet('stocktakeCounts').catch(() => null)) || {}
      return res.json({ counts })
    }

    if (req.method === 'POST') {
      const { counts } = req.body
      if (!counts || typeof counts !== 'object') return res.status(400).json({ error: 'counts object required' })
      await kvSet('stocktakeCounts', counts)
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      await kvSet('stocktakeCounts', {})
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
