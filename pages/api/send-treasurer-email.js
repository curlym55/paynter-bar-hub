/**
 * pages/api/send-treasurer-email.js
 *
 * Sends a delivery confirmation email to treasurer@gemwoods.com.au
 * with the receive report and invoice attached.
 *
 * Uses:
 *  - Delegated token (existing refresh token) to fetch files from OneDrive
 *  - App token (client credentials) to send mail via Graph API
 *
 * Required env vars (in addition to existing OneDrive vars):
 *  ONEDRIVE_TENANT_ID   – Azure Directory (tenant) ID
 *  MAIL_SENDER          – e.g. paynterbar@gemwoods.com.au
 *  MAIL_TREASURER       – e.g. treasurer@gemwoods.com.au (optional, has default)
 */

import { createClient } from '@supabase/supabase-js'
import { getAccessToken } from '../../lib/onedrive'
import { requireAuth } from '../../lib/session'

const SENDER     = process.env.MAIL_SENDER     || 'paynterbar@gemwoods.com.au'
const TREASURER  = process.env.MAIL_TREASURER  || 'treasurer@gemwoods.com.au'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── App token (client credentials) for Mail.Send ─────────────────────────────
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

// ── Fetch a file from OneDrive by path, return base64 ────────────────────────
async function fetchFileBase64(filePath, token) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/')
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  return Buffer.from(buf).toString('base64')
}

// ── Format a YYYY-MM-DD date string to "26 May 2026" ─────────────────────────
function fmtDate(isoDate) {
  if (!isoDate) return '—'
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Sends email on the bar's behalf. Management access only.
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { doc } = req.body
  if (!doc?.po_ref) return res.status(400).json({ error: 'doc with po_ref required' })

  try {
    const [delegatedToken, appToken] = await Promise.all([
      getAccessToken(),
      getAppToken(),
    ])

    const safeSupplier = (doc.supplier || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').trim()
    const safeRef      = (doc.po_ref || '').replace(/\s/g, '_')
    const attachments  = []

    // ── Attach receive report ─────────────────────────────────────────────────
    let receiptName = null
    if (doc.receive_date) {
      const [y, m, d] = doc.receive_date.split('-')
      const dateFile  = `${d}-${m}-${y}`
      receiptName     = `${safeRef}-Receipt-${dateFile}.xlsx`
      const path      = `POs Invoices and Receive Reports/Receive Reports/${safeSupplier}/${receiptName}`
      const b64       = await fetchFileBase64(path, delegatedToken)
      if (b64) {
        attachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name:         receiptName,
          contentType:  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentBytes: b64,
        })
      }
    }

    // ── Attach invoice (try pdf → jpg → jpeg → png) ───────────────────────────
    let invoiceName = null
    if (doc.invoice_onedrive_url || doc.invoice_url) {
      const mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
      for (const ext of ['pdf', 'jpg', 'jpeg', 'png']) {
        const name = `${safeRef}-Invoice.${ext}`
        const path = `POs Invoices and Receive Reports/Invoices/${safeSupplier}/${name}`
        const b64  = await fetchFileBase64(path, delegatedToken)
        if (b64) {
          invoiceName = name
          attachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name:         name,
            contentType:  mimeMap[ext],
            contentBytes: b64,
          })
          break
        }
      }
    }

    // ── Build email body ──────────────────────────────────────────────────────
    const subject   = `Delivery Receipt — ${doc.supplier} — ${doc.po_ref} — ${fmtDate(doc.receive_date)}`
    const attachMsg = attachments.length > 0
      ? `<p style="color:#16a34a;font-weight:600">✅ ${attachments.length} document${attachments.length !== 1 ? 's' : ''} attached: ${attachments.map(a => a.name).join(', ')}</p>`
      : `<p style="color:#d97706;font-weight:600">⚠️ Files could not be retrieved — please download from OneDrive links below.</p>`

    const oneDriveLinks = [
      doc.receipt_onedrive_url ? `<a href="${doc.receipt_onedrive_url}" style="color:#0e7490">📄 Receive Report on OneDrive</a>` : null,
      doc.invoice_onedrive_url ? `<a href="${doc.invoice_onedrive_url}" style="color:#0e7490">📎 Invoice on OneDrive</a>` : null,
    ].filter(Boolean).join('<br>')

    const htmlBody = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;max-width:600px">
  <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">Paynter Bar — Delivery Receipt</h2>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">GemLife Palmwoods</p>
  </div>
  <div style="background:#f8fafc;padding:20px 24px;border:1px solid #e2e8f0;border-top:none">
    <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;font-weight:600">Supplier</td><td style="padding:6px 0;font-weight:700">${doc.supplier}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">PO Reference</td><td style="padding:6px 0">${doc.po_ref || '—'}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Order Date</td><td style="padding:6px 0">${fmtDate(doc.order_date)}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Received</td><td style="padding:6px 0">${fmtDate(doc.receive_date)}</td></tr>
      <tr><td style="padding:6px 20px 6px 0;color:#64748b;font-size:13px;font-weight:600">Items</td><td style="padding:6px 0">${doc.item_count || '—'}</td></tr>
    </table>
    ${attachMsg}
    ${oneDriveLinks ? `<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:13px">${oneDriveLinks}</div>` : ''}
  </div>
  <div style="padding:12px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
    <p style="font-size:11px;color:#94a3b8;margin:0">Sent automatically by Paynter Bar Hub · GemLife Palmwoods</p>
  </div>
</body></html>`

    // ── Send via Graph API ────────────────────────────────────────────────────
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
            subject,
            body:         { contentType: 'HTML', content: htmlBody },
            toRecipients: [
              { emailAddress: { address: TREASURER, name: 'Treasurer' } },
              { emailAddress: { address: SENDER,    name: 'Paynter Bar' } },
            ],
            from:         { emailAddress: { address: SENDER,    name: 'Paynter Bar' } },
            attachments,
          },
          saveToSentItems: true,
        }),
      }
    )

    if (sendRes.status === 202) {
      // ── Write treasurer_emailed_at timestamp to bar_documents ─────────────
      const now = new Date().toISOString()
      try {
        const { error: updateError } = await sb()
          .from('bar_documents')
          .update({ treasurer_emailed_at: now })
          .eq('id', doc.id)
        if (updateError) console.error('[send-treasurer-email] failed to update treasurer_emailed_at:', updateError.message)
      } catch (e) {
        console.error('[send-treasurer-email] update threw:', e.message)
      }

      return res.status(200).json({ ok: true, attached: attachments.map(a => a.name), treasurer_emailed_at: now })
    }

    const errData = await sendRes.json().catch(() => ({}))
    throw new Error(errData.error?.message || `Send failed ${sendRes.status}`)

  } catch (err) {
    console.error('[send-treasurer-email]', err.message)
    return res.status(200).json({ ok: false, error: err.message })
  }
}
