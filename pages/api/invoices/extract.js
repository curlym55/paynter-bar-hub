export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel' })

  const { pdf_base64 } = req.body
  if (!pdf_base64) return res.status(400).json({ error: 'pdf_base64 required' })

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
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
            { type: 'text', text: `Extract all product line items from this supplier invoice.
Return ONLY valid JSON with no markdown or explanation:
{
  "invoice_ref": "invoice/order number",
  "supplier": "supplier name",
  "invoice_date": "YYYY-MM-DD",
  "gst_included": true or false,
  "items": [
    {
      "item_name_raw": "full product name as on invoice",
      "invoice_qty": numeric quantity ordered,
      "pack_type": "Bottle/Case/Block/Pack/Each",
      "units_per_pack": integer units per pack,
      "invoice_unit_price": numeric price per invoice unit as shown on the invoice (include GST if the line item price includes it)
    }
  ]
}

Rules for gst_included:
- Dan Murphy's invoices: line item prices INCLUDE GST — set gst_included: true
- Coles/Woolworths invoices: line item prices INCLUDE GST — set gst_included: true
- ACW invoices: line item prices are typically EX GST — set gst_included: false, but check the invoice
- If GST is shown as a separate line at the bottom and line prices are ex GST: set gst_included: false
- When in doubt: check if line_total = qty × price, if yes and a GST line exists separately, prices are ex GST

Rules for units_per_pack:
- Single spirit/wine bottle: 1
- Beer/cider/premix 375ml cans: 24
- Beer/cider/premix 330ml bottles: 24
- Beer/cider 440ml cans (e.g. Guinness, Kilkenny): 24
- Beer/cider 470-500ml cans: 24
- Beer 30-block cans: 30
- Schweppes/Kirks/Bundaberg mixer bottles in 4-packs (Soda Water, Tonic Water, Lemon Lime & Bitters, Ginger Ale, Ginger Beer): 4
- 10-pack cans: 10
- Wine 750ml case: ALWAYS 6
- Piccolo 200ml (e.g. Henkell, Yellowglen): ALWAYS 24
- Single spirit/wine bottle purchased individually: 1
- Individual snack bags: 1
- If unsure: 1

Exclude: service fees, handling, delivery, freight, GST summary lines.` }
          ]
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
