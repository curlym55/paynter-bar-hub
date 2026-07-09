import { fetchSalesReport } from '../../lib/square'
import { kvGet } from '../../lib/redis'
import { defaultCategory } from '../../lib/calculations'
import { requireAuth } from '../../lib/session'

export default async function handler(req, res) {
  // Sales figures. Requires a valid session — no anonymous access.
  if (!requireAuth(req, res)) return

  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const { start, end, compareStart, compareEnd } = req.query
    if (!start || !end) return res.status(400).json({ error: 'start and end required' })

    const allSettings = (await kvGet('itemSettings').catch(() => null)) || {}

    const [mainSold, compareSold] = await Promise.all([
      fetchSalesReport(token, start, end),
      compareStart && compareEnd ? fetchSalesReport(token, compareStart, compareEnd) : Promise.resolve({}),
    ])

    const allNames = new Set([...Object.keys(mainSold), ...Object.keys(compareSold)])
    const itemMap = {}

    for (const name of allNames) {
      const settings  = allSettings[name] || {}
      const category  = settings.category || defaultCategory(name)
      const main      = mainSold[name]    || { units: 0, revenue: null }
      const prior     = compareSold[name] || { units: 0, revenue: null }
      const unitsSold = main.units
      const prevSold  = prior.units
      const revenue   = main.revenue
      const prevRev   = prior.revenue
      const change    = prevSold > 0 ? +(((unitsSold - prevSold) / prevSold) * 100).toFixed(1) : null

      if (unitsSold > 0 || prevSold > 0) {
        itemMap[name] = { name, category, unitsSold, prevSold, change, revenue, prevRev }
      }
    }

    const items = Object.values(itemMap).sort((a, b) => b.unitsSold - a.unitsSold)

    const categories = {}
    for (const item of items) {
      if (!categories[item.category]) categories[item.category] = { unitsSold: 0, prevSold: 0, revenue: 0, prevRev: 0 }
      categories[item.category].unitsSold += item.unitsSold
      categories[item.category].prevSold  += item.prevSold
      categories[item.category].revenue   += item.revenue || 0
      categories[item.category].prevRev   += item.prevRev || 0
    }

    const totals = {
      unitsSold: items.reduce((s, i) => s + i.unitsSold, 0),
      prevSold:  items.reduce((s, i) => s + i.prevSold, 0),
      revenue:   +items.reduce((s, i) => s + (i.revenue || 0), 0).toFixed(2),
      prevRev:   +items.reduce((s, i) => s + (i.prevRev || 0), 0).toFixed(2),
    }

    res.status(200).json({ items, categories, totals })
  } catch (err) {
    console.error('Sales API error:', err)
    res.status(500).json({ error: err.message })
  }
}
