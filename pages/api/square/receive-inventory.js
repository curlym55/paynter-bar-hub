/**
 * POST /api/square/receive-inventory
 *
 * Receives stock into Square Inventory using ADJUSTMENT changes (NONE → IN_STOCK).
 * Resolves variation IDs server-side via getVariationIdMap — same pattern as wastage-sync.
 *
 * Request body:
 * {
 *   items: [
 *     { name: string, quantity: number, unit: string }
 *   ],
 *   reference: string   // e.g. "ACW delivery"
 * }
 *
 * Response:
 * { success: true, changes: number, skipped: string[] }
 */

import { randomUUID } from 'crypto'
import { getVariationIdMap, getLocationId } from '../../../lib/square'
import { requireAuth } from '../../../lib/session'
import { invalidateItemsCache } from '../../../lib/cache'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  const { items, reference } = req.body ?? {}

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' })
  }

  const validItems = items.filter(it => it.name && Number(it.quantity) > 0)
  if (validItems.length === 0) {
    return res.status(400).json({ error: 'No items with quantity > 0' })
  }

  try {
    // Resolve variation IDs and location in parallel — same as wastage-sync
    const [varMap, locationId] = await Promise.all([
      getVariationIdMap(token),
      getLocationId(token),
    ])

    console.log('[receive-inventory] varMap keys:', Object.keys(varMap).slice(0, 20))
    console.log('[receive-inventory] requested items:', validItems.map(i => i.name))

    const occurredAt     = new Date().toISOString()
    const idempotencyKey = randomUUID()
    const skipped        = []

    const changes = validItems
      .map(item => {
        const entry = varMap[item.name]
        if (!entry?.varId) {
          console.log(`[receive-inventory] no varId for: "${item.name}"`)
          skipped.push(item.name)
          return null
        }
        return {
          type: 'ADJUSTMENT',
          adjustment: {
            from_state:        'NONE',
            to_state:          'IN_STOCK',
            catalog_object_id: entry.varId,
            location_id:       locationId,
            quantity:          String(Number(item.quantity).toFixed(4)),
            occurred_at:       occurredAt,
          },
        }
      })
      .filter(Boolean)

    if (changes.length === 0) {
      return res.status(200).json({
        success: false,
        skipped,
        reason: `No variation IDs found. Requested: [${validItems.map(i=>i.name).join(', ')}]. Map has ${Object.keys(varMap).length} items.`,
      })
    }

    const BASE_URL = 'https://connect.squareup.com/v2'
    const sqRes = await fetch(`${BASE_URL}/inventory/changes/batch-create`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${token}`,
        'Square-Version': '2024-01-17',
      },
      body: JSON.stringify({ idempotency_key: idempotencyKey, changes }),
    })

    const data = await sqRes.json()

    if (!sqRes.ok || data.errors?.length) {
      const msg = data.errors?.[0]?.detail ?? `Square error ${sqRes.status}`
      return res.status(500).json({ error: msg })
    }

    // Square's stock just changed — clear the cached items payload so the
    // Dashboard and order wizard don't keep showing pre-delivery figures.
    await invalidateItemsCache()

    return res.status(200).json({
      success: true,
      changes: changes.length,
      skipped,
    })

  } catch (err) {
    console.error('[receive-inventory]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
