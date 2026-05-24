// DashboardView.jsx — extracted from pages/index.js
import React from 'react'

export default function DashboardView({ items, lastUpdated, onNav, onStartOrder, orderedItems = {}, rundownItems = {}, fromCache = false, orderCount: orderCountProp, critCount: critCountProp, onOrderCount: onOrderCountProp }) {
  const onOrderCount = onOrderCountProp ?? Object.keys(orderedItems).length
  const dontOrderRe  = /do\s*n'?t\s+order|do\s+not\s+order|do\s+not\s+restock|do\s*n'?t\s+restock/i
  const isRundown    = item => !!rundownItems[item.name]
  const critCount    = critCountProp ?? items.filter(i => i.priority === 'CRITICAL' && !isRundown(i) && !dontOrderRe.test(i.notes || '')).length
  const lowCount     = items.filter(i => i.priority === 'LOW' && !isRundown(i) && !dontOrderRe.test(i.notes || '')).length
  const orderCount   = orderCountProp ?? items.filter(i => i.orderQty > 0 && !orderedItems[i.name] && !isRundown(i) && !dontOrderRe.test(i.notes || '')).length
  const totalItems   = items.length

  const now = new Date()
  const refreshedAgo = lastUpdated ? (() => {
    const mins = Math.floor((now - new Date(lastUpdated)) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins/60)}h ${mins%60}m ago`
  })() : 'Not yet refreshed'

  const statCards = [
    { label: 'Critical',  value: critCount,    sub: 'below target',      color: '#dc2626', bg: '#fef2f2', action: () => onNav('reorder') },
    { label: 'Low Stock', value: lowCount,     sub: 'running low',       color: '#d97706', bg: '#fffbeb', action: () => onNav('reorder') },
    { label: 'To Order',  value: orderCount,   sub: 'need ordering',     color: '#2563eb', bg: '#eff6ff', action: () => onNav('reorder') },
    { label: 'On Order',  value: onOrderCount, sub: 'awaiting delivery', color: '#16a34a', bg: '#f0fdf4', action: () => onNav('reorder') },
    { label: 'Refreshed', value: refreshedAgo, sub: fromCache ? '📦 cached data' : '✅ live from Square', color: fromCache ? '#d97706' : '#475569', bg: fromCache ? '#fffbeb' : '#f8fafc', action: null },
  ]

  const alertItems = items
    .filter(i => (i.priority === 'CRITICAL' || i.priority === 'LOW') && !isRundown(i) && !dontOrderRe.test(i.notes || ''))
    .sort((a, b) => (a.priority === 'CRITICAL' ? 0 : 1) - (b.priority === 'CRITICAL' ? 0 : 1) || (a.onHand ?? 999) - (b.onHand ?? 999))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Weekly Order CTA */}
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

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 32px', maxWidth: 1100, margin: '0 auto' }}>

          {/* Stat cards */}
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

          {/* Stock Alerts */}
          {alertItems.length === 0
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
          }

          <div style={{ marginTop: 14, fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
            Paynter Bar Hub · GemLife Palmwoods · {totalItems} items tracked
          </div>
        </div>
      </div>
    </div>
  )
}
