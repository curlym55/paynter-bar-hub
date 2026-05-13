import { getOneDriveToken } from '../../../lib/onedrive'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { filename, base64, mimeType } = req.body
  if (!filename || !base64) return res.status(400).json({ error: 'filename and base64 required' })

  try {
    const token = await getOneDriveToken()
    const buffer = Buffer.from(base64, 'base64')
    const folder = 'Paynter Bar/Invoices'
    const encodedPath = encodeURIComponent(folder)

    // Ensure folder exists
    await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/children`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(() => null)

    // Upload file
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/${encodeURIComponent(filename)}:/content`
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType || 'application/octet-stream',
      },
      body: buffer,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      return res.status(500).json({ error: err.error?.message || 'Upload failed' })
    }

    const data = await uploadRes.json()
    return res.json({ ok: true, name: data.name, webUrl: data.webUrl })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
