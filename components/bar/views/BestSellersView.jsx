// BestSellersView.jsx — extracted from pages/index.js
import React from 'react'
import { styles } from '../../../lib/barStyles'

export default function BestSellersView({ items, salesData, loading, error, daysBack = 90 }) {
  const today = new Date()

  // Build sales map from Orders API data
  const salesMap = {}
  if (salesData) {
    for (const item of salesData.items || []) {
      salesMap[item.name] = (salesMap[item.name] || 0) + item.unitsSold
    }
  }

  const withData = items.filter(i => i.weeklyAvg != null)
  const sorted   = [...withData].sort((a, b) => (b.weeklyAvg || 0) - (a.weeklyAvg || 0))
  const top10    = sorted.slice(0, 10)
  const maxAvg   = top10[0]?.weeklyAvg || 1

  // Slow sellers: has stock, sold in period but in bottom 25% by units
  const itemsWithSales = salesData
    ? withData
        .filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) > 0)
        .sort((a, b) => (salesMap[a.name] || 0) - (salesMap[b.name] || 0))
    : []
  const slowCutoff = Math.ceil(itemsWithSales.length * 0.25)
  const slowSellers = itemsWithSales.slice(0, slowCutoff)

  // Not selling at all: has stock, zero sales in period
  const notSelling = salesData
    ? withData.filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) === 0)
        .sort((a, b) => (b.onHand || 0) - (a.onHand || 0))
    : []

  // Consistent stars: top 20% weekly avg that also appear in Orders API sales
  const avgThreshold = sorted[Math.floor(sorted.length * 0.2)]?.weeklyAvg || 0
  const consistent = sorted.filter(i =>
    (i.weeklyAvg || 0) >= avgThreshold && (salesData ? (salesMap[i.name] || 0) > 0 : true)
  )

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64, color: '#64748b' }}>
      <div style={{ ...styles.spinner, margin: '0 auto 16px' }} />
      Loading {daysBack} days of sales data from Square...
    </div>
  )

  if (error) return <div style={{ ...styles.errorBox, margin: 24 }}><strong>Error:</strong> {error}</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', alignSelf: 'center', fontWeight: 600 }}>
          📅 {daysBack}-day period
        </div>
        {[
          { label: 'Top Seller',      value: top10[0]?.name.split(' ').slice(0,3).join(' ') || '—', sub: top10[0] ? `${top10[0].weeklyAvg} / week` : '', color: '#16a34a' },
          { label: 'Items Tracked',   value: withData.length,   sub: `${items.length} total`,              color: '#2563eb' },
          { label: 'Slow Sellers',    value: slowSellers.length, sub: 'bottom 25% with stock',             color: '#d97706' },
          { label: 'Not Selling',     value: notSelling.length,  sub: 'zero sales, has stock',             color: '#dc2626' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 18px', flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Top 10 sellers */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: '#14532d', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            🏆 Top 10 Sellers — Weekly Average
          </div>
          {top10.map((item, idx) => {
            const barPct = Math.round((item.weeklyAvg / maxAvg) * 100)
            return (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: idx < 9 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ marginTop: 3, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: '#16a34a', borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{item.weeklyAvg}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>/wk</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Slow sellers */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#92400e', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🐢 Slow Sellers — Bottom 25% (Last 90 Days)
            </div>
            {slowSellers.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {salesData ? 'No slow sellers identified ✓' : 'Loading...'}
              </div>
            ) : slowSellers.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: idx < slowSellers.length - 1 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fffbeb' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category} · {item.onHand} in stock</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#d97706' }}>{salesMap[item.name] || 0}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>units / 90 days</div>
                </div>
              </div>
            ))}
          </div>

          {/* Not selling */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#7f1d1d', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              ⚠️ Not Selling — Zero Sales, Has Stock
            </div>
            {notSelling.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {salesData ? 'Everything is selling ✓' : 'Loading...'}
              </div>
            ) : notSelling.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: idx < notSelling.length - 1 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fef2f2' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category} · {item.onHand} in stock</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>0 sold</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>last 90 days</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Based on Square Orders API · 90 day window · {salesData ? `${(salesData.items||[]).length} items analysed` : 'Loading...'}
      </div>
    </div>
  )
}
