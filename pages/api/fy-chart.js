import { fetchSalesReport } from '../../lib/square'
import { kvGet, kvSet } from '../../lib/redis'

const CACHE_KEY = 'fyChartCache'

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  const forceRefresh = req.query.refresh === 'true'

  // Serve from cache unless forced
  if (!forceRefresh) {
    const cached = await kvGet(CACHE_KEY).catch(() => null)
    if (cached) return res.status(200).json({ ...cached, fromCache: true })
  }

  // Build list of months for current FY (May–Apr)
  const now = new Date()
  const fyStartYear = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1
  const months = []
  for (let m = 0; m < 12; m++) {
    const jsMonth = (4 + m) % 12
    const year    = jsMonth < 4 ? fyStartYear + 1 : fyStartYear
    const start   = new Date(year, jsMonth, 1)
    if (start > now) break
    const rawEnd = new Date(year, jsMonth + 1, 0, 23, 59, 59, 999)
    const end     = rawEnd > now ? new Date(now) : rawEnd
    months.push({ jsMonth, year, start, end, partial: rawEnd > now })
  }

  try {
    const results = []
    for (const { start, end, partial } of months) {
      let revenue = 0
      try {
        const report = await fetchSalesReport(token, start.toISOString(), end.toISOString())
        for (const item of Object.values(report || {})) {
          revenue += item.revenue || 0
        }
        revenue = +revenue.toFixed(2)
      } catch(e) {
        console.error('FY chart month fetch error:', e.message)
      }
      results.push({
        label:   start.toLocaleDateString('en-AU', { month: 'short' }),
        revenue,
        partial,
      })
    }

    const payload = { months: results, generatedAt: new Date().toISOString() }
    // Cache for 6 hours — partial month data stays reasonably fresh
    kvSet(CACHE_KEY, payload, 6 * 60 * 60).catch(e => console.error('FY cache write failed:', e))
    res.status(200).json({ ...payload, fromCache: false })

  } catch (err) {
    // Fall back to stale cache on error
    const stale = await kvGet(CACHE_KEY).catch(() => null)
    if (stale) return res.status(200).json({ ...stale, fromCache: true, stale: true })
    res.status(500).json({ error: err.message })
  }
}
