import { kvGet } from '../../lib/redis'
import { requireAuth } from '../../lib/session'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  // Read-only users can open the Stocktake tab, so they may read its history.
  if (!requireAuth(req, res)) return
  try {
    const history = (await kvGet('stocktakeHistory')) || []
    return res.json({ history })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
