import { requireAuth } from '../../lib/session'
import { persistGet, persistSet } from '../../lib/persist'

export default async function handler(req, res) {
  // Counts are read by the Stocktake tab; writes are management-only.
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (!requireAuth(req, res, { allowReadOnly: false })) return
  } else if (!requireAuth(req, res)) return

  try {
    if (req.method === 'GET') {
      const counts = (await persistGet('stocktakeCounts', {}).catch(() => null)) || {}
      return res.json({ counts })
    }

    if (req.method === 'POST') {
      const { counts } = req.body
      if (!counts || typeof counts !== 'object') return res.status(400).json({ error: 'counts object required' })
      await persistSet('stocktakeCounts', counts)
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      await persistSet('stocktakeCounts', {})
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
