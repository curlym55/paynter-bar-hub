import { kvGet, kvSet } from '../../../lib/redis'
import { requireAuth } from '../../../lib/session'

// One-time fix: buy prices were stored at bottle/case level instead of per-unit.
// Uses the pack, bottleML, nipML already set in stock items — no guessing.
//
// A buyPrice is wrong if it's much larger than expected for a single unit.
// We detect this by comparing buyPrice to (buyPrice / pack) — if dividing by
// pack gives a plausible per-unit price we correct it.
//
// Threshold: if buyPrice / nipsPerBottle < buyPrice * 0.25, it's a bottle price.
//            if buyPrice / pack < buyPrice * 0.25, it's a case price.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  try {
    const settings = await kvGet('itemSettings').catch(() => null) || {}
    const fixed = []

    for (const [name, item] of Object.entries(settings)) {
      const buyPrice = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice) : null
      if (!buyPrice || buyPrice <= 0) continue

      const cat      = item.category || ''
      const isSpirit = ['Spirits', 'Fortified & Liqueurs'].includes(cat)
      let corrected  = null
      let reason     = ''

      if (isSpirit && item.bottleML && item.nipML) {
        const nips = Number(item.bottleML) / Number(item.nipML)
        const perNip = buyPrice / nips
        // If dividing by nips gives a price < 25% of current, it's a bottle price
        if (perNip < buyPrice * 0.25) {
          corrected = Math.round(perNip * 1000) / 1000
          reason = `÷${Math.round(nips * 10) / 10} nips (${item.nipML}ml)`
        }
      } else if (item.pack && Number(item.pack) > 1) {
        const pack    = Number(item.pack)
        const perUnit = buyPrice / pack
        if (perUnit < buyPrice * 0.25) {
          corrected = Math.round(perUnit * 1000) / 1000
          reason = `÷${pack} pack`
        }
      }

      if (corrected != null) {
        settings[name] = { ...item, buyPrice: corrected }
        fixed.push({ name, category: cat, was: buyPrice, now: corrected, reason })
      }
    }

    if (fixed.length > 0) await kvSet('itemSettings', settings)

    return res.json({ ok: true, fixed: fixed.length, items: fixed })
  } catch (e) {
    console.error('[fix-buy-prices]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
