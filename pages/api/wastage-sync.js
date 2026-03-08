import { kvGet, kvSet }                                    from '../../lib/redis'
import { getLocationId, getVariationIdMap, postWasteAdjustments } from '../../lib/square'

const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']
const WINE_CATS   = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']

// Convert a logged wastage quantity into the unit Square tracks for that item.
//   Spirits in Square  → nips
//   Wine    in Square  → bottles (decimals OK, e.g. 0.2 for one 150ml glass)
//   Everything else    → units (cans, packets, etc.)
function computeSquareQty(entry, itemSettings) {
  const { itemName, category, qty, unit } = entry
  const s = itemSettings[itemName] || {}

  if (SPIRIT_CATS.includes(category)) {
    if (unit === 'bottles') {
      const bottleML      = s.bottleML || 700
      const nipML         = s.nipML    || 30
      const nipsPerBottle = bottleML / nipML
      return +(qty * nipsPerBottle).toFixed(1)
    }
    // logged in nips — 1:1
    return Number(qty)
  }

  if (WINE_CATS.includes(category)) {
    if (unit === 'glasses') {
      // 150 ml glass out of a 750 ml bottle = 0.2 bottles
      return +(qty * 0.2).toFixed(3)
    }
    // logged in bottles — 1:1
    return Number(qty)
  }

  // Beer, cider, premix, soft drinks, snacks — units 1:1
  return Number(qty)
}

// Human-readable note explaining any conversion applied (for audit trail).
function conversionNote(entry, itemSettings) {
  const { itemName, category, qty, unit } = entry
  const s = itemSettings[itemName] || {}

  if (SPIRIT_CATS.includes(category) && unit === 'bottles') {
    const bottleML      = s.bottleML || 700
    const nipML         = s.nipML    || 30
    const nipsPerBottle = +(bottleML / nipML).toFixed(1)
    const result        = +(qty * nipsPerBottle).toFixed(1)
    return `${qty} btl × ${nipsPerBottle} nips/btl (${bottleML}ml÷${nipML}ml) = ${result} nips`
  }
  if (WINE_CATS.includes(category) && unit === 'glasses') {
    return `${qty} × 150ml glass ÷ 750ml = ${+(qty * 0.2).toFixed(3)} bottles`
  }
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

      // Fresh catalog lookup so we always have the current variation IDs
      const varMap  = await getVariationIdMap(token)

      const preview = unsynced.map(entry => {
        const squareQty   = computeSquareQty(entry, itemSettings)
        const note        = conversionNote(entry, itemSettings)
        const variationId = varMap[entry.itemName] || null
        return {
          id:          entry.id,
          itemName:    entry.itemName,
          category:    entry.category || '',
          date:        entry.date,
          qty:         entry.qty,
          unit:        entry.unit,
          reason:      entry.reason,
          squareQty,
          conversionNote: note,
          variationId,
          canSync:     !!variationId && squareQty > 0,
        }
      }).sort((a, b) => b.date - a.date)

      return res.json({ preview, unsyncedCount: unsynced.length })
    }

    // ── POST — execute sync for given entry IDs ───────────────────────────────
    if (req.method === 'POST') {
      const { entryIds } = req.body || {}
      if (!Array.isArray(entryIds) || !entryIds.length) {
        return res.status(400).json({ error: 'entryIds array required' })
      }

      // Only process entries that exist, are requested, and haven't been synced yet
      const toSync = log.filter(e => entryIds.includes(e.id) && !e.squareSynced)
      if (!toSync.length) {
        return res.json({ ok: true, synced: 0, skipped: 0, message: 'Nothing to sync' })
      }

      // Fetch Square catalog and location in parallel
      const [varMap, locationId] = await Promise.all([
        getVariationIdMap(token),
        getLocationId(token),
      ])

      const adjustments = []
      const skipped     = []
      const syncedAt    = new Date().toISOString()

      for (const entry of toSync) {
        const variationId = varMap[entry.itemName]
        const squareQty   = computeSquareQty(entry, itemSettings)
        const note        = conversionNote(entry, itemSettings)

        if (!variationId) {
          skipped.push({ id: entry.id, itemName: entry.itemName, reason: 'Not found in Square catalogue' })
          continue
        }
        if (squareQty <= 0) {
          skipped.push({ id: entry.id, itemName: entry.itemName, reason: 'Zero quantity after conversion' })
          continue
        }

        adjustments.push({
          variationId,
          squareQty:      String(squareQty),
          occurredAt:     new Date(entry.date).toISOString(),
          entryId:        entry.id,
          itemName:       entry.itemName,
          conversionNote: note,
        })
      }

      // Post to Square (only if we have valid adjustments)
      if (adjustments.length) {
        await postWasteAdjustments(token, locationId, adjustments)
      }

      // Mark synced entries in Redis
      const syncedIds  = new Set(adjustments.map(a => a.entryId))
      const updatedLog = log.map(e => {
        if (!syncedIds.has(e.id)) return e
        const adj = adjustments.find(a => a.entryId === e.id)
        return {
          ...e,
          squareSynced:   true,
          squareSyncedAt: syncedAt,
          squareQty:      adj.squareQty,
          conversionNote: adj.conversionNote || null,
        }
      })
      await kvSet('wastageLog', updatedLog)

      const msg = adjustments.length
        ? `${adjustments.length} entr${adjustments.length === 1 ? 'y' : 'ies'} synced to Square${skipped.length ? ` · ${skipped.length} skipped` : ''}`
        : `Nothing synced${skipped.length ? ` · ${skipped.length} skipped` : ''}`

      return res.json({
        ok:           true,
        synced:       adjustments.length,
        skipped:      skipped.length,
        skippedItems: skipped,
        message:      msg,
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (e) {
    console.error('Wastage sync error:', e)
    return res.status(500).json({ error: e.message })
  }
}
