import { buildAndSavePO } from '../../../lib/onedrive'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  // Writes a purchase order into OneDrive. Management access only.
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
    return res.status(200).json({ skipped: true, reason: 'OneDrive not configured' })
  }

  const { po_ref, supplier, order_date, items } = req.body
  if (!po_ref || !items?.length) return res.status(400).json({ error: 'po_ref and items required' })

  try {
    const { filename, webUrl } = await buildAndSavePO({ po_ref, supplier, order_date, items })
    return res.json({ ok: true, filename, webUrl })
  } catch (e) {
    console.error('[save-po]', e.message)
    return res.status(200).json({ skipped: true, reason: e.message })
  }
}
