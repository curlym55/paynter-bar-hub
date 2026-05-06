export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })
  const hdr = { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' }
  const loc = 'LNM7JRJ0VKQ7W'

  // Vendor IDs discovered
  const vendorIds = [
    'ULVSWLCADZ3UFMMN', // ACW
    '3BFEDKDHPUXBGED5', // ACW Sunshine
    'QRUCIOLEAG4XPP7B', // Coles
    'A3ZIU6DFAAWA3TLN', // Coles/Woolworths
    'XINO5IOUWTY2NS4T', // Dan Murphy
    '3RQHRXLQOVQCJ3NB', // Dan Murphy's
  ]

  const results = {}

  // Try 1: nested filter with location_id_filter
  const r1 = await fetch('https://connect.squareup.com/v2/purchase-orders/search', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ filter: { location_id_filter: { location_ids: [loc] } } })
  })
  const d1 = await r1.json()
  results.try1_location_filter = { status: r1.status, count: d1.purchase_orders?.length, sample: d1.purchase_orders?.slice(0,2), errors: d1.errors }

  // Try 2: vendor_id_filter
  const r2 = await fetch('https://connect.squareup.com/v2/purchase-orders/search', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ filter: { vendor_id_filter: { vendor_ids: vendorIds } } })
  })
  const d2 = await r2.json()
  results.try2_vendor_filter = { status: r2.status, count: d2.purchase_orders?.length, sample: d2.purchase_orders?.slice(0,2), errors: d2.errors }

  // Try 3: state filter only
  const r3 = await fetch('https://connect.squareup.com/v2/purchase-orders/search', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ filter: { state_filter: { states: ['DRAFT','OPEN','RECEIVED'] } } })
  })
  const d3 = await r3.json()
  results.try3_state_filter = { status: r3.status, count: d3.purchase_orders?.length, sample: d3.purchase_orders?.slice(0,2), errors: d3.errors }

  return res.json(results)
}