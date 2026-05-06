export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'No token' })
  try {
    // Get bar category IDs
    const catRes = await fetch('https://connect.squareup.com/v2/catalog/list?types=CATEGORY', {
      headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22' }
    })
    const catData = await catRes.json()
    const BAR_KEYWORDS = ['beer','wine','spirit','cider','premix','sparkling','liqueur','fortified','rose','soft drink','mixer','snack','chip','nut','beverage','alcohol','whisk','bar']
    const barCats = (catData.objects || []).filter(obj => {
      const name = (obj.category_data?.name || '').toLowerCase()
      return BAR_KEYWORDS.some(kw => name.includes(kw))
    }).map(obj => ({ id: obj.id, name: obj.category_data?.name }))

    // Get the specific BBQ item
    const itemRes = await fetch('https://connect.squareup.com/v2/catalog/object/MOPBJRU2NYLDOOPF7KMBZP3R', {
      headers: { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22' }
    })
    const itemData = await itemRes.json()
    const d = itemData.object?.item_data || {}

    return res.status(200).json({
      bar_categories: barCats,
      bbq_blast: {
        name: d.name,
        category_id: d.category_id,
        categories: d.categories,
        reporting_category: d.reporting_category,
        is_archived: d.is_archived
      }
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}