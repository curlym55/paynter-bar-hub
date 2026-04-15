import { fetchSalesReport } from '../../lib/square'
import { kvGet, kvSet } from '../../lib/redis'
import { nowAEST, startOfDayAEST, endOfDayAEST } from '../../lib/timezone'

export const config = { maxDuration: 60 }

const CACHE_KEY = 'fyChartCache'

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  const forceRefresh = req.query.refresh === 'true'

  if (!forceRefresh) {
    const cached = await kvGet(CACHE_KEY).catch(() => null)
    if (cached) return res.status(200).json({ ...cached, fromCache: true })
  }

  // Use AEST (Brisbane UTC+10) for month/FY boundary logic -- Vercel runs UTC
  const now = nowAEST()
  const fyStartYear = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1
  const months = []
  for (let m = 0; m < 12; m++) {
    const jsMonth = (4 + m) % 12
    const year    = jsMonth < 4 ? fyStartYear + 1 : fyStartYear
    const startISO   = startOfDayAEST(year, jsMonth, 1)
    const lastDay    = new Date(year, jsMonth + 1, 0).getDate()
    const rawEndISO  = endOfDayAEST(year, jsMonth, lastDay)
    const startDate  = new Date(startISO)
    const rawEndDate = new Date(rawEndISO)
    if (startDate > new Date()) break
    const partial = rawEndDate > new Date()
    const endISO  = partial ? new Date().toISOString() : rawEndISO
    const label   = new Date(year, jsMonth, 1).toLocaleDateString('en-AU', { month: 'short' })
    months.push({ startISO, endISO, partial, label })
  }

  try {
    const results = []
    for (const { startISO, endISO, partial, label } of months) {
      let revenue = 0
      try {
        const report = await fetchSalesReport(token, startISO, endISO)
        for (const item of Object.values(report || {})) {
          revenue += item.revenue || 0
        }
        revenue = +revenue.toFixed(2)
      } catch(e) {
        console.error('FY chart month fetch error:', e.message)
      }
      results.push({ label, revenue, partial })
    }

    const payload = { months: results, generatedAt: new Date().toISOString() }
    kvSet(CACHE_KEY, payload, 6 * 60 * 60).catch(e => console.error('FY cache write failed:', e))
    res.status(200).json({ ...payload, fromCache: false })

  } catch (err) {
    const stale = await kvGet(CACHE_KEY).catch(() => null)
    if (stale) return res.status(200).json({ ...stale, fromCache: true, stale: true })
    res.status(500).json({ error: err.message })
  }
}