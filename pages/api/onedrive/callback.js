import { kvGet, kvSet, kvDelete } from '../../../lib/redis'
import { requireAuth } from '../../../lib/session'

const REDIRECT_URI = 'https://paynter-bar-hub.vercel.app/api/onedrive/callback'

function errorPage(title, message, showRetry) {
  const retry = showRetry ? '<a href="/api/onedrive/auth">\u2190 Try again</a>' : ''
  return '<html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">'
    + '<h2 style="color:#dc2626">' + title + '</h2>'
    + '<p>' + message + '</p>'
    + retry
    + '</body></html>'
}

export default async function handler(req, res) {
  // Same admin-only gate as auth.js -- SameSite=Lax cookies are still sent
  // on this top-level redirect back from Microsoft, so a legitimate admin's
  // browser carries its session here automatically. An attacker's browser,
  // with no admin session, cannot complete the flow even with a valid code.
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  const CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID
  const CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send(errorPage(
      '\u274c OneDrive Not Configured',
      'ONEDRIVE_CLIENT_ID / ONEDRIVE_CLIENT_SECRET are not set. Contact the Bar Manager.',
      false
    ))
  }

  const { code, error, error_description, state } = req.query

  if (error) {
    return res.status(400).send(errorPage(
      '\u274c OneDrive Connection Failed',
      '<strong>' + error + '</strong><p>' + (error_description || '') + '</p>',
      true
    ))
  }

  if (!code) {
    return res.status(400).send(errorPage('\u274c OneDrive Connection Failed', 'No authorization code received.', true))
  }

  // CSRF check -- the state value must match the one auth.js generated for
  // this specific flow, and it's single-use (deleted immediately after the
  // first check regardless of outcome).
  const expectedState = await kvGet('onedriveOAuthState').catch(() => null)
  await kvDelete('onedriveOAuthState').catch(() => {})
  if (!expectedState || state !== expectedState) {
    return res.status(400).send(errorPage(
      '\u274c OneDrive Connection Failed',
      'This authorization link has expired or was already used. Please start the connection again.',
      true
    ))
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
    if (data.error) throw new Error(data.error_description || data.error)

    await kvSet('onedriveRefreshToken', data.refresh_token)

    return res.status(200).send(
      '<html><body style="font-family:Arial;padding:40px;max-width:600px;margin:auto">'
      + '<h2 style="color:#16a34a">\u2705 OneDrive Connected!</h2>'
      + '<p>Receive reports will be saved automatically to OneDrive \u2192 Paynter Bar \u2192 Receive Reports</p>'
      + '<a href="/" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#1e3a5f;color:#fff;border-radius:6px;text-decoration:none">\u2190 Back to Hub</a>'
      + '</body></html>'
    )
  } catch (err) {
    return res.status(500).send(errorPage('\u274c Token Exchange Failed', err.message, true))
  }
}