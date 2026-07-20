import { fetchSquareData } from '../../lib/square'
import { calculateItem, CATEGORY_ORDER } from '../../lib/calculations'
import { kvGet, kvSet, kvDelete } from '../../lib/redis'
import { getSession } from '../../lib/session'

const CACHE_KEY = (days) => `itemsCache_${days}`

// Fields the pinless public price list (?public=pricelist) is allowed to see.
// Everything else — buy prices, suppliers, stock quantities, ordering internals —
// is withheld. The price list only ever tests `onHand > 0` to hide sold-out
// items, so we send a 1/0 flag rather than the real quantity.
const PUBLIC_FIELDS = [
  'name', 'category', 'isSpirit', 'sellPrice', 'sellPriceBottle',
  'squareSellPrice', 'squareSellPriceBottle', 'sellUnit', 'bottleOnly',
  'alcoholPct', 'containerML', 'nipML', 'bottleML',
]

// Cost data. Withheld from read-only users as well as the public — the read-only
// PIN is handed out to residents, and buy prices are commercially sensitive.
const COST_FIELDS = ['buyPrice', 'supplier']

/**
 * The cache stores the full payload, so sanitising must happen on the way OUT,
 * on every path (cache hit, fresh fetch, and the stale-cache fallback).
 */
function sanitisePayload(payload, role) {
  if (role === 'bmt') return payload

  if (role === 'readonly') {
    return {
      ...payload,
      items: payload.items.map(it => {
        const copy = { ...it }
        for (const f of COST_FIELDS) delete copy[f]
        return copy
      }),
      suppliers: [],
    }
  }

  // No session at all — public price list.
  return {
    ...payload,
    items: payload.items.map(it => {
      const copy = {}
      for (const f of PUBLIC_FIELDS) if (it[f] !== undefined) copy[f] = it[f]
      copy.onHand = (it.onHand || 0) > 0 ? 1 : 0
      copy.variations = (it.variations || []).map(v => ({ name: v.name, price: v.price }))
      return copy
    }),
    // targetWeeks is left intact — it's a harmless global setting (e.g. 6 weeks)
    // and the client may use it in calculations.
    suppliers: [],
  }
}

export default async function handler(req, res) {
  // No wildcard Access-Control-Allow-Origin. It previously let any website read
  // this endpoint — including buy prices — from a visitor's browser.
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Unauthenticated callers are treated as the public price list and get a
  // heavily reduced payload. A valid session unlocks more.
  const session = getSession(req)
  const role = session?.role ?? 'public'

  // Forcing a live Square refetch is a privileged, rate-limited operation.
  if (req.query.refresh === 'true' && role !== 'bmt') {
    return res.status(403).json({ error: 'Refresh requires management access.' })
  }

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
        return res.status(200).json(sanitisePayload({ ...cached, fromCache: true }, role))
      }
    }

    // Fetch live from Square
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
        targetWeeksOverride:   settings.targetWeeksOverride != null ? Number(settings.targetWeeksOverride) : null,
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

    res.status(200).json(sanitisePayload({ ...payload, fromCache: false }, role))
  } catch (err) {
    console.error('Items API error:', err)

    // On Square failure, fall back to stale cache rather than hard error
    const stale = await kvGet(CACHE_KEY(daysBack)).catch(async () => {
      await kvDelete(CACHE_KEY(daysBack)).catch(() => {})
      return null
    })
    if (stale && stale.items) {
      console.warn('Square fetch failed - serving stale cache')
      return res.status(200).json(sanitisePayload({ ...stale, fromCache: true, stale: true }, role))
    }

    res.status(500).json({ error: err.message })
  }
}