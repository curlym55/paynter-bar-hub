// constants.js — shared constants for Paynter Bar Hub components

export const DEFAULT_SUPPLIERS = ['Dan Murphy', 'Coles Woolies', 'ACW']

export const PRIORITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', text: '#991b1b', badge: '#dc2626' },
  LOW:      { bg: '#fef9c3', text: '#854d0e', badge: '#ca8a04' },
  OK:       { bg: '#f0fdf4', text: '#166534', badge: '#16a34a' },
}

export const SUPPLIER_COLORS = {
  'Dan Murphy':    '#1f4e79',
  'Coles Woolies': '#c2410c',
  'ACW':           '#166534',
}

export const CATEGORY_ORDER_LIST = [
  'Beer','Cider','PreMix','White Wine','Red Wine','Rose',
  'Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks'
]

export const TREND_CAT_COLORS = {
  'Beer':                 '#3b82f6',
  'Cider':                '#06b6d4',
  'PreMix':               '#8b5cf6',
  'White Wine':           '#f59e0b',
  'Red Wine':             '#ef4444',
  'Rose':                 '#ec4899',
  'Sparkling':            '#10b981',
  'Fortified & Liqueurs': '#f97316',
  'Spirits':              '#6366f1',
  'Soft Drinks':          '#84cc16',
  'Snacks':               '#a8a29e',
}

export const TREND_CHART_W  = 680
export const TREND_CHART_H  = 200
export const TREND_PAD_L    = 50
export const TREND_PAD_T    = 20
export const TREND_PAD_R    = 20
export const TREND_PAD_B    = 40

// Wine glass pour used for every COST, markup, profit and stock-conversion
// calculation: 165ml = 11/50 of a 750ml bottle = 4.545 glasses per bottle. This
// is Square's true glass portion and includes the overpour buffer — deliberately
// a little larger than the 150ml pour advertised on the customer price list.
// Change it HERE and everything follows. It used to be typed out separately in
// half a dozen places and they drifted apart (some said 150ml / 5 glasses, some
// 165ml), so the same wine showed different markups on different screens.
export const GLASS_SERVE_ML = 165
export const GLASSES_PER_BOTTLE = 750 / GLASS_SERVE_ML
