import crypto from 'crypto'
import { kvSet } from '../../../lib/redis'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  // Only an already-authenticated admin session can start this flow --
  // otherwise anyone who finds this URL could connect their OWN Microsoft
  // account, silently redirecting where all future invoices/POs/reports
  // get saved.
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  const clientId = process.env.ONEDRIVE_CLIENT_ID
  if (!clientId) {
    return res.status(500).send('OneDrive is not configured (ONEDRIVE_CLIENT_ID missing). Contact the Bar Manager.')
  }

  const redirectUri = 'https://paynter-bar-hub.vercel.app/api/onedrive/callback'
  const scope = 'https://graph.microsoft.com/Files.ReadWrite.All offline_access'

  // Single-use, short-lived CSRF state -- callback.js must see this exact
  // value come back from Microsoft before it will exchange the code.
  const state = crypto.randomBytes(24).toString('base64url')
  await kvSet('onedriveOAuthState', state, 300) // 5 minutes

  const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&response_type=code'
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=' + encodeURIComponent(scope)
    + '&response_mode=query'
    + '&state=' + encodeURIComponent(state)

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send('<html><head><meta http-equiv="refresh" content="0;url=' + url + '"></head><body><a href="' + url + '">Click here if not redirected</a></body></html>')
}