// xlsAOAtoWS.js -- extracted from pages/index.js

export function xlsAOAtoWS(wb, aoa, sheetName, { cols, rowHeights, merges, freeze, autoFilter } = {}) {
  const ws = wb.addWorksheet(sheetName)
  if (cols) ws.columns = cols.map(c => ({ width: c.wch || 12 }))
  if (freeze) ws.views = [{ state: 'frozen', ySplit: freeze }]
  aoa.forEach((rowData, ri) => {
    if (!rowData || rowData.length === 0) { ws.addRow([]); return }
    const values = rowData.map(c => {
      if (!c || typeof c !== 'object') return c ?? ''
      if (c.f) return { formula: c.f, result: 0 }
      return c.v ?? ''
    })
    const row = ws.addRow(values)
    if (rowHeights?.[ri]) row.height = rowHeights[ri].hpt
    rowData.forEach((c, ci) => {
      if (!c || typeof c !== 'object') return
      const xc = row.getCell(ci + 1)
      const s = c.s || {}
      if (s.font) {
        const f = {}
        if (s.font.bold !== undefined) f.bold = s.font.bold
        if (s.font.italic) f.italic = true
        if (s.font.sz) f.size = s.font.sz
        if (s.font.color?.rgb) f.color = { argb: 'FF' + s.font.color.rgb }
        xc.font = f
      }
      if (s.fill?.fgColor?.rgb) xc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+s.fill.fgColor.rgb } }
      if (s.alignment) xc.alignment = { horizontal:s.alignment.horizontal, vertical:s.alignment.vertical, wrapText:s.alignment.wrapText }
      if (s.numFmt) xc.numFmt = s.numFmt
      if (s.border) {
        const b = {}
        for (const side of ['top','bottom','left','right']) {
          if (s.border[side]) b[side] = { style:s.border[side].style, color:{ argb:'FF'+s.border[side].color.rgb } }
        }
        xc.border = b
      }
    })
  })
  if (merges) merges.forEach(m => ws.mergeCells(m.s.r+1, m.s.c+1, m.e.r+1, m.e.c+1))
  if (autoFilter) ws.autoFilter = autoFilter
  return ws
}
