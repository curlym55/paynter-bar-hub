import { kvGet }                                                from '../../lib/redis'
import { getLocationId, getVariationIdMap, postPhysicalCount } from '../../lib/square'

const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']

// Convert stocktake total (bottles) to Square unit (nips for spirits, units for everything else)
function toSquareQty(item, totalBottles, itemSettings) {
  if (SPIRIT_CATS.includes(item.category)) {
    const s           = itemSettings[item.name] || {}
    const bottleML    = s.bottleML || item.bottleML || 700
    const nipML       = s.nipML    || item.nipML    || 30
    return +(totalBottles * (bottleML / nipML)).toFixed(1)
  }
  return +totalBottles.toFixed(3)
}

function conversionNote(item, totalBottles, itemSettings) {
  if (SPIRIT_CATS.includes(item.category)) {
    const s           = itemSettings[item.name] || {}
    const bottleML    = s.bottleML || item.bottleML || 700
    const nipML       = s.nipML    || item.nipML    || 30
    const nipsPerBtl  = +(bottleML / nipML).toFixed(1)
    return `${totalBottles} btl × ${nipsPerBtl} nips/btl = ${+(totalBottles * nipsPerBtl).toFixed(1)} nips`
  }
  return null
}

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const counts      = (await kvGet('stocktakeCounts'))  || {}
    const itemSettings = (await kvGet('itemSettings')) || {}

    // Item metadata (category, bottleML, nipML) is passed from the client
    // since items are fetched from Square on the frontend, not stored in Redis
    const clientItems  = req.method === 'POST' ? (req.body?.items || []) : []
    // For GET, items are passed as a JSON query param
    let cachedItems = clientItems
    if (req.method === 'GET' && req.query.items) {
      try { cachedItems = JSON.parse(req.query.items) } catch { cachedItems = [] }
    }

    // Only process items that have at least one count entered
    const countedNames = Object.entries(counts)
      .filter(([, c]) => {
        const cr = parseFloat(c.coolRoom) || 0
        const sr = parseFloat(c.storeRoom) || 0
        const br = parseFloat(c.bar) || 0
        return c.coolRoom !== '' || c.storeRoom !== '' || c.bar !== ''
      })
      .map(([name]) => name)

    if (countedNames.length === 0) {
      return res.json({ preview: [], countedCount: 0 })
    }

    // ── GET — preview ───────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const varMap = await getVariationIdMap(token)

      const preview = countedNames.map(name => {
        const c     = counts[name]
        const cr    = parseFloat(c.coolRoom)  || 0
        const sr    = parseFloat(c.storeRoom) || 0
        const br    = parseFloat(c.bar)       || 0
        const total = cr + sr + br

        const item      = cachedItems.find(i => i.name === name) || { name, category: '' }
        const varInfo   = varMap[name] || null
        const sqQty     = varInfo ? toSquareQty(item, total, itemSettings) : null
        const note      = varInfo ? conversionNote(item, total, itemSettings) : null
        const skipReason = !varInfo ? 'Not found in Square catalogue' : null

        return {
          name,
          category:       item.category || '',
          coolRoom:       c.coolRoom,
          storeRoom:      c.storeRoom,
          bar:            c.bar,
          total,
          squareQty:      sqQty,
          conversionNote: note,
          squareOnHand:   varInfo?.onHand ?? null,
          variationId:    varInfo?.varId  || null,
          skipReason,
          canSync:        !skipReason,
        }
      }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

      return res.json({ preview, countedCount: countedNames.length })
    }

    // ── POST — execute sync ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const [varMap, locationId] = await Promise.all([
        getVariationIdMap(token),
        getLocationId(token),
      ])

      const occurredAt = new Date().toISOString()
      const succeeded  = []
      const failed     = []
      const skipped    = []

      for (const name of countedNames) {
        const c       = counts[name]
        const cr      = parseFloat(c.coolRoom)  || 0
        const sr      = parseFloat(c.storeRoom) || 0
        const br      = parseFloat(c.bar)       || 0
        const total   = cr + sr + br
        const item    = cachedItems.find(i => i.name === name) || { name, category: '' }
        const varInfo = varMap[name] || null

        if (!varInfo) {
          skipped.push({ name, reason: 'Not found in Square catalogue' })
          continue
        }

        const sqQty = toSquareQty(item, total, itemSettings)
        const note  = conversionNote(item, total, itemSettings)

        const result = await postPhysicalCount(token, locationId, {
          variationId: varInfo.varId,
          quantity:    String(sqQty),
          occurredAt,
          itemName:    name,
        })

        if (result.ok) succeeded.push({ name, sqQty, note })
        else           failed.push({ name, error: result.error })
      }

      const parts = []
      if (succeeded.length) parts.push(`${succeeded.length} items synced to Square`)
      if (skipped.length)   parts.push(`${skipped.length} skipped`)
      if (failed.length)    parts.push(`${failed.length} failed`)

      return res.json({
        ok:           failed.length === 0,
        synced:       succeeded.length,
        skipped:      skipped.length,
        failed:       failed.length,
        skippedItems: [...skipped, ...failed.map(f => ({ name: f.name, reason: f.error }))],
        message:      parts.join(' · '),
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch(e) {
    console.error('Stocktake sync error:', e)
    return res.status(500).json({ error: e.message })
  }
}
