// DashboardView.jsx — extracted from pages/index.js
import React, { useState, useEffect } from 'react'

export default function DashboardView({ items, lastUpdated, onNav, onStartOrder, orderedItems = {}, fromCache = false, orderCount: orderCountProp, critCount: critCountProp, onOrderCount: onOrderCountProp }) {
  const [dashTab, setDashTab]   = useState('overview')
  const [fyData,  setFyData]    = useState(null)
  const [fyLoading, setFyLoading] = useState(false)
  const [fyError,   setFyError]   = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [revenueTarget, setRevenueTarget] = useState(null)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const onOrderCount = onOrderCountProp ?? Object.keys(orderedItems).length
  const dontOrderRe  = /do\s*n'?t\s+order|do\s+not\s+order|do\s+not\s+restock|do\s*n'?t\s+restock/i
  const critCount    = critCountProp ?? items.filter(i => i.priority === 'CRITICAL' && !dontOrderRe.test(i.notes || '')).length
  const lowCount     = items.filter(i => i.priority === 'LOW' && !dontOrderRe.test(i.notes || '')).length
  const orderCount   = orderCountProp ?? items.filter(i => i.orderQty > 0 && !orderedItems[i.name] && !dontOrderRe.test(i.notes || '')).length
  const totalItems   = items.length

  const now = new Date()
  const refreshedAgo = lastUpdated ? (() => {
    const mins = Math.floor((now - new Date(lastUpdated)) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins/60)}h ${mins%60}m ago`
  })() : 'Not yet refreshed'

  // Auto-load FY chart and weather on mount
  useEffect(() => {
    if (!fyData && !fyLoading) loadFyChart()
    if (!weatherData && !weatherLoading) loadWeather()
  }, [])

  // Load revenue target from settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const s = d.settings || d || {}
      if (d.revenueTarget) setRevenueTarget(Number(d.revenueTarget))
    }).catch(() => {})
  }, [])

  async function saveRevenueTarget(val) {
    const v = parseFloat(val)
    if (!isNaN(v) && v > 0) {
      setRevenueTarget(v)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: '__revenueTarget', field: 'revenueTarget', value: v, who: 'BMT' })
      })
    }
    setEditingTarget(false)
  }

  async function loadWeather() {
    setWeatherLoading(true)
    try {
      // Palmwoods QLD: lat -26.70, lon 152.76
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=-26.70&longitude=152.76&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia%2FBrisbane&forecast_days=7'
      const r = await fetch(url)
      const d = await r.json()
      // Wed=3, Fri=5, Sun=0
      const days = d.daily.time.map((date, i) => ({
        date,
        dayOfWeek: new Date(date + 'T12:00:00').getDay(),
        code: d.daily.weathercode[i],
        max: Math.round(d.daily.temperature_2m_max[i]),
        min: Math.round(d.daily.temperature_2m_min[i]),
        rain: d.daily.precipitation_probability_max[i],
      }))
      setWeatherData(days)
    } catch(e) { setWeatherData([]) }
    finally { setWeatherLoading(false) }
  }

  async function loadFyChart(forceRefresh = false) {
    setFyLoading(true); setFyError(null)
    try {
      const url = forceRefresh ? '/api/fy-chart?refresh=true' : '/api/fy-chart'
      const r = await fetch(url)
      if (!r.ok) throw new Error('Failed to load FY chart')
      const d = await r.json()
      setFyData(d.months || [])
    } catch(e) { setFyError(e.message) }
    finally { setFyLoading(false) }
  }

  const features = [
    { icon: '📦', label: 'Reorder Planner',    desc: 'Stock levels, order quantities & supplier sheets', tab: 'reorder',    color: '#1e3a5f' },
    { icon: '📊', label: 'Sales Report',        desc: 'Period sales with category breakdown',             tab: 'sales',      color: '#7c3aed' },
    { icon: '📈', label: 'Quarterly Trends',    desc: 'Four-quarter category performance charts',         tab: 'trends',     color: '#0e7490' },
    { icon: '🏆', label: 'Best & Worst Sellers',desc: 'Top 10, slow sellers and items not moving',        tab: 'bestsellers',color: '#92400e' },
    { icon: '🏷️', label: 'Price List',          desc: 'Printable A4 price list for bar display',          tab: 'pricelist',  color: '#be185d' },
    { icon: '👥', label: 'Volunteer Roster',    desc: 'Volunteer scheduling (opens new tab)',             tab: 'roster',     color: '#065f46', external: true },
    { icon: '🗑️', label: 'Wastage Log',          desc: 'Record breakages, spoilage and expired stock',    tab: 'wastage',    color: '#92400e' },
    { icon: '❓', label: 'Help & Guide',         desc: 'Full documentation for all features',             tab: 'help',       color: '#475569' },
  ]

  const alertItems = items
    .filter(i => (i.priority === 'CRITICAL' || i.priority === 'LOW') && !dontOrderRe.test(i.notes || ''))
    .sort((a, b) => (a.priority === 'CRITICAL' ? 0 : 1) - (b.priority === 'CRITICAL' ? 0 : 1) || (a.onHand ?? 999) - (b.onHand ?? 999))

  const statCards = [
    { label: 'Critical',  value: critCount,    sub: 'below target',      color: '#dc2626', bg: '#fef2f2', action: () => onNav('reorder') },
    { label: 'Low Stock', value: lowCount,     sub: 'running low',       color: '#d97706', bg: '#fffbeb', action: () => onNav('reorder') },
    { label: 'To Order',  value: orderCount,   sub: 'need ordering',     color: '#2563eb', bg: '#eff6ff', action: () => onNav('reorder') },
    { label: 'On Order',  value: onOrderCount, sub: 'awaiting delivery', color: '#16a34a', bg: '#f0fdf4', action: () => onNav('reorder') },
    { label: 'Refreshed', value: refreshedAgo, sub: fromCache ? '📦 cached data' : '✅ live from Square', color: fromCache ? '#d97706' : '#475569', bg: fromCache ? '#fffbeb' : '#f8fafc', action: null },
  ]

  const dashTabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'alerts',   label: `⚠️ Stock Alerts${critCount + lowCount > 0 ? ` (${critCount + lowCount})` : ''}` },
  ]

  const fmt = v => '$' + Math.round(v).toLocaleString('en-AU')
  const tradingDays = [0, 3, 5] // Sun=0, Wed=3, Fri=5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Weekly Order CTA — prominent for new users */}
      {onStartOrder && orderCount > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0e7490 100%)', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>📦 {orderCount} item{orderCount !== 1 ? 's' : ''} need{orderCount === 1 ? 's' : ''} ordering</div>
            <div style={{ color: '#bae6fd', fontSize: 12, marginTop: 2 }}>
              {critCount > 0 ? `${critCount} critical · ` : ''}{onOrderCount > 0 ? `${onOrderCount} already on order` : 'No pending orders'}
            </div>
          </div>
          <button onClick={onStartOrder}
            style={{ background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            📋 Start Weekly Order
          </button>
        </div>
      )}
      {/* Dashboard sub-tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 32px 0', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
        {dashTabs.map(t => (
          <button key={t.id} onClick={() => setDashTab(t.id)}
            style={{ padding: '7px 18px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontSize: 12, fontWeight: dashTab === t.id ? 700 : 400,
              background: dashTab === t.id ? '#fff' : 'transparent',
              color: dashTab === t.id ? '#0f172a' : '#64748b',
              borderBottom: dashTab === t.id ? '2px solid #fff' : '2px solid transparent',
              marginBottom: dashTab === t.id ? -2 : 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 32px', maxWidth: 1100, margin: '0 auto' }}>

          {/* Stat cards — always visible */}
          <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
            {statCards.map(({ label, value, sub, color, bg, action }) => (
              <div key={label} onClick={action || undefined}
                style={{ background: bg, borderRadius: 8, border: `1px solid ${color}33`, padding: '10px 14px', cursor: action ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (action) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.1, wordBreak: 'break-word' }}>{value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Overview tab — FY chart + weather */}
          {dashTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* FY Sales chart + revenue target */}
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📊 FY Sales</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {fyData && <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(fyData.reduce((s, m) => s + m.revenue, 0))}</div>}
                    <button onClick={() => { setFyData(null); loadFyChart(true) }}
                      style={{ padding: '3px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>🔄</button>
                  </div>
                </div>
                {fyLoading
                  ? <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>Loading sales...</div>
                  : fyError
                    ? <div style={{ color: '#dc2626', fontSize: 12 }}>⚠️ {fyError}</div>
                    : fyData && (() => {
                        const maxRev = Math.max(...fyData.map(m => m.revenue), 1)
                        const fyTotal = fyData.reduce((s, m) => s + m.revenue, 0)
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, paddingBottom: 20, paddingLeft: 40, position: 'relative' }}>
                              {[0.5, 1].map(pct => (
                                <div key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + pct * 94, pointerEvents: 'none' }}>
                                  <span style={{ fontSize: 8, color: '#94a3b8', position: 'absolute', left: 0, top: -5, whiteSpace: 'nowrap' }}>{fmt(maxRev * pct)}</span>
                                  <div style={{ position: 'absolute', left: 36, right: 0, borderTop: '1px dashed #f1f5f9' }} />
                                </div>
                              ))}
                              {fyData.map(m => {
                                const barH = Math.max(2, Math.round((m.revenue / maxRev) * 94))
                                return (
                                  <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                                    title={`${m.label}: ${fmt(m.revenue)}${m.partial ? ' (partial)' : ''}`}>
                                    <div style={{ width: '80%', height: barH, background: m.partial ? '#a78bfa' : '#7c3aed', borderRadius: '2px 2px 0 0', opacity: m.revenue === 0 ? 0.1 : 1 }} />
                                    <div style={{ fontSize: 8, color: m.partial ? '#7c3aed' : '#94a3b8', marginTop: 3 }}>{m.label}{m.partial ? '*' : ''}</div>
                                  </div>
                                )
                              })}
                            </div>
                            {revenueTarget && (() => {
                              const pct = Math.min(100, (fyTotal / revenueTarget) * 100)
                              const remaining = revenueTarget - fyTotal
                              const color = pct >= 100 ? '#16a34a' : pct >= 75 ? '#7c3aed' : pct >= 50 ? '#d97706' : '#dc2626'
                              return (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                                    <span style={{ color, fontWeight: 700 }}>Target: {pct.toFixed(1)}% of <span onClick={() => { setTargetInput(String(revenueTarget)); setEditingTarget(true) }} style={{ cursor: `pointer`, textDecoration: `underline dotted` }} title="Click to edit">{fmt(revenueTarget)}</span></span>
                                    <span style={{ color: remaining > 0 ? '#64748b' : '#16a34a' }}>{remaining > 0 ? `${fmt(remaining)} to go` : `🎉 Exceeded by ${fmt(-remaining)}`}</span>
                                  </div>
                                  <div style={{ background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                                  </div>
                                </div>
                              )
                            })()}
                            {!revenueTarget && !editingTarget && (
                              <button onClick={() => { setTargetInput(''); setEditingTarget(true) }}
                                style={{ marginTop: 6, fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }}>✎ Set revenue target</button>
                            )}
                            {editingTarget && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                                <span style={{ fontSize: 11, color: '#64748b' }}>$</span>
                                <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                                  style={{ width: 80, fontSize: 11, border: '1px solid #7c3aed', borderRadius: 4, padding: '2px 6px' }}
                                  onKeyDown={e => e.key === 'Enter' && saveRevenueTarget(targetInput)} autoFocus />
                                <button onClick={() => saveRevenueTarget(targetInput)}
                                  style={{ fontSize: 10, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingTarget(false)}
                                  style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                              </div>
                            )}
                          </div>
                        )
                      })()
                }
              </div>

              {/* Weather */}
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>🌤️ Trading Weather</div>
                  <button onClick={() => { setWeatherData(null); loadWeather() }}
                    style={{ padding: '3px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>🔄</button>
                </div>
                {weatherLoading
                  ? <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading weather...</div>
                  : (() => {
                      const WMO = { 0:'☀️ Clear', 1:'🌤️ Mostly Clear', 2:'⛅ Partly Cloudy', 3:'☁️ Overcast', 45:'🌫️ Foggy', 48:'🌫️ Icy Fog', 51:'🌦️ Light Drizzle', 53:'🌦️ Drizzle', 55:'🌧️ Heavy Drizzle', 61:'🌧️ Light Rain', 63:'🌧️ Rain', 65:'🌧️ Heavy Rain', 80:'🌦️ Showers', 81:'🌧️ Showers', 82:'⛈️ Heavy Showers', 95:'⛈️ Thunderstorm', 96:'⛈️ Thunderstorm', 99:'⛈️ Thunderstorm' }
                      const dayName = d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                      const days = weatherData || []
                      const rainColor = r => r >= 70 ? '#dc2626' : r >= 40 ? '#d97706' : '#16a34a'
                      if (days.length === 0) return <div style={{ color: '#94a3b8', fontSize: 12 }}>Weather data unavailable</div>
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                          {days.map(d => {
                            const isTrading = tradingDays.includes(d.dayOfWeek)
                            return (
                              <div key={d.date} style={{ background: isTrading ? '#eff6ff' : '#f8fafc', border: `1px solid ${isTrading ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>{new Date(d.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' })}</div>
                                  {isTrading && <span style={{ fontSize: 8, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '0 3px', borderRadius: 2 }}>BAR</span>}
                                </div>
                                <div style={{ fontSize: 16, margin: '2px 0' }}>{(WMO[d.code] || '🌡️').split(' ')[0]}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{d.max}°<span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 9 }}>/{d.min}°</span></div>
                                <div style={{ fontSize: 9, color: rainColor(d.rain), fontWeight: 600, marginTop: 2 }}>💧{d.rain}%</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()
                }
              </div>

            </div>
          )}

          {/* Stock Alerts tab */}
          {dashTab === 'alerts' && (
            alertItems.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#16a34a', fontSize: 14 }}>✅ All items are at target stock levels</div>
              : <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Status','Item','Category','Supplier','On Hand','Target','To Order'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Status' ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alertItems.map((item, i) => {
                        const isCrit = item.priority === 'CRITICAL'
                        const isOnOrder = !!orderedItems[item.name]
                        return (
                          <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: isCrit ? '#fee2e2' : '#fef9c3', color: isCrit ? '#991b1b' : '#854d0e' }}>{isCrit ? 'CRITICAL' : 'LOW'}</span>
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                              {item.name}
                              {isOnOrder && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#16a34a' }}>🛒 On Order</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.category}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.supplier || '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: isCrit ? '#dc2626' : '#d97706' }}>{item.onHand ?? '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#64748b' }}>{item.targetStock ?? '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: isOnOrder ? '#16a34a' : '#2563eb', fontWeight: item.orderQty > 0 ? 700 : 400 }}>
                              {isOnOrder ? '✓ Ordered' : item.orderQty > 0 ? item.orderQty : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
                    <button onClick={() => onNav('reorder')} style={{ padding: '6px 14px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      📦 Open Reorder Planner
                    </button>
                  </div>
                </div>
          )}


          <div style={{ marginTop: 14, fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
            Paynter Bar Hub · GemLife Palmwoods · {totalItems} items tracked
          </div>
        </div>
      </div>
    </div>
  )
}
