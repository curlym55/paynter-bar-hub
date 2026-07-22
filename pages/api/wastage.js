import { requireAuth } from '../../lib/session'
import { persistGet, persistSet } from '../../lib/persist'

export default async function handler(req, res) {
  try {
    // GET is readable by any valid session; all writes require BMT access.
    // (Auth is checked before the GET branch below runs, not after --
    // previously GET returned data before this check was ever reached.)
    if (req.method === 'GET' && !requireAuth(req, res)) return
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && !requireAuth(req, res, { allowReadOnly: false })) return

    const log = (await persistGet('wastageLog', []).catch(() => null)) || []

    if (req.method === 'GET') {
      return res.json({ entries: log.sort((a, b) => b.date - a.date) })
    }

    if (req.method === 'POST') {
      // Bulk mark all unsynced entries as already synced (no Square API call)
      if (req.body?.action === 'markAllSynced') {
        const now = Date.now()
        let count = 0
        for (const entry of log) {
          if (!entry.squareSynced) {
            entry.squareSynced   = true
            entry.squareSyncedAt = now
            entry.conversionNote = 'Marked as previously synced'
            count++
          }
        }
        await persistSet('wastageLog', log)
        return res.json({ ok: true, count })
      }

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
      await persistSet('wastageLog', log)
      return res.json({ entry })
    }

    if (req.method === 'PUT') {
      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const idx = log.findIndex(e => e.id === id)
      if (idx === -1) return res.status(404).json({ error: 'Entry not found' })
      // Once an entry has been synced to Square, its quantity has already
      // reduced Square's stock. Editing it here would NOT change Square, so
      // the two would silently diverge — exactly the kind of mismatch that
      // causes stocktake discrepancies. Only allow editing the note/recordedBy
      // on synced entries; block changes to the quantity-affecting fields.
      if (log[idx].squareSynced) {
        const { note, recordedBy } = req.body
        log[idx] = { ...log[idx], note: note ?? log[idx].note, recordedBy: recordedBy ?? log[idx].recordedBy }
        await persistSet('wastageLog', log)
        return res.json({ entry: log[idx], syncedNote: 'Only note/recorded-by updated — quantity is locked because this entry was already synced to Square.' })
      }
      const { itemName, category, qty, unit, reason, note, recordedBy, date } = req.body
      log[idx] = { ...log[idx], itemName, category: category || '', qty: Number(qty), unit: unit || 'units', reason, note: note || '', recordedBy: recordedBy || '', date }
      await persistSet('wastageLog', log)
      return res.json({ entry: log[idx] })
    }

    if (req.method === 'DELETE') {
      const { id, force } = req.query
      if (!id) return res.status(400).json({ error: 'id required' })
      const entry = log.find(e => e.id === id)
      if (!entry) return res.status(404).json({ error: 'Entry not found' })
      // Block deleting a synced entry unless the caller explicitly forces it,
      // because deleting here does NOT restore the stock in Square — the entry
      // already reduced Square's count. Removing it from the log would hide a
      // real Square adjustment and cause the Hub and Square to disagree.
      if (entry.squareSynced && force !== 'true') {
        return res.status(409).json({
          error: 'SYNCED_ENTRY',
          message: 'This entry was already synced to Square. Deleting it here will NOT restore the stock in Square — the two would no longer match. If you have already corrected the stock in Square (e.g. via a stocktake), you can force-remove this log entry.',
        })
      }
      const filtered = log.filter(e => e.id !== id)
      await persistSet('wastageLog', filtered)
      return res.json({ ok: true, forced: force === 'true' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
