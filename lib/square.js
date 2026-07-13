import { nowAEST } from './timezone'

const BASE_URL = 'https://connect.squareup.com/v2'

const BAR_CATEGORY_KEYWORDS = [
  'beer', 'wine', 'spirit', 'cider', 'premix', 'sparkling', 'liqueur',
  'fortified', 'rose', 'soft drink', 'mixer', 'snack', 'chip', 'nut',
  'beverage', 'alcohol', 'whisky', 'whiskey', 'rum', 'gin', 'vodka',
  'bourbon', 'brandy', 'champagne', 'seltzer', 'bar snack', 'pre mix'
]

const SKIP_KEYWORDS = [
  'ticket', 'raffle', 'dinner', 'lunch', 'burger', 'sausage', 'hosting',
  'roll', 'sandwich', 'curry', 'pie', 'trivia', 'bingo', 'cruise',
  'shirt', 'polo', 'sweep', 'event', 'party', 'session', 'music',
  'aqua', 'hypno', 'fashion', 'yoga', 'exercise', 'strength',
  'mobility', 'produce', 'account', 'hosting', 'coffee', 'pod', 'token'
]

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Square-Version': '2024-01-17'
  }
}

export async function getLocationId(token) {
  const res = await fetch(`${BASE_URL}/locations`, { headers: headers(token) })
  const data = await res.json()
  const active = (data.locations || []).filter(l => l.status === 'ACTIVE')
  if (!active.length) throw new Error('No active Square locations found')
  return active[0].id
}

async function getBarCategoryIds(token) {
  const res = await fetch(`${BASE_URL}/catalog/list?types=CATEGORY`, { headers: headers(token) })
  const data = await res.json()
  const ids = new Set()
  for (const obj of data.objects || []) {
    if (obj.type === 'CATEGORY') {
      const name = (obj.category_data?.name || '').toLowerCase()
      if (BAR_CATEGORY_KEYWORDS.some(kw => name.includes(kw))) {
        ids.add(obj.id)
      }
    }
  }
  return ids
}

async function getCatalogItems(token, barCategoryIds) {
  const allItems = {}
  const variations = {}
  let cursor = null

  do {
    const url = `${BASE_URL}/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ''}`
    const res = await fetch(url, { headers: headers(token) })
    const data = await res.json()

    for (const obj of data.objects || []) {
      if (obj.type !== 'ITEM') continue
      if (obj.is_deleted || obj.item_data?.is_archived) continue
      const d = obj.item_data || {}
      const catIds = new Set()
      if (d.category_id) catIds.add(d.category_id)
      for (const c of d.categories || []) if (c.id) catIds.add(c.id)
      const rc = d.reporting_category
      if (rc?.id) catIds.add(rc.id)
      allItems[obj.id] = { name: d.name || 'Unknown', categoryIds: catIds, imageId: (d.image_ids || [])[0] || null }

      // Extract variations from nested item_data.variations[] — reliable for all item types
      for (const v of d.variations || []) {
        if (v.type !== 'ITEM_VARIATION') continue
        const vd = v.item_variation_data || {}
        const priceAmt = vd.price_money?.amount
        variations[v.id] = {
          itemId: obj.id,
          variationName: vd.name || 'Regular',
          sku: vd.sku || '',
          sellPrice: priceAmt !== undefined ? +(priceAmt / 100).toFixed(2) : null,
        }
      }
    }
    cursor = data.cursor
  } while (cursor)

  // Filter by bar categories
  const filteredItemIds = new Set()
  for (const [id, item] of Object.entries(allItems)) {
    const intersection = [...item.categoryIds].filter(x => barCategoryIds.has(x))
    if (intersection.length > 0) filteredItemIds.add(id)
  }

  // Build filtered variations with parent names
  const filtered = {}
  for (const [varId, v] of Object.entries(variations)) {
    if (filteredItemIds.has(v.itemId)) {
      const parentName = allItems[v.itemId]?.name || 'Unknown'
      const nameLower = parentName.toLowerCase()
      if (!SKIP_KEYWORDS.some(kw => nameLower.includes(kw))) {
        filtered[varId] = { ...v, parentName }
      }
    }
  }
  return filtered
}

async function getInventoryCounts(token, locationId, variationIds) {
  const counts = {}
  const varList = [...variationIds]

  for (let i = 0; i < varList.length; i += 1000) {
    const chunk = varList.slice(i, i + 1000)
    const res = await fetch(`${BASE_URL}/inventory/counts/batch-retrieve`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        catalog_object_ids: chunk,
        location_ids: [locationId],
        states: ['IN_STOCK']
      })
    })
    const data = await res.json()
    for (const count of data.counts || []) {
      const varId = count.catalog_object_id
      counts[varId] = (counts[varId] || 0) + parseFloat(count.quantity || 0)
    }
  }
  return counts
}

async function getSoldQuantities(token, locationId, daysBack = 90) {
  const sold = {}
  const lastSold = {}
  // Use AEST so the daysBack window is correct on Vercel (which runs UTC)
  const startDate = nowAEST()
  startDate.setDate(startDate.getDate() - daysBack)
  const startStr = startDate.toISOString()
  let cursor = null
  let page = 0
  const MAX_PAGES = 50

  do {
    page++
    if (page > MAX_PAGES) break

    const payload = {
      location_ids: [locationId],
      types: ['ADJUSTMENT'],
      updated_after: startStr
    }
    if (cursor) payload.cursor = cursor

    const res = await fetch(`${BASE_URL}/inventory/changes/batch-retrieve`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    const changes = data.changes || []
    if (!changes.length) break

    for (const change of changes) {
      const adj = change.adjustment || {}
      const varId = adj.catalog_object_id
      if (!varId) continue
      if (adj.from_state === 'IN_STOCK' && adj.to_state === 'SOLD') {
        const qty = Math.abs(parseFloat(adj.quantity || 0))
        sold[varId] = (sold[varId] || 0) + qty
        if (adj.occurred_at) {
          const dt = new Date(adj.occurred_at)
          if (!lastSold[varId] || dt > lastSold[varId]) lastSold[varId] = dt
        }
      }
    }
    cursor = data.cursor
  } while (cursor)

  return { sold, lastSold }
}

export async function getCatalogImages(token, imageIds) {
  if (!imageIds || imageIds.length === 0) return {}
  const images = {}
  for (let i = 0; i < imageIds.length; i += 200) {
    const chunk = imageIds.slice(i, i + 200)
    const res = await fetch(BASE_URL + '/catalog/batch-retrieve', {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ object_ids: chunk })
    })
    const data = await res.json()
    for (const obj of data.objects || []) {
      if (obj.type === 'IMAGE' && obj.image_data && obj.image_data.url) {
        images[obj.id] = obj.image_data.url
      }
    }
  }
  return images
}

export async function fetchSquareData(token, daysBack = 90, kvGet = null, kvSet = null) {
  const locationId = await getLocationId(token)
  const barCategoryIds = await getBarCategoryIds(token)
  const catalog = await getCatalogItems(token, barCategoryIds)
  // Include parent item IDs alongside variation IDs —
  // unit-conversion wines (glass+bottle) store inventory at the item level, not variation level
  const varIds  = Object.keys(catalog)
  const itemIds = [...new Set(Object.values(catalog).map(v => v.itemId))]
  const inventory = await getInventoryCounts(token, locationId, [...varIds, ...itemIds])
  const { sold, lastSold } = await getSoldQuantities(token, locationId, daysBack)

  // Glass sales from Orders API — cached separately with 6hr TTL
  // If cache is cold, return immediately with inventory-only averages (fast path)
  // and populate the cache in the background for next refresh
  let ordersSales = {}
  const glassCacheKey = `glassSales_${daysBack}`
  if (kvGet) {
    try { ordersSales = (await kvGet(glassCacheKey)) || {} } catch {}
  }
  const glassFromCache = Object.keys(ordersSales).length > 0
  if (!glassFromCache) {
    // Await the fetch so glass sales are included on first load — accuracy > speed
    try {
      const periodStart = nowAEST()
      periodStart.setDate(periodStart.getDate() - daysBack)
      const sales = await fetchSalesReport(token, periodStart.toISOString(), nowAEST().toISOString())
      if (Object.keys(sales).length > 0) {
        ordersSales = sales
        if (kvSet) kvSet(glassCacheKey, sales, 6 * 60 * 60).catch(() => {})
      }
    } catch (e) {
      console.warn('[square] glass sales fetch failed, using inventory-only avg:', e.message)
      // ordersSales stays {} — wines will use inventory-only avg as fallback
    }
  }

  // Group by item name
  const itemGroups = {}
  for (const [varId, v] of Object.entries(catalog)) {
    const name = v.parentName
    if (!itemGroups[name]) itemGroups[name] = []
    itemGroups[name].push({ varId, ...v })
  }

  // Build item list
  const items = []
  for (const [name, vars] of Object.entries(itemGroups)) {
    // Priority for inventory counting:
    // 1. 'Bottle' variation — present on unit-conversion wines (glass+bottle), has actual stock
    // 2. 'Regular' variation — standard for most items
    // 3. Any non-glass variation — fallback
    // 4. All variations — last resort
    const bottleVars   = vars.filter(v => v.variationName.toLowerCase() === 'bottle')
    const regularVars  = vars.filter(v => v.variationName.toLowerCase() === 'regular' || v.variationName === '')
    const nonGlassVars = vars.filter(v => !v.variationName.toLowerCase().includes('glass'))
    const countVars = bottleVars.length   ? bottleVars
                    : regularVars.length  ? regularVars
                    : nonGlassVars.length ? nonGlassVars
                    : vars
    const glassVars = vars.filter(v => v.variationName.toLowerCase().includes('glass'))
    const hasGlass  = glassVars.length > 0

    const varOnHand  = countVars.reduce((s, v) => s + (inventory[v.varId] || 0), 0)
    // For unit-conversion items, Square may store inventory at the item level
    const itemId     = vars[0]?.itemId
    const itemOnHand = itemId ? (inventory[itemId] || 0) : 0
    const onHand = Math.round(varOnHand || itemOnHand)

    let totalSold, weeklyAvg

    if (hasGlass) {
      // For wine items: use Orders API which captures glass sales correctly
      // Orders API returns unitsSold in glasses; convert to bottle equivalents
      const GLASS_ML  = 150
      const BOTTLE_ML = 750
      const glassFraction = GLASS_ML / BOTTLE_ML  // 0.2 bottles per glass
      const salesData = ordersSales[name]
      const glassesSold = salesData?.units || 0
      const bottlesSold = countVars.reduce((s, v) => s + (sold[v.varId] || 0), 0)
      const totalBottles = bottlesSold + (glassesSold * glassFraction)
      totalSold  = Math.round(totalBottles)
      weeklyAvg  = +(totalBottles / (daysBack / 7)).toFixed(1)
    } else {
      // For beer, spirits etc: inventory changes are accurate
      const soldUnits = countVars.reduce((s, v) => s + (sold[v.varId] || 0), 0)
      totalSold  = Math.round(soldUnits)
      weeklyAvg  = +(soldUnits / (daysBack / 7)).toFixed(1)
    }

    let lastSoldDate = null
    for (const v of [...countVars, ...glassVars]) {
      if (lastSold[v.varId] && (!lastSoldDate || lastSold[v.varId] > lastSoldDate)) {
        lastSoldDate = lastSold[v.varId]
      }
    }

    const priceVar = countVars[0]

    // Store all variations with names and prices for the price list
    const allVariations = vars.map(v => ({
      name:  v.variationName,
      price: v.sellPrice,
      sku:   v.sku || '',
    })).filter(v => v.price != null || v.sku)

    // Determine primary sell price — prefer 'Regular' or 'Glass' variation
    const glassVar   = vars.find(v => v.variationName.toLowerCase().includes('glass'))
    const bottleVar  = vars.find(v => v.variationName.toLowerCase().includes('bottle'))
    const regularVar = countVars[0]
    const primaryPrice = (glassVar || regularVar)?.sellPrice ?? null
    const bottlePrice  = bottleVar?.sellPrice ?? null

    items.push({
      name,
      sku:                  countVars[0]?.sku || '',
      onHand,
      soldInPeriod: totalSold,
      weeklyAvg,
      lastSold:             lastSoldDate ? lastSoldDate.toISOString().split('T')[0] : null,
      squareSellPrice:      primaryPrice,
      squareSellPriceBottle: bottlePrice,
      variations:           allVariations,
    })
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchSalesReport(token, startStr, endStr) {
  const locationId = await getLocationId(token)
  const barCategoryIds = await getBarCategoryIds(token)
  const catalog = await getCatalogItems(token, barCategoryIds)

  // Build varId -> item name map
  const varToName = {}
  const varToVariationName = {}
  // Track which items have a glass variation — for those, 'Regular' = bottle
  const itemHasGlass = {}
  for (const [varId, v] of Object.entries(catalog)) {
    varToName[varId] = v.parentName
    varToVariationName[varId] = v.variationName
    if (v.variationName.toLowerCase().includes('glass')) {
      itemHasGlass[v.parentName] = true
    }
  }

  // Use Orders API for real revenue data
  const soldUnits   = {} // glasses + regular
  const soldBottles = {} // bottle variations
  const soldRevenue = {}
  let cursor = null
  let page = 0
  const MAX_PAGES = 100

  do {
    page++
    if (page > MAX_PAGES) break

    const payload = {
      location_ids: [locationId],
      query: {
        filter: {
          date_time_filter: {
            created_at: { start_at: startStr, end_at: endStr }
          },
          state_filter: { states: ['COMPLETED'] }
        }
      },
      limit: 500,
    }
    if (cursor) payload.cursor = cursor

    const res = await fetch(`${BASE_URL}/orders/search`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    const orders = data.orders || []
    if (!orders.length) break

    for (const order of orders) {
      for (const lineItem of order.line_items || []) {
        const varId = lineItem.catalog_object_id
        if (!varId || !varToName[varId]) continue

        // Count Regular, Glass, and Bottle variations separately
        const vName = (varToVariationName[varId] || '').toLowerCase()
        const isRegular = vName === 'regular' || vName === ''
        const isGlass   = vName.includes('glass')
        const isBottle  = vName.includes('bottle')
        if (!isRegular && !isGlass && !isBottle) continue

        const name = varToName[varId]
        const qty = parseFloat(lineItem.quantity || 0)
        // Use total_money (after discounts) for accurate revenue
        const unitPriceCents = lineItem.base_price_money?.amount || 0
        const totalCents     = lineItem.total_money?.amount ?? lineItem.gross_sales_money?.amount ?? (unitPriceCents * qty)

        // For items that have a glass variation, 'Regular' means the bottle —
        // Square names the bottle variation 'Regular' on unit-conversion wines
        const isBottleSale = isBottle || (isRegular && itemHasGlass[name])

        if (isBottleSale) {
          soldBottles[name] = (soldBottles[name] || 0) + qty
        } else {
          soldUnits[name]   = (soldUnits[name]   || 0) + qty
        }
        soldRevenue[name] = (soldRevenue[name] || 0) + totalCents
      }
    }

    cursor = data.cursor
  } while (cursor)

  // Convert revenue from cents to dollars
  const result = {}
  const allNames = new Set([...Object.keys(soldUnits), ...Object.keys(soldBottles), ...Object.keys(soldRevenue)])
  for (const name of allNames) {
    result[name] = {
      units:   Math.round(soldUnits[name]   || 0),
      bottles: Math.round(soldBottles[name] || 0),
      revenue: soldRevenue[name] ? +(soldRevenue[name] / 100).toFixed(2) : null,
    }
  }

  return result
}

// ─── WASTAGE SYNC HELPERS ─────────────────────────────────────────────────────

// Returns { itemName: { varId, onHand } } for all bar items.
// Includes current inventory so preview can flag zero-stock items.
export async function getVariationIdMap(token) {
  const locationId     = await getLocationId(token)
  const barCategoryIds = await getBarCategoryIds(token)
  const catalog        = await getCatalogItems(token, barCategoryIds)

  // Group variations by parent item name
  const groups = {}
  for (const [varId, v] of Object.entries(catalog)) {
    if (!groups[v.parentName]) groups[v.parentName] = []
    groups[v.parentName].push({ varId, variationName: v.variationName })
  }

  // For each item, prefer the 'Regular' variation (the one Square tracks inventory on)
  const primaryVarIds = {}
  for (const [name, vars] of Object.entries(groups)) {
    const regular = vars.find(v =>
      v.variationName.toLowerCase() === 'regular' || v.variationName === ''
    )
    primaryVarIds[name] = (regular || vars[0]).varId
  }

  // Fetch current inventory counts so preview can detect zero-stock
  const inventory = await getInventoryCounts(token, locationId, Object.values(primaryVarIds))

  const map = {}
  for (const [name, varId] of Object.entries(primaryVarIds)) {
    map[name] = { varId, onHand: inventory[varId] ?? 0 }
  }
  return map
}

// Posts a single WASTE adjustment. Returns { ok, error } — never throws.
export async function postSingleWasteAdjustment(token, locationId, adj) {
  const body = {
    idempotency_key: `waste-${adj.entryId}-${Date.now()}`,
    changes: [{
      type: 'ADJUSTMENT',
      adjustment: {
        catalog_object_id: adj.variationId,
        location_id:       locationId,
        from_state:        'IN_STOCK',
        to_state:          'WASTE',
        quantity:          String(adj.squareQty),
        occurred_at:       adj.occurredAt,
      }
    }]
  }
  try {
    const res  = await fetch(`${BASE_URL}/inventory/changes/batch-create`, {
      method:  'POST',
      headers: headers(token),
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (data.errors?.length) {
      const errDetail = data.errors.map(e => `[${e.code}] ${e.detail || e.category || ''}`).join('; ')
      return { ok: false, error: errDetail }
    }
    // Return raw Square response for debugging
    return { ok: true, _squareResponse: data }
  } catch(e) {
    return { ok: false, error: e.message }
  }
}

// Posts PHYSICAL_COUNT adjustments — sets absolute inventory quantities in Square.
// counts: [{ variationId, quantity (string), occurredAt (ISO), itemName }]
// Sends one at a time so a single bad item doesn't block the rest.
export async function postPhysicalCount(token, locationId, count) {
  const body = {
    idempotency_key: `stocktake-${count.itemName.replace(/\s+/g, '-')}-${Date.now()}`,
    changes: [{
      type: 'PHYSICAL_COUNT',
      physical_count: {
        catalog_object_id: count.variationId,
        location_id:       locationId,
        quantity:          String(count.quantity),
        state:             'IN_STOCK',
        occurred_at:       count.occurredAt,
      }
    }]
  }
  try {
    const res  = await fetch(`${BASE_URL}/inventory/changes/batch-create`, {
      method:  'POST',
      headers: headers(token),
      body:    JSON.stringify(body),
    })
    const data = await res.json()
    if (data.errors?.length) {
      const errDetail = data.errors.map(e => `[${e.code}] ${e.detail || e.category || ''}`).join('; ')
      return { ok: false, error: errDetail }
    }
    // Return raw Square response for debugging
    return { ok: true, _squareResponse: data }
  } catch(e) {
    return { ok: false, error: e.message }
  }
}
