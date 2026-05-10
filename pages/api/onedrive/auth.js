/**
 * GET /api/onedrive/auth
 * Redirects to Microsoft OAuth consent screen.
 * Visit this URL in the browser to connect OneDrive.
 */
export default function handler(req, res) {
  const params = new URLSearchParams({
    client_id:     process.env.ONEDRIVE_CLIENT_ID,
    response_type: 'code',
    redirect_uri:  'https://paynter-bar-hub.vercel.app/api/onedrive/callback',
    scope:         'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
    response_mode: 'query',
  })
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`)
}
