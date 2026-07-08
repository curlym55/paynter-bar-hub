// StocktakeView.jsx — extracted from pages/index.js
import React, { useState, useEffect } from 'react'
import { loadExcelJS } from '../../../lib/excel/loadExcelJS'
import { xlsDownload } from '../../../lib/excel/xlsDownload'
import { xlsAOAtoWS } from '../../../lib/excel/xlsAOAtoWS'

export default function StocktakeView({ items, readOnly, onExport }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
  const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']

  // counts keyed by item name: { coolRoom, storeRoom, bar }
  const [counts, setCounts] = useState({})
  const [countsLoaded, setCountsLoaded] = useState(false)
  const [filterCat, setFilterCat] = useState('All')
  const [mobileMode, setMobileMode] = useState(false)
  const [mobileIdx, setMobileIdx] = useState(0)
  const [showDiffs, setShowDiffs] = useState(false)

  // Square sync state
  const [showSyncModal, setShowSyncModal]   = useState(false)
  const [syncPreview, setSyncPreview]       = useState(null)
  const [syncLoading, setSyncLoading]       = useState(false)
  const [syncing, setSyncing]               = useState(false)
  const [syncCompleted, setSyncCompleted]   = useState(false)
  const [syncResult, setSyncResult]         = useState(null)
  const [autoSyncPrompt, setAutoSyncPrompt] = useState(false)
  const [autoSyncDismissed, setAutoSyncDismissed] = useState(false)
  const [showHistory, setShowHistory]       = useState(false)
  const [history, setHistory]               = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const r = await fetch('/api/stocktake-history')
      if (!r.ok) {
        console.error('[stocktake-history] request failed:', r.status)
        setHistory([])
        return
      }
      const d = await r.json()
      setHistory(Array.isArray(d.history) ? d.history : [])
    } catch(e) {
      console.error('[stocktake-history] fetch error:', e)
      setHistory([])
    } finally { setHistoryLoading(false) }
  }

  const exportSnapshotToExcel = (day, snap) => {
    if (!snap?.items?.length) return
    ;(async () => {
      await loadExcelJS()
      const NAVY = '0F172A', TEAL = '0E7490'
      const WHITE = 'FFFFFF', GREEN = '16A34A', RED = 'DC2626', GREY = '64748B'
      const cell = (v, s) => ({ v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's' })
      const hStyle = {
        font: { bold: true, color: { rgb: WHITE }, sz: 10 },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: TEAL } } }
      }
      const hStyleL = { ...hStyle, alignment: { horizontal: 'left' } }
      const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      const timeStr = new Date(snap.ts).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })

      const rows = []
      const merges = []
      rows.push([cell('Paynter Bar — Stocktake Sync to Square', { font: { bold: true, sz: 16, color: { rgb: NAVY } } }), ...Array(5).fill(cell(''))])
      rows.push([cell(`${dateLabel} at ${timeStr}`, { font: { sz: 10, color: { rgb: GREY } } }), ...Array(5).fill(cell(''))])
      rows.push([cell(`${snap.synced} synced${snap.skipped ? `, ${snap.skipped} skipped` : ''}${snap.failed ? `, ${snap.failed} failed` : ''}`, { font: { sz: 10, color: { rgb: GREY } } }), ...Array(5).fill(cell(''))])
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } })
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } })
      merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 5 } })
      rows.push([])

      rows.push([
        cell('Item',      hStyleL),
        cell('Category',  hStyleL),
        cell('Before',    hStyle),
        cell('Set To',    hStyle),
        cell('Change',    hStyle),
        cell('Conversion', hStyleL),
      ])

      snap.items.forEach((item, idx) => {
        const shade = idx % 2 === 0 ? WHITE : 'F8FAFC'
        const s  = { fill: { fgColor: { rgb: shade } }, font: { sz: 10 } }
        const sc = { ...s, alignment: { horizontal: 'center' } }
        const hasBefore = item.before !== null && item.before !== undefined
        const change = hasBefore ? +(item.sqQty - item.before).toFixed(2) : null
        const changeColor = change === null ? GREY : change > 0 ? GREEN : change < 0 ? RED : GREY
        const changeText  = change === null ? '—' : (change > 0 ? `+${change}` : `${change}`)
        rows.push([
          cell(item.name, s),
          cell(item.category || '', { ...s, font: { sz: 10, color: { rgb: GREY } } }),
          cell(hasBefore ? item.before : '—', { ...sc, font: { sz: 10, color: { rgb: GREY } } }),
          cell(item.sqQty, { ...sc, font: { sz: 10, bold: true, color: { rgb: GREEN } } }),
          cell(changeText, { ...sc, font: { sz: 10, bold: true, color: { rgb: changeColor } } }),
          cell(item.note || '1:1', { ...s, font: { sz: 9, color: { rgb: GREY } } }),
        ])
      })

      const wb = new window.ExcelJS.Workbook()
      xlsAOAtoWS(wb, rows, 'Sync', {
        cols: [{ wch:34 },{ wch:18 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:32 }],
        rowHeights: rows.map((_, i) => i === 0 ? { hpt:26 } : { hpt:18 }),
        merges,
        freeze: 5,
      })
      const fname = `Paynter-Bar-Sync-${day.date}-${timeStr.replace(':','').replace(' ','')}.xlsx`
      await xlsDownload(wb, fname)
    })()
  }

  const exportSyncChangesToExcel = () => {
    if (!syncResult || !syncPreview?.preview) return
    ;(async () => {
      await loadExcelJS()
      const NAVY = '0F172A', TEAL = '0E7490'
      const WHITE = 'FFFFFF', GREEN = '16A34A', AMBER = '92400E', GREY = '64748B'
      const cell = (v, s) => ({ v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's' })
      const hStyle = {
        font: { bold: true, color: { rgb: WHITE }, sz: 10 },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: TEAL } } }
      }
      const hStyleL = { ...hStyle, alignment: { horizontal: 'left' } }

      const rows = []
      const merges = []
      rows.push([cell('Paynter Bar — Stocktake Sync to Square', { font: { bold: true, sz: 16, color: { rgb: NAVY } } }), ...Array(6).fill(cell(''))])
      rows.push([cell(`Synced: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`, { font: { sz: 10, color: { rgb: GREY } } }), ...Array(6).fill(cell(''))])
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } })
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } })
      rows.push([])

      rows.push([
        cell('Item',              hStyleL),
        cell('Category',          hStyleL),
        cell('Counted (btl/units)', hStyle),
        cell('Square Before',     hStyle),
        cell('Square Set To',     hStyle),
        cell('Conversion',        hStyleL),
        cell('Status',            hStyle),
      ])

      const skippedNames = new Set((syncResult.skippedItems || []).map(s => s.name))
      syncPreview.preview.forEach((p, idx) => {
        const status = skippedNames.has(p.name) ? 'Skipped / Failed' : (p.canSync ? 'Synced' : 'Skipped')
        const shade = idx % 2 === 0 ? WHITE : 'F8FAFC'
        const s  = { fill: { fgColor: { rgb: shade } }, font: { sz: 10 } }
        const sc = { ...s, alignment: { horizontal: 'center' } }
        const statusColor = status === 'Synced' ? GREEN : AMBER
        rows.push([
          cell(p.name, s),
          cell(p.category || '', { ...s, font: { sz: 10, color: { rgb: GREY } } }),
          cell(p.total, sc),
          cell(p.squareOnHand ?? '—', sc),
          cell(p.canSync ? p.squareQty : '—', { ...sc, font: { sz: 10, bold: true, color: { rgb: GREEN } } }),
          cell(p.conversionNote || '1:1', { ...s, font: { sz: 9, color: { rgb: GREY } } }),
          cell(status, { ...sc, font: { sz: 10, bold: true, color: { rgb: statusColor } } }),
        ])
      })

      const wb = new window.ExcelJS.Workbook()
      xlsAOAtoWS(wb, rows, 'Sync Changes', {
        cols: [{ wch:34 },{ wch:16 },{ wch:16 },{ wch:14 },{ wch:14 },{ wch:32 },{ wch:16 }],
        rowHeights: rows.map((_, i) => i === 0 ? { hpt:26 } : { hpt:18 }),
        merges,
        freeze: 4,
        autoFilter: { from:'A4', to:'G4' },
      })
      await xlsDownload(wb, `Paynter-Bar-Square-Sync-${new Date().toISOString().split('T')[0]}.xlsx`)
    })()
  }

  const loadSyncPreview = async () => {
    setSyncLoading(true)
    setSyncResult(null)
    setSyncPreview(null)
    try {
      const itemsPayload = items.map(i => ({ name: i.name, category: i.category, bottleML: i.bottleML, nipML: i.nipML }))
      const d = await fetch('/api/stocktake-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload, previewOnly: true })
      }).then(r => r.json())
      setSyncPreview(d)
    } catch(e) { setSyncPreview({ error: e.message }) }
    finally { setSyncLoading(false) }
  }

  const openSyncModal = () => { setShowSyncModal(true); setAutoSyncPrompt(false); setAutoSyncDismissed(true); setSyncCompleted(false); loadSyncPreview() }

  const executeSync = async () => {
    setSyncing(true)
    try {
      const itemsPayload = items.map(i => ({ name: i.name, category: i.category, bottleML: i.bottleML, nipML: i.nipML }))
      const r = await fetch('/api/stocktake-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload })
      })
      const d = await r.json()
      setSyncResult(d)
      setSyncCompleted(d.ok === true)
      // Don't reload the preview here — that would re-fetch the SAME items
      // as "ready to sync" again (since local counts aren't cleared), making
      // it look like the sync did nothing. Just refresh history in the background.
      if (d.ok && showHistory) loadHistory()
    } catch(e) { setSyncResult({ ok: false, error: e.message }) }
    finally { setSyncing(false) }
  }

  // Load counts from server on mount
  useEffect(() => {
    fetch('/api/stocktake')
      .then(r => r.json())
      .then(data => { setCounts(data.counts || {}); setCountsLoaded(true) })
      .catch(() => setCountsLoaded(true))
  }, [])

  // Save counts to server whenever they change (debounced 800ms)
  useEffect(() => {
    if (!countsLoaded) return
    const t = setTimeout(() => {
      fetch('/api/stocktake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counts }) }).catch(() => {})
      // Show auto-sync prompt once per session if there are counted items and it hasn't been dismissed
      const anyCount = Object.values(counts).some(c => c.coolRoom !== '' || c.storeRoom !== '' || c.bar !== '')
      if (anyCount && !showSyncModal && !autoSyncDismissed) setAutoSyncPrompt(true)
    }, 800)
    return () => clearTimeout(t)
  }, [counts, countsLoaded])

  const setCount = (name, field, val) => {
    const num = val === '' ? '' : parseFloat(val) || 0
    setCounts(c => ({ ...c, [name]: { ...(c[name] || { coolRoom: '', storeRoom: '', bar: '' }), [field]: num } }))
  }

  const getCount = (name, field) => {
    const c = counts[name]
    if (!c || c[field] === '' || c[field] == null) return ''
    return c[field]
  }

  const totalCount = (item) => {
    const c = counts[item.name]
    if (!c) return ''
    const cr = parseFloat(c.coolRoom) || 0
    const sr = parseFloat(c.storeRoom) || 0
    const br = parseFloat(c.bar) || 0
    if (c.coolRoom === '' && c.storeRoom === '' && c.bar === '') return ''
    return cr + sr + br
  }

  const totalNips = (item) => {
    const tc = totalCount(item)
    if (tc === '') return ''
    if (!item.isSpirit) return tc
    const nipsPerBottle = (item.bottleML || 700) / (item.nipML || 30)
    return +(tc * nipsPerBottle).toFixed(1)
  }

  const diff = (item) => {
    const tn = totalNips(item)
    if (tn === '') return ''
    if (item.isSpirit) return +(tn - item.onHand).toFixed(1)
    const tc = totalCount(item)
    if (tc === '') return ''
    return +(tc - item.onHand).toFixed(1)
  }

  const diffColor = (d) => {
    if (d === '') return '#94a3b8'
    if (d > 0) return '#16a34a'
    if (d < 0) return '#dc2626'
    return '#0f172a'
  }

  const sortedItems = [
    ...CATEGORY_ORDER.filter(c => items.some(i => i.category === c)),
    ...items.map(i => i.category).filter((c, i, a) => !CATEGORY_ORDER.includes(c) && a.indexOf(c) === i)
  ].flatMap(cat => items.filter(i => i.category === cat).sort((a, b) => a.name.localeCompare(b.name)))

  const categories = ['All', ...CATEGORY_ORDER.filter(c => items.some(i => i.category === c))]
  const filteredItems = filterCat === 'All' ? sortedItems : sortedItems.filter(i => i.category === filterCat)

  const completedCount = filteredItems.filter(i => totalCount(i) !== '').length

  // Mobile: navigate item by item
  const mobileItem = filteredItems[mobileIdx] || null

  const exportToExcel = () => {
    ;(async () => {
      await loadExcelJS()
      const NAVY = '0F172A', TEAL = '0E7490', WHITE = 'FFFFFF', LGREY = 'F1F5F9'
      const hStyle = { font: { bold: true, color: { rgb: WHITE }, sz: 11 }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { bottom: { style: 'medium', color: { rgb: TEAL } } } }
      const hStyleL = { ...hStyle, alignment: { horizontal: 'left', vertical: 'center' } }
      const catStyle = { font: { bold: true, sz: 10, color: { rgb: '374151' } }, fill: { fgColor: { rgb: LGREY } }, border: { top: { style: 'medium', color: { rgb: 'CBD5E1' } } } }
      const cell = (v, s, f) => ({ v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's', ...(f ? { f, t: 'n' } : {}) })

      const rows = []
      // Title
      rows.push([cell('Paynter Bar — Stocktake', { font: { bold: true, sz: 16, color: { rgb: NAVY } } }), ...Array(7).fill(cell(''))])
      rows.push([cell(`Date: ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}`, { font: { sz: 10, color: { rgb: '64748B' } } }), ...Array(7).fill(cell(''))])
      rows.push([])
      // Header
      rows.push([
        cell('Item', hStyleL), cell('Category', hStyleL),
        cell('Cool Room', hStyle), cell('Store Room', hStyle), cell('Bar', hStyle),
        cell('Total', hStyle), cell('Nips/Btl', hStyle), cell('Total Nips', hStyle),
        cell('Square', hStyle), cell('Diff', hStyle),
      ])

      let lastCat = null
      sortedItems.forEach((item, idx) => {
        if (item.category !== lastCat) {
          lastCat = item.category
          rows.push([cell(item.category.toUpperCase(), catStyle), ...Array(9).fill(cell('', catStyle))])
        }
        const rowNum = rows.length + 1
        const shade = idx % 2 === 0 ? WHITE : 'F8FAFC'
        const s = { fill: { fgColor: { rgb: shade } }, font: { sz: 10 }, alignment: { horizontal: 'left' } }
        const ns = { ...s, alignment: { horizontal: 'center' } }
        const cr = getCount(item.name, 'coolRoom')
        const sr = getCount(item.name, 'storeRoom')
        const br = getCount(item.name, 'bar')
        const nipsPerBottle = item.isSpirit ? +((item.bottleML || 700) / (item.nipML || 30)).toFixed(2) : ''
        rows.push([
          cell(item.name, s),
          cell(item.category, { ...s, font: { sz: 10, color: { rgb: '64748B' } } }),
          cell(cr !== '' ? cr : 0, ns),
          cell(sr !== '' ? sr : 0, ns),
          cell(br !== '' ? br : 0, ns),
          cell(null, ns, `C${rowNum}+D${rowNum}+E${rowNum}`),
          cell(nipsPerBottle !== '' ? nipsPerBottle : null, { ...ns, numFmt: '0.0' }),
          item.isSpirit ? cell(null, ns, `IFERROR(F${rowNum}*G${rowNum},0)`) : cell(null, ns),
          cell(item.onHand, ns),
          item.isSpirit ? cell(null, { ...ns, font: { sz: 10, bold: true } }, `IFERROR(H${rowNum}-I${rowNum},F${rowNum}-I${rowNum})`) : cell(null, { ...ns, font: { sz: 10, bold: true } }, `F${rowNum}-I${rowNum}`),
        ])
      })

      const wb = new window.ExcelJS.Workbook()
      xlsAOAtoWS(wb, rows, 'Stocktake', {
        cols: [{ wch:36 },{ wch:18 },{ wch:12 },{ wch:12 },{ wch:8 },{ wch:10 },{ wch:10 },{ wch:12 },{ wch:10 },{ wch:10 }],
        rowHeights: rows.map((_, i) => i === 0 ? { hpt:24 } : i === 3 ? { hpt:24 } : { hpt:18 }),
        merges: [{ s:{r:0,c:0}, e:{r:0,c:9} }, { s:{r:1,c:0}, e:{r:1,c:9} }],
        freeze: 4,
      })
      await xlsDownload(wb, `Paynter-Bar-Stocktake-${new Date().toISOString().split('T')[0]}.xlsx`)
    })()
  }

  const printBlankSheet = () => {
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
    let lastCat = null
    let rows = ''
    sortedItems.forEach((item, idx) => {
      if (item.category !== lastCat) {
        lastCat = item.category
        const forcePageBreak = item.category === 'Sparkling' ? ' style="page-break-before: always; break-before: page;"' : ''
        rows += `<tr class="cat-row"${forcePageBreak}><td colspan="8">${item.category}</td></tr>`
      }
      const shade = idx % 2 === 0 ? '#ffffff' : '#dfe7ef'
      const nipsPerBottle = item.isSpirit ? +((item.bottleML || 700) / (item.nipML || 30)).toFixed(1) : ''
      rows += `<tr style="background:${shade}">
        <td class="item-name">${item.name}${item.isSpirit ? '<span class="hint">enter bottles (0.5 = half bottle)</span>' : ''}</td>
        <td class="input-cell"></td>
        <td class="input-cell"></td>
        <td class="input-cell"></td>
        <td class="total-cell"></td>
        <td class="nips-cell">${nipsPerBottle !== '' ? `<span class="nips-ref">${nipsPerBottle}</span>` : ''}</td>
        <td class="sq-cell">${item.onHand}</td>
        <td class="diff-cell"></td>
      </tr>`
    })

    const html = `<!DOCTYPE html><html><head><title>Stocktake — Paynter Bar</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1f2937; background: #fff; }
  .page { padding: 20px 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 6px; }
  .header-left h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
  .header-left p { font-size: 10px; color: #64748b; margin-top: 2px; }
  .header-right { font-size: 10px; color: #64748b; text-align: right; line-height: 1.7; }
  .header-right strong { font-size: 13px; color: #0f172a; display: block; }
  .instructions { background: #f1f5f9; border-radius: 6px; padding: 7px 12px; margin-bottom: 10px; font-size: 10px; color: #475569; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; border: 2px solid #0f172a; }
  th { background: #0f172a; color: #fff; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid #0f172a; }
  th.item-col { text-align: left; width: 32%; }
  th.input-col { text-align: center; width: 10%; }
  th.total-col { text-align: center; width: 8%; background: #1e3a5f; }
  th.nips-col { text-align: center; width: 8%; background: #134e4a; }
  th.sq-col { text-align: center; width: 8%; }
  th.diff-col { text-align: center; width: 8%; background: #1e3a5f; }
  td { padding: 5px 8px; border: 1px solid #94a3b8; vertical-align: middle; }
  td.item-name { font-size: 11px; font-weight: 500; border-left: 1px solid #94a3b8; }
  td.input-cell { text-align: center; border-left: 1.5px solid #64748b; }
  td.total-cell { text-align: center; background: #f0f9ff; border-left: 2px solid #38bdf8; font-weight: 700; }
  td.sq-cell { text-align: center; color: #64748b; font-family: monospace; }
  td.diff-cell { text-align: center; background: #fefce8; border-left: 2px solid #eab308; }
  .write-box { display: inline-block; width: 52px; height: 20px; border-bottom: 1.5px solid #94a3b8; }
  tr.cat-row td { background: #cbd5e1; font-weight: 700; font-size: 10px; color: #1e293b; padding: 6px 8px; border-top: 2px solid #64748b; border-bottom: 2px solid #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
  td.nips-cell { text-align: center; color: #0f766e; font-family: monospace; font-weight: 700; font-size: 11px; background: #ccfbf1; border-left: 1.5px solid #2dd4bf; }
  .nips-ref { display: inline-block; background: #99f6e4; border-radius: 4px; padding: 1px 5px; font-size: 10px; }
  .hint { font-size: 8px; color: #94a3b8; display: block; margin-top: 1px; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
  .sign-row { display: flex; gap: 40px; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
  .sign-block { flex: 1; }
  .sign-block .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
  .sign-block .line { border-bottom: 1px solid #94a3b8; }
  @media print {
    body { font-size: 10px; }
    .page { padding: 12px 16px; }
    tr { page-break-inside: avoid; }
    tr.cat-row { page-break-before: auto; }
    .no-print { display: none; }
  }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Stocktake Sheet</h1>
      <p>Paynter Bar — GemLife Palmwoods</p>
    </div>
    <div class="header-right">
      <strong>${dateStr}</strong>
      Completed by: _______________________<br>
      Trading session: __________________
    </div>
  </div>
  <div class="instructions">
    <strong>Instructions:</strong>&nbsp;
    Count stock in each location and write the count in the box. For spirits, enter bottle count (use decimals for part bottles, e.g. 4.5). Add Cool Room + Store Room + Bar for Total. Variance = Total − Square.
  </div>
  <table>
    <thead>
      <tr>
        <th class="item-col">Item</th>
        <th class="input-col">❄️ Cool Room</th>
        <th class="input-col">📦 Store Room</th>
        <th class="input-col">🍺 Bar</th>
        <th class="total-col">Total Btls</th>
        <th class="nips-col">Nips/Btl</th>
        <th class="sq-col">Square</th>
        <th class="diff-col">Variance</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sign-row">
    <div class="sign-block"><div class="label">Counted by</div><div class="line"></div></div>
    <div class="sign-block"><div class="label">Checked by</div><div class="line"></div></div>
    <div class="sign-block"><div class="label">Date completed</div><div class="line"></div></div>
  </div>
  <div class="footer">
    <span>Paynter Bar — Stocktake Sheet — Generated ${dateStr}</span>
    <span>Square On Hand figures current at time of printing</span>
  </div>
</div></body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  const resetAll = () => { if (window.confirm('Clear all counts?')) { setCounts({}); fetch('/api/stocktake', { method: 'DELETE' }).catch(() => {}) } }

  // ── MOBILE VIEW ───────────────────────────────────────────────────────────────
  if (mobileMode) {
    const item = mobileItem
    const tc = item ? totalCount(item) : ''
    const tn = item ? totalNips(item) : ''
    const d = item ? diff(item) : ''
    return (
      <div style={{ background: '#f1f5f9', minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile toolbar */}
        <div style={{ background: '#0f172a', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => setMobileMode(false)} style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>⬅ Table</button>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{completedCount} / {filteredItems.length} counted</div>
          <button onClick={exportToExcel} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📊 Excel</button>
        </div>


      {/* Category filter */}
        <div style={{ overflowX: 'auto', background: '#1e293b', padding: '8px 12px', display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
          {categories.map(c => (
            <button key={c} onClick={() => { setFilterCat(c); setMobileIdx(0) }}
              style={{ background: filterCat === c ? '#0e7490' : '#334155', color: '#e2e8f0', border: 'none', borderRadius: 16, padding: '4px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
              {c === 'All' ? 'All' : c}
            </button>
          ))}
        </div>

        {/* Item card */}
        {item && (
          <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setMobileIdx(i => Math.max(0, i - 1))} disabled={mobileIdx === 0}
                style={{ background: mobileIdx === 0 ? '#e2e8f0' : '#334155', color: mobileIdx === 0 ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 20, cursor: mobileIdx === 0 ? 'default' : 'pointer' }}>‹</button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{mobileIdx + 1} of {filteredItems.length}</div>
                <div style={{ fontSize: 11, color: '#0e7490', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.category}</div>
              </div>
              <button onClick={() => setMobileIdx(i => Math.min(filteredItems.length - 1, i + 1))} disabled={mobileIdx === filteredItems.length - 1}
                style={{ background: mobileIdx === filteredItems.length - 1 ? '#e2e8f0' : '#334155', color: mobileIdx === filteredItems.length - 1 ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 20, cursor: mobileIdx === filteredItems.length - 1 ? 'default' : 'pointer' }}>›</button>
            </div>

            {/* Item name card */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{item.name}</div>
              {item.isSpirit && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{item.bottleML || 700}ml bottle · {item.nipML || 30}ml nips · {+((item.bottleML || 700) / (item.nipML || 30)).toFixed(1)} nips/btl</div>}
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Square: <strong>{item.onHand}</strong> {item.isSpirit ? 'nips' : 'units'}</div>
            </div>

            {/* Count inputs */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {[['coolRoom', '❄️ Cool Room'], ['storeRoom', '📦 Store Room'], ['bar', '🍺 Bar']].map(([field, label]) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#374151' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => { const cur = parseFloat(getCount(item.name, field)) || 0; setCount(item.name, field, Math.max(0, item.isSpirit ? +(cur - 0.5).toFixed(1) : cur - 1)) }}
                      style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>−</button>
                    <input
                      type="number"
                      value={getCount(item.name, field)}
                      onChange={e => setCount(item.name, field, e.target.value)}
                      style={{ width: 72, textAlign: 'center', fontSize: 22, fontWeight: 700, border: '2px solid #0e7490', borderRadius: 8, padding: '8px 4px', color: '#0f172a' }}
                      inputMode="decimal"
                    />
                    <button onClick={() => { const cur = parseFloat(getCount(item.name, field)) || 0; setCount(item.name, field, item.isSpirit ? +(cur + 0.5).toFixed(1) : cur + 1) }}
                      style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            {tc !== '' && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', gap: 12, justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Total{item.isSpirit ? ' Btls' : ''}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{tc}</div>
                </div>
                {item.isSpirit && (
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Total Nips</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{tn}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Diff</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: diffColor(d) }}>{d > 0 ? '+' : ''}{d}</div>
                </div>
              </div>
            )}

            {/* Quick jump: next uncounted */}
            <button onClick={() => {
              const nextIdx = filteredItems.findIndex((it, i) => i > mobileIdx && totalCount(it) === '')
              if (nextIdx !== -1) setMobileIdx(nextIdx)
            }} style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
              ⏭ Next uncounted
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── DESKTOP / TABLE VIEW ──────────────────────────────────────────────────────
  return (
    <div className="view-wrap" style={{ padding: '20px 28px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, fontSize: 13, color: '#64748b' }}>
          {completedCount} of {filteredItems.length} items counted
          {completedCount > 0 && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>({Math.round(completedCount / filteredItems.length * 100)}%)</span>}
        </div>
        <button onClick={() => setShowDiffs(s => !s)}
          style={{ padding: '7px 14px', background: showDiffs ? '#0e7490' : '#f1f5f9', color: showDiffs ? '#fff' : '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {showDiffs ? '✓ Diffs On' : 'Show Diffs'}
        </button>
        <button onClick={() => { setMobileMode(true); setMobileIdx(0) }}
          style={{ padding: '7px 14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          📱 Mobile Mode
        </button>
        <button onClick={exportToExcel}
          style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
          📊 Export Excel
        </button>
        <button onClick={printBlankSheet}
          style={{ padding: '7px 14px', background: '#0e7490', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
          🖨️ Print Blank Sheet
        </button>
        {!readOnly && (
          <button onClick={openSyncModal}
            style={{ padding: '7px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
            ⬆ Sync to Square
          </button>
        )}
        <button onClick={() => { setShowHistory(h => !h); if (!history) loadHistory() }}
          style={{ padding: '7px 14px', background: showHistory ? '#0f172a' : '#f1f5f9', color: showHistory ? '#fff' : '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          📋 History
        </button>
        <button onClick={resetAll}
          style={{ padding: '7px 14px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          🗑 Clear All
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 12 }}>
            📋 Stocktake Sync History
          </div>
          {historyLoading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>}
          {!historyLoading && history?.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>No syncs recorded yet.</div>
          )}
          {!historyLoading && history?.map(day => (
            <div key={day.date} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0e7490', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                <span style={{ marginLeft: 8, fontWeight: 400, color: '#94a3b8' }}>({day.snapshots.length} sync{day.snapshots.length !== 1 ? 's' : ''})</span>
              </div>
              {day.snapshots.map((snap, si) => (
                <div key={si} style={{ marginBottom: 8, padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {new Date(snap.ts).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, flex: 1 }}>
                      ✓ {snap.synced} synced{snap.skipped > 0 ? ` · ${snap.skipped} skipped` : ''}{snap.failed > 0 ? ` · ${snap.failed} failed` : ''}
                    </span>
                    {snap.items?.length > 0 && (
                      <button onClick={() => exportSnapshotToExcel(day, snap)}
                        style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        📊 Export
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {snap.items?.map((item, ii) => (
                      <span key={ii} style={{ fontSize: 10, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>
                        {item.name}: {item.before != null ? `${item.before} → ` : ''}{item.sqQty}{item.note ? ` (${item.note})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            style={{ padding: '5px 12px', background: filterCat === c ? '#0e7490' : '#f1f5f9', color: filterCat === c ? '#fff' : '#374151', border: '1px solid ' + (filterCat === c ? '#0e7490' : '#e2e8f0'), borderRadius: 16, fontSize: 12, cursor: 'pointer', fontWeight: filterCat === c ? 700 : 400 }}>
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 200 }}>Item</th>
                <th style={{ padding: '10px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>❄️ Cool Room</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📦 Store Room</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🍺 Bar</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#1e3a5f' }}>Total</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nips/Btl</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Nips</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Square</th>
                {showDiffs && <th style={{ padding: '10px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#1e3a5f' }}>Diff</th>}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = []
                let lastCat = null
                filteredItems.forEach((item, idx) => {
                  if (item.category !== lastCat) {
                    lastCat = item.category
                    rows.push(
                      <tr key={`cat-${item.category}`} style={{ background: '#f1f5f9' }}>
                        <td colSpan={showDiffs ? 10 : 9} style={{ padding: '7px 14px', fontWeight: 700, fontSize: 11, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '2px solid #e2e8f0' }}>{item.category}</td>
                      </tr>
                    )
                  }
                  const tc = totalCount(item)
                  const tn = totalNips(item)
                  const d = diff(item)
                  const counted = tc !== ''
                  rows.push(
                    <tr key={item.name} style={{ background: counted ? '#f0fdf4' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 14px', fontWeight: 500, color: '#0f172a' }}>{item.name}</td>
                      <td style={{ padding: '7px 10px', color: '#64748b', fontSize: 12 }}>{item.category}</td>
                      {['coolRoom', 'storeRoom', 'bar'].map(field => (
                        <td key={field} style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={getCount(item.name, field)}
                            onChange={e => setCount(item.name, field, e.target.value)}
                            placeholder="—"
                            step={item.isSpirit ? 0.5 : 1}
                            style={{ width: 70, textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 4px', fontSize: 13, fontFamily: 'monospace', background: getCount(item.name, field) !== '' ? '#f0fdf4' : '#fff' }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', background: '#f0f9ff' }}>{tc !== '' ? tc : '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{item.isSpirit ? +((item.bottleML || 700) / (item.nipML || 30)).toFixed(1) : '—'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: item.isSpirit ? 600 : 400, color: item.isSpirit ? '#0f172a' : '#94a3b8' }}>{item.isSpirit && tn !== '' ? tn : (item.isSpirit ? '—' : '—')}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#374151' }}>{item.onHand}</td>
                      {showDiffs && <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: diffColor(d) }}>{d !== '' ? (d > 0 ? `+${d}` : d) : '—'}</td>}
                    </tr>
                  )
                })
                return rows
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
        For spirits: enter bottle count (decimals ok, e.g. 4.5 for a half-used bottle). Nips calculated automatically. Non-spirit items: enter unit count.
      </div>


      {/* Auto-sync prompt — appears after save when counts exist */}
      {autoSyncPrompt && !showSyncModal && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>⬆ Sync counts to Square?</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Stocktake saved. Push counted quantities to Square inventory?</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setAutoSyncPrompt(false); setAutoSyncDismissed(true) }}
              style={{ padding: '6px 14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
              Not now
            </button>
            <button onClick={openSyncModal}
              style={{ padding: '6px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              Sync to Square
            </button>
          </div>
        </div>
      )}

      {/* Sync modal */}
      {showSyncModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ background: '#0f172a', borderRadius: '14px 14px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>⬆ Sync Stocktake to Square</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}>This will set Square inventory quantities to your counted values</div>
              </div>
              <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Result banner */}
              {syncResult && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: syncResult.ok ? '#f0fdf4' : '#fee2e2', border: `1px solid ${syncResult.ok ? '#86efac' : '#fca5a5'}`, color: syncResult.ok ? '#166534' : '#991b1b', fontSize: 13, fontWeight: 600 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span>{syncResult.ok ? '✓ ' : '✕ '}{syncResult.message || syncResult.error}</span>
                    {syncResult.ok && (
                      <button onClick={exportSyncChangesToExcel}
                        style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        📊 Export Changes to Excel
                      </button>
                    )}
                  </div>
                  {syncResult.skippedItems?.length > 0 && (
                    <div style={{ marginTop: 8, fontWeight: 400, fontSize: 12 }}>
                      {syncResult.skippedItems.map((s, i) => (
                        <div key={i} style={{ padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
                          <strong>{s.name}</strong>: {s.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {syncLoading && <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Loading preview…</div>}
              {syncPreview?.error && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
                  Error: {syncPreview.error}
                </div>
              )}
              {syncPreview && !syncPreview.error && (
                <>
                  {syncPreview.preview?.length === 0
                    ? <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>No counted items to sync.</div>
                    : <>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                          <strong style={{ color: '#0f172a' }}>{syncPreview.preview?.filter(p => p.canSync).length}</strong> items ready to sync
                          {syncPreview.preview?.filter(p => !p.canSync).length > 0 && (
                            <span style={{ color: '#d97706' }}> · {syncPreview.preview.filter(p => !p.canSync).length} will be skipped</span>
                          )}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                {['Item','Category','Counted','→ Square sets to','Conversion','Sq Current','Status'].map(h => (
                                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {syncPreview.preview.map((p, idx) => (
                                <tr key={p.name} style={{ background: !p.canSync ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', opacity: !p.canSync ? 0.65 : 1 }}>
                                  <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{p.name}</td>
                                  <td style={{ padding: '7px 10px', fontSize: 11, color: '#64748b' }}>{p.category}</td>
                                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                    {p.total} {SPIRIT_CATS.includes(p.category) ? 'btl' : 'units'}
                                  </td>
                                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                                    {p.canSync ? `${p.squareQty} ${SPIRIT_CATS.includes(p.category) ? 'nips' : 'units'}` : '—'}
                                  </td>
                                  <td style={{ padding: '7px 10px', fontSize: 11, color: '#64748b' }}>
                                    {p.conversionNote || <span style={{ color: '#cbd5e1' }}>1:1</span>}
                                  </td>
                                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>
                                    {p.squareOnHand !== null ? p.squareOnHand : '—'}
                                  </td>
                                  <td style={{ padding: '7px 10px' }}>
                                    {p.canSync
                                      ? <span style={{ fontSize: 10, background: syncCompleted ? '#dcfce7' : '#ede9fe', color: syncCompleted ? '#166534' : '#6d28d9', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{syncCompleted ? '✓ Synced' : 'Ready'}</span>
                                      : <span title={p.skipReason} style={{ fontSize: 10, background: '#fef9c3', color: '#92400e', fontWeight: 700, padding: '2px 8px', borderRadius: 99, cursor: 'help' }}>Skip ⓘ</span>
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                  }
                </>
              )}
            </div>

            {/* Footer */}
            {syncCompleted ? (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null); setSyncCompleted(false) }}
                  style={{ padding: '9px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>
                  ✓ Done
                </button>
              </div>
            ) : (
              <>
                {syncPreview && !syncPreview.error && syncPreview.preview?.filter(p => p.canSync).length > 0 && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                      style={{ padding: '9px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={executeSync} disabled={syncing}
                      style={{ padding: '9px 22px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: syncing ? 0.7 : 1 }}>
                      {syncing ? 'Syncing…' : `⬆ Sync ${syncPreview.preview.filter(p => p.canSync).length} item${syncPreview.preview.filter(p => p.canSync).length === 1 ? '' : 's'} to Square`}
                    </button>
                  </div>
                )}
                {syncPreview && !syncPreview.error && syncPreview.preview?.filter(p => p.canSync).length === 0 && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                      style={{ padding: '9px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                      Close
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
