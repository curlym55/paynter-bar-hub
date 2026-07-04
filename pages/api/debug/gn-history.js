import { getVariationIdMap, getLocationId } from '../../../lib/square'

export default async function handler(req, res) {
  try {
    const token = process.env.SQUARE_ACCESS_TOKEN
    const locationId = await getLocationId(token)
    const variationMap = await getVariationIdMap(token) // { itemName: variationId }

    const searchTerm = (req.query.item || 'supercrisp').toLowerCase()
    const matchName = Object.keys(variationMap).find(name =>
      name.toLowerCase().includes(searchTerm)
    )
    if (!matchName) {
      return res.json({
        ok: false,
        error: `No item matching "${searchTerm}" found in Square catalog`,
        availableNames: Object.keys(variationMap).filter(n => n.toLowerCase().includes(searchTerm.slice(0,4))),
      })
    }
    const variationId = variationMap[matchName].varId

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    // Paginate through ALL changes in the window — a single call caps at 100
    let allChanges = []
    let cursor = null
    let pageCount = 0
    do {
      const body = { catalog_object_ids: [variationId], location_ids: [locationId], updated_after: since }
      if (cursor) body.cursor = cursor
      const changesRes = await fetch('https://connect.squareup.com/v2/inventory/changes/batch-retrieve', {
        method: 'POST',
        headers: { 'Square-Version': '2026-01-22', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const changesData = await changesRes.json()
      if (!changesRes.ok) return res.json({ ok: false, error: changesData, pagesFetched: pageCount })
      allChanges = allChanges.concat(changesData.changes || [])
      cursor = changesData.cursor || null
      pageCount++
    } while (cursor && pageCount < 20)

    const changes = allChanges.map(c => {
      const a = c.physical_count || c.adjustment
      return {
        type: c.type,
        occurredAt: a?.occurred_at,
        createdAt: a?.created_at,
        quantity: a?.quantity,
        fromState: a?.from_state,
        toState: a?.to_state,
        state: a?.state,
        source: a?.source?.product_name || a?.source?.name || null,
        note: a?.note || null,
      }
    }).sort((a,b) => new Date(a.occurredAt||a.createdAt) - new Date(b.occurredAt||b.createdAt))

    // Summarise by transition type to spot double-counted receiving paths
    const summary = {}
    for (const c of changes) {
      const key = `${c.fromState || c.state || '?'} -> ${c.toState || '?'}`
      const qty = Number(c.quantity) || 0
      summary[key] = (summary[key] || 0) + qty
    }

    return res.json({
      ok: true,
      itemName: matchName,
      variationId,
      pagesFetched: pageCount,
      changeCount: changes.length,
      summaryByTransition: summary,
      changes,
    })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}
