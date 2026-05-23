// CategoryChart.jsx -- extracted from pages/index.js
import React from 'react'
import { TREND_CAT_COLORS, TREND_CHART_W, TREND_CHART_H, TREND_PAD_L, TREND_PAD_T, TREND_PAD_R, TREND_PAD_B } from '../../../lib/constants'

export default function CategoryChart({ cat, data, hasRev }) {
  const chartW = TREND_CHART_W, chartH = TREND_CHART_H, padL = TREND_PAD_L, padT = TREND_PAD_T, padR = TREND_PAD_R
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - TREND_PAD_B
  const vals   = data.map(q => q.categories[cat]?.unitsSold || 0)
  const revs   = data.map(q => q.categories[cat]?.revenue  || 0)
  const maxVal = Math.max(...vals, 1)
  const color  = TREND_CAT_COLORS[cat] || '#2563eb'
  const barW   = Math.floor(innerW / data.length) - 16
  const trend  = vals[vals.length-1] - vals[0]
  const trendColor = trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#64748b'
  const trendIcon  = trend > 0 ? '▲' : trend < 0 ? '▼' : '→'
  const total      = vals.reduce((s, v) => s + v, 0)

  const bars = data.map((q, i) => {
    const bh = Math.round((vals[i] / maxVal) * innerH)
    const x  = padL + i * (innerW / data.length) + 8
    const y  = padT + innerH - bh
    return (
      <g key={i}>
        <rect x={x} y={y} width={barW} height={bh} fill={color} rx={3} opacity={0.85}/>
        <text x={x + barW/2} y={y - 5} textAnchor="middle" fontSize={10} fill="#0f172a" fontWeight="600">{vals[i]}</text>
        <text x={x + barW/2} y={padT + innerH + 14} textAnchor="middle" fontSize={9} fill="#475569">{q.label.split(' ').slice(0,2).join(' ')}</text>
        {hasRev && <text x={x + barW/2} y={padT + innerH + 26} textAnchor="middle" fontSize={8} fill="#16a34a">${revs[i] ? revs[i].toFixed(0) : '—'}</text>}
      </g>
    )
  })

  const grids = [0.5, 1].map(pct => {
    const y   = padT + innerH - Math.round(pct * innerH)
    const val = Math.round(pct * maxVal)
    return (
      <g key={pct}>
        <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth={1}/>
        <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{val}</text>
      </g>
    )
  })

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: color }}/>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{cat}</span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>4-quarter total: <strong style={{ color: '#0f172a' }}>{total.toLocaleString()} units</strong></span>
          <span style={{ color: trendColor, fontWeight: 700 }}>{trendIcon} {Math.abs(trend)} units {trend >= 0 ? 'up' : 'down'} vs 4 qtrs ago</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + (hasRev ? 10 : 0)}`} style={{ overflow: 'visible' }}>
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1}/>
        <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1}/>
        {grids}
        {bars}
      </svg>
    </div>
  )
}
