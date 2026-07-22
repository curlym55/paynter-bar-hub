// pages/api/onedrive/status.js
import { getAccessToken } from '../../../lib/onedrive'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  try {
    const token = await getAccessToken()
    // Quick test — fetch drive root metadata (very lightweight)
    const r = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!r.ok) throw new Error(`Graph API ${r.status}`)
    const d = await r.json()
    return res.json({ ok: true, name: d.owner?.user?.displayName || null, email: d.owner?.user?.email || null })
  } catch (err) {
    return res.json({ ok: false, error: err.message })
  }
}
