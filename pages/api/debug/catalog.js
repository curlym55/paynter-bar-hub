export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })

  try {
    // Fetch all catalog items directly
    let allItems = []
    let cursor = null
    do {
      const url = `https://connect.squareup.com/v2/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ''}`
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22' } })
      const d = await r.json()
      allItems = allItems.concat(d.objects || [])
      cursor = d.cursor
    } while (cursor)

    // Find samboy / snack items
    const samboy = allItems
      .filter(obj => (obj.item_data?.name || '').toLowerCase().includes('samboy'))
      .map(obj => ({
        id: obj.id,
        name: obj.item_data?.name,
        is_deleted: obj.is_deleted,
        is_archived: obj.item_data?.is_archived,
        ecom_available: obj.item_data?.ecom_available,
        category_id: obj.item_data?.category_id,
        categories: (obj.item_data?.categories || []).map(c => c.id),
        reporting_category_id: obj.item_data?.reporting_category?.id,
        variations: (obj.item_data?.variations || []).map(v => ({
          id: v.id, name: v.item_variation_data?.name,
          price: v.item_variation_data?.price_money?.amount,
          track_inventory: v.item_variation_data?.track_inventory
        }))
      }))

    return res.status(200).json({ total_catalog_items: allItems.length, samboy_items: samboy })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}