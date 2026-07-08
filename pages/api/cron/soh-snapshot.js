import { createClient } from '@supabase/supabase-js'
import { fetchSquareData } from '../../../lib/square'
import { calculateItem } from '../../../lib/calculations'
import { kvGet } from '../../../lib/redis'

// Use the service-role key (server-side only, never exposed to the browser)
// rather than the public anon key. The anon key would require the soh_reports
// table to allow anonymous inserts, which means anyone who found the public
// Supabase URL could write junk rows. The service-role key keeps writes locked
// to this server-side cron.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorised calls
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.authorization
  // Fail closed: if a secret is configured, a request MUST present the matching
  // header. Previously a request with NO Authorization header slipped through
  // because both sides of the && were false.
  if (cronSecret && (!auth || auth !== `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  // The Vercel cron fires on days 28-31 (cron can't express "last day of month").
  // Only actually take a snapshot when TOMORROW is the 1st — i.e. today is the
  // real last day of the month — so we store exactly one month-end row rather
  // than 3-4 clustered rows at the end of longer months.
  const nowBris = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }))
  const tomorrow = new Date(nowBris)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (tomorrow.getDate() !== 1) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'Not the last day of the month (Brisbane time)' })
  }

  try {
    const token = process.env.SQUARE_ACCESS_TOKEN
    if (!token) return res.status(500).json({ error: 'No Square token' })

    // Get all item settings from Redis
    const allSettings = (await kvGet('itemSettings')) || {}
    const targetWeeks = Number(await kvGet('targetWeeks')) || 6

    // Fetch fresh Square data
    const squareItems = await fetchSquareData(token, 90)

    // Build report items
    const items = squareItems.map(item => {
      const settings = allSettings[item.name] || {}
      const calc = calculateItem(item, settings, targetWeeks)
      return {
        name: item.name,
        category: calc.category || '',
        supplier: calc.supplier || '',
        onHand: item.onHand || 0,
        weeklyAvg: calc.weeklyAvg || 0,
        targetStock: calc.targetStock || 0,
        priority: calc.priority || 'OK',
        buyPrice: settings.buyPrice || null,
        totalValue: settings.buyPrice && item.onHand > 0
          ? Math.round(Number(settings.buyPrice) * Number(item.onHand) * 100) / 100
          : null
      }
    }).filter(i => i.onHand > 0)
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name))

    const totalValue = items.reduce((sum, i) => sum + (i.totalValue || 0), 0)
    const reportDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

    const { error } = await supabase.from('soh_reports').insert({
      report_date: reportDate,
      items_count: items.length,
      total_value: Math.round(totalValue * 100) / 100,
      data: items
    })

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({
      ok: true,
      report_date: reportDate,
      items: items.length,
      total_value: totalValue.toFixed(2)
    })
  } catch (err) {
    console.error('SOH snapshot error:', err)
    return res.status(500).json({ error: err.message })
  }
}