export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const { raw_names, hub_names } = req.body
  if (!raw_names?.length || !hub_names?.length)
    return res.status(400).json({ error: 'raw_names and hub_names required' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are matching supplier invoice line item descriptions to bar inventory system item names.

Hub inventory items:
${hub_names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Invoice descriptions to match:
${raw_names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY valid JSON, no markdown or explanation:
{
  "matches": [
    { "raw": "exact invoice description", "hub": "matching Hub item name or null", "confidence": "high|medium|low" }
  ]
}

Matching rules:
- Return one match object per invoice description, in the same order
- "high" = clear match (same product, minor wording/abbreviation difference)
- "medium" = probable match (same brand and type, some ambiguity on size or variant)
- "low" = uncertain (similar but could be wrong)
- null hub = no reasonable match found
- Match on product name, brand, and size — ignore pack quantities and case sizes
- Ignore suffixes like "750ml Btl", "6pk", "24x375ml", "Case" when comparing
- "Stoneleigh's Sauv Blanc 750ml Case 12" → "Stoneleigh's Sauv Blanc" is high confidence`
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || `Claude API error ${response.status}`)

    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.json({ ok: true, ...parsed })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
