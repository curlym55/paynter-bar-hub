export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })
  try {
    // Try the inventory purchase orders approach
    const r = await fetch('https://connect.squareup.com/v2/purchase-orders/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_ids: ['LNM7JRJ0VKQ7W'] })
    })
    const d = await r.json()
    return res.json({ status: r.status, result: d })
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}