import { fetchSquareData } from '../../lib/square'
import { calculateItem, CATEGORY_ORDER } from '../../lib/calculations'
import { kvGet, kvSet, kvDelete } from '../../lib/redis'

const CACHE_KEY = (days) => `itemsCache_${days}`

export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  const forceRefresh = req.query.refresh === 'true'
  const daysBack     = parseInt(req.query.days) || 60

  try {
    // ── Serve from cache unless forced refresh ──────────────────────────────
    if (!forceRefresh) {
      const cached = await kvGet(CACHE_KEY(daysBack)).catch(async (e) => {
        // Corrupted cache entry — delete it so next load fetches fresh
        console.warn('Cache read failed, deleting corrupted key:', e.message)
        await kvDelete(CACHE_KEY(daysBack)).catch(() => {})
        return null
      })
      if (cached) {
        return res.status(200).json({ ...cached, fromCache: true })
      }
    }

    // ── Fetch live from Square ──────────────────────────────────────────────
    const squareItems = await fetchSquareData(token, daysBack, kvGet, kvSet)
    const allSettings = (await kvGet('itemSettings').catch(() => null)) || {}
    const targetWeeks = (await kvGet('targetWeeks').catch(() => null))  || 6
    const suppliers   = (await kvGet('suppliers').catch(() => null))    || ['Dan Murphy', 'Coles Woolies', 'ACW']

    // One-time migration: rename "Dan Murphys" -> "Dan Murphy" in item settings
    let migrated = false
    for (const s of Object.values(allSettings)) {
      if (s.supplier === 'Dan Murphys') { s.supplier = 'Dan Murphy'; migrated = true }
    }
    if (migrated) await kvSet('itemSettings', allSettings)

    const items = squareItems.map(item => {
      const settings = allSettings[item.name] || {}
      const effectiveItem = settings.stockOverride !== undefined && settings.stockOverride !== null
        ? { ...item, onHand: settings.stockOverride }
        : item
      const calculated = calculateItem(effectiveItem, settings, targetWeeks)
      const sellPrice = settings.sellPrice !== undefined && settings.sellPrice !== ''
        ? settings.sellPrice
        : (item.squareSellPrice ?? '')
      const sellPriceBottle = settings.sellPriceBottle !== undefined && settings.sellPriceBottle !== ''
        ? settings.sellPriceBottle
        : (item.squareSellPriceBottle ?? '')

      return {
        ...calculated,
        isSpirit:              ['Spirits','Fortified & Liqueurs'].includes(calculated.category),
        stockOverride:         settings.stockOverride ?? null,
        notes:                 settings.notes || '',
        buyPrice:              settings.buyPrice || '',
        sellPrice,
        squareSellPrice:       item.squareSellPrice ?? null,
        squareSellPriceBottle: item.squareSellPriceBottle ?? null,
        variations:            item.variations ?? [],
        sellUnit:              settings.sellUnit || null,
        sellPriceBottle,
        bottleOnly:            settings.bottleOnly === true || settings.bottleOnly === 'yes',
        orderQtyOverride:      settings.orderQtyOverride != null ? Number(settings.orderQtyOverride) : null,
        weeklyAvgOverride:     settings.weeklyAvgOverride != null ? Number(settings.weeklyAvgOverride) : null,
        squareWeeklyAvg:       item.weeklyAvg,
        alcoholPct:            settings.alcoholPct || '',
        containerML:           settings.containerML ? Number(settings.containerML) : null,
      }
    })

    items.sort((a, b) => {
      const catDiff = (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99)
      return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name)
    })

    const lastUpdated = new Date().toISOString()
    const payload = { items, targetWeeks, suppliers, daysBack, lastUpdated }

    // Save to cache keyed by daysBack (fire and forget)
    kvSet(CACHE_KEY(daysBack), payload).catch(e => console.error('Cache write failed:', e))

    res.status(200).json({ ...payload, fromCache: false })
  } catch (err) {
    console.error('Items API error:', err)

    // On Square failure, fall back to stale cache rather than hard error
    const stale = await kvGet(CACHE_KEY(daysBack)).catch(async () => {
      await kvDelete(CACHE_KEY(daysBack)).catch(() => {})
      return null
    })
    if (stale && stale.items) {
      console.warn('Square fetch failed - serving stale cache')
      return res.status(200).json({ ...stale, fromCache: true, stale: true })
    }

    res.status(500).json({ error: err.message })
  }
}
