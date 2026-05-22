// TrendsView.jsx — extracted from pages/index.js
import React from 'react'

export default function TrendsView({ data, loading, error }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>Loading quarterly data from Square...</div>
      <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>This may take a few seconds</div>
    </div>
  )
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
      <div style={{ fontSize: 14 }}>Could not load trend data: {error}</div>
    </div>
  )
  if (!data) return null

  const allCats    = CATEGORY_ORDER.filter(c => data.some(q => q.categories[c]))
  const hasRev     = data.some(q => q.totals.revenue > 0)
  const qLabels    = data.map(q => q.label)
  const grandTotals = data.map(q => q.totals.unitsSold)
  const maxGrand   = Math.max(...grandTotals, 1)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Quarterly Sales Trends</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Last 4 quarters — units sold by category</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {qLabels.map((q, i) => (
              <div key={i} style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '3px 8px', color: '#475569' }}>
                {q}: <strong>{grandTotals[i].toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
        <svg width="100%" viewBox="0 0 680 60" style={{ overflow: 'visible' }}>
          {data.map((q, i) => {
            const bh = Math.round((grandTotals[i] / maxGrand) * 40)
            const x  = 10 + i * 165
            const y  = 50 - bh
            return (
              <g key={i}>
                <rect x={x} y={y} width={150} height={bh} fill="#0f172a" rx={3} opacity={0.15}/>
                <rect x={x} y={y} width={150} height={bh} fill="#2563eb" rx={3} opacity={0.6}/>
                <text x={x + 75} y={y - 4} textAnchor="middle" fontSize={10} fill="#0f172a" fontWeight="700">{grandTotals[i].toLocaleString()}</text>
                <text x={x + 75} y={58} textAnchor="middle" fontSize={9} fill="#64748b">{q.label}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {allCats.map(cat => <CategoryChart key={cat} cat={cat} data={data} hasRev={hasRev} />)}
    </div>
  )
}
