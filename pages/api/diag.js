// pages/api/diag.js  — TEMPORARY diagnostic, delete after debugging
import { getLocationId } from '../../lib/square'

const BASE_URL = 'https://connect.squareup.com/v2'
const headers  = t => ({ 'Square-Version': '2024-02-22', 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' })

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'no token' })

  const name = req.query.name || 'Smiths Salt'

  // 1. Get location
  const locationId = await getLocationId(token)

  // 2. Search catalog by name
  const searchRes = await fetch(`${BASE_URL}/catalog/search`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      object_types: ['ITEM'],
      query: { text_query: { keywords: [name] } }
    })
  })
  const searchData = await searchRes.json()
  const items = (searchData.objects || []).map(obj => {
    const d = obj.item_data || {}
    return {
      itemId: obj.id,
      name: d.name,
      variations: (d.variations || []).map(v => ({
        varId: v.id,
        name: v.item_variation_data?.name,
        sku:  v.item_variation_data?.sku,
      }))
    }
  })

  // 3. For each variation found, check inventory count
  const allVarIds = items.flatMap(i => i.variations.map(v => v.varId))
  let counts = {}
  if (allVarIds.length) {
    const countRes = await fetch(`${BASE_URL}/inventory/counts/batch-retrieve`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        catalog_object_ids: allVarIds,
        location_ids: [locationId],
        states: ['IN_STOCK']
      })
    })
    const countData = await countRes.json()
    for (const c of countData.counts || []) {
      counts[c.catalog_object_id] = c.quantity
    }
  }

  return res.json({ locationId, items, counts })
}
