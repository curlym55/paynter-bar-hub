import ExcelJS from 'exceljs'
import { getAccessToken } from '../../../lib/onedrive'
import { requireAuth } from '../../../lib/session'

export default async function handler(req, res) {
  // Writes a report into OneDrive. Management access only.
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
    return res.status(200).json({ success: true, skipped: true, reason: 'OneDrive not configured' })
  }

  const { reference, supplier, receivedBy, locationName, items } = req.body ?? {}
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' })

  // ── Colours (ExcelJS ARGB) ────────────────────────────────────────────────
  const NAVY  = 'FF0F172A'
  const TEAL  = 'FF0E7490'
  const WHITE = 'FFFFFFFF'
  const LGREY = 'FFF1F5F9'
  const SLATE = 'FF64748B'
  const GREEN = 'FF16A34A'
  const AMBER = 'FFD97706'
  const RED   = 'FFDC2626'
  const LBLUE = 'FFEFF6FF'

  const sup       = supplier     || 'Unknown'
  const receiver  = receivedBy   || 'Bar Manager'
  const location  = locationName || 'Paynter Bar'
  const date      = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: 'short', year: 'numeric' })
  const dateFile  = new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' }).replace(/\//g, '-')

  const totalOrdered  = items.reduce((s, i) => s + (i.orderedQty  || 0), 0)
  const totalReceived = items.reduce((s, i) => s + (i.receivedQty || 0), 0)
  const itemsReceived = items.filter(i => (i.receivedQty || 0) > 0).length
  const itemsMissing  = items.filter(i => (i.receivedQty || 0) === 0).length

  // ── Style helpers ─────────────────────────────────────────────────────────
  const fill  = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
  const font  = (opts) => opts
  const align = (h, v = 'middle') => ({ horizontal: h, vertical: v })
  const border = (style, argb) => ({ style, color: { argb } })

  const colHdrStyle = cell => {
    cell.fill      = fill(TEAL)
    cell.font      = { bold: true, size: 10, color: { argb: WHITE } }
    cell.alignment = align(cell.value === 'Item' ? 'left' : 'center')
    cell.border    = { bottom: { style: 'medium', color: { argb: NAVY } } }
  }

  const dataStyle = (cell, col, rowIdx, missing) => {
    const bg = missing ? 'FFFFF7ED' : rowIdx % 2 === 0 ? 'FFF8FAFC' : WHITE
    cell.fill      = fill(bg)
    cell.alignment = align(['ordered', 'received', 'unit'].includes(col) ? 'center' : 'left', 'middle')
    if (col === 'item')     { cell.font = { size: 11, bold: false } }
    if (col === 'sku')      { cell.font = { size: 10, color: { argb: SLATE } } }
    if (col === 'ordered')  { cell.font = { size: 10, color: { argb: SLATE } } }
    if (col === 'received') {
      const qty = cell.value
      cell.font   = { bold: true, size: 11, color: { argb: qty > 0 ? GREEN : AMBER } }
    }
    if (col === 'unit')     { cell.font = { size: 10, color: { argb: SLATE } } }
    if (col === 'note')     { cell.font = { size: 10, italic: true, color: { argb: missing ? AMBER : SLATE } } }
    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
  }

  try {
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'Paynter Bar Hub'
    wb.created  = new Date()
    const ws = wb.addWorksheet('Goods Received')

    ws.columns = [
      { key: 'item',     width: 40 },
      { key: 'sku',      width: 16 },
      { key: 'ordered',  width: 12 },
      { key: 'received', width: 12 },
      { key: 'unit',     width: 10 },
      { key: 'note',     width: 28 },
    ]

    // ── Row 1: Banner title ──────────────────────────────────────────────────
    const r1 = ws.addRow(['Goods Received Report', '', '', '', '', ''])
    ws.mergeCells('A1:F1')
    r1.height = 30
    const c1 = r1.getCell(1)
    c1.value     = 'Goods Received Report'
    c1.fill      = fill(NAVY)
    c1.font      = { bold: true, size: 16, color: { argb: WHITE } }
    c1.alignment = align('left', 'middle')

    // ── Rows 2-3: Supplier / Date meta ───────────────────────────────────────
    const addMeta = (label, value, valueColor = SLATE) => {
      const r = ws.addRow([label, value, '', '', '', ''])
      r.height = 16
      r.getCell(1).font = { bold: true, size: 10, color: { argb: SLATE } }
      r.getCell(2).font = { size: 10, color: { argb: valueColor } }
      return r
    }
    addMeta('Supplier', sup)
    addMeta('Date', date)
    if (reference) addMeta('PO Reference', reference, NAVY)
    addMeta('Received By', receiver)

    // ── Summary bar ──────────────────────────────────────────────────────────
    ws.addRow([])
    const summRow = ws.addRow([
      `${itemsReceived} of ${items.length} lines received`,
      '',
      `${totalReceived} units in`,
      '',
      itemsMissing > 0 ? `${itemsMissing} line${itemsMissing !== 1 ? 's' : ''} missing` : 'All lines received',
      '',
    ])
    ws.mergeCells(`A${summRow.number}:B${summRow.number}`)
    ws.mergeCells(`C${summRow.number}:D${summRow.number}`)
    ws.mergeCells(`E${summRow.number}:F${summRow.number}`)
    summRow.height = 20
    ;[1, 3, 5].forEach(col => {
      const c = summRow.getCell(col)
      c.fill      = fill(LBLUE)
      c.font      = { bold: true, size: 10, color: { argb: col === 5 && itemsMissing > 0 ? AMBER : NAVY } }
      c.alignment = align('center', 'middle')
      c.border    = { top: { style: 'thin', color: { argb: TEAL } }, bottom: { style: 'thin', color: { argb: TEAL } } }
    })
    ;[2, 4, 6].forEach(col => {
      const c = summRow.getCell(col)
      c.fill   = fill(LBLUE)
      c.border = { top: { style: 'thin', color: { argb: TEAL } }, bottom: { style: 'thin', color: { argb: TEAL } } }
    })

    ws.addRow([])

    // ── Column headers ───────────────────────────────────────────────────────
    const hRow = ws.addRow(['Item', 'SKU', 'Ordered', 'Received', 'Unit', 'Note'])
    hRow.height = 20
    hRow.eachCell(cell => colHdrStyle(cell))

    const hdrRowNum = hRow.number
    ws.views = [{ state: 'frozen', ySplit: hdrRowNum }]
    ws.autoFilter = { from: `A${hdrRowNum}`, to: `F${hdrRowNum}` }

    // ── Data rows ─────────────────────────────────────────────────────────────
    items.forEach((item, i) => {
      const missing = (item.receivedQty || 0) === 0
      const row = ws.addRow([
        item.name,
        item.sku      || '',
        item.orderedQty  || '',
        item.receivedQty ?? '',
        item.unit     || '',
        item.note     || '',
      ])
      row.height = 18
      const cols = ['item', 'sku', 'ordered', 'received', 'unit', 'note']
      row.eachCell((cell, colNum) => dataStyle(cell, cols[colNum - 1], i, missing))
    })

    // ── Totals row ────────────────────────────────────────────────────────────
    const totRow = ws.addRow(['TOTALS', '', totalOrdered || '', totalReceived || '', '', ''])
    totRow.height = 18
    ;[1, 3, 4].forEach(col => {
      const c = totRow.getCell(col)
      c.fill      = fill(NAVY)
      c.font      = { bold: true, size: 10, color: { argb: WHITE } }
      c.alignment = align(col === 1 ? 'left' : 'center', 'middle')
    })
    ;[2, 5, 6].forEach(col => {
      const c = totRow.getCell(col)
      c.fill = fill(NAVY)
    })

    ws.addRow([])

    // ── Footer ────────────────────────────────────────────────────────────────
    const footRow = ws.addRow([`${location} - GemLife Palmwoods`, '', '', '', '', 'Generated by Paynter Bar Hub'])
    ws.mergeCells(`A${footRow.number}:E${footRow.number}`)
    ;[1, 6].forEach(col => {
      footRow.getCell(col).font = { size: 9, italic: true, color: { argb: SLATE } }
    })

    // ── Write and upload ─────────────────────────────────────────────────────
    const buf = await wb.xlsx.writeBuffer()
    const safeSupplier = sup.replace(/[^a-zA-Z0-9 ]/g, '').trim()
    const filename = `${reference ? reference.replace(/\s/g, '_') + '-' : ''}Receipt-${dateFile}.xlsx`
    const folder   = `POs Invoices and Receive Reports/Receive Reports/${safeSupplier}`
    const encodedPath = folder.split('/').map(encodeURIComponent).join('/')
    const token    = await getAccessToken()
    const url      = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/${encodeURIComponent(filename)}:/content`

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      body: buf,
    })
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `Upload failed ${uploadRes.status}`)
    }
    const data = await uploadRes.json()
    return res.status(200).json({ success: true, filename, webUrl: data.webUrl })
  } catch (err) {
    console.error('[save-report]', err.message)
    return res.status(200).json({ success: false, skipped: true, reason: err.message })
  }
}
