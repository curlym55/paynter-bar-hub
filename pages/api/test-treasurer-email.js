/**
 * pages/api/test-treasurer-email.js
 *
 * Sends a test email that mirrors the real treasurer email exactly —
 * same body template, plus a dummy PDF attachment to verify attachments work.
 *
 * DELETE THIS FILE once confirmed working.
 *
 * Usage (browser GET):
 *   /api/test-treasurer-email?to=your@email.com
 */

const SENDER = process.env.MAIL_SENDER || 'paynterbar@gemwoods.com.au'

async function getAppToken() {
  const tenantId = process.env.ONEDRIVE_TENANT_ID
  if (!tenantId) throw new Error('ONEDRIVE_TENANT_ID env var not set — add it in Vercel')
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.ONEDRIVE_CLIENT_ID,
      client_secret: process.env.ONEDRIVE_CLIENT_SECRET,
      grant_type:    'client_credentials',
      scope:         'https://graph.microsoft.com/.default',
    }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(`App token error: ${data.error_description ?? data.error}`)
  return data.access_token
}

// Minimal valid PDF as base64 — just enough to prove attachment works
const DUMMY_PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA0MDAgMzAwXQovQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA1NCA+PgpzdHJlYW0KQlQgL0YxIDIwIFRmIDUwIDIwMCBUZCAoUGF5bnRlciBCYXIgVEVTVCBJbnZvaWNlKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMTE5IDAwMDAwIG4gCjAwMDAwMDAyODMgMDAwMDAgbiAKMDAwMDAwMDM4NyAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ2MgolJUVPRgo='

export default async function handler(req, res) {
  const to = req.query.to || req.body?.to
  if (!to) {
    return res.status(400).json({
      error: 'No recipient — add ?to=your@email.com to the URL'
    })
  }

  const now = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  // Fake doc record that mirrors a real delivery
  const doc = {
    supplier:             'Dan Murphy',
    po_ref:               'TEST-PO-001',
    order_date:           '2026-05-24',
    receive_date:         '2026-05-26',
    item_count:           15,
    receipt_onedrive_url: 'https://onedrive.live.com/test-receipt-link',
    invoice_onedrive_url: 'https://onedrive.live.com/test-invoice-link',
  }

  const fmtDate = iso =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric'
    })

  // ── Same HTML template as the real send-treasurer-email.js ─────────────────
  const attachMsg = `<p style="color:#16a34a;font-weight:600">✅ 2 documents attached: TEST-PO-001-Receipt-26-05-2026.xlsx, TEST-PO-001-Invoice.pdf</p>`
  const oneDriveLinks = `
    <a href="${doc.receipt_onedrive_url}" style="color:#0e7490">📄 Receive Report on OneDrive</a><br>
    <a href="${doc.invoice_onedrive_url}" style="color:#0e7490">📎 Invoice on OneDrive</a>`

  const htmlBody = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;max-width:600px">
  <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Paynter Bar — Delivery Receipt</h2>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">GemLife Palmwoods</p>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-top:none">
    <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;font-weight:600">Supplier</td><td style="padding:6px 0;font-weight:700">${doc.supplier}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">PO Reference</td><td style="padding:6px 0">${doc.po_ref}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Order Date</td><td style="padding:6px 0">${fmtDate(doc.order_date)}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Received</td><td style="padding:6px 0">${fmtDate(doc.receive_date)}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Items</td><td style="padding:6px 0">${doc.item_count}</td></tr>
    </table>
    ${attachMsg}
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:13px">${oneDriveLinks}</div>
    <div style="margin-top:20px;padding:12px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;font-size:12px;color:#854d0e">
      <strong>⚠️ This is a TEST email</strong> — sent ${now} AEST to verify Mail.Send and attachments are working.
      The dummy PDF attached below is a placeholder; real deliveries attach the actual receive report and supplier invoice.
      Once confirmed, delete <code>pages/api/test-treasurer-email.js</code>.
    </div>
  </div>
  <div style="padding:12px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p style="font-size:11px;color:#94a3b8;margin:0">Sent automatically by Paynter Bar Hub · GemLife Palmwoods</p>
  </div>
</body></html>`

  // Two attachments: dummy receipt (xlsx mime) + dummy invoice (pdf)
  const attachments = [
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name:         'TEST-PO-001-Receipt-26-05-2026.xlsx',
      contentType:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentBytes: DUMMY_PDF_B64,   // not a real xlsx but proves attachment delivery
    },
    {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name:         'TEST-PO-001-Invoice.pdf',
      contentType:  'application/pdf',
      contentBytes: DUMMY_PDF_B64,
    },
  ]

  try {
    const appToken = await getAppToken()

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${appToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject:      `[TEST] Delivery Receipt — Dan Murphy — TEST-PO-001 — 26 May 2026`,
            body:         { contentType: 'HTML', content: htmlBody },
            toRecipients: [{ emailAddress: { address: to } }],
            from:         { emailAddress: { address: SENDER, name: 'Paynter Bar' } },
            attachments,
          },
          saveToSentItems: true,
        }),
      }
    )

    if (sendRes.status === 202) {
      return res.status(200).json({
        ok:   true,
        from: SENDER,
        to,
        msg:  `Test email sent to ${to} — check your inbox. It should have 2 attachments and the full email body.`
      })
    }

    const errData = await sendRes.json().catch(() => ({}))
    throw new Error(errData.error?.message || `Send failed ${sendRes.status}: ${JSON.stringify(errData)}`)

  } catch (err) {
    console.error('[test-treasurer-email]', err.message)
    return res.status(200).json({ ok: false, error: err.message })
  }
}
