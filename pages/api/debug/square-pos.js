export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })
  try {
    // Try bare search first to see what works
    const r = await fetch('https://connect.squareup.com/v2/purchase-orders/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const d = await r.json()
    return res.json({ status: r.status, total: d.purchase_orders?.length, purchase_orders: d.purchase_orders, cursor: d.cursor, errors: d.errors })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}