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
      // Preferred: { changes: { itemName: {coolRoom,storeRoom,bar} | null } }.
      // Merged into the CURRENT saved counts (null deletes an item), so two
      // devices entering counts at the same time each only touch the items
      // they changed. Saving the whole count sheet (the { counts } form below)
      // meant each device's save wiped out whatever the other had entered.
      const { changes } = req.body
      if (changes && typeof changes === 'object') {
        const latest = (await persistGet('stocktakeCounts', {}).catch(() => null)) || {}
        for (const [name, c] of Object.entries(changes)) {
          if (c === null) delete latest[name]
          else latest[name] = c
        }
        await persistSet('stocktakeCounts', latest)
        return res.json({ ok: true })
      }

      // Legacy full replace — kept so an old open tab still saves after this
      // deploys, until it's refreshed and picks up the merge-based client.
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
