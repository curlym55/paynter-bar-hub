/**
 * POST /api/admin/restore-from-supabase
 * Restores Redis from Supabase bar_config backup.
 * Use when Redis has been corrupted or incorrectly modified.
 */
import { kvSet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'

const KEYS = [
  'itemSettings',
  'targetWeeks',
  'revenueTarget',
  'suppliers',
  'supplierVendorNames',
  'priceListSettings',
  'settingsAudit',
  'orderedItems',
  'rundownItems',
  'poNextNumber',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  const results = []
  for (const key of KEYS) {
    try {
      const val = await sbConfigGet(key)
      if (val !== null && val !== undefined) {
        await kvSet(key, val)
        results.push({ key, status: 'restored' })
      } else {
        results.push({ key, status: 'skipped — not in Supabase' })
      }
    } catch (e) {
      results.push({ key, status: 'error: ' + e.message })
    }
  }

  return res.json({ ok: true, results })
}
