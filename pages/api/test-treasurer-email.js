/**
 * pages/api/test-treasurer-email.js
 *
 * Sends a test email to verify Mail.Send is configured correctly.
 * DELETE THIS FILE once confirmed working.
 *
 * Usage:
 *   POST /api/test-treasurer-email
 *   Body: { "to": "your@email.com" }
 *
 * Or hit it directly in the browser (GET) to send to the address
 * in the TEST_EMAIL_TO env var or the ?to= query param.
 */

const SENDER = process.env.MAIL_SENDER || 'paynterbar@gemwoods.com.au'

async function getAppToken() {
  const tenantId = process.env.ONEDRIVE_TENANT_ID
  if (!tenantId) throw new Error('ONEDRIVE_TENANT_ID env var not set')

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

export default async function handler(req, res) {
  // Accept both GET (browser) and POST (app button)
  const to = req.query.to || req.body?.to || process.env.TEST_EMAIL_TO
  if (!to) {
    return res.status(400).json({
      error: 'No recipient — add ?to=your@email.com to the URL, or POST { "to": "your@email.com" }'
    })
  }

  const now = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  try {
    const appToken = await getAppToken()

    const htmlBody = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;max-width:600px">
  <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Paynter Bar — Test Email</h2>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">GemLife Palmwoods</p>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-top:none">
    <p style="margin:0 0 12px">✅ If you're reading this, <strong>Mail.Send is working correctly.</strong></p>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap">Sent from</td><td>${SENDER}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Sent to</td><td>${to}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Time (AEST)</td><td>${now}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Tenant ID</td><td>${process.env.ONEDRIVE_TENANT_ID?.slice(0, 8)}…</td></tr>
    </table>
    <div style="margin-top:16px;padding:12px;background:#dcfce7;border:1px solid #86efac;border-radius:6px;font-size:13px;color:#166534">
      <strong>Next step:</strong> You can now use the 📧 Email Treasurer button in the Purchase Documents tab.
      Once confirmed working, delete <code>pages/api/test-treasurer-email.js</code>.
    </div>
  </div>
  <div style="padding:12px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p style="font-size:11px;color:#94a3b8;margin:0">Sent automatically by Paynter Bar Hub · GemLife Palmwoods</p>
  </div>
</body></html>`

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
            subject:      'Paynter Bar Hub — Mail.Send Test',
            body:         { contentType: 'HTML', content: htmlBody },
            toRecipients: [{ emailAddress: { address: to } }],
            from:         { emailAddress: { address: SENDER, name: 'Paynter Bar' } },
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
        msg:  `Test email sent to ${to} — check your inbox.`
      })
    }

    const errData = await sendRes.json().catch(() => ({}))
    throw new Error(errData.error?.message || `Send failed ${sendRes.status}: ${JSON.stringify(errData)}`)

  } catch (err) {
    console.error('[test-treasurer-email]', err.message)
    return res.status(200).json({ ok: false, error: err.message })
  }
}
