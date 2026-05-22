// loadExcelJS.js -- extracted from pages/index.js

export async function loadExcelJS() {
  if (!window.ExcelJS) {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
    document.head.appendChild(s)
    await new Promise(r => { s.onload = r })
  }
  return window.ExcelJS
}
