/**
 * POST /api/admin/rematch-history
 * Re-runs Haiku name matching on all buy_price_history rows where
 * item_name_hub is null or equals item_name_raw (unmatched).
 */
import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Get all unmatched rows (hub = raw or hub is null)
    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_raw, item_name_hub')

    if (error) return res.status(500).json({ error: error.message })

    // Get Hub item names
    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}
    const hubNames = Object.keys(settings)

    if (!hubNames.length) return res.status(400).json({ error: 'No Hub items found' })

    // Find unique unmatched raw names
    const unmatched = [...new Set(
      (rows || [])
        .filter(r => !r.item_name_hub || r.item_name_hub === r.item_name_raw)
        .map(r => r.item_name_raw)
        .filter(Boolean)
    )]

    if (!unmatched.length) return res.json({ ok: true, matched: 0, message: 'All rows already matched' })

    // Call Haiku match-names API
    const base = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'http://localhost:3000'

    const mRes = await fetch(`${base}/api/invoices/match-names`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_names: unmatched, hub_names: hubNames })
    })
    if (!mRes.ok) return res.status(500).json({ error: 'match-names failed' })
    const mData = await mRes.json()

    // Build match map
    const matchMap = {}
    for (const m of mData.matches || []) {
      if (m.hub && m.confidence !== 'low') matchMap[m.raw] = m.hub
    }

    // Update rows in Supabase
    let updated = 0
    for (const [raw, hub] of Object.entries(matchMap)) {
      const { error: upErr } = await sb
        .from('buy_price_history')
        .update({ item_name_hub: hub })
        .eq('item_name_raw', raw)
        .or(`item_name_hub.is.null,item_name_hub.eq.${raw}`)
      if (!upErr) updated++
    }

    return res.json({
      ok: true,
      unmatched_count: unmatched.length,
      matched: updated,
      skipped: unmatched.length - Object.keys(matchMap).length,
      matches: matchMap
    })
  } catch (e) {
    console.error('[rematch-history]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
