// ONE-OFF recovery endpoint — regenerates the ACW-PO-137 Excel and links it
// to the existing PO Documents record. Safe to delete after running once.
export default async function handler(req, res) {
  try {
    const po_ref = 'ACW-PO-137-29 06 2026'
    const supplier = 'ACW'
    const order_date = '29 Jun 2026'
    const items = [
      { name: "Nobby's Salted Mixed Nuts 150g", sku: 'Y401336', orderQty: 20, bottlesToOrder: null, isSpirit: false },
      { name: "Nobby's Salted Peanuts 170g",    sku: '383983P', orderQty: 20, bottlesToOrder: null, isSpirit: false },
      { name: 'Smiths Original Chips 45g',      sku: 'D572056', orderQty: 54, bottlesToOrder: null, isSpirit: false },
    ]

    const base = `https://${req.headers.host}`

    const saveRes = await fetch(`${base}/api/onedrive/save-po`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ po_ref, supplier, order_date, items }),
    })
    const saveData = await saveRes.json()

    if (!saveData.webUrl) {
      return res.json({ ok: false, step: 'save-po', error: saveData })
    }

    const linkRes = await fetch(`${base}/api/documents/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_urls', po_ref, po_onedrive_url: saveData.webUrl }),
    })
    const linkData = await linkRes.json()

    return res.json({ ok: true, webUrl: saveData.webUrl, linkResult: linkData })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}
