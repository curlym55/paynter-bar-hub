import { kvGet, kvSet } from '../../lib/redis'

export default async function handler(req, res) {
  try {
    const notes = (await kvGet('barNotes').catch(() => null)) || []

    if (req.method === 'GET') {
      return res.json({ notes: notes.sort((a, b) => b.date - a.date) })
    }

    if (req.method === 'POST') {
      const { itemName, comment, author, noteDate } = req.body
      if (!comment) return res.status(400).json({ error: 'comment required' })
      const entry = {
        id:         `N-${Date.now()}`,
        itemName:   itemName || '',
        comment,
        author:     author || '',
        noteDate:   noteDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }),
        date:       Date.now(),
      }
      notes.push(entry)
      await kvSet('barNotes', notes)
      return res.json({ entry })
    }

    if (req.method === 'PUT') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const { itemName, comment, author, noteDate } = req.body
      if (!comment) return res.status(400).json({ error: 'comment required' })
      const idx = notes.findIndex(e => e.id === id)
      if (idx === -1) return res.status(404).json({ error: 'not found' })
      notes[idx] = { ...notes[idx], itemName: itemName || '', comment, author: author || '', noteDate: noteDate || notes[idx].noteDate }
      await kvSet('barNotes', notes)
      return res.json({ entry: notes[idx] })
    }

    if (req.method === 'DELETE') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const filtered = notes.filter(e => e.id !== id)
      await kvSet('barNotes', filtered)
      return res.json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
