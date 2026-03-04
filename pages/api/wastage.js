import { kvGet, kvSet } from '../../lib/redis'

export default async function handler(req, res) {
  try {
    const log = (await kvGet('wastageLog').catch(() => null)) || []

    if (req.method === 'GET') {
      return res.json({ entries: log.sort((a, b) => b.date - a.date) })
    }

    if (req.method === 'POST') {
      const { itemName, category, qty, unit, reason, note, recordedBy } = req.body
      if (!itemName || !qty || !reason) return res.status(400).json({ error: 'itemName, qty and reason required' })
      const entry = {
        id:         `W-${Date.now()}`,
        itemName,
        category:   category || '',
        qty:        Number(qty),
        unit:       unit || 'units',
        reason,     // Breakage | Spoilage | Expired | Other
        note:       note || '',
        recordedBy: recordedBy || '',
        date:       Date.now(),
      }
      log.push(entry)
      await kvSet('wastageLog', log)
      return res.json({ entry })
    }

    if (req.method === 'PUT') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const { itemName, category, qty, unit, reason, note, recordedBy, date } = req.body
      const idx = log.findIndex(e => e.id === id)
      if (idx === -1) return res.status(404).json({ error: 'Entry not found' })
      log[idx] = { ...log[idx], itemName, category: category || '', qty: Number(qty), unit: unit || 'units', reason, note: note || '', recordedBy: recordedBy || '', date }
      await kvSet('wastageLog', log)
      return res.json({ entry: log[idx] })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const filtered = log.filter(e => e.id !== id)
      await kvSet('wastageLog', filtered)
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
