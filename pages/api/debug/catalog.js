export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })
  try {
    // Fetch from list API and find the BBQ item specifically
    let found = null
    let cursor = null
    let pages = 0
    do {
      pages++
      const url = `https://connect.squareup.com/v2/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ''}`
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22' } })
      const d = await r.json()
      for (const obj of d.objects || []) {
        if (obj.id === 'MOPBJRU2NYLDOOPF7KMBZP3R') {
          found = {
            id: obj.id,
            name: obj.item_data?.name,
            is_deleted: obj.is_deleted,
            is_archived: obj.item_data?.is_archived,
            category_id: obj.item_data?.category_id,
            has_categories_field: !!obj.item_data?.categories,
            categories: obj.item_data?.categories,
            has_reporting_category: !!obj.item_data?.reporting_category,
            reporting_category: obj.item_data?.reporting_category,
            raw_item_data_keys: Object.keys(obj.item_data || {})
          }
        }
      }
      cursor = d.cursor
    } while (cursor && !found)

    return res.status(200).json({ pages_fetched: pages, bbq_from_list_api: found })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}