import { getAccessToken } from '../../../lib/onedrive'

export default async function handler(req, res) {
  try {
    const token = await getAccessToken()
    
    // Try to save a test file to the invoices folder
    const folder = 'POs Invoices and Receive Reports/Invoices/Dan Murphy'
    const encodedPath = folder.split('/').map(encodeURIComponent).join('/')
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/test-invoice.txt:/content`
    
    const saveRes = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: 'test invoice file'
    })
    const saveData = await saveRes.json()
    
    return res.json({
      ok: saveRes.ok,
      status: saveRes.status,
      webUrl: saveData.webUrl ?? null,
      error: saveData.error ?? null,
      folder_used: folder,
    })
  } catch (e) {
    return res.json({ ok: false, error: e.message })
  }
}