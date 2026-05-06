import { getBarCategoryIds, getCatalogItems } from '../../../lib/square'

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })

  // Get bar category IDs
  const barCategoryIds = await getBarCategoryIds(token)

  // Fetch ALL catalog items without category filter
  const allRes = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM', {
    headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22' }
  })
  const allData = await allRes.json()
  const allItems = allData.objects || []

  // Find samboy
  const samboy = allItems.filter(obj => 
    (obj.item_data?.name || '').toLowerCase().includes('samboy') ||
    (obj.item_data?.name || '').toLowerCase().includes('bbq')
  ).map(obj => ({
    id: obj.id,
    name: obj.item_data?.name,
    is_deleted: obj.is_deleted,
    is_archived: obj.item_data?.is_archived,
    category_id: obj.item_data?.category_id,
    categories: obj.item_data?.categories,
    reporting_category: obj.item_data?.reporting_category,
    variations: (obj.item_data?.variations || []).map(v => ({
      id: v.id,
      name: v.item_variation_data?.name,
      price: v.item_variation_data?.price_money
    }))
  }))

  return res.status(200).json({ 
    total_items: allItems.length,
    bar_category_ids: [...barCategoryIds],
    samboy_items: samboy
  })
}