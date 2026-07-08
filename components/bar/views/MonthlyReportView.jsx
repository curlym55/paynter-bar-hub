// MonthlyReportView.jsx — one-click monthly bar report
import React, { useState, useEffect } from 'react'
import { loadExcelJS } from '../../../lib/excel/loadExcelJS'
import { xlsDownload } from '../../../lib/excel/xlsDownload'
import { xlsAOAtoWS } from '../../../lib/excel/xlsAOAtoWS'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const money = n => `$${Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num   = n => Number(n || 0).toLocaleString('en-AU')

export default function MonthlyReportView() {
  // Default to the most recently completed month, not the current partial one.
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }))
  const defYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const defMonth = now.getMonth() === 0 ? 12 : now.getMonth() // getMonth() is 0-indexed → previous month

  const [year, setYear]       = useState(defYear)
  const [month, setMonth]     = useState(defMonth)
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  async function run() {
    setLoading(true); setError(null); setReport(null)
    try {
      const r = await fetch(`/api/monthly-report?year=${year}&month=${month}`)
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'Report failed')
      setReport(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { run() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function exportExcel() {
    if (!report) return
    await loadExcelJS()
    const NAVY='0F172A', TEAL='0E7490', WHITE='FFFFFF', GREY='64748B', GREEN='16A34A', RED='DC2626'
    const cell = (v, s) => ({ v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's' })
    const H  = { font:{bold:true,color:{rgb:WHITE},sz:10}, fill:{fgColor:{rgb:NAVY}}, alignment:{horizontal:'center'}, border:{bottom:{style:'medium',color:{rgb:TEAL}}} }
    const HL = { ...H, alignment:{horizontal:'left'} }
    const rows = [], merges = []

    rows.push([cell(`Paynter Bar — Monthly Report`, { font:{bold:true,sz:16,color:{rgb:NAVY}} })])
    rows.push([cell(report.period.label, { font:{sz:11,color:{rgb:GREY}} })])
    merges.push({ s:{r:0,c:0}, e:{r:0,c:4} }, { s:{r:1,c:0}, e:{r:1,c:4} })
    rows.push([])

    // Summary
    rows.push([cell('SUMMARY', HL), cell('', H), cell('', H), cell('', H), cell('', H)])
    merges.push({ s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:4} })
    const chg = report.sales.changePct
    rows.push([cell('Revenue', {font:{sz:10}}), cell(report.sales.revenue, {font:{sz:10,bold:true,color:{rgb:GREEN}}}),
               cell(`vs ${report.period.prevLabel}`, {font:{sz:9,color:{rgb:GREY}}}),
               cell(chg == null ? '—' : `${chg > 0 ? '+' : ''}${chg}%`, {font:{sz:10,bold:true,color:{rgb: chg==null?GREY : chg>=0?GREEN:RED}}}), cell('')])
    rows.push([cell('Units sold', {font:{sz:10}}), cell(report.sales.unitsSold, {font:{sz:10}}), cell(''), cell(''), cell('')])
    rows.push([cell('Wastage cost', {font:{sz:10}}), cell(report.wastage.totalCost, {font:{sz:10,bold:true,color:{rgb:RED}}}), cell(`${report.wastage.entryCount} entries`, {font:{sz:9,color:{rgb:GREY}}}), cell(''), cell('')])
    rows.push([cell('Revenue less wastage', {font:{sz:10}}), cell(report.summary.grossProfit, {font:{sz:10,bold:true}}), cell(''), cell(''), cell('')])
    rows.push([cell('Orders placed', {font:{sz:10}}), cell(report.purchases.orderCount, {font:{sz:10}}), cell(`${report.purchases.received} received, ${report.purchases.pending} pending`, {font:{sz:9,color:{rgb:GREY}}}), cell(''), cell('')])
    rows.push([cell('Average markup (excl. spirits)', {font:{sz:10}}), cell(report.pricing.avgMarkupPct == null ? '—' : `${report.pricing.avgMarkupPct}%`, {font:{sz:10}}), cell(`${report.pricing.itemsPriced} items priced`, {font:{sz:9,color:{rgb:GREY}}}), cell(''), cell('')])
    rows.push([cell('Spirits markup (per nip)', {font:{sz:10}}), cell(report.pricing.avgSpiritMarkupPct == null ? '—' : `${report.pricing.avgSpiritMarkupPct}%`, {font:{sz:10}}), cell(`${report.pricing.spiritsPriced} spirits`, {font:{sz:9,color:{rgb:GREY}}}), cell(''), cell('')])
    rows.push([])

    // Sales by category
    rows.push([cell('SALES BY CATEGORY', HL), cell('', H), cell('', H), cell('', H), cell('', H)])
    merges.push({ s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:4} })
    rows.push([cell('Category', HL), cell('Units', H), cell('Revenue', H), cell(`${report.period.prevLabel} rev`, H), cell('Change', H)])
    for (const c of report.sales.categories) {
      const d = c.prevRevenue > 0 ? ((c.revenue - c.prevRevenue) / c.prevRevenue) * 100 : null
      rows.push([cell(c.category,{font:{sz:10}}), cell(c.units,{alignment:{horizontal:'center'},font:{sz:10}}),
                 cell(c.revenue,{alignment:{horizontal:'right'},font:{sz:10,bold:true}}),
                 cell(c.prevRevenue,{alignment:{horizontal:'right'},font:{sz:10,color:{rgb:GREY}}}),
                 cell(d==null?'—':`${d>0?'+':''}${d.toFixed(1)}%`,{alignment:{horizontal:'center'},font:{sz:10,color:{rgb: d==null?GREY : d>=0?GREEN:RED}}})])
    }
    rows.push([])

    // Top items
    rows.push([cell('TOP ITEMS BY REVENUE', HL), cell('', H), cell('', H), cell('', H), cell('', H)])
    merges.push({ s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:4} })
    rows.push([cell('Item', HL), cell('Category', HL), cell('Units', H), cell('Revenue', H), cell('')])
    for (const i of report.sales.topItems) {
      rows.push([cell(i.name,{font:{sz:10}}), cell(i.category,{font:{sz:10,color:{rgb:GREY}}}),
                 cell(i.units,{alignment:{horizontal:'center'},font:{sz:10}}),
                 cell(i.revenue,{alignment:{horizontal:'right'},font:{sz:10,bold:true}}), cell('')])
    }
    rows.push([])

    // Wastage
    rows.push([cell('WASTAGE', HL), cell('', H), cell('', H), cell('', H), cell('', H)])
    merges.push({ s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:4} })
    rows.push([cell(report.wastage.valuationBasis, { font:{sz:9,italic:true,color:{rgb:GREY}} })])
    merges.push({ s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:4} })
    if (report.wastage.entries.length) {
      rows.push([cell('Item', HL), cell('Qty', H), cell('Reason', HL), cell('Cost', H), cell('Date', H)])
      for (const w of report.wastage.entries) {
        rows.push([cell(w.name,{font:{sz:10}}), cell(`${w.qty} ${w.unit}`,{alignment:{horizontal:'center'},font:{sz:10}}),
                   cell(w.reason,{font:{sz:10}}),
                   cell(w.cost == null ? '—' : w.cost,{alignment:{horizontal:'right'},font:{sz:10,color:{rgb: w.cost==null?GREY:RED}}}),
                   cell(new Date(w.date).toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short'}),{alignment:{horizontal:'center'},font:{sz:9,color:{rgb:GREY}}})])
      }
    } else {
      rows.push([cell('No wastage recorded this month.', { font:{sz:10,color:{rgb:GREY}} })])
    }
    rows.push([])

    // Orders
    rows.push([cell('ORDERS PLACED', HL), cell('', H), cell('', H), cell('', H), cell('', H)])
    merges.push({ s:{r:rows.length-1,c:0}, e:{r:rows.length-1,c:4} })
    if (report.purchases.orders.length) {
      rows.push([cell('PO Reference', HL), cell('Supplier', HL), cell('Items', H), cell('Ordered', H), cell('Received', H)])
      for (const o of report.purchases.orders) {
        rows.push([cell(o.po_ref,{font:{sz:10}}), cell(o.supplier||'',{font:{sz:10,color:{rgb:GREY}}}),
                   cell(o.item_count||0,{alignment:{horizontal:'center'},font:{sz:10}}),
                   cell(o.order_date||'',{alignment:{horizontal:'center'},font:{sz:9}}),
                   cell(o.receive_date||'—',{alignment:{horizontal:'center'},font:{sz:9,color:{rgb: o.receive_date?GREEN:GREY}}})])
      }
    } else {
      rows.push([cell('No orders placed this month.', { font:{sz:10,color:{rgb:GREY}} })])
    }

    const wb = new window.ExcelJS.Workbook()
    xlsAOAtoWS(wb, rows, 'Monthly Report', {
      cols: [{wch:38},{wch:18},{wch:16},{wch:16},{wch:14}],
      rowHeights: rows.map((_,i) => i===0 ? {hpt:26} : {hpt:17}),
      merges,
    })
    await xlsDownload(wb, `Paynter-Bar-Monthly-Report-${year}-${String(month).padStart(2,'0')}.xlsx`)
  }

  const card = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 16px' }
  const sel  = { padding:'7px 12px', fontSize:13, borderRadius:7, border:'1px solid #e2e8f0', fontWeight:600, color:'#334155', cursor:'pointer' }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', flex:1 }}>📅 Monthly Report</div>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} style={sel}>
          {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={sel}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={run} disabled={loading}
          style={{ padding:'8px 18px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: loading?'default':'pointer', opacity: loading?0.6:1 }}>
          {loading ? 'Generating…' : 'Generate'}
        </button>
        {report && (
          <button onClick={exportExcel}
            style={{ padding:'8px 16px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
            📊 Excel
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding:'12px 16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, color:'#991b1b', fontSize:13, marginBottom:16 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>Building report…</div>}

      {report && !loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Headline stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10 }}>
            {[
              { label:'Revenue', value: money(report.sales.revenue), color:'#16a34a',
                sub: report.sales.changePct == null ? `vs ${report.period.prevLabel}: —`
                     : `${report.sales.changePct > 0 ? '+' : ''}${report.sales.changePct}% vs ${report.period.prevLabel}`,
                subColor: report.sales.changePct == null ? '#94a3b8' : report.sales.changePct >= 0 ? '#16a34a' : '#dc2626' },
              { label:'Units sold', value: num(report.sales.unitsSold), color:'#0f172a', sub:`${report.sales.itemCount} items` },
              { label:'Wastage', value: money(report.wastage.totalCost), color:'#dc2626', sub:`${report.wastage.entryCount} entries` },
              { label:'Orders placed', value: num(report.purchases.orderCount), color:'#0e7490', sub:`${report.purchases.received} received` },
              { label:'Avg markup', value: report.pricing.avgMarkupPct == null ? '—' : `${report.pricing.avgMarkupPct}%`, color:'#7c3aed',
                sub: `${report.pricing.itemsPriced} items (excl. spirits)${report.pricing.itemsSkipped ? ` · ${report.pricing.itemsSkipped} unpriced` : ''}` },
              { label:'Spirits markup', value: report.pricing.avgSpiritMarkupPct == null ? '—' : `${report.pricing.avgSpiritMarkupPct}%`, color:'#7c3aed',
                sub: `${report.pricing.spiritsPriced} spirits · per nip` },
            ].map(s => (
              <div key={s.label} style={card}>
                <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:700 }}>{s.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:s.color, marginTop:4, fontFamily:'monospace' }}>{s.value}</div>
                <div style={{ fontSize:11, color:s.subColor || '#94a3b8', marginTop:2 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Sales by category */}
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:10 }}>Sales by category</div>
            {report.sales.categories.length === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13 }}>No sales recorded for this month.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
                    <th style={{ textAlign:'left', padding:'6px 4px', fontSize:11, color:'#64748b', textTransform:'uppercase' }}>Category</th>
                    <th style={{ textAlign:'right', padding:'6px 4px', fontSize:11, color:'#64748b', textTransform:'uppercase' }}>Units</th>
                    <th style={{ textAlign:'right', padding:'6px 4px', fontSize:11, color:'#64748b', textTransform:'uppercase' }}>Revenue</th>
                    <th style={{ textAlign:'right', padding:'6px 4px', fontSize:11, color:'#64748b', textTransform:'uppercase' }}>vs prev</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sales.categories.map(c => {
                    const d = c.prevRevenue > 0 ? ((c.revenue - c.prevRevenue) / c.prevRevenue) * 100 : null
                    return (
                      <tr key={c.category} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'7px 4px', fontWeight:600 }}>{c.category}</td>
                        <td style={{ padding:'7px 4px', textAlign:'right', fontFamily:'monospace' }}>{num(c.units)}</td>
                        <td style={{ padding:'7px 4px', textAlign:'right', fontFamily:'monospace', fontWeight:700 }}>{money(c.revenue)}</td>
                        <td style={{ padding:'7px 4px', textAlign:'right', fontFamily:'monospace',
                                     color: d==null ? '#94a3b8' : d>=0 ? '#16a34a' : '#dc2626' }}>
                          {d==null ? '—' : `${d>0?'+':''}${d.toFixed(1)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Wastage */}
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:4 }}>Wastage</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10, fontStyle:'italic' }}>{report.wastage.valuationBasis}</div>
            {report.wastage.entryCount === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13 }}>No wastage recorded this month.</div>
            ) : (
              <>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  {Object.entries(report.wastage.byReason).map(([r, cost]) => (
                    <span key={r} style={{ fontSize:11, background:'#fef2f2', color:'#991b1b', border:'1px solid #fecaca', borderRadius:6, padding:'3px 8px', fontWeight:600 }}>
                      {r}: {money(cost)}
                    </span>
                  ))}
                </div>
                {report.wastage.unvaluedEntries > 0 && (
                  <div style={{ fontSize:11, color:'#92400e', background:'#fefce8', border:'1px solid #fde68a', borderRadius:6, padding:'6px 10px', marginBottom:10 }}>
                    {report.wastage.unvaluedEntries} {report.wastage.unvaluedEntries === 1 ? 'entry has' : 'entries have'} no buy price set, so they're excluded from the cost total.
                  </div>
                )}
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <tbody>
                    {report.wastage.entries.slice(0, 12).map((w, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'6px 4px' }}>{w.name}</td>
                        <td style={{ padding:'6px 4px', color:'#64748b', fontSize:12 }}>{w.qty} {w.unit}</td>
                        <td style={{ padding:'6px 4px', color:'#64748b', fontSize:12 }}>{w.reason}</td>
                        <td style={{ padding:'6px 4px', textAlign:'right', fontFamily:'monospace', color: w.cost==null ? '#94a3b8' : '#dc2626' }}>
                          {w.cost == null ? '—' : money(w.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Orders */}
          <div style={card}>
            <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', marginBottom:10 }}>
              Orders placed
              <span style={{ fontWeight:400, color:'#94a3b8', fontSize:12, marginLeft:8 }}>
                {report.purchases.received} received · {report.purchases.pending} pending
              </span>
            </div>
            {report.purchases.orderCount === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13 }}>No orders placed this month.</div>
            ) : (
              <>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  {Object.entries(report.purchases.bySupplier).map(([s, n]) => (
                    <span key={s} style={{ fontSize:11, background:'#f0f9ff', color:'#0369a1', border:'1px solid #bae6fd', borderRadius:6, padding:'3px 8px', fontWeight:600 }}>
                      {s}: {n}
                    </span>
                  ))}
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <tbody>
                    {report.purchases.orders.map(o => (
                      <tr key={o.po_ref} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'6px 4px', fontFamily:'monospace', fontSize:12 }}>{o.po_ref}</td>
                        <td style={{ padding:'6px 4px', color:'#64748b', fontSize:12 }}>{o.supplier}</td>
                        <td style={{ padding:'6px 4px', textAlign:'center', color:'#64748b', fontSize:12 }}>{o.item_count} items</td>
                        <td style={{ padding:'6px 4px', textAlign:'right', fontSize:11, color: o.receive_date ? '#16a34a' : '#94a3b8' }}>
                          {o.receive_date ? '✓ received' : 'pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
