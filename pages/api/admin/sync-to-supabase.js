/**
 * GET /api/admin/sync-to-supabase
 * One-time migration: copies all critical Redis keys to Supabase bar_config.
 * Safe to run multiple times — upserts so no duplicates.
 */
import { kvGet } from '../../../lib/redis'
import { sbConfigSet } from '../../../lib/supabase-config'

const KEYS = [
  { key: 'itemSettings',       fallback: {} },
  { key: 'targetWeeks',        fallback: 6 },
  { key: 'revenueTarget',      fallback: null },
  { key: 'suppliers',          fallback: ['Dan Murphy', 'Coles Woolies', 'ACW'] },
  { key: 'supplierVendorNames', fallback: {} },
  { key: 'priceListSettings',  fallback: {} },
  { key: 'settingsAudit',      fallback: {} },
  { key: 'orderedItems',       fallback: {} },
  { key: 'rundownItems',       fallback: {} },
  { key: 'poNextNumber',       fallback: 99 },
]

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const results = []
  for (const { key, fallback } of KEYS) {
    try {
      const val = await kvGet(key).catch(() => null)
      if (val !== null && val !== undefined) {
        await sbConfigSet(key, val)
        results.push({ key, status: '✓ synced', type: typeof val === 'object' ? (Array.isArray(val) ? 'array' : 'object') : typeof val })
      } else {
        results.push({ key, status: '— skipped (Redis empty)', type: null })
      }
    } catch (e) {
      results.push({ key, status: `✗ error: ${e.message}` })
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Redis → Supabase Sync</title>
<style>body{font-family:Arial,sans-serif;padding:32px;max-width:600px}h2{color:#1e3a5f}
.ok{color:#16a34a}.skip{color:#94a3b8}.err{color:#dc2626}li{padding:4px 0;font-size:13px}</style>
</head><body>
<h2>Redis → Supabase Sync Complete</h2>
<ul>${results.map(r => `<li class="${r.status.startsWith('✓') ? 'ok' : r.status.startsWith('—') ? 'skip' : 'err'}">
  ${r.status} &nbsp;<strong>${r.key}</strong>${r.type ? ` <span style="color:#94a3b8">(${r.type})</span>` : ''}
</li>`).join('')}</ul>
<p style="margin-top:24px;color:#64748b;font-size:12px">
  All future changes will be automatically mirrored to Supabase. You can delete this endpoint after running.
</p></body></html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.send(html)
}
