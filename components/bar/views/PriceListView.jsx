// PriceListView.jsx — extracted from pages/index.js
import React, { useState } from 'react'

export default function PriceListView({ items, settings, readOnly, saving, onSave, onPrint, publicMode = false }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
  const [showOutOfStock, setShowOutOfStock] = useState(false)

  // Group items by category
  const grouped = {}
  for (const item of items) {
    const cat = item.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const cats = CATEGORY_ORDER.filter(c => grouped[c])


  function normaliseVariations(vars) {
    return vars
      .map(v => {
        const n = v.name.toLowerCase()
        const label = n.includes('glass') || n.includes('wine glass') ? 'Glass'
                    : n.includes('bottle') || n === 'regular' ? 'Bottle'
                    : v.name
        return { ...v, name: label }
      })
      .sort((a, b) => {
        if (a.name === 'Glass') return -1
        if (b.name === 'Glass') return 1
        return 0
      })
  }

  function getPrice(item) {
    const isBottleOnly = item.bottleOnly || /minchinbury|curtis legion/i.test(item.name)
    if (isBottleOnly) return item.sellPriceBottle || item.squareSellPriceBottle
                           || (item.variations || []).find(v => /bottle|regular/i.test(v.name) && !/glass/i.test(v.name))?.price
                           || null
    if (item.sellPrice != null)       return item.sellPrice
    if (item.squareSellPrice != null) return item.squareSellPrice
    return null
  }

  function getVariations(item) {
    const isBottleOnly = item.bottleOnly || /minchinbury|curtis legion/i.test(item.name)
    if (isBottleOnly) return null
    const vars = (item.variations || []).filter(v => v.price != null)
    if (vars.length > 1) return normaliseVariations(vars)
    return null
  }

function isHidden(item) {
    return (settings[item.name] || {}).hidden === true
  }

  const visibleCount = items.filter(i => !isHidden(i)).length

  // Public mode - strip everything, show only category price cards
  if (publicMode) return (
    <div style={{ padding: '12px 16px', fontFamily: 'Arial, sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🍺 Paynter Bar</div>
          <div style={{ fontSize: 11, color: '#bfdbfe', marginTop: 2 }}>GemLife Palmwoods · Current Prices</div>
        </div>
        <div style={{ fontSize: 10, color: '#bfdbfe', textAlign: 'right' }}>Prices may vary.<br/>See bar staff for details.</div>
      </div>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', color: '#fff', padding: '6px 14px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {grouped[cat].filter(item => !isHidden(item) && (item.onHand || 0) > 0).map((item, idx) => {
                const price   = getPrice(item)
                const vars    = getVariations(item)
                return (
                  <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 14px', fontSize: 14, color: '#0f172a' }}>{item.name}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
                      {vars ? (
                        <div>{vars.map(v => (
                          <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                            <span style={{ color: '#64748b', fontFamily: 'Arial', fontWeight: 400 }}>{v.name}</span>
                            <span>${Number(v.price).toFixed(2)}</span>
                          </div>
                        ))}</div>
                      ) : price != null ? `$${Number(price).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )

  return (
    <div className="view-wrap" style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Price List — From Square</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {visibleCount} items · Prices from Square
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowOutOfStock(v => !v)}
            style={{ background: showOutOfStock ? '#f1f5f9' : '#fff', color: showOutOfStock ? '#374151' : '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            {showOutOfStock ? '👁 Showing Out of Stock' : '🚫 Hiding Out of Stock'}
          </button>
          <button
            style={{ background: '#be185d', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            onClick={() => onPrint(items, settings)}>
            🖨️ Print Price List
          </button>
        </div>
      </div>

      {/* Category sections */}
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cat}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Alc%</th>
                  <th style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Std Drinks</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Price</th>
                  {!readOnly && <th style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>On Print</th>}

                </tr>
              </thead>
              <tbody>
                {grouped[cat].filter(item => showOutOfStock || (item.onHand || 0) > 0 || isHidden(item) || (settings[item.name]?.showOnPrint)).map((item, idx) => {
                  const hidden  = isHidden(item)
                  const price   = getPrice(item)
                  const rowBg   = idx % 2 === 0 ? '#fff' : '#f8fafc'

                  return (
                    <tr key={item.name} style={{ background: rowBg }}>
                      {/* Display name */}
                      <td style={{ padding: '7px 14px', fontSize: 13, color: '#0f172a' }}>
                        {item.name}
                      </td>

                      {/* Alc% — editable inline */}
                      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                        {readOnly
                          ? <span style={{ fontSize: 12, color: '#64748b' }}>{item.alcoholPct ? `${item.alcoholPct}%` : '—'}</span>
                          : <input
                              type="text" placeholder="—"
                              value={(settings[item.name] || {}).alcoholPct ?? item.alcoholPct ?? ''}
                              onChange={e => onSave(item.name, 'alcoholPct', e.target.value, true)}
                              style={{ width: 52, textAlign: 'center', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 6px', fontFamily: 'monospace', background: '#f8fafc' }}
                            />
                        }
                      </td>

                      {/* Standard drinks */}
                      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                        {(() => {
                          const abv = parseFloat(item.alcoholPct)
                          if (!abv) return <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                          const spiritCats = ['Spirits','Fortified & Liqueurs']
                          const wineCats = ['White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs']
                          const vars = getVariations(item)
                          if (vars) {
                            return (
                              <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
                                {vars.map(v => {
                                  const ml = v.name === 'Glass' ? 150 : v.name === 'Bottle' ? 750 : null
                                  const sd = ml ? (Math.ceil(abv / 100 * ml * 0.789 / 10 * 10) / 10).toFixed(1) : null
                                  return <tr key={v.name}><td style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '1px 0' }}>{sd ?? '—'}</td></tr>
                                })}
                              </table>
                            )
                          }
                          let ml = null
                          if (spiritCats.includes(item.category)) ml = item.nipML || 30
                          else if (wineCats.includes(item.category)) ml = 150
                          else ml = item.containerML || 375  // beer/cider — use stored container size
                          const sd = (Math.ceil(abv / 100 * ml * 0.789 / 10 * 10) / 10).toFixed(1)
                          return <span style={{ fontSize: 12, color: '#0f172a', fontFamily: 'monospace' }}>{sd}</span>
                        })()}
                      </td>

                      {/* Price — from Square only */}
                      <td style={{ padding: '7px 14px', textAlign: 'right' }}>
                        {(() => {
                          const variations = getVariations(item)
                          if (variations) {
                            return (
                              <table style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
                                {variations.map(v => (
                                  <tr key={v.name}>
                                    <td style={{ fontSize: 10, color: '#64748b', paddingRight: 8, whiteSpace: 'nowrap' }}>{v.name}</td>
                                    <td style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>${Number(v.price).toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr><td colSpan={2} style={{ fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>Square</td></tr>
                              </table>
                            )
                          }
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: price != null ? '#0f172a' : '#cbd5e1' }}>
                                {price != null ? `$${Number(price).toFixed(2)}` : '—'}
                              </span>
                              {price != null && <span style={{ fontSize: 9, color: '#94a3b8' }}>Square</span>}
                              {price == null && !readOnly && <span style={{ fontSize: 9, color: '#dc2626' }}>Set in Square</span>}
                            </div>
                          )
                        })()}
                      </td>

                      {!readOnly && (
                        <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                          {hidden ? (
                            <button onClick={() => onSave(item.name, 'hidden', false)}
                              style={{ fontSize: 10, padding: '2px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
                              ✗ Hidden
                            </button>
                          ) : (item.onHand || 0) <= 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <button onClick={() => onSave(item.name, 'showOnPrint', !(settings[item.name]?.showOnPrint))}
                                style={{ fontSize: 10, padding: '2px 8px', background: (settings[item.name]?.showOnPrint) ? '#f0fdf4' : '#fff', color: (settings[item.name]?.showOnPrint) ? '#16a34a' : '#64748b', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                {(settings[item.name]?.showOnPrint) ? '✓ Include' : '+ Include'}
                              </button>
                              <span style={{ fontSize: 9, color: '#94a3b8' }}>zero stock</span>
                            </div>
                          ) : (
                            <button onClick={() => onSave(item.name, 'hidden', true)}
                              style={{ fontSize: 10, padding: '2px 8px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                              Hide
                            </button>
                          )}
                        </td>
                      )}

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
