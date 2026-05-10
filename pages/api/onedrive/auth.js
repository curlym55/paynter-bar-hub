export default function handler(req, res) {
  const clientId = 'f890238a-c64f-434a-b793-f42a4b4be29c'
  const redirectUri = 'https://paynter-bar-hub.vercel.app/api/onedrive/callback'
  const scope = 'https://graph.microsoft.com/Files.ReadWrite.All offline_access'
  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_mode=query`

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(`<html><head><meta http-equiv="refresh" content="0;url=${url}"></head><body><a href="${url}">Click here if not redirected</a></body></html>`)
}
