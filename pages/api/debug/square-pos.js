export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const loc = 'LNM7JRJ0VKQ7W'
  if (!token) return res.status(500).json({ error: 'No token' })
  const hdr = { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' }

  // Get all inventory changes - paginate through all of them
  let allChanges = [], cursor = null, pages = 0
  do {
    pages++
    const body = { location_ids: [loc], updated_after: '2026-01-01T00:00:00.000Z' }
    if (cursor) body.cursor = cursor
    const r = await fetch('https://connect.squareup.com/v2/inventory/batch-retrieve-changes', {
      method: 'POST', headers: hdr, body: JSON.stringify(body)
    })
    const d = await r.json()
    if (d.errors) return res.json({ errors: d.errors, pages })
    allChanges = allChanges.concat(d.changes || [])
    cursor = d.cursor
  } while (cursor && pages < 20)

  // Group by PO reference from source.name — look for "Order #N" pattern
  const poMap = {}
  for (const ch of allChanges) {
    const adj = ch.adjustment || ch.physical_count
    if (!adj) continue
    const src = adj.source?.name || ''
    const match = src.match(/Order\s*#?(\d+)/i) || src.match(/#(\d+)/)
    if (match) {
      const num = match[1]
      if (!poMap[num]) poMap[num] = { order_number: num, source_name: src, occurred_at: adj.occurred_at, vendor_id: adj.source?.type, items: [] }
      poMap[num].items.push({ variation_id: adj.catalog_object_id, qty: adj.quantity })
    }
  }

  const pos = Object.values(poMap).sort((a,b) => Number(a.order_number) - Number(b.order_number))
  return res.json({ total_changes: allChanges.length, pages, pos_found: pos.length, purchase_orders: pos })
}