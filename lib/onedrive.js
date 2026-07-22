/**
 * lib/onedrive.js
 *
 * Microsoft Graph helper for saving files to OneDrive.
 * Refresh token is loaded from Redis (set via /api/onedrive/callback)
 * or from the ONEDRIVE_REFRESH_TOKEN env var as fallback.
 *
 * Required env vars:
 *   ONEDRIVE_CLIENT_ID      – Azure app registration client ID
 *   ONEDRIVE_CLIENT_SECRET  – Azure app client secret
 *   ONEDRIVE_FOLDER_PATH    – e.g. "Paynter Bar/Receive Reports" (optional, has default)
 */

import { kvGet, kvSet, kvDelete, getRedis } from './redis'

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

// ── Token management ──────────────────────────────────────────────────────────

let _cachedToken = null
let _tokenExpiry = 0

async function getRefreshToken() {
  // Prefer Redis-stored token (set via OAuth callback), fall back to env var
  const fromRedis = await kvGet('onedriveRefreshToken').catch(() => null)
  return fromRedis || process.env.ONEDRIVE_REFRESH_TOKEN || null
}

async function saveRefreshToken(token) {
  await kvSet('onedriveRefreshToken', token).catch(() => {})
}

// Multiple people can use the Hub at the same time, and Vercel may run each
// request on a separate serverless instance with its own in-memory cache —
// so two requests can both decide the token is expired and refresh it
// simultaneously. Microsoft rotates refresh tokens on use, so a losing
// concurrent request can invalidate the connection for everyone. We use a
// short-lived Redis lock so only one request refreshes at a time; the rest
// wait briefly and then re-check Redis for the token the winner saved.
async function acquireRefreshLock() {
  const lockKey = 'onedriveTokenRefreshLock'
  const redis = getRedis()
  for (let attempt = 0; attempt < 20; attempt++) {
    // Atomic "set if not exists, expire in 10s" — only one caller can win this
    const got = await redis.set(lockKey, '1', 'EX', 10, 'NX').catch(() => null)
    if (got === 'OK') return true
    await new Promise(r => setTimeout(r, 150))
  }
  return false // proceed anyway rather than hang forever
}

export async function getAccessToken() {
  const now = Date.now()
  if (_cachedToken && now < _tokenExpiry - 60_000) return _cachedToken

  const gotLock = await acquireRefreshLock()
  try {
    // Re-check in-memory cache — another request on this same instance
    // (or the lock holder) may have just refreshed it while we waited.
    const nowAfterLock = Date.now()
    if (_cachedToken && nowAfterLock < _tokenExpiry - 60_000) return _cachedToken

    const refreshToken = await getRefreshToken()
    if (!refreshToken) throw new Error('OneDrive not connected — visit /api/onedrive/auth to connect')

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.ONEDRIVE_CLIENT_ID,
        client_secret: process.env.ONEDRIVE_CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        scope:         'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
      })
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      throw new Error(`OneDrive token error: ${data.error_description ?? data.error ?? res.status}`)
    }

    _cachedToken = data.access_token
    _tokenExpiry = nowAfterLock + data.expires_in * 1000

    // Save new refresh token back to Redis if it rotated
    if (data.refresh_token && data.refresh_token !== refreshToken) {
      await saveRefreshToken(data.refresh_token)
    }

    return _cachedToken
  } finally {
    if (gotLock) {
      await kvDelete('onedriveTokenRefreshLock').catch(() => {})
    }
  }
}

// ── File upload ───────────────────────────────────────────────────────────────

/**
 * saveFile
 * Uploads (or overwrites) a file to OneDrive.
 */
export async function saveFile(filename, content, mimeType = 'text/csv') {
  const token = await getAccessToken()

  const folder = (process.env.ONEDRIVE_FOLDER_PATH ?? 'Paynter Bar/Receive Reports').replace(/^\/|\/$/g, '')
  const encodedPath = folder.split('/').map(encodeURIComponent).join('/')
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/${encodeURIComponent(filename)}:/content`

  const body = typeof content === 'string' ? Buffer.from(content, 'utf8') : content

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
    body,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(`OneDrive upload error ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`)
  }

  return { id: data.id, webUrl: data.webUrl }
}

/**
 * deleteFile
 * Deletes a file from OneDrive by folder + filename. Best-effort by design:
 * callers should catch/log failures rather than let a missing OneDrive file
 * block the underlying data operation (e.g. deleting a PO record should
 * still succeed even if the file was already gone or OneDrive is briefly
 * unavailable). A 404 (already deleted / never existed) is treated as
 * success, not an error.
 */
export async function deleteFile(folder, filename) {
  const token = await getAccessToken()

  const cleanFolder = folder.replace(/^\/|\/$/g, '')
  const encodedPath = cleanFolder.split('/').map(encodeURIComponent).join('/')
  const url = 'https://graph.microsoft.com/v1.0/me/drive/root:/' + encodedPath + '/' + encodeURIComponent(filename)

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  })

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    throw new Error('OneDrive delete error ' + res.status + ': ' + (data.error?.message ?? JSON.stringify(data)))
  }

  return true
}// ── CSV builder ───────────────────────────────────────────────────────────────

export function buildReceiveCsv({ reference, receivedBy, locationName, items }) {
  const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })

  const header = [
    `"Paynter Bar — Goods Received Record"`,
    `"Reference","${reference}"`,
    `"Date/Time","${timestamp}"`,
    `"Received By","${receivedBy ?? 'Bar Manager'}"`,
    `"Location","${locationName ?? 'Paynter Bar'}"`,
    ``,
    `"Item","Ordered Qty","Received Qty","Unit","Note"`,
  ].join('\n')

  const rows = items.map(it => {
    const note = it.note ? `"${it.note.replace(/"/g, '""')}"` : '""'
    return `"${it.name}","${it.orderedQty ?? ''}","${it.receivedQty}","${it.unit ?? ''}",${note}`
  })

  return [header, ...rows, ``, `"Generated by","Paynter Bar Hub"`].join('\n')
}

/**
 * deleteFileByShareUrl
 * Deletes a OneDrive file identified by its webUrl (the sharing link
 * returned when the file was uploaded, e.g. bar_documents.invoice_onedrive_url).
 * Resolves the URL to a DriveItem via Graph's /shares endpoint first, then
 * deletes by item ID -- this works regardless of filename, extension, or
 * folder-naming rules, so callers never need to reconstruct a path.
 * Best-effort: a 404 (already gone) is treated as success, not an error.
 */
export async function deleteFileByShareUrl(webUrl) {
  const token = await getAccessToken()

  const base64 = Buffer.from(webUrl).toString('base64')
    .replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
  const shareId = 'u!' + base64

  const shareRes = await fetch('https://graph.microsoft.com/v1.0/shares/' + shareId + '/driveItem', {
    headers: { Authorization: 'Bearer ' + token },
  })
  if (shareRes.status === 404) return true
  if (!shareRes.ok) {
    const data = await shareRes.json().catch(() => ({}))
    throw new Error('OneDrive share resolve error ' + shareRes.status + ': ' + (data.error?.message ?? JSON.stringify(data)))
  }
  const item = await shareRes.json()

  const delRes = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/' + item.id, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  })
  if (!delRes.ok && delRes.status !== 404) {
    const data = await delRes.json().catch(() => ({}))
    throw new Error('OneDrive delete-by-id error ' + delRes.status + ': ' + (data.error?.message ?? JSON.stringify(data)))
  }
  return true
}