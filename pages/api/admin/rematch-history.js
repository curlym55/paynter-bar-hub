/**
 * POST /api/admin/rematch-history
 * Re-runs Haiku name matching ONLY on rows where item_name_hub is null
 * or equals item_name_raw (genuinely unmatched). Never overwrites existing matches.
 */
import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_raw, item_name_hub')

    if (error) return res.status(500).json({ error: error.message })

    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}
    const hubNames = Object.keys(settings)
    if (!hubNames.length) return res.status(400).json({ error: 'No Hub items found' })

    // ONLY match rows where hub is null or hub === raw AND raw is not itself a valid Hub item
    // If raw === hub AND raw exists in Hub settings, it's already correctly matched — skip it
    const hubSet = new Set(hubNames)
    const unmatched = [...new Set(
      (rows || [])
        .filter(r => {
          if (!r.item_name_hub) return true              // hub is null — unmatched
          if (r.item_name_hub !== r.item_name_raw) return false  // hub differs from raw — already matched
          // hub === raw — only treat as unmatched if raw name is NOT a valid Hub item
          return !hubSet.has(r.item_name_raw)
        })
        .map(r => r.item_name_raw)
        .filter(Boolean)
    )]

    if (!unmatched.length) return res.json({ ok: true, matched: 0, message: 'All rows already matched' })

    const prompt = `You are matching supplier invoice descriptions to bar stock item names.
IMPORTANT RULES:
- Spirits on the invoice are sold as bottles (e.g. "Bundaberg Original Rum 1l") but tracked as nips in the Hub (e.g. "Bundaberg Rum 30ml Nip"). Match them.
- Wines: match on brand and variety name, ignore size.
- Beers: match on brand name, ignore size/pack.
- Ignore size differences — focus on brand and product name.
- Return null for hub if there is genuinely no match.
- Only return HIGH confidence matches — if unsure, return null.

Hub item names:
${hubNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Invoice descriptions to match:
${unmatched.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Respond ONLY with valid JSON, no markdown:
{
  "matches": [
    { "raw": "invoice description", "hub": "exact Hub item name from the list above, or null", "confidence": "high|medium|low" }
  ]
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!aiRes.ok) return res.status(500).json({ error: 'Haiku API error' })
    const aiData = await aiRes.json()
    const text = aiData.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const mData = JSON.parse(clean)

    // Only apply HIGH confidence matches
    const matchMap = {}
    for (const m of mData.matches || []) {
      if (m.hub && m.confidence === 'high') matchMap[m.raw] = m.hub
    }

    // Update ONLY rows where hub is still null or equals raw — never overwrite existing matches
    let updated = 0
    for (const [raw, hub] of Object.entries(matchMap)) {
      const { error: upErr } = await sb
        .from('buy_price_history')
        .update({ item_name_hub: hub })
        .eq('item_name_raw', raw)
      if (!upErr) updated++
    }

    return res.json({
      ok: true,
      unmatched_count: unmatched.length,
      matched: updated,
      skipped: unmatched.length - Object.keys(matchMap).length,
      matches: matchMap
    })
  } catch (e) {
    console.error('[rematch-history]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
