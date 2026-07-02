import { kvGet } from '../../../lib/redis'

export default async function handler(req, res) {
  try {
    const ordered = (await kvGet('orderedItems')) || {}
    // Return raw structure exactly as stored, plus a summary
    const summary = Object.entries(ordered).map(([name, val]) => ({
      itemName: name,
      isArray: Array.isArray(val),
      rawValue: val,
    }))
    return res.json({ ok: true, rawOrdered: ordered, summary })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}
