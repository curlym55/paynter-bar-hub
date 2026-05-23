import { getLocationId, fetchSquareData } from '../../lib/square'
import { calculateItem } from '../../lib/calculations'

const BASE_URL = 'https://connect.squareup.com/v2'

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Square-Version': '2026-01-22'
  }
}

async function getAdjustmentsSince(token, locationId, afterISO) {
  const adjustments = {}
  let cursor = null
  let page = 0

  do {
    page++
    if (page > 50) break
    const body = {
      location_ids: [locationId],
      types: ['ADJUSTMENT', 'PHYSICAL_COUNT'],
      updated_after: afterISO
    }
    if (cursor) body.cursor = cursor
    const res = await fetch(`${BASE_URL}/inventory/changes/batch-retrieve`, {
      method: 'POST', headers: headers(token), body: JSON.stringify(body)
    })
    const data = await res.json()
    const changes = data.changes || []
    if (!changes.length) break

    for (const change of changes) {
      if (change.type === 'ADJUSTMENT') {
        const adj = change.adjustment || {}
        const varId = adj.catalog_object_id
        if (!varId) continue
        const qty = parseFloat(adj.quantity || 0)
        // Sales reduce stock (IN_STOCK -> SOLD), receipts increase (RECEIVED -> IN_STOCK)
        if (adj.from_state === 'IN_STOCK' && adj.to_state === 'SOLD') {
          adjustments[varId] = (adjustments[varId] || 0) - qty
        } else if (adj.to_state === 'IN_STOCK' && adj.from_state !== 'IN_STOCK') {
          adjustments[varId] = (adjustments[varId] || 0) + qty
        } else if (adj.from_state === 'IN_STOCK') {
          adjustments[varId] = (adjustments[varId] || 0) - qty
        }
      } else if (change.type === 'PHYSICAL_COUNT') {
        const pc = change.physical_count || {}
        // Physical count overrides - record separately
        if (!adjustments._physicalCounts) adjustments._physicalCounts = {}
        adjustments._physicalCounts[pc.catalog_object_id] = {
          quantity: parseFloat(pc.quantity || 0),
          occurredAt: pc.occurred_at
        }
      }
    }
    cursor = data.cursor
  } while (cursor)

  return adjustments
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No Square token' })

  try {
    const locationId = await getLocationId(token)

    // Get current items with stock
    const currentItems = await fetchSquareData(token, 90)

    // Get all adjustments since 1 May 2026 00:00 AEST = 30 Apr 2026 14:00 UTC
    const cutoffISO = '2026-04-30T14:00:00Z'
    const adjsSince = await getAdjustmentsSince(token, locationId, cutoffISO)
    const physicalCounts = adjsSince._physicalCounts || {}
    delete adjsSince._physicalCounts

    // Get variation ID map for current items
    const varRes = await fetch(`${BASE_URL}/catalog/list?types=ITEM`, { headers: headers(token) })
    const varData = await varRes.json()

    // Build varId -> item name map
    const varToItem = {}
    for (const obj of varData.objects || []) {
      if (obj.is_deleted || obj.item_data?.is_archived) continue
      for (const v of obj.item_data?.variations || []) {
        varToItem[v.id] = obj.item_data?.name || 'Unknown'
      }
    }

    // For each current item, calculate end-of-April stock
    // eoy stock = current stock - adjustments made since 1 May
    const itemAdjMap = {}
    for (const [varId, delta] of Object.entries(adjsSince)) {
      const name = varToItem[varId]
      if (!name) continue
      itemAdjMap[name] = (itemAdjMap[name] || 0) + delta
    }

    const report = currentItems
      .filter(i => !i.name.toLowerCase().includes('ticket') && !i.name.toLowerCase().includes('raffle'))
      .map(item => {
        const adjDelta = itemAdjMap[item.name] || 0
        // End of April stock = current stock minus changes since 1 May
        const endAprilStock = Math.max(0, Math.round(item.onHand - adjDelta))
        return {
          name: item.name,
          category: item.category || '',
          endAprilStock,
          currentStock: item.onHand,
          changesSinceMay1: adjDelta,
          unitCost: item.buyPrice || '',
          totalValue: item.buyPrice ? +(endAprilStock * item.buyPrice).toFixed(2) : ''
        }
      })
      .filter(i => i.endAprilStock > 0)
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))

    return res.status(200).json({ report, asAt: new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: 'long', year: 'numeric' }), generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('SOH audit error:', err)
    return res.status(500).json({ error: err.message })
  }
}