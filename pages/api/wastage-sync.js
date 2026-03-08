import { kvGet, kvSet }                                              from '../../lib/redis'
import { getLocationId, getVariationIdMap, postSingleWasteAdjustment } from '../../lib/square'

const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']
const WINE_CATS   = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']

function computeSquareQty(entry, itemSettings) {
  const { itemName, category, qty, unit } = entry
  const s = itemSettings[itemName] || {}
  if (SPIRIT_CATS.includes(category)) {
    if (unit === 'bottles') {
      const nipsPerBottle = (s.bottleML || 700) / (s.nipML || 30)
      return +(qty * nipsPerBottle).toFixed(1)
    }
    return Number(qty)
  }
  if (WINE_CATS.includes(category)) {
    if (unit === 'glasses') return +(qty * 0.2).toFixed(3)
    return Number(qty)
  }
  return Number(qty)
}

function conversionNote(entry, itemSettings) {
  const { itemName, category, qty, unit } = entry
  const s = itemSettings[itemName] || {}
  if (SPIRIT_CATS.includes(category) && unit === 'bottles') {
    const bottleML      = s.bottleML || 700
    const nipML         = s.nipML    || 30
    const nipsPerBottle = +(bottleML / nipML).toFixed(1)
    return `${qty} btl × ${nipsPerBottle} nips/btl (${bottleML}ml÷${nipML}ml) = ${+(qty * nipsPerBottle).toFixed(1)} nips`
  }
  if (WINE_CATS.includes(category) && unit === 'glasses') {
    return `${qty} × 150ml glass ÷ 750ml = ${+(qty * 0.2).toFixed(3)} bottles`
  }
  return null
}

function skipReason(entry, varInfo, squareQty) {
  if (!varInfo)       return 'Not found in Square catalogue'
  if (squareQty <= 0) return 'Zero quantity after conversion'
  if (varInfo.onHand !== undefined && varInfo.onHand <= 0)
                      return 'No stock in Square — already reflected'
  return null
}

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const log          = (await kvGet('wastageLog'))   || []
    const itemSettings = (await kvGet('itemSettings')) || {}

    // ── GET — preview unsynced entries ───────────────────────────────────────
    if (req.method === 'GET') {
      const unsynced = log.filter(e => !e.squareSynced)
      const varMap   = await getVariationIdMap(token)

      const preview = unsynced.map(entry => {
        const varInfo   = varMap[entry.itemName] || null
        const squareQty = computeSquareQty(entry, itemSettings)
        const note      = conversionNote(entry, itemSettings)
        const reason    = skipReason(entry, varInfo, squareQty)
        return {
          id:             entry.id,
          itemName:       entry.itemName,
          category:       entry.category || '',
          date:           entry.date,
          qty:            entry.qty,
          unit:           entry.unit,
          reason:         entry.reason,
          squareQty,
          conversionNote: note,
          variationId:    varInfo?.varId   || null,
          squareOnHand:   varInfo?.onHand  ?? null,
          skipReason:     reason,
          canSync:        !reason,
        }
      }).sort((a, b) => b.date - a.date)

      return res.json({ preview, unsyncedCount: unsynced.length })
    }

    // ── POST — execute sync ───────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { entryIds } = req.body || {}
      if (!Array.isArray(entryIds) || !entryIds.length)
        return res.status(400).json({ error: 'entryIds array required' })

      const toSync = log.filter(e => entryIds.includes(e.id) && !e.squareSynced)
      if (!toSync.length)
        return res.json({ ok: true, synced: 0, skipped: 0, message: 'Nothing to sync' })

      console.log('[sync POST] step 1: getting varMap + locationId')
      let varMap, locationId
      try {
        locationId = await getLocationId(token)
        console.log('[sync POST] step 2: locationId =', locationId)
      } catch(e) {
        console.error('[sync POST] getLocationId failed:', e.message)
        throw e
      }
      try {
        varMap = await getVariationIdMap(token)
        console.log('[sync POST] step 3: varMap keys =', Object.keys(varMap).length)
      } catch(e) {
        console.error('[sync POST] getVariationIdMap failed:', e.message)
        throw e
      }

      const syncedAt  = new Date().toISOString()
      const succeeded = []
      const failed    = []
      const skipped   = []

      for (const entry of toSync) {
        const varInfo   = varMap[entry.itemName] || null
        const squareQty = computeSquareQty(entry, itemSettings)
        const note      = conversionNote(entry, itemSettings)
        const reason    = skipReason(entry, varInfo, squareQty)

        if (reason) { skipped.push({ id: entry.id, itemName: entry.itemName, reason }); continue }

        const result = await postSingleWasteAdjustment(token, locationId, {
          variationId: varInfo.varId,
          squareQty:   String(squareQty),
          occurredAt:  new Date(entry.date).toISOString(),
          entryId:     entry.id,
          itemName:    entry.itemName,
        })

        if (result.ok) succeeded.push({ id: entry.id, itemName: entry.itemName, squareQty, note })
        else           failed.push({ id: entry.id, itemName: entry.itemName, variationId: varInfo.varId, error: result.error })
      }

      // Mark only successfully synced entries in Redis
      const succeededIds = new Set(succeeded.map(s => s.id))
      const updatedLog   = log.map(e => {
        if (!succeededIds.has(e.id)) return e
        const s = succeeded.find(x => x.id === e.id)
        return { ...e, squareSynced: true, squareSyncedAt: syncedAt,
                 squareQty: String(s.squareQty), conversionNote: s.note || null }
      })
      await kvSet('wastageLog', updatedLog)

      const parts = []
      if (succeeded.length) parts.push(`${succeeded.length} synced to Square`)
      if (skipped.length)   parts.push(`${skipped.length} skipped`)
      if (failed.length)    parts.push(`${failed.length} failed`)

      return res.json({
        ok:           failed.length === 0,
        synced:       succeeded.length,
        skipped:      skipped.length,
        failed:       failed.length,
        skippedItems: [...skipped, ...failed.map(f => ({ ...f, reason: `${f.error}${f.variationId ? ` (varId: ${f.variationId})` : ''}` }))],
        message:      parts.join(' · '),
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (e) {
    console.error('Wastage sync error:', e)
    return res.status(500).json({ error: e.message })
  }
}
