import { createClient } from '@supabase/supabase-js'
import { getCatalogImages } from '../../lib/square'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN

  if (req.method === 'GET') {
    // Fetch active specials from Supabase
    const { data: specials, error } = await supabase
      .from('specials')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })

    // Fetch images from Square for items that have square_item_id
    let imageMap = {}
    const imageIds = specials.filter(s => s.square_image_id).map(s => s.square_image_id)
    if (token && imageIds.length > 0) {
      try { imageMap = await getCatalogImages(token, imageIds) } catch {}
    }

    const enriched = specials.map(s => ({
      ...s,
      image_url: s.square_image_id ? imageMap[s.square_image_id] : s.photo_url
    }))

    return res.status(200).json({ specials: enriched })
  }

  if (req.method === 'POST') {
    const { action, special } = req.body
    if (action === 'upsert') {
      const { data, error } = await supabase.from('specials').upsert(special).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, data })
    }
    if (action === 'delete') {
      const { error } = await supabase.from('specials').delete().eq('id', special.id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }
    if (action === 'reorder') {
      for (const { id, display_order } of special) {
        await supabase.from('specials').update({ display_order }).eq('id', id)
      }
      return res.status(200).json({ ok: true })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}