// SalesView.jsx
import React, { useState } from 'react'
import { styles } from '../../../lib/barStyles'
import { CATEGORY_ORDER_LIST } from '../../../lib/constants'

export default function SalesView({ period, setPeriod, custom, setCustom, report, loading, error, category, setCategory, sort, setSort, onLoad, onExportPdf, onExportXlsx, exportLoading, showDetails }) {
  const [showComparison, setShowComparison] = useState(false)

  const fmt = n => n == null ? '-' : `$${Number(n).toFixed(2)}`
  const fmtChange = n => {
    if (n == null) return null
    const sign = n >= 0 ? '+' : ''
    const color = n >= 0 ? '#16a34a' : '#dc2626'
    return <span style={{ fontSize: 11, color, fontWeight: 700 }}>{sign}{n}%</span>
  }

  const filteredItems = report
    ? report.items
        .filter(i => category === 'All' || i.category === category)
        .sort((a, b) => sort === 'revenue' ? ((b.revenue || 0) - (a.revenue || 0)) : (b.unitsSold - a.unitsSold))
    : []

  const totals = filteredItems.reduce(
    (acc, i) => ({ units: acc.units + i.unitsSold, bottles: acc.bottles + (i.bottlesSold || 0), prev: acc.prev + i.prevSold, rev: acc.rev + (i.revenue || 0), prevRev: acc.prevRev + (i.prevRev || 0) }),
    { units: 0, bottles: 0, prev: 0, rev: 0, prevRev: 0 }
  )

  const hasRev     = report && report.items.some(i => i.revenue != null)
  const hasBottles = report && report.items.some(i => i.bottlesSold > 0)
  const showCat = category === 'All'
  const soldItems = filteredItems.filter(i => i.unitsSold > 0)
  const avgTx = hasRev && totals.units > 0 ? (totals.rev / totals.units) : null

  return (
    <div className="view-wrap" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Period + export — single compact row ────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['month','This Month'],['lastmonth','Last Month'],['3months','Last 3 Months'],['financialYear','Financial Year (May – Apr)'],['day','Single Day'],['custom','Custom Range']].map(([val, label]) => (
          <button key={val}
            style={{ ...styles.tab, padding: '5px 11px', fontSize: 12, ...(period === val ? styles.tabActive : {}) }}
            onClick={() => { setPeriod(val); if (val !== 'custom' && val !== 'day') onLoad(val, custom) }}>
            {label}
          </button>
        ))}
        {period === 'day' && (
          <input type="date" value={custom.day || ''} onChange={e => { const c2 = {...custom, day: e.target.value}; setCustom(c2); if (e.target.value) onLoad('day', c2) }}
            style={{ ...styles.supplierInput, width: 150 }} />
        )}
        {period === 'custom' && (
          <>
            <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))} style={{ ...styles.supplierInput, width: 140 }} />
            <span style={{ color: '#64748b', fontSize: 12 }}>to</span>
            <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))} style={{ ...styles.supplierInput, width: 140 }} />
            <button style={{ ...styles.btn, padding: '5px 14px', fontSize: 12 }} onClick={() => onLoad('custom', custom)}>Load</button>
          </>
        )}
        {report && !loading && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
            <button onClick={onExportPdf} disabled={exportLoading}
              style={{ padding: '5px 12px', background: exportLoading ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: exportLoading ? 'not-allowed' : 'pointer' }}>
              {exportLoading ? '...' : '🖨️ Print / PDF'}
            </button>
            <button onClick={onExportXlsx} disabled={exportLoading}
              style={{ padding: '5px 12px', background: exportLoading ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: exportLoading ? 'not-allowed' : 'pointer' }}>
              {exportLoading ? '...' : '📊 Excel'}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <div style={{ ...styles.spinner, margin: '0 auto 16px' }} />
          Fetching sales data from Square...
        </div>
      )}

      {error && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}

      {report && !loading && (
        <>
          {/* ── KPI strip + category pills — single combined row ────────── */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 14px' }}>

            {/* KPI cards */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              {[
                { label: 'Units Sold',   value: totals.units,         prev: totals.prev,    money: false },
                ...(hasRev ? [{ label: 'Revenue', value: fmt(totals.rev), prev: totals.prevRev, money: true, rawVal: totals.rev, rawPrev: totals.prevRev }] : []),
                { label: 'Items Sold',   value: soldItems.length,     noChange: true },
                ...(avgTx != null ? [{ label: 'Avg / Unit', value: fmt(avgTx), noChange: true }] : []),
              ].map(({ label, value, prev, money, rawVal, rawPrev, noChange }, i, arr) => {
                const numVal  = money ? (rawVal  ?? 0) : (typeof value === 'number' ? value : 0)
                const numPrev = money ? (rawPrev ?? 0) : (typeof prev  === 'number' ? prev  : 0)
                const chg = (!noChange && numPrev > 0) ? +(((numVal - numPrev) / numPrev) * 100).toFixed(1) : null
                return (
                  <div key={label} style={{ flex: 1, paddingRight: 14, marginRight: 14, borderRight: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
                    {!noChange && prev != null && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                        Prior: {money ? fmt(rawPrev) : prev}
                        {chg != null && <span style={{ marginLeft: 4, color: chg >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{chg >= 0 ? '+' : ''}{chg}%</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Category pills */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2 }}>Filter:</span>
              <button onClick={() => setCategory('All')}
                style={{ padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  background: category === 'All' ? '#1e3a5f' : '#f1f5f9', color: category === 'All' ? '#fff' : '#374151' }}>
                All
              </button>
              {CATEGORY_ORDER_LIST.filter(c => report.categories[c]).map(c => {
                const active = category === c
                const cat = report.categories[c]
                return (
                  <button key={c} onClick={() => setCategory(active ? 'All' : c)}
                    style={{ padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: active ? '#1e3a5f' : '#f1f5f9', color: active ? '#fff' : '#374151' }}>
                    {c} <span style={{ opacity: 0.65 }}>· {cat.unitsSold}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Item table ──────────────────────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {category === 'All' ? 'All Items' : category} — {soldItems.length} items sold
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setShowComparison(v => !v)}
                  style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: showComparison ? '#eff6ff' : '#f8fafc', color: showComparison ? '#1d4ed8' : '#64748b' }}>
                  {showComparison ? '▾ Hide comparison' : '▸ Show comparison'}
                </button>
                <span style={{ fontSize: 12, color: '#64748b' }}>Sort:</span>
                {[['units','By Units'],['revenue','By Revenue']].map(([val, label]) => (
                  (!hasRev && val === 'revenue') ? null :
                  <button key={val}
                    style={{ ...styles.tab, padding: '3px 10px', fontSize: 12, ...(sort === val ? styles.tabActive : {}) }}
                    onClick={() => setSort(val)}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
              <table style={{ ...styles.table, fontSize: 13 }}>
                <thead>
                  <tr style={{ ...styles.thead, position: 'sticky', top: 0, zIndex: 2 }}>
                    <th style={{ ...styles.th, width: 28, textAlign: 'right' }}>#</th>
                    <th style={styles.th}>Item</th>
                    {showCat && <th style={styles.th}>Category</th>}
                    <th style={{ ...styles.th, textAlign: 'right' }}>Glasses</th>
                    {hasBottles && <th style={{ ...styles.th, textAlign: 'right' }}>Bottles</th>}
                    {showComparison && <th style={{ ...styles.th, textAlign: 'right' }}>Prior Period</th>}
                    {showComparison && <th style={{ ...styles.th, textAlign: 'right' }}>Change</th>}
                    {hasRev && <th style={{ ...styles.th, textAlign: 'right', color: '#16a34a' }}>Revenue</th>}
                    {hasRev && showComparison && <th style={{ ...styles.th, textAlign: 'right', color: '#94a3b8' }}>Prior Rev</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.filter(i => i.unitsSold > 0 || i.prevSold > 0).map((item, idx) => (
                    <tr key={item.name} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 500 }}>{item.name}</td>
                      {showCat && <td style={{ ...styles.td, color: '#64748b', fontSize: 12 }}>{item.category}</td>}
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                        {item.unitsSold || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      {hasBottles && (
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#7c3aed' }}>
                          {item.bottlesSold > 0 ? item.bottlesSold : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      )}
                      {showComparison && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>{item.prevSold || 0}</td>}
                      {showComparison && <td style={{ ...styles.td, textAlign: 'right' }}>{fmtChange(item.change)}</td>}
                      {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#16a34a', fontWeight: 600 }}>{fmt(item.revenue)}</td>}
                      {hasRev && showComparison && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8' }}>{fmt(item.prevRev)}</td>}
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9' }}>
                    <td style={styles.td} />
                    <td style={{ ...styles.td, fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                    {showCat && <td style={styles.td} />}
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15 }}>{totals.units}</td>
                    {hasBottles && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#7c3aed' }}>{totals.bottles}</td>}
                    {showComparison && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>{totals.prev}</td>}
                    {showComparison && <td style={styles.td} />}
                    {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: '#16a34a' }}>{fmt(totals.rev)}</td>}
                    {hasRev && showComparison && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8' }}>{fmt(totals.prevRev)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
