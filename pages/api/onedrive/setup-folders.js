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
  const parentUrl = parts.length
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${parts.map(encodeURIComponent).join('/')}:/children`
    : `https://graph.microsoft.com/v1.0/me/drive/root/children`

  const res = await fetch(parentUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'ignore' }),
  })
  const data = await res.json()
  const ok = res.ok || data.error?.code === 'nameAlreadyExists' || data.error?.code === 'ResourceAlreadyExists'
  const errMsg = ok ? '' : (data.error?.message || `HTTP ${res.status}`)
  return { path, ok, errMsg }
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

    const rows = results.map(r =>
      `<li style="color:${r.ok ? '#16a34a' : '#dc2626'};padding:4px 0">
        ${r.ok ? '&#10003;' : '&#10007;'} ${r.path}
        ${r.errMsg ? `<span style="font-size:11px;color:#dc2626;margin-left:8px">(${r.errMsg})</span>` : ''}
      </li>`
    ).join('')

    const allOk = results.every(r => r.ok)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OneDrive Setup</title>
<style>body{font-family:Arial,sans-serif;padding:32px;max-width:700px}h2{color:#1e3a5f}ul{margin-top:12px}li{font-size:13px}</style>
</head><body>
<h2>${allOk ? 'OneDrive Folder Setup Complete' : 'OneDrive Folder Setup — Some Errors'}</h2>
<p>Results:</p>
<ul>${rows}</ul>
<p style="margin-top:24px;color:#64748b;font-size:12px">You can now copy your existing files into the new folder structure.</p>
</body></html>`)
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(500).send(`<p style="color:red;font-family:Arial;padding:32px">Error: ${e.message}</p>`)
  }
}
