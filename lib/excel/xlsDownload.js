// xlsDownload.js -- extracted from pages/index.js

export async function xlsDownload(wb, filename) {
  wb.calcProperties = { fullCalcOnLoad: true }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
