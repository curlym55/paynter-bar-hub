/**
 * GET /api/onedrive/auth
 * Redirects to Microsoft OAuth consent screen.
 */
export default function handler(req, res) {
  const clientId = process.env.ONEDRIVE_CLIENT_ID || 'f890238a-c64f-434a-b793-f42a4b4be29c'
  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    redirect_uri:  'https://paynter-bar-hub.vercel.app/api/onedrive/callback',
    scope:         'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
    response_mode: 'query',
  })
  res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`)
}
