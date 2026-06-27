import { getAccessToken } from '../../../lib/onedrive'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
    return res.status(200).json({ skipped: true, reason: 'OneDrive not configured' })
  }

  const { filename, base64, mimeType, supplier } = req.body
  if (!filename || !base64) return res.status(400).json({ error: 'filename and base64 required' })

  // Reject files over 8MB (base64 is ~33% larger than binary)
  const estimatedBytes = Math.ceil(base64.length * 0.75)
  if (estimatedBytes > 8 * 1024 * 1024) {
    return res.status(413).json({ error: `File too large (${(estimatedBytes / 1024 / 1024).toFixed(1)}MB). Maximum is 8MB.` })
  }

  try {
    const token = await getAccessToken()
    const buffer = Buffer.from(base64, 'base64')
    const supplierRaw = (supplier || 'Unknown')
    const safeSupplier = supplierRaw.toLowerCase().includes('dan murphy') ? 'Dan Murphy'
      : supplierRaw.toLowerCase().includes('coles') || supplierRaw.toLowerCase().includes('woolies') || supplierRaw.toLowerCase().includes('woolworths') ? 'Coles Woolies'
      : supplierRaw.toLowerCase().includes('acw') ? 'ACW'
      : supplierRaw.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    const folder = `POs Invoices and Receive Reports/Invoices/${safeSupplier}`
    const encodedPath = folder.split('/').map(encodeURIComponent).join('/')
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/${encodeURIComponent(filename)}:/content`

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType || 'application/octet-stream' },
      body: buffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      return res.status(200).json({ skipped: true, reason: err.error?.message || `Upload failed ${uploadRes.status}` })
    }

    const data = await uploadRes.json()
    return res.json({ ok: true, name: data.name, webUrl: data.webUrl })
  } catch (e) {
    return res.status(200).json({ skipped: true, reason: e.message })
  }
}
