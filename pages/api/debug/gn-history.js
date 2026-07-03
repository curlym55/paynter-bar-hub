import { getVariationIdMap, getLocationId } from '../../../lib/square'

export default async function handler(req, res) {
  try {
    const token = process.env.SQUARE_ACCESS_TOKEN
    const locationId = await getLocationId(token)
    const variationMap = await getVariationIdMap(token) // { itemName: variationId }

    const matchName = Object.keys(variationMap).find(name =>
      name.toLowerCase().includes('supercrisp')
    )
    if (!matchName) {
      return res.json({ ok: false, error: 'No item matching "supercrisp" found in Square catalog', availableNames: Object.keys(variationMap).filter(n => n.toLowerCase().includes('gn')) })
    }
    const variationId = variationMap[matchName]

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const changesRes = await fetch('https://connect.squareup.com/v2/inventory/changes/batch-retrieve', {
      method: 'POST',
      headers: { 'Square-Version': '2026-01-22', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        catalog_object_ids: [variationId],
        location_ids: [locationId],
        updated_after: since,
      })
    })
    const changesData = await changesRes.json()
    if (!changesRes.ok) return res.json({ ok: false, error: changesData })

    const changes = (changesData.changes || []).map(c => {
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
        employeeId: a?.employee_id || null,
        teamMemberId: a?.team_member_id || null,
      }
    }).sort((a,b) => new Date(a.occurredAt||a.createdAt) - new Date(b.occurredAt||b.createdAt))

    return res.json({ ok: true, itemName: matchName, variationId, changeCount: changes.length, changes })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}
