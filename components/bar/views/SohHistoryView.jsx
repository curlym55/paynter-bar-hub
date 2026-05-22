// SohHistoryView.jsx — extracted from pages/index.js
import React, { useState, useEffect } from 'react'
import { loadExcelJS } from '../../../lib/excel/loadExcelJS'
import { xlsDownload } from '../../../lib/excel/xlsDownload'
import { xlsAOAtoWS } from '../../../lib/excel/xlsAOAtoWS'

export default function SohHistoryView() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [generating, setGenerating] = useState(false)

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
      const r = await fetch('/api/cron/soh-snapshot')
      const d = await r.json()
      if (d.ok) { alert(`Snapshot saved: ${d.items} items, $${d.total_value}`); await loadReports() }
      else alert('Error: ' + (d.error || 'unknown'))
    } finally { setGenerating(false) }
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
        <button onClick={runNow} disabled={generating}
          style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {generating ? 'Generating...' : '📸 Snapshot Now'}
        </button>
      </div>

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
                  style={{ padding: '6px 14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  CSV
                </button>
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
