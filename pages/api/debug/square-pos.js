export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })
  try {
    let orders = [], cursor = null
    do {
      const body = {
        location_ids: ['LNM7JRJ0VKQ7W'],
        query: { filter: { state_filter: { states: ['DRAFT','OPEN','RECEIVED','CANCELLED'] } } }
      }
      if (cursor) body.cursor = cursor
      const r = await fetch('https://connect.squareup.com/v2/purchase-orders/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (d.errors) return res.status(400).json({ errors: d.errors })
      orders = orders.concat(d.purchase_orders || [])
      cursor = d.cursor
    } while (cursor)
    return res.json({ total: orders.length, purchase_orders: orders })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}