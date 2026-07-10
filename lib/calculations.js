export const CATEGORIES = [
  'Beer', 'Cider', 'PreMix', 'White Wine', 'Red Wine', 'Rose',
  'Sparkling', 'Fortified & Liqueurs', 'Spirits', 'Soft Drinks', 'Snacks'
]

export const SUPPLIERS = ['Dan Murphys', 'Coles Woolies', 'ACW']

export const CATEGORY_ORDER = {
  'Beer': 0, 'Cider': 1, 'PreMix': 2, 'White Wine': 3, 'Red Wine': 4,
  'Rose': 5, 'Sparkling': 6, 'Fortified & Liqueurs': 7, 'Spirits': 8,
  'Soft Drinks': 9, 'Snacks': 10
}

export function defaultCategory(name) {
  const n = name.toLowerCase()
  if (n.includes('nip') || n.includes('rum') || n.includes(' gin') || n.includes('vodka') ||
      n.includes('whisky') || n.includes('whiskey') || n.includes('bourbon') || n.includes('brandy'))
    return 'Spirits'
  if (n.includes('port') || n.includes('baileys') || n.includes('liqueur'))
    return 'Fortified & Liqueurs'
  if (n.includes('cider')) return 'Cider'
  if (n.includes('sauv') || n.includes('pinot gri') || n.includes('chardon') || n.includes('riesling'))
    return 'White Wine'
  if (n.includes('shiraz') || n.includes('cabernet') || n.includes('merlot') || n.includes('pinot noir'))
    return 'Red Wine'
  if (n.includes('rose') || n.includes('ros\u00e9')) return 'Rose'
  if (n.includes('prosecco') || n.includes('sparkling') || n.includes('brut') || n.includes('piccolo'))
    return 'Sparkling'
  if (n.includes('& dry') || n.includes('canadian club')) return 'PreMix'
  if (n.includes('bundaberg') || n.includes('ginger ale') || n.includes('coke') ||
      n.includes('soda') || n.includes('tonic') || n.includes('lemon') || n.includes('lemonade'))
    return 'Soft Drinks'
  if (n.includes('chip') || n.includes('nut') || n.includes('snack') ||
      n.includes('nobby') || n.includes('smith') || n.includes('samboy'))
    return 'Snacks'
  return 'Beer'
}

export function defaultSupplier(category) {
  if (category === 'Snacks') return 'ACW'
  if (category === 'Soft Drinks') return 'Coles Woolies'
  return 'Dan Murphys'
}

export function defaultPack(category) {
  const packs = {
    'Beer': 24, 'Cider': 24, 'PreMix': 24,
    'White Wine': 6, 'Red Wine': 6, 'Rose': 6, 'Sparkling': 6,
    'Spirits': 1, 'Fortified & Liqueurs': 1,
    'Soft Drinks': 24, 'Snacks': 18
  }
  return packs[category] || 1
}

export function calculateItem(item, settings, targetWeeks = 6) {
  const category = settings.category || defaultCategory(item.name)
  const supplier = settings.supplier || defaultSupplier(category)
  const pack = settings.pack || defaultPack(category)
  const bottleML = settings.bottleML || null
  const nipML = settings.nipML || null

  const isSpirit = category === 'Spirits' || category === 'Fortified & Liqueurs'

  // Default Australian standard: 700ml bottle, 30ml nip
  const effectiveBottleML = bottleML || (isSpirit ? 700 : null)
  const effectiveNipML    = nipML    || (isSpirit ? 30  : null)

  // Weekly average in base units — use manual override if set (for new items with no sales history)
  const weeklyAvgUnits = settings.weeklyAvgOverride != null ? Number(settings.weeklyAvgOverride) : item.weeklyAvg

  // Per-item target weeks override
  const effectiveTargetWeeks = settings.targetWeeksOverride != null ? Number(settings.targetWeeksOverride) : targetWeeks

  // Convert to bottles/units per week if spirit
  let weeklyAvgOrdering = weeklyAvgUnits
  let nipsPerBottle = null
  if (isSpirit && effectiveBottleML && effectiveNipML && effectiveNipML > 0) {
    nipsPerBottle = effectiveBottleML / effectiveNipML
    weeklyAvgOrdering = +(weeklyAvgUnits / nipsPerBottle).toFixed(2)
  }

  // For spirits: work in NIPS throughout, then convert to bottles at the end
  // targetStock and currentStock are in nips for spirits
  const calculatedTarget = isSpirit
    ? Math.ceil(weeklyAvgUnits * effectiveTargetWeeks)
    : Math.ceil(weeklyAvgOrdering * effectiveTargetWeeks)
  // ── Guardrails around the usage-derived target ───────────────────────────
  // The target is self-tuning (weekly average x target weeks), but two manual
  // limits clamp it:
  //   minStock — floor. Stops a quiet fortnight under-ordering a staple.
  //   maxStock — ceiling. Stops a slow mover, or a one-off function inflating
  //              the 90-day average, turning into a bulk buy.
  //
  // Both are expressed in the SAME unit as targetStock: nips for spirits,
  // base units for everything else.
  //
  // A value of 0 is meaningful (maxStock: 0 = never order), so we test against
  // null/'' rather than falsiness.
  const num = (v) => (v != null && v !== '' ? Number(v) : null)
  const minStock = num(settings.minStock)
  const maxStock = num(settings.maxStock)

  let targetStock  = calculatedTarget
  let targetSource = 'usage'

  // Ceiling first, floor second — so if someone sets min above max (a config
  // error) the floor wins and a staple is never under-ordered.
  if (maxStock != null && targetStock > maxStock) { targetStock = maxStock; targetSource = 'max' }
  if (minStock != null && targetStock < minStock) { targetStock = minStock; targetSource = 'min' }

  const stockLimitConflict = minStock != null && maxStock != null && minStock > maxStock

  const currentStock = item.onHand                       // always raw on-hand units

  const nipsNeeded     = isSpirit ? Math.max(0, targetStock - currentStock) : 0
  const bottlesToOrder = isSpirit && nipsNeeded > 0 && nipsPerBottle
    ? ((v) => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(nipsNeeded / nipsPerBottle)
    : null
  // Nips to order = whole bottles × nips per bottle (what you'll actually receive)
  const nipsToOrder = bottlesToOrder && nipsPerBottle
    ? Math.ceil(bottlesToOrder * nipsPerBottle)
    : null
  const unitsNeeded = isSpirit ? (nipsNeeded || 0) : Math.max(0, targetStock - currentStock)

  const orderQty = isSpirit
    ? (nipsToOrder || 0)
    : (unitsNeeded === 0 ? 0 : Math.ceil(unitsNeeded / pack) * pack)

  // maxStock caps the TARGET, but you can't buy a fraction of a carton or a
  // bottle — so a single pack can still push you past the ceiling. We can't
  // prevent that (ordering less isn't possible), so we flag it instead and let
  // whoever is ordering decide whether to zero the line.
  const projectedStock  = currentStock + orderQty
  const exceedsMaxStock = maxStock != null && orderQty > 0 && projectedStock > maxStock

  let priority = 'OK'
  if (isSpirit ? nipsToOrder > 0 : orderQty > 0) {
    // Use the effective weekly avg (respects override) for priority calculation
    const weeksLeft = isSpirit
      ? currentStock / (weeklyAvgUnits || 1)
      : currentStock / (weeklyAvgOrdering || 1)
    priority = weeksLeft <= 2 ? 'CRITICAL' : 'LOW'
  }

  return {
    ...item,
    category,
    supplier,
    pack,
    bottleML: effectiveBottleML,
    nipML: effectiveNipML,
    nipsPerBottle,
    weeklyAvgOrdering: +weeklyAvgOrdering.toFixed(2),
    targetStock,
    currentStock: +currentStock.toFixed(1),
    unitsNeeded,
    orderQty,
    nipsToOrder,
    bottlesToOrder,
    priority,
    targetWeeksOverride: settings.targetWeeksOverride != null ? Number(settings.targetWeeksOverride) : null,
    minStock,
    maxStock,
    targetSource,        // 'usage' | 'min' | 'max' — why targetStock is what it is
    stockLimitConflict,  // true when minStock > maxStock (min wins; UI should warn)
    projectedStock,      // stock after this order lands
    exceedsMaxStock,     // pack rounding pushes projectedStock past maxStock
    effectiveTargetWeeks
  }
}