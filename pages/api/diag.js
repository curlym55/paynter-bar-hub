import { kvGet } from '../../lib/redis'

export default async function handler(req, res) {
  const keys = [
    'itemsCache_60', 'itemsCache_90', 'itemsCache_30',
    'glassSales_60', 'glassSales_90',
    'itemSettings', 'targetWeeks', 'suppliers', 'orderedItems',
    'fyChartCache', 'settingsAudit'
  ]
  const results = {}
  for (const key of keys) {
    try {
      const val = await kvGet(key)
      results[key] = val === null ? 'null (missing)' : `OK (type: ${typeof val}, isArray: ${Array.isArray(val)})`
    } catch (e) {
      results[key] = `ERROR: ${e.message}`
    }
  }
  res.status(200).json(results)
}