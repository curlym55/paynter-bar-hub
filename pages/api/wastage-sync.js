import { kvGet }                                                     from '../../lib/redis'
import { getLocationId, getVariationIdMap, postSingleWasteAdjustment } from '../../lib/square'
import { requireAuth } from '../../lib/session'
import { invalidateItemsCache } from '../../lib/cache'
import { persistGet, persistSet } from '../../lib/persist'

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
  // GET is a preview; POST posts waste adjustments into Square.
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (!requireAuth(req, res, { allowReadOnly: false })) return
  } else if (!requireAuth(req, res)) return

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const log          = (await persistGet('wastageLog', [])) || []
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

      const [varMap, locationId] = await Promise.all([
        getVariationIdMap(token),
        getLocationId(token),
      ])

      const syncedAt  = new Date().toISOString()
      const succeeded = []
      const failed    = []
      const skipped   = []

      // ── Record each attempt BEFORE touching Square ───────────────────────
      // Waste adjustments SUBTRACT from Square, so a repeat is a real double
      // deduction. If a sync dies partway (dropped connection, time limit),
      // Square may have taken some deductions that were never marked synced
      // here. On the retry we send the SAME idempotency key and the SAME
      // request body (including occurred_at), which lets Square recognise the
      // repeat and return the original result instead of deducting again.
      // A saved attempt is reused only while it still matches the request
      // (same Square item, same quantity) and is under 23h old — Square
      // rejects adjustments backdated more than 24h.
      const ATTEMPT_MAX_AGE_MS = 23 * 60 * 60 * 1000
      const nowMs = Date.now()
      const plan  = []   // entries we'll actually send, with their attempt
      for (const entry of toSync) {
        const varInfo   = varMap[entry.itemName] || null
        const squareQty = computeSquareQty(entry, itemSettings)
        const reason    = skipReason(entry, varInfo, squareQty)
        if (reason) { skipped.push({ id: entry.id, itemName: entry.itemName, reason }); continue }

        const prev = entry.syncAttempt
        const reusable = prev
          && prev.variationId === varInfo.varId
          && prev.squareQty   === String(squareQty)
          && (nowMs - Date.parse(prev.occurredAt)) < ATTEMPT_MAX_AGE_MS
        const attempt = reusable ? prev : {
          key:         `waste-${entry.id}-${nowMs}`,
          occurredAt:  new Date(nowMs).toISOString(),
          variationId: varInfo.varId,
          squareQty:   String(squareQty),
        }
        plan.push({ entry, varInfo, squareQty, attempt })
      }

      if (plan.length) {
        // Re-read so we don't overwrite entries added/edited since the start.
        const fresh = (await persistGet('wastageLog', [])) || []
        const byId  = new Map(plan.map(p => [p.entry.id, p.attempt]))
        await persistSet('wastageLog', fresh.map(e => byId.has(e.id) ? { ...e, syncAttempt: byId.get(e.id) } : e))
      }

      for (const { entry, varInfo, squareQty, attempt } of plan) {
        const note   = conversionNote(entry, itemSettings)
        const result = await postSingleWasteAdjustment(token, locationId, {
          variationId:    varInfo.varId,
          squareQty:      String(squareQty),
          occurredAt:     attempt.occurredAt,
          idempotencyKey: attempt.key,
          entryId:        entry.id,
          itemName:       entry.itemName,
        })

        if (result.ok) succeeded.push({ id: entry.id, itemName: entry.itemName, squareQty, note })
        else           failed.push({ id: entry.id, itemName: entry.itemName, variationId: varInfo.varId, error: result.error })
      }

      // Mark only successfully synced entries. Re-read the log first rather
      // than writing back the copy read at the start: the Square calls above
      // take a few seconds, and writing the old copy would wipe any entry
      // added or edited in that window.
      const succeededMap = new Map(succeeded.map(s => [s.id, s]))
      const latestLog    = (await persistGet('wastageLog', [])) || []
      const updatedLog   = latestLog.map(e => {
        const s = succeededMap.get(e.id)
        if (!s) return e
        const { syncAttempt, ...rest } = e
        return { ...rest, squareSynced: true, squareSyncedAt: syncedAt,
                 squareQty: String(s.squareQty), conversionNote: s.note || null }
      })
      await persistSet('wastageLog', updatedLog)

      // Waste adjustments reduced Square's stock — clear the cached items
      // payload so on-hand figures reflect the loss immediately.
      if (succeeded.length > 0) await invalidateItemsCache()

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
