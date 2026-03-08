import { kvGet } from '../../lib/redis'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const history = (await kvGet('stocktakeHistory')) || []
    return res.json({ history })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}
