// getSpecialPrice.js -- extracted from pages/index.js

export function getSpecialPrice(s, items) {
  const item = items?.find(i => i.name?.toLowerCase() === s.name?.toLowerCase())
  if (item?.squareSellPrice != null) return '$' + Number(item.squareSellPrice).toFixed(2)
  return s.price_override || ''
}
