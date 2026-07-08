// SohHistoryView.jsx — extracted from pages/index.js
import React, { useState, useEffect } from 'react'
import { loadExcelJS } from '../../../lib/excel/loadExcelJS'
import { xlsDownload } from '../../../lib/excel/xlsDownload'
import { xlsAOAtoWS } from '../../../lib/excel/xlsAOAtoWS'

export default function SohHistoryView({ readOnly, onExportPdf, onExportXlsx }) {
  const [reports, setReports]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting]   = useState(null)

  // ── Trend chart (inline SVG — no charting dependency) ────────────────────
  const [chartMode, setChartMode] = useState('value')   // 'value' | 'units'
  const [chartCat, setChartCat]   = useState('All')
  const [hover, setHover]         = useState(null)

  // Snapshots come back newest-first; the chart reads left-to-right oldest-first.
  const chronological = React.useMemo(() => [...reports].reverse(), [reports])

  const chartCategories = React.useMemo(() => {
    const set = new Set()
    for (const r of reports) for (const it of (r.data || [])) if (it.category) set.add(it.category)
    return ['All', ...[...set].sort()]
  }, [reports])

  const series = React.useMemo(() => chronological.map(r => {
    const items = chartCat === 'All' ? (r.data || []) : (r.data || []).filter(i => i.category === chartCat)
    const value = items.reduce((s, i) => s + (Number(i.totalValue) || 0), 0)
    const units = items.reduce((s, i) => s + (Number(i.onHand) || 0), 0)
    return {
      date: r.report_date,
      label: new Date(r.report_date + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
      value: Math.round(value * 100) / 100,
      units: Math.round(units * 100) / 100,
    }
  }), [chronological, chartCat])

  const chart = React.useMemo(() => {
    if (series.length === 0) return null
    const W = 900, H = 260
    const padL = 64, padR = 20, padT = 18, padB = 34
    const key = chartMode
    const vals = series.map(p => p[key])
    const rawMax = Math.max(...vals, 0)
    // Round the axis top up to something readable rather than a jagged max.
    const mag  = Math.pow(10, Math.max(0, String(Math.floor(rawMax)).length - 2))
    const maxY = rawMax === 0 ? 1 : Math.ceil(rawMax / mag) * mag
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    // With a single snapshot there's no span to divide by — pin it centre.
    const x = i => series.length === 1 ? padL + innerW / 2 : padL + (i / (series.length - 1)) * innerW
    const y = v => padT + innerH - (v / maxY) * innerH

    const pts = series.map((p, i) => ({ ...p, cx: x(i), cy: y(p[key]) }))
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ')
    const area = `${line} L ${pts[pts.length - 1].cx.toFixed(1)} ${padT + innerH} L ${pts[0].cx.toFixed(1)} ${padT + innerH} Z`

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const v = (maxY / 4) * i
      return { v, y: y(v) }
    })
    return { W, H, padL, padR, padT, padB, innerH, pts, line, area, ticks, maxY }
  }, [series, chartMode])

  const fmtAxis = v => chartMode === 'value'
    ? (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(v)}`)
    : `${Math.round(v)}`
  const fmtFull = v => chartMode === 'value'
    ? `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${Number(v).toLocaleString('en-AU')} units`

  const btn = active => ({
    padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 6,
    border: '1px solid ' + (active ? '#0e7490' : '#e2e8f0'),
    background: active ? '#0e7490' : '#fff',
    color: active ? '#fff' : '#475569',
  })

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)
    try {
      const r = await fetch('/api/soh-history')
      const d = await r.json()
      setReports(d.reports || [])
    } finally { setLoading(false) }
  }

  async function runNow() {
    if (!confirm('Generate a SOH snapshot now?')) return
    setGenerating(true)
    try {
      // ?manual=true bypasses the month-end-only guard in the cron handler
      const r = await fetch('/api/cron/soh-snapshot?manual=true')
      const d = await r.json()
      if (d.ok) { alert(`Snapshot saved: ${d.items} items, $${d.total_value}`); await loadReports() }
      else alert('Error: ' + (d.error || 'unknown'))
    } finally { setGenerating(false) }
  }

  async function deleteReport(report) {
    const dateStr = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
    if (!confirm(`Delete the snapshot for ${dateStr}?\n\nThis cannot be undone.`)) return
    setDeleting(report.id)
    try {
      const r = await fetch('/api/soh-history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id }),
      })
      const d = await r.json()
      if (d.ok) {
        setReports(prev => prev.filter(rpt => rpt.id !== report.id))
        if (expanded === report.id) setExpanded(null)
      } else {
        alert('Delete failed: ' + (d.error || 'unknown'))
      }
    } finally { setDeleting(null) }
  }

  async function downloadReport(report) {
    await loadExcelJS()

    const NAVY = '1E3A5F'; const WHITE = 'FFFFFF'; const GOLD = 'C8A84B'
    const LGREY = 'F1F5F9'; const DGREY = '334155'; const MGREY = 'E2E8F0'

    const hdr = (v, right) => ({ v, s: { font: { bold: true, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: right ? 'right' : 'left' } } })
    const cat = v => ({ v, s: { font: { bold: true, color: { rgb: WHITE } }, fill: { fgColor: { rgb: DGREY } } } })
    const num = (v, i) => ({ v: v || '', s: { fill: { fgColor: { rgb: i % 2 === 0 ? LGREY : WHITE } }, alignment: { horizontal: 'right' } }, t: typeof v === 'number' ? 'n' : 's' })
    const cur = (v, i) => ({ v: v || '', s: { fill: { fgColor: { rgb: i % 2 === 0 ? LGREY : WHITE } }, alignment: { horizontal: 'right' }, numFmt: '$#,##0.00' }, t: typeof v === 'number' ? 'n' : 's' })
    const txt = (v, i) => ({ v: v || '', s: { fill: { fgColor: { rgb: i % 2 === 0 ? LGREY : WHITE } } } })
    const sub = v => ({ v: v || '', s: { font: { bold: true }, fill: { fgColor: { rgb: MGREY } }, alignment: { horizontal: 'right' }, numFmt: '$#,##0.00' }, t: typeof v === 'number' ? 'n' : 's' })
    const empty = bg => ({ v: '', s: { fill: { fgColor: { rgb: bg || WHITE } } } })

    const reportDateStr = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
    const rows = []

    rows.push([{ v: `Paynter Bar — Stock on Hand as at ${reportDateStr}`, s: { font: { bold: true, sz: 14, color: { rgb: NAVY } } } }, ...Array(6).fill(empty())])
    rows.push([{ v: `GemLife Palmwoods  ·  ${report.items_count} items  ·  Total Inventory Value: $${Number(report.total_value).toFixed(2)}`, s: { font: { sz: 10, color: { rgb: '64748B' }, italic: true } } }, ...Array(6).fill(empty())])
    rows.push([{ v: `Generated: ${new Date(report.generated_at).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} AEST`, s: { font: { sz: 9, color: { rgb: '94A3B8' } } } }, ...Array(6).fill(empty())])
    rows.push(Array(7).fill(empty()))
    rows.push([hdr('Item'), hdr('Category'), hdr('Supplier'), hdr('On Hand', true), hdr('Wkly Avg', true), hdr('Buy Price', true), hdr('Total Value', true)])

    const cats = {}
    const CAT_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    for (const item of report.data) { const c2 = item.category || 'Other'; if (!cats[c2]) cats[c2] = []; cats[c2].push(item) }
    const sorted = [...CAT_ORDER.filter(c2 => cats[c2]), ...Object.keys(cats).filter(c2 => !CAT_ORDER.includes(c2))]

    for (const catName of sorted) {
      const items = cats[catName]
      rows.push([cat(catName.toUpperCase()), ...Array(6).fill(cat(''))])
      let catTotal = 0
      items.forEach((item, i) => {
        const tv = item.buyPrice && item.onHand > 0 ? Math.round(Number(item.buyPrice) * Number(item.onHand) * 100) / 100 : null
        if (tv) catTotal += tv
        rows.push([txt(item.name, i), txt(item.category, i), txt(item.supplier, i), num(item.onHand, i), num(item.weeklyAvg, i), cur(item.buyPrice || null, i), cur(tv, i)])
      })
      rows.push([{ v: `${catName} Subtotal`, s: { font: { bold: true }, fill: { fgColor: { rgb: MGREY } } } }, empty(MGREY), empty(MGREY), empty(MGREY), empty(MGREY), empty(MGREY), sub(catTotal || '')])
      rows.push(Array(7).fill(empty()))
    }

    rows.push([
      { v: 'GRAND TOTAL', s: { font: { bold: true, sz: 12, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } } } },
      ...Array(5).fill({ v: '', s: { fill: { fgColor: { rgb: NAVY } } } }),
      { v: Number(report.total_value), s: { font: { bold: true, sz: 12, color: { rgb: GOLD } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: 'right' }, numFmt: '$#,##0.00' } }
    ])

    const wb = new window.ExcelJS.Workbook()
    xlsAOAtoWS(wb, rows, 'SOH Report', {
      cols: [{ wch:40 },{ wch:20 },{ wch:18 },{ wch:12 },{ wch:12 },{ wch:14 },{ wch:16 }],
      rowHeights: [{ hpt:28 }, { hpt:16 }, { hpt:14 }],
      merges: [{ s:{r:0,c:0}, e:{r:0,c:6} }, { s:{r:1,c:0}, e:{r:1,c:6} }, { s:{r:2,c:0}, e:{r:2,c:6} }],
      freeze: 5,
    })
    await xlsDownload(wb, `SOH_${report.report_date}.xlsx`)
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>🗓️ SOH History</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Monthly stock on hand snapshots — auto-generated 2am AEST on the 1st of each month</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!readOnly && onExportPdf && (
            <button onClick={onExportPdf}
              style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🖨️ Print / PDF
            </button>
          )}
          {!readOnly && onExportXlsx && (
            <button onClick={onExportXlsx}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              📊 Export Excel
            </button>
          )}
          {!readOnly && (
            <button onClick={runNow} disabled={generating}
              style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {generating ? 'Generating...' : '📸 Snapshot Now'}
            </button>
          )}
        </div>
      </div>

      {/* Trend chart */}
      {!loading && reports.length > 0 && chart && (
        <div style={{ marginBottom: 18, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', flex: 1 }}>
              📈 Stock Trend
              <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>
                {series.length} snapshot{series.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setChartMode('value')} style={btn(chartMode === 'value')}>$ Value</button>
              <button onClick={() => setChartMode('units')} style={btn(chartMode === 'units')}>Units</button>
            </div>
            <select value={chartCat} onChange={e => setChartCat(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
              {chartCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
            </select>
          </div>

          {series.length === 1 && (
            <div style={{ fontSize: 12, color: '#92400e', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              Only one snapshot so far — the trend line appears once there are at least two.
            </div>
          )}

          <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox={`0 0 ${chart.W} ${chart.H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
                 onMouseLeave={() => setHover(null)}>
              <defs>
                <linearGradient id="sohFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0e7490" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0e7490" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* gridlines + y axis labels */}
              {chart.ticks.map((t, i) => (
                <g key={i}>
                  <line x1={chart.padL} x2={chart.W - chart.padR} y1={t.y} y2={t.y}
                        stroke="#f1f5f9" strokeWidth="1" />
                  <text x={chart.padL - 10} y={t.y + 4} textAnchor="end"
                        fontSize="11" fill="#94a3b8" fontFamily="system-ui">{fmtAxis(t.v)}</text>
                </g>
              ))}

              {/* area + line */}
              {chart.pts.length > 1 && <path d={chart.area} fill="url(#sohFill)" />}
              {chart.pts.length > 1 && (
                <path d={chart.line} fill="none" stroke="#0e7490" strokeWidth="2.5"
                      strokeLinejoin="round" strokeLinecap="round" />
              )}

              {/* points + hover targets + x labels */}
              {chart.pts.map((p, i) => (
                <g key={p.date}>
                  <circle cx={p.cx} cy={p.cy} r={hover === i ? 5.5 : 3.5}
                          fill="#fff" stroke="#0e7490" strokeWidth="2.5" />
                  <rect x={p.cx - 22} y={chart.padT} width="44" height={chart.innerH}
                        fill="transparent" style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHover(i)} />
                  <text x={p.cx} y={chart.H - 12} textAnchor="middle"
                        fontSize="11" fill="#94a3b8" fontFamily="system-ui">{p.label}</text>
                </g>
              ))}

              {/* hover marker */}
              {hover != null && chart.pts[hover] && (
                <line x1={chart.pts[hover].cx} x2={chart.pts[hover].cx}
                      y1={chart.padT} y2={chart.padT + chart.innerH}
                      stroke="#0e7490" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              )}
            </svg>

            {/* tooltip */}
            {hover != null && chart.pts[hover] && (
              <div style={{
                position: 'absolute',
                left: `${(chart.pts[hover].cx / chart.W) * 100}%`,
                top: `${(chart.pts[hover].cy / chart.H) * 100}%`,
                transform: 'translate(-50%, -130%)',
                background: '#0f172a', color: '#fff', padding: '6px 10px', borderRadius: 6,
                fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontWeight: 700 }}>{fmtFull(chart.pts[hover][chartMode])}</div>
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  {new Date(chart.pts[hover].date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            )}
          </div>

          {/* change since previous snapshot */}
          {series.length > 1 && (() => {
            const last = series[series.length - 1][chartMode]
            const prev = series[series.length - 2][chartMode]
            const diff = last - prev
            const pct  = prev === 0 ? null : (diff / prev) * 100
            const up   = diff > 0
            const flat = Math.abs(diff) < 0.005
            return (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
                <div><span style={{ color: '#94a3b8' }}>Latest: </span>
                  <strong style={{ color: '#0f172a' }}>{fmtFull(last)}</strong></div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Change: </span>
                  <strong style={{ color: flat ? '#64748b' : up ? '#16a34a' : '#dc2626' }}>
                    {flat ? '—' : `${up ? '+' : ''}${fmtFull(diff)}`}
                    {pct != null && !flat && ` (${up ? '+' : ''}${pct.toFixed(1)}%)`}
                  </strong>
                  <span style={{ color: '#94a3b8' }}> vs previous</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading...</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
          <div style={{ fontSize: 15 }}>No snapshots yet — click Snapshot Now to create the first one</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map(report => (
            <div key={report.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', background: '#f8fafc', cursor: 'pointer', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    {new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {report.items_count} items · Generated {new Date(report.generated_at).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} AEST
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>
                  ${Number(report.total_value).toFixed(2)}
                </div>
                <button onClick={e => { e.stopPropagation(); downloadReport(report) }}
                  style={{ padding: '6px 14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  📊 Excel
                </button>
                {!readOnly && (
                  <button onClick={e => { e.stopPropagation(); deleteReport(report) }}
                    disabled={deleting === report.id}
                    style={{ padding: '6px 12px', background: deleting === report.id ? '#f1f5f9' : '#fef2f2', color: deleting === report.id ? '#94a3b8' : '#dc2626', border: '1px solid ' + (deleting === report.id ? '#e2e8f0' : '#fca5a5'), borderRadius: 6, fontSize: 12, cursor: deleting === report.id ? 'default' : 'pointer', fontWeight: 600 }}>
                    {deleting === report.id ? '...' : '🗑️'}
                  </button>
                )}
                <span style={{ color: '#94a3b8', fontSize: 14 }}>{expanded === report.id ? '▲' : '▼'}</span>
              </div>
              {expanded === report.id && (
                <div style={{ padding: '0 18px 14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#fff' }}>
                        {['Item','Category','On Hand','Wkly Avg','Buy Price','Total Value'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Item' || h === 'Category' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.map((item, i) => (
                        <tr key={item.name} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 10px', fontWeight: 500 }}>{item.name}</td>
                          <td style={{ padding: '5px 10px', color: '#64748b' }}>{item.category}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{item.onHand}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{item.weeklyAvg}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{item.buyPrice ? '$' + Number(item.buyPrice).toFixed(2) : '—'}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: item.totalValue ? '#16a34a' : '#94a3b8' }}>{item.totalValue ? '$' + Number(item.totalValue).toFixed(2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
