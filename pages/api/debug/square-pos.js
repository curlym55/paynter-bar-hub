export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const loc = 'LNM7JRJ0VKQ7W'
  if (!token) return res.status(500).json({ error: 'No token' })
  const hdr = { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' }
  const results = {}

  // 1. Vendors - correct format
  const vr = await fetch('https://connect.squareup.com/v2/vendors/search', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ filter: { status: ['ACTIVE'] } })
  })
  const vd = await vr.json()
  results.vendors = { status: vr.status, vendors: vd.vendors?.map(v=>({id:v.id, name:v.name})) || vd.errors }

  // 2. Inventory changes - no types filter, just location + date
  const ir = await fetch('https://connect.squareup.com/v2/inventory/batch-retrieve-changes', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ location_ids: [loc], updated_after: '2026-01-01T00:00:00.000Z' })
  })
  const id2 = await ir.json()
  // Find changes with source info that might reference POs
  const changes = id2.changes || []
  const receives = changes.filter(c => c.physical_count || (c.adjustment && c.adjustment.from_state === 'IN_TRANSIT'))
  results.inventory = { status: ir.status, total_changes: changes.length, receive_type_sample: receives.slice(0,2), error: id2.errors }

  // 3. Try GET /v2/purchase-orders with the right location param
  const pr2 = await fetch(`https://connect.squareup.com/v2/purchase-orders?location_ids[]=${loc}`, { headers: hdr })
  const pd2 = await pr2.json()
  results.po_attempt2 = { status: pr2.status, result: pd2 }

  return res.json(results)
}