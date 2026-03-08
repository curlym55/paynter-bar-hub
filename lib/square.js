const BASE_URL = 'https://connect.squareup.com/v2'
const BAR_CATEGORY_KEYWORDS = [
  'beer', 'wine', 'spirit', 'cider', 'premix', 'sparkling', 'liqueur',
  'fortified', 'rose', 'soft drink', 'mixer', 'snack', 'chip', 'nut',
  'beverage', 'alcohol', 'whisky', 'whiskey', 'rum', 'gin', 'vodka',
  'bourbon', 'brandy', 'champagne', 'seltzer', 'bar snack', 'pre mix'
]

const SKIP_KEYWORDS = [
  'ticket', 'raffle', 'dinner', 'lunch', 'bbq', 'burger', 'sausage',
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
      const d = obj.item_data || {}
      const catIds = new Set()
      if (d.category_id) catIds.add(d.category_id)
      for (const c of d.categories || []) if (c.id) catIds.add(c.id)
      const rc = d.reporting_category
      if (rc?.id) catIds.add(rc.id)
      allItems[obj.id] = { name: d.name || 'Unknown', categoryIds: catIds }

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
  const startDate = new Date()
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

export async function fetchSquareData(token, daysBack = 90) {
  const locationId = await getLocationId(token)
  const barCategoryIds = await getBarCategoryIds(token)
  const catalog = await getCatalogItems(token, barCategoryIds)
  const inventory = await getInventoryCounts(token, locationId, Object.keys(catalog))
  const { sold, lastSold } = await getSoldQuantities(token, locationId, daysBack)

  // Group by item name
  const itemGroups = {}
  for (const [varId, v] of Object.entries(catalog)) {
    const name = v.parentName
    if (!itemGroups[name]) itemGroups[name] = []
    itemGroups[name].push({ varId, ...v })
  }

  // Build item list using Regular variation only for counts
  const items = []
  for (const [name, vars] of Object.entries(itemGroups)) {
    const regularVars = vars.filter(v => v.variationName.toLowerCase() === 'regular' || v.variationName === '')
    const countVars = regularVars.length ? regularVars : vars

    const onHand = Math.round(countVars.reduce((s, v) => s + (inventory[v.varId] || 0), 0))
    const totalSold = Math.round(countVars.reduce((s, v) => s + (sold[v.varId] || 0), 0))
    const weeklyAvg = +(totalSold / (daysBack / 7)).toFixed(1)

    let lastSoldDate = null
    for (const v of countVars) {
      if (lastSold[v.varId] && (!lastSoldDate || lastSold[v.varId] > lastSoldDate)) {
        lastSoldDate = lastSold[v.varId]
      }
    }

    const priceVar = countVars[0]

    // Store all variations with names and prices for the price list
    const allVariations = vars.map(v => ({
      name:  v.variationName,
      price: v.sellPrice,
    })).filter(v => v.price != null)

    // Determine primary sell price — prefer 'Regular' or 'Glass' variation
    const glassVar   = vars.find(v => v.variationName.toLowerCase().includes('glass'))
    const bottleVar  = vars.find(v => v.variationName.toLowerCase().includes('bottle'))
    const regularVar = countVars[0]
    const primaryPrice = (glassVar || regularVar)?.sellPrice ?? null
    const bottlePrice  = bottleVar?.sellPrice ?? null

    items.push({
      name,
      onHand,
      soldLast90: totalSold,
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
  for (const [varId, v] of Object.entries(catalog)) {
    varToName[varId] = v.parentName
    varToVariationName[varId] = v.variationName
  }

  // Use Orders API for real revenue data
  const soldUnits   = {}
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

        // Only count Regular variation
        const vName = (varToVariationName[varId] || '').toLowerCase()
        if (vName !== 'regular' && vName !== '') continue

        const name = varToName[varId]
        const qty = parseFloat(lineItem.quantity || 0)
        // gross_sales_money is total before discounts, base_price_money is unit price
        const unitPriceCents = lineItem.base_price_money?.amount || 0
        const totalCents     = lineItem.gross_sales_money?.amount || (unitPriceCents * qty)

        soldUnits[name]   = (soldUnits[name]   || 0) + qty
        soldRevenue[name] = (soldRevenue[name] || 0) + totalCents
      }
    }

    cursor = data.cursor
  } while (cursor)

  // Convert revenue from cents to dollars
  const result = {}
  const allNames = new Set([...Object.keys(soldUnits), ...Object.keys(soldRevenue)])
  for (const name of allNames) {
    result[name] = {
      units:   Math.round(soldUnits[name]   || 0),
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
    console.log('[stocktake-sync] Square response:', res.status, JSON.stringify(data))
    if (data.errors?.length) {
      const errDetail = data.errors.map(e => `[${e.code}] ${e.detail || e.category || ''}`).join('; ')
      return { ok: false, error: errDetail }
    }
    return { ok: true }
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
    console.log('[stocktake-sync] Square response:', res.status, JSON.stringify(data))
    if (data.errors?.length) {
      const errDetail = data.errors.map(e => `[${e.code}] ${e.detail || e.category || ''}`).join('; ')
      return { ok: false, error: errDetail }
    }
    return { ok: true }
  } catch(e) {
    return { ok: false, error: e.message }
  }
}
