/**
 * POST /api/admin/rematch-history
 * Re-runs Haiku name matching on all buy_price_history rows where
 * item_name_hub is null or equals item_name_raw (unmatched).
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

    // Get all unmatched rows (hub = raw or hub is null)
    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_raw, item_name_hub')

    if (error) return res.status(500).json({ error: error.message })

    // Get Hub item names
    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}
    const hubNames = Object.keys(settings)

    if (!hubNames.length) return res.status(400).json({ error: 'No Hub items found' })

    // Find unique unmatched raw names — includes rows where hub name doesn't exist in Hub settings
    const hubSet = new Set(hubNames)
    const unmatched = [...new Set(
      (rows || [])
        .filter(r => !r.item_name_hub || r.item_name_hub === r.item_name_raw || !hubSet.has(r.item_name_hub))
        .map(r => r.item_name_raw)
        .filter(Boolean)
    )]

    if (!unmatched.length) return res.json({ ok: true, matched: 0, message: 'All rows already matched' })

    // Call Haiku via fetch (same pattern as extract.js)
    const prompt = `You are matching supplier invoice descriptions to bar stock item names.
IMPORTANT RULES:
- Spirits on the invoice are sold as bottles (e.g. "Bundaberg Original Rum 1l") but tracked as nips in the Hub (e.g. "Bundaberg Rum 30ml Nip"). Match them.
- Wines on the invoice may say "Pinot Gris" and the Hub says "Pinot Gris" — match on brand/variety.
- Ignore size differences (1l vs 700ml vs 30ml nip) — focus on brand and product name.
- If the raw name already exactly matches a Hub name, still check if there is a BETTER match (e.g. a nip version).
- Return null for hub if there is genuinely no match.

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

    // Build match map
    const matchMap = {}
    for (const m of mData.matches || []) {
      if (m.hub && m.confidence !== 'low') matchMap[m.raw] = m.hub
    }

    // Update rows in Supabase
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
