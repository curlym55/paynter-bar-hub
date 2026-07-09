import { getCatalogImages } from '../../lib/square'
import { requireAuth } from '../../lib/session'

export default async function handler(req, res) {
  // Square catalog images. Requires a valid session — no anonymous access.
  if (!requireAuth(req, res)) return

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })

  // Fetch all catalog items with their image IDs
  const itemsRes = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM', {
    headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22' }
  })
  const itemsData = await itemsRes.json()

  // Collect all image IDs
  const imageIds = []
  const itemImageMap = {}
  for (const obj of itemsData.objects || []) {
    const ids = obj.item_data?.image_ids || []
    if (ids.length > 0) {
      imageIds.push(...ids)
      itemImageMap[obj.item_data?.name] = ids[0]
    }
  }

  // Fetch image URLs
  const imageUrls = await getCatalogImages(token, [...new Set(imageIds)])

  // Return items with their image URLs
  const result = Object.entries(itemImageMap).map(([name, imageId]) => ({
    name,
    imageId,
    url: imageUrls[imageId] || null
  })).filter(i => i.url).sort((a, b) => a.name.localeCompare(b.name))

  res.status(200).json({ items: result })
}