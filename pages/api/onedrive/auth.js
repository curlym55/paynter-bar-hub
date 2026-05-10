/**
 * GET /api/onedrive/callback
 * Handles the OAuth callback from Microsoft.
 * Exchanges the auth code for a refresh token and stores it in Redis.
 */
import { kvSet } from '../../../lib/redis'

const CLIENT_ID     = process.env.ONEDRIVE_CLIENT_ID     || 'f890238a-c64f-434a-b793-f42a4b4be29c'
const CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET || 'PQt8Q~DpWh2n2-Qd7BpymQ.Qi23cTJMplxK2pcwy'
const REDIRECT_URI  = 'https://paynter-bar-hub.vercel.app/api/onedrive/callback'

export default async function handler(req, res) {
  const { code, error, error_description } = req.query

  if (error) {
    return res.status(400).send(`
      <html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">❌ OneDrive Connection Failed</h2>
        <p><strong>${error}</strong></p>
        <p>${error_description || ''}</p>
        <a href="/">← Back to Hub</a>
      </body></html>
    `)
  }

  if (!code) {
    return res.status(400).send('No auth code received')
  }

  try {
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
        scope:         'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
      })
    })

    const data = await tokenRes.json()

    if (data.error) {
      throw new Error(data.error_description || data.error)
    }

    await kvSet('onedriveRefreshToken', data.refresh_token)

    return res.status(200).send(`
      <html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">
        <h2 style="color:#16a34a">✅ OneDrive Connected!</h2>
        <p>Paynter Bar Hub is now connected to OneDrive. Receive reports will be saved automatically to:</p>
        <p style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;font-family:monospace">
          OneDrive → Paynter Bar → Receive Reports
        </p>
        <p style="color:#64748b;font-size:13px">The connection will stay active automatically. You only need to do this once.</p>
        <a href="/" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1e3a5f;color:#fff;border-radius:6px;text-decoration:none">← Back to Hub</a>
      </body></html>
    `)
  } catch (err) {
    return res.status(500).send(`
      <html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">
        <h2 style="color:#dc2626">❌ Token Exchange Failed</h2>
        <p>${err.message}</p>
        <a href="/">← Back to Hub</a>
      </body></html>
    `)
  }
}
