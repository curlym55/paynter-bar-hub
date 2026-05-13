import { saveFile } from '../../../lib/onedrive'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
    return res.status(200).json({ skipped: true, reason: 'OneDrive not configured' })
  }

  const { filename, base64, mimeType } = req.body
  if (!filename || !base64) return res.status(400).json({ error: 'filename and base64 required' })

  try {
    const buffer = Buffer.from(base64, 'base64')

    // Save to Paynter Bar/Invoices/ using the existing saveFile helper
    // Temporarily override the folder by patching the path directly via Graph
    const token = await import('../../../lib/onedrive').then(m => m.getAccessToken())
    const folder = 'Paynter Bar/Invoices'
    const encodedPath = folder.split('/').map(encodeURIComponent).join('/')
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/${encodeURIComponent(filename)}:/content`

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType || 'application/octet-stream',
      },
      body: buffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      return res.status(200).json({ skipped: true, reason: err.error?.message || 'Upload failed' })
    }

    const data = await uploadRes.json()
    return res.json({ ok: true, name: data.name, webUrl: data.webUrl })
  } catch (e) {
    return res.status(200).json({ skipped: true, reason: e.message })
  }
}
