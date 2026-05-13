import { getAccessToken } from '../../../lib/onedrive'

const FOLDERS = [
  'POs Invoices and Receive Reports',
  'POs Invoices and Receive Reports/Purchase Orders',
  'POs Invoices and Receive Reports/Purchase Orders/Dan Murphy',
  'POs Invoices and Receive Reports/Purchase Orders/ACW',
  'POs Invoices and Receive Reports/Purchase Orders/Coles Woolies',
  'POs Invoices and Receive Reports/Invoices',
  'POs Invoices and Receive Reports/Invoices/Dan Murphy',
  'POs Invoices and Receive Reports/Invoices/ACW',
  'POs Invoices and Receive Reports/Invoices/Coles Woolies',
  'POs Invoices and Receive Reports/Receive Reports',
  'POs Invoices and Receive Reports/Receive Reports/Dan Murphy',
  'POs Invoices and Receive Reports/Receive Reports/ACW',
  'POs Invoices and Receive Reports/Receive Reports/Coles Woolies',
]

async function createFolder(token, path) {
  const parts = path.split('/')
  const name = parts.pop()
  const parentPath = parts.join('/')
  const parentUrl = parentPath
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${parts.map(encodeURIComponent).join('/')}:/children`
    : `https://graph.microsoft.com/v1.0/me/drive/root/children`

  const res = await fetch(parentUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'ignore' }),
  })
  const data = await res.json()
  return { path, ok: res.ok || data.error?.code === 'nameAlreadyExists', status: res.status, name: data.name }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const token = await getAccessToken()
    const results = []
    for (const folder of FOLDERS) {
      const r = await createFolder(token, folder)
      results.push(r)
    }
    const html = `<!DOCTYPE html><html><head><title>OneDrive Setup</title>
<style>body{font-family:Arial,sans-serif;padding:32px;max-width:600px}h2{color:#1e3a5f}.ok{color:#16a34a}.fail{color:#dc2626}li{padding:4px 0}</style>
</head><body>
<h2>✅ OneDrive Folder Setup Complete</h2>
<p>The following folders were created in your OneDrive:</p>
<ul>${results.map(r => `<li class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.path}</li>`).join('')}</ul>
<p style="margin-top:24px;color:#64748b;font-size:13px">You can now copy your existing files into the new folder structure. Close this tab when done.</p>
</body></html>`
    res.setHeader('Content-Type', 'text/html')
    return res.send(html)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
