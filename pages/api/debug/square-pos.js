export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const loc = 'LNM7JRJ0VKQ7W'
  if (!token) return res.status(500).json({ error: 'No token' })

  const hdr = { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' }
  const results = {}

  // 1. List vendors
  const vr = await fetch('https://connect.squareup.com/v2/vendors/search', { method:'POST', headers: hdr, body: JSON.stringify({}) })
  const vd = await vr.json()
  results.vendors = { status: vr.status, data: vd.vendors?.map(v => ({ id: v.id, name: v.name, status: v.status })) || vd.errors }

  // 2. Try PO list via GET
  const pr = await fetch(`https://connect.squareup.com/v2/purchase-orders?location_id=${loc}`, { headers: hdr })
  const pd = await pr.json()
  results.pos_get = { status: pr.status, data: pd }

  // 3. Inventory history - RECEIVE type adjustments (these come from PO receipts)
  const ir = await fetch('https://connect.squareup.com/v2/inventory/changes/batch-retrieve', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ location_ids: [loc], types: ['RECEIVE'], updated_after: '2026-01-01T00:00:00Z' })
  })
  const id2 = await ir.json()
  results.inventory_receives = { status: ir.status, sample: id2.changes?.slice(0,3) || id2.errors }

  return res.json(results)
}