// SalesView.jsx -- extracted from pages/index.js
import React from 'react'
import { styles } from '../../../lib/barStyles'
import { CATEGORY_ORDER_LIST } from '../../../lib/constants'

export default function SalesView({ period, setPeriod, custom, setCustom, report, loading, error, category, setCategory, sort, setSort, onLoad, onExportPdf, onExportXlsx, exportLoading, showDetails }) {
  const fmt = n => n == null ? '-' : `$${Number(n).toFixed(2)}`

  const fmtChange = n => {
    if (n == null) return null
    const sign = n >= 0 ? '+' : ''
    const color = n >= 0 ? '#16a34a' : '#dc2626'
    return <span style={{ fontSize: 11, color, fontWeight: 700 }}>{sign}{n}%</span>
  }

  const allCats = report
    ? ['All', ...CATEGORY_ORDER_LIST.filter(c => report.categories[c])]
    : ['All']

  const filteredItems = report
    ? report.items
        .filter(i => category === 'All' || i.category === category)
        .sort((a, b) => sort === 'revenue' ? ((b.revenue || 0) - (a.revenue || 0)) : (b.unitsSold - a.unitsSold))
    : []

  const totals = filteredItems.reduce(
    (acc, i) => ({ units: acc.units + i.unitsSold, prev: acc.prev + i.prevSold, rev: acc.rev + (i.revenue || 0), prevRev: acc.prevRev + (i.prevRev || 0) }),
    { units: 0, prev: 0, rev: 0, prevRev: 0 }
  )

  const hasRev = report && report.items.some(i => i.revenue != null)

  return (
    <div className="view-wrap" style={{ padding: '24px 32px' }}>
      {/* Period controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, background: '#fff', padding: '10px 20px', borderBottom: '1px solid #e2e8f0' }}>
        {[['month','This Month'],['lastmonth','Last Month'],['3months','Last 3 Months'],['financialYear','Financial Year (May – Apr)'],['day','Single Day'],['custom','Custom Range']].map(([val, label]) => (
          <button key={val}
            style={{ ...styles.tab, ...(period === val ? styles.tabActive : {}) }}
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
            <input type="date" value={custom.start} onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
              style={{ ...styles.supplierInput, width: 140 }} />
            <span style={{ color: '#64748b' }}>to</span>
            <input type="date" value={custom.end} onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
              style={{ ...styles.supplierInput, width: 140 }} />
            <button style={{ ...styles.btn, padding: '6px 16px', fontSize: 13 }}
              onClick={() => onLoad('custom', custom)}>Load</button>
          </>
        )}
      </div>

      {/* Export buttons */}
      {report && !loading && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 20px 0', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <button onClick={onExportPdf} disabled={exportLoading}
            style={{ padding: '6px 16px', background: exportLoading ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: exportLoading ? 'not-allowed' : 'pointer' }}>
            {exportLoading ? 'Loading...' : '🖨️ Print / PDF'}
          </button>
          <button onClick={onExportXlsx} disabled={exportLoading}
            style={{ padding: '6px 16px', background: exportLoading ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: exportLoading ? 'not-allowed' : 'pointer' }}>
            {exportLoading ? 'Loading...' : '📊 Excel'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <div style={{ ...styles.spinner, margin: '0 auto 16px' }} />
          Fetching sales data from Square...
        </div>
      )}

      {error && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}

      {report && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Units Sold',   value: totals.units,            prev: totals.prev,   money: false },
              ...(hasRev ? [{ label: 'Revenue', value: fmt(totals.rev), prev: totals.prevRev, money: true, rawVal: totals.rev, rawPrev: totals.prevRev }] : []),
              { label: 'Items Sold',  value: filteredItems.filter(i => i.unitsSold > 0).length, noChange: true },
              { label: 'Top Seller',  value: (filteredItems[0]?.name || '-').split(' ').slice(0,3).join(' '), noChange: true },
            ].map(({ label, value, prev, money, rawVal, rawPrev, noChange }) => {
              const numVal  = money ? (rawVal  ?? 0) : value
              const numPrev = money ? (rawPrev ?? 0) : prev
              const chg = (!noChange && numPrev > 0) ? +(((numVal - numPrev) / numPrev) * 100).toFixed(1) : null
              return (
                <div key={label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px', minWidth: 130, flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{value}</div>
                  {!noChange && prev != null && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Prior: {money ? fmt(rawPrev) : prev}
                      {chg != null && <span style={{ marginLeft: 6, color: chg >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{chg >= 0 ? '+' : ''}{chg}%</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Category bar */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 16px', marginBottom: 12, overflowX: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Category Breakdown — click to filter</div>
            <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
              {CATEGORY_ORDER_LIST.filter(c => report.categories[c]).map(c => {
                const cat = report.categories[c]
                const pct = report.totals.unitsSold > 0 ? Math.round((cat.unitsSold / report.totals.unitsSold) * 100) : 0
                const active = category === c
                return (
                  <button key={c} onClick={() => setCategory(active ? 'All' : c)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 12px', cursor: 'pointer', border: 'none', borderBottom: `3px solid ${active ? '#2563eb' : '#e2e8f0'}`, background: active ? '#eff6ff' : 'transparent', minWidth: 90 }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>{c}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{cat.unitsSold}</span>
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{pct}%</span>
                    {hasRev && cat.revenue > 0 && <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>{fmt(cat.revenue)}</span>}
                  </button>
                )
              })}
              <button onClick={() => setCategory('All')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 12px', cursor: 'pointer', border: 'none', borderBottom: `3px solid ${category === 'All' ? '#2563eb' : '#e2e8f0'}`, background: category === 'All' ? '#eff6ff' : 'transparent', minWidth: 70 }}>
                <span style={{ fontSize: 9, color: '#94a3b8', marginBottom: 1 }}>ALL</span>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: '#0f172a' }}>{report.totals.unitsSold}</span>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>100%</span>
                {hasRev && <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 600 }}>{fmt(report.totals.revenue)}</span>}
              </button>
            </div>
          </div>

          {/* Item table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {category === 'All' ? 'All Items' : category} — {filteredItems.filter(i => i.unitsSold > 0).length} items sold
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>Sort:</span>
                {[['units','By Units'],['revenue','By Revenue']].map(([val, label]) => (
                  (!hasRev && val === 'revenue') ? null :
                  <button key={val}
                    style={{ ...styles.tab, padding: '4px 12px', fontSize: 12, ...(sort === val ? styles.tabActive : {}) }}
                    onClick={() => setSort(val)}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table style={{ ...styles.table, fontSize: 13 }}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={{ ...styles.th, width: 28, textAlign: 'right' }}>#</th>
                    <th style={styles.th}>Item</th>
                    <th style={{ ...styles.th, display: showDetails ? '' : 'none' }}>Category</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Units Sold</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Prior Period</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Change</th>
                    {hasRev && <th style={{ ...styles.th, textAlign: 'right', color: '#16a34a' }}>Revenue</th>}
                    {hasRev && <th style={{ ...styles.th, textAlign: 'right', color: '#94a3b8' }}>Prior Rev</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.filter(i => i.unitsSold > 0 || i.prevSold > 0).map((item, idx) => (
                    <tr key={item.name} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>{idx + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 500 }}>{item.name}</td>
                      <td style={{ ...styles.td, color: '#64748b', fontSize: 12 }}>{item.category}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                        {item.unitsSold || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>{item.prevSold || 0}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmtChange(item.change)}</td>
                      {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#16a34a', fontWeight: 600 }}>{fmt(item.revenue)}</td>}
                      {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8' }}>{fmt(item.prevRev)}</td>}
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9' }}>
                    <td style={styles.td} />
                    <td style={{ ...styles.td, fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                    <td style={styles.td} />
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15 }}>{totals.units}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>{totals.prev}</td>
                    <td style={styles.td} />
                    {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: '#16a34a' }}>{fmt(totals.rev)}</td>}
                    {hasRev && <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#94a3b8' }}>{fmt(totals.prevRev)}</td>}
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
