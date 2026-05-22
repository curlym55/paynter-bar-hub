// BarcodeSheetView.jsx — extracted from pages/index.js
import React, { useState, useEffect, useRef } from 'react'

export default function BarcodeSheetView({ items, settings = {} }) {
  const [loaded, setLoaded] = useState(false)
  const allRef   = useRef(null)  // wrapper for all previews - used for SVG rasterisation
  const sheetRef = useRef(null)  // single-page 3-col
  const p1Ref    = useRef(null)  // 2-page: page 1 (Spirits + Fortified)
  const p2Ref      = useRef(null)  // 2-page: page 2 (White + Red/Rose)
  const p2NoHdrRef = useRef(null)  // 2-page: page 2 without column headers (for laminate)

  const isPrintVisible = (item) => {
    const pl = settings[item.name] || {}
    if (pl.hidden) return false
    if ((item.onHand || 0) <= 0 && !pl.showOnPrint) return false
    return true
  }

  const C = {
    spirits:   { hdr: '#2C3E50', rowA: '#B8D4E8', rowB: '#D6EAFF' },
    white:     { hdr: '#D4AC0D', rowA: '#FFF0A0', rowB: '#FFFDD0' },
    red:       { hdr: '#8B0000', rowA: '#F5B8B8', rowB: '#FFD6D6' },
    fortified: { hdr: '#5C3D1E', rowA: '#E8D5B8', rowB: '#F5E8D0' },
    rose:      { hdr: '#8B0045' },
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.JsBarcode) { setLoaded(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js'
    s.onload = () => setLoaded(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!loaded || !allRef.current) return
    allRef.current.querySelectorAll('svg[data-sku]').forEach(svg => {
      const sku = svg.getAttribute('data-sku')
      if (!sku) return
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      svg.removeAttribute('style')
      try {
        window.JsBarcode(svg, sku, { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 14 })
        const w = parseInt(svg.getAttribute('width')), h = parseInt(svg.getAttribute('height'))
        const svgData = new XMLSerializer().serializeToString(svg)
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const tmpImg = new Image()
        tmpImg.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = w * 3; canvas.height = h * 3
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(tmpImg, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          const img = document.createElement('img')
          img.src = canvas.toDataURL('image/png')
          img.style.cssText = 'width:100%;height:auto;display:block'
          if (svg.parentNode) svg.parentNode.replaceChild(img, svg)
        }
        tmpImg.src = url
      } catch(e) {}
    })
  }, [loaded, items])

  function getGlassSku(item) {
    return (item.variations || []).find(v => v.name.toLowerCase().includes('glass'))?.sku || ''
  }
  const LABEL_OVERRIDES = { 'Curtis Legion Cabernet Sauvignon': 'Curtis Legion Cab Sauv' }
  function getLabel(item) {
    return LABEL_OVERRIDES[item.name] || item.name.replace(/ \d+ml Nip$/i, '').replace(/ Nip$/i, '')
  }

  const spiritsItems   = items.filter(i => i.category === 'Spirits' && isPrintVisible(i)).sort((a,b) => a.name.localeCompare(b.name))
  const fortifiedItems = items.filter(i => i.category === 'Fortified & Liqueurs' && isPrintVisible(i)).sort((a,b) => a.name.localeCompare(b.name))
  const RIGHT_SPIRITS  = ['canadian club','glenlivet','jack daniel','jameson']
  const spiritsLeft    = spiritsItems.filter(i => !RIGHT_SPIRITS.some(n => i.name.toLowerCase().includes(n)))
  const spiritsRight   = spiritsItems.filter(i =>  RIGHT_SPIRITS.some(n => i.name.toLowerCase().includes(n)))
  const col1p1         = spiritsLeft
  const col2p1         = [
    ...spiritsRight,
    ...(fortifiedItems.length ? [
      { _spacer: true, _h: 24 },
      { _div: true, name: 'FORTIFIED & LIQUEURS', _hdr: C.fortified.hdr },
      ...fortifiedItems,
    ] : []),
  ]
  const whiteItems     = items.filter(i => i.category === 'White Wine' && getGlassSku(i) && isPrintVisible(i)).sort((a,b) => a.name.localeCompare(b.name)).map(i => ({...i,_glass:true}))
  const roseItems      = items.filter(i => i.category === 'Rose' && getGlassSku(i) && isPrintVisible(i)).sort((a,b) => a.name.localeCompare(b.name)).map(i => ({...i,_glass:true}))
  const redItems       = items.filter(i => i.category === 'Red Wine' && getGlassSku(i) && isPrintVisible(i) && !/minchinbury|curtis legion/i.test(i.name)).sort((a,b) => a.name.localeCompare(b.name)).map(i => ({...i,_glass:true}))

  const col2single = [
    ...whiteItems,
    ...(roseItems.length    ? [{_div:true, name:'ROSÉ',                _hdr:C.rose.hdr     }, ...roseItems]      : []),
    ...(fortifiedItems.length ? [{_div:true, name:'FORTIFIED & LIQUEURS',_hdr:C.fortified.hdr}, ...fortifiedItems] : []),
  ]
  const col2wines = [
    ...redItems,
    ...(roseItems.length ? [{_div:true, name:'ROSÉ', _hdr:C.rose.hdr}, ...roseItems] : []),
  ]

  const COL_CSS = `
    .bc-col{flex:1;display:flex;flex-direction:column;border:2px solid #888;overflow:hidden;}
    .bc-col-hdr{flex:0 0 auto;padding:4px 6px;text-align:center;font-weight:900;font-size:15px;letter-spacing:.07em;text-transform:uppercase;color:#fff;}
    .bc-div{flex:0 0 18px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:#fff;border-top:1px solid #888;}
    .bc-row{flex:1;display:flex;border-top:1px solid #ccc;min-height:52px;}
    .bc-label{flex:1;display:flex;align-items:center;padding:0 6px;font-weight:900;font-size:18px;word-break:break-word;border-right:1px solid #ccc;}
    .bc-cell{flex:1;display:flex;align-items:center;overflow:hidden;min-width:0;padding:7px 4px;}
    .bc-cell img{width:100%;height:auto;display:block;}
  `

  function renderCol(colItems, colours, isWine) {
    let idx = 0
    return colItems.map((item, i) => {
      if (item._spacer) return (
        <div key={`sp${i}`} style={{ flex: `0 0 ${item._h || 30}px`, background: '#fff', borderTop: '1px solid #e2e8f0' }} />
      )
      if (item._div) return (
        <div key={`d${i}`} className="bc-div" style={{ background: item._hdr }}>{item.name}</div>
      )
      const rowIdx = idx++
      const bg = rowIdx % 2 === 0 ? colours.rowA : colours.rowB
      const sku = isWine && item._glass ? getGlassSku(item) : (item.sku || '')
      const label = getLabel(item)
      const labelEl = <div key="lbl" className="bc-label" style={{ background: bg }}>{label}</div>
      const bcEl    = <div key="bc"  className="bc-cell"  style={{ background: bg }}>
        {sku ? <svg data-sku={sku} /> : <span style={{fontSize:9,color:'#999',fontStyle:'italic'}}>—</span>}
      </div>
      return (
        <div key={item.name} className="bc-row">
          {rowIdx % 2 === 0 ? [labelEl, bcEl] : [bcEl, labelEl]}
        </div>
      )
    })
  }

  function ColDiv({ title, colItems, colours, isWine, showHeader = true }) {
    return (
      <div className="bc-col">
        {showHeader && <div className="bc-col-hdr" style={{ background: colours.hdr }}>{title}</div>}
        {renderCol(colItems, colours, isWine)}
      </div>
    )
  }

  const PAGE_CSS = (leftMargin, largeTitles = false) => `
    @page{size:A4 landscape;margin:5mm 6mm 5mm ${leftMargin};}
    html,body{height:100%;margin:0;padding:0;font-family:Arial,sans-serif;}
    .bc-page{height:100%;display:flex;flex-direction:column;}
    .bc-hdr{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;background:#1A2F45;color:#fff;padding:2px 8px;margin-bottom:3px;font-size:11px;font-weight:800;}
    .bc-hdr-date{font-size:10px;color:#cbd5e1;}
    .bc-cols{flex:1;display:flex;gap:4px;min-height:0;}
    ${COL_CSS}
    ${largeTitles ? '.bc-col-hdr{font-size:20px!important;padding:5px 8px!important;}' : ''}
    @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  `

  function printWindow(pages, leftMargin = '14mm', largeTitles = false) {
    const w = window.open('', '_blank')
    const dateStr = new Date().toLocaleDateString('en-AU', { timeZone:'Australia/Brisbane', day:'2-digit', month:'short', year:'numeric' })
    const pageBlocks = pages.map((p, idx) => `
      <div class="bc-page" style="${idx < pages.length - 1 ? 'page-break-after:always;' : ''}">
        <div class="bc-hdr"><span>🍺 Paynter Bar — ${p.subtitle}</span><span class="bc-hdr-date">${dateStr}</span></div>
        <div class="bc-cols">${p.html}</div>
      </div>`).join('')
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Barcode Sheet</title>
<style>${PAGE_CSS(leftMargin, largeTitles)}</style></head><body>${pageBlocks}</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 900)
  }

  async function printA3PDF() {
    // Ensure JsBarcode is loaded
    if (!window.JsBarcode) {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
      document.head.appendChild(s)
      await new Promise(r => { s.onload = r })
    }

    const ROYAL   = '#1E3A5F', WHITE = '#fff', CREAM = '#fafaf7'
    const C_SP    = { hdr: '#2d4a70', alt: '#f0f4f8' }
    const C_FORT  = { hdr: '#7c3a7c', alt: '#fdf0fd' }
    const C_WHITE = { hdr: '#2d6a3f', alt: '#f0fdf4' }
    const C_RED   = { hdr: '#8b2020', alt: '#fff0f0' }
    const C_ROSE  = { hdr: '#b45a8a', alt: '#fdf0f6' }

    function buildSVG(sku) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      try { window.JsBarcode(svg, sku, { format:'CODE128', width:3, height:90, displayValue:false, margin:12, background:'#ffffff' }) }
      catch { return '' }
      return new XMLSerializer().serializeToString(svg)
    }

    function rowsHtml(arr, alt) {
      return arr.map((item, i) => {
        if (item._spacer) return `<div style='flex:0 0 ${item._h||30}px;background:#fff;border-top:1px solid #dde2ea'></div>`
        if (item._div)    return `<div style='flex:0 0 24px;display:flex;align-items:center;padding:0 10px;font-size:13px;font-weight:900;color:#fff;letter-spacing:.08em;background:${item._hdr}'>${item.name}</div>`
        const sku = item.sku || item.square_item_id || ''
        const bc  = sku ? buildSVG(sku) : ''
        const bg  = i%2===0 ? '#ffffff' : alt
        return `<div style='flex:1;display:flex;border-top:1px solid #dde2ea;min-height:52px;background:${bg}'>`
          + `<div style='flex:1;display:flex;align-items:center;padding:0 10px;font-size:18px;font-weight:900;color:#1a2535;line-height:1.2'>${item.name}</div>`
          + (bc ? `<div style='width:180px;flex:0 0 180px;display:flex;align-items:center;justify-content:center;padding:4px 8px'>${bc}</div>` : '')
          + `</div>`
      }).join('')
    }

    function colHtml(title, arr, hdr, alt, cont) {
      return `<div style='flex:1;display:flex;flex-direction:column;min-width:0;border:1.5px solid #c0cad8;border-radius:4px;overflow:hidden'>`
           + (cont ? '' : `<div style='flex:0 0 auto;padding:6px 10px;background:${hdr};color:#fff;font-size:18px;font-weight:900;letter-spacing:.05em;text-transform:uppercase'>${title}</div>`)
           + `<div style='flex:1;display:flex;flex-direction:column;overflow:hidden'>${rowsHtml(arr, alt)}</div>`
           + `</div>`
    }

    // Use same pre-computed arrays as the 2-page sheet
    const spL     = spiritsLeft
    const spRFort = col2p1
    const wht     = [...whiteItems, ...(roseItems.length ? [{ _div:true, name:'ROSÉ', _hdr:C_ROSE.hdr }, ...roseItems] : [])]
    const red     = redItems

    const page = (cols, pg) =>
      `<div style='width:420mm;height:297mm;display:flex;flex-direction:column;padding:7mm 8mm 7mm 12mm;box-sizing:border-box;background:#fff;page-break-after:${pg<2?'always':'avoid'}'>`
      + `<div style='flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:5px;border-bottom:2.5px solid ${ROYAL}'>`
      + `<div style='font-size:22px;font-weight:900;color:${ROYAL}'>Paynter Bar — GemLife Palmwoods</div>`
      + `<div style='font-size:15px;font-weight:700;color:#64748b'>Barcode Reference Sheet &nbsp;·&nbsp; Page ${pg} of 2 &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'})}</div>`
      + `</div>`
      + `<div style='flex:1;display:flex;gap:8px;min-height:0;overflow:hidden'>${cols}</div>`
      + `</div>`

    const html = `<!DOCTYPE html><html><head><meta charset='utf-8'>`
      + `<script src='https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'></script>`
      + `<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif}@page{size:A3 landscape;margin:0}@media print{body{width:420mm;height:297mm}}</style>`
      + `</head><body>`
      + `<div style='width:420mm;height:297mm;display:flex;flex-direction:column;padding:6mm 7mm 6mm 11mm;box-sizing:border-box;background:#fff'>`
      + `<div style='flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;padding-bottom:4px;border-bottom:2.5px solid ${ROYAL}'>`
      + `<div style='font-size:20px;font-weight:900;color:${ROYAL}'>Paynter Bar — GemLife Palmwoods</div>`
      + `<div style='font-size:13px;font-weight:700;color:#64748b'>Barcode Reference Sheet &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'})}</div>`
      + `</div>`
      + `<div style='flex:1;display:flex;gap:6px;min-height:0;overflow:hidden'>`
      + colHtml('Spirits', spL, C_SP.hdr, C_SP.alt)
      + colHtml('Spirits (cont.)', spRFort, C_SP.hdr, C_SP.alt)
      + colHtml('White Wine & Rosé', wht, C_WHITE.hdr, C_WHITE.alt)
      + colHtml('Red Wine & Sparkling', red, C_RED.hdr, C_RED.alt)
      + `</div></div>`
      + `<script>document.querySelectorAll('svg[data-sku]').forEach(s=>{try{JsBarcode(s,s.dataset.sku,{format:'CODE128',width:3,height:90,displayValue:false,margin:12})}catch{}})</script>`
      + `</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    // Wait for JsBarcode to load then print
    setTimeout(() => {
      w.print()
    }, 1200)
  }

  function doPrint1Page() {
    printWindow([{ subtitle: 'By the Glass Barcodes', html: sheetRef.current?.innerHTML || '' }])
  }

  function doPrint2Page() {
    printWindow([
      { subtitle: 'Spirits & Fortified — Barcodes', html: p1Ref.current?.innerHTML || '' },
      { subtitle: 'Wines — By the Glass Barcodes',  html: p2Ref.current?.innerHTML || '' },
    ], '14mm', true)
  }

  // Normalise Square variation names for display and sort Glass before Bottle
  function doPrint2PageLaminate() {
    const p1 = p1Ref.current?.innerHTML || ''
    const p2 = p2Ref.current?.innerHTML || ''
    const w = window.open('', '_blank')
    const dateStr = new Date().toLocaleDateString('en-AU', { timeZone:'Australia/Brisbane', day:'2-digit', month:'short', year:'numeric' })
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Barcode Sheet — Laminate</title>
<style>${PAGE_CSS('14mm', true)}</style></head><body>
  <div class="bc-page" style="page-break-after:always;">
    <div class="bc-hdr"><span>🍺 Paynter Bar — Spirits &amp; Fortified</span><span class="bc-hdr-date">${dateStr}</span></div>
    <div class="bc-cols">${p1}</div>
  </div>
  <div class="bc-page">
    <div class="bc-cols">${p2}</div>
  </div>
</body></html>`)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 900)
  }


  const btnStyle = (active) => ({
    background: active ? '#1A2F45' : '#94a3b8', color:'#fff', border:'none',
    borderRadius:6, padding:'7px 16px', fontSize:13, fontWeight:700,
    cursor: active ? 'pointer' : 'not-allowed'
  })

  return (
    <div style={{ padding:'12px 20px', fontFamily:'Arial,sans-serif' }}>
      <style>{COL_CSS}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#0f172a' }}>🏷️ Barcode Sheet <span style={{ fontSize:11, color:'#64748b', fontWeight:400 }}>— landscape A4</span></div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {!loaded && <span style={{ fontSize:12, color:'#94a3b8' }}>Loading…</span>}
          <button onClick={doPrint1Page} disabled={!loaded} style={btnStyle(loaded)}>🖨️ Print (1 page)</button>
          <button onClick={doPrint2Page} disabled={!loaded} style={{...btnStyle(loaded), background: loaded ? '#7c3aed' : '#94a3b8'}}>🖨️ Print (2 pages)</button>
          <button onClick={doPrint2PageLaminate} disabled={!loaded} style={{...btnStyle(loaded), background: loaded ? '#0f766e' : '#94a3b8', color:'#fff'}}>🖨️ Print (laminate A3)</button>
          <button onClick={printA3PDF} disabled={!loaded} style={{...btnStyle(loaded), background: loaded ? '#b45309' : '#94a3b8', color:'#fff'}}>📄 A3 Full Colour PDF</button>
        </div>
      </div>

      <div ref={allRef}>
        {/* Single-page preview */}
        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>1-page layout</div>
        <div ref={sheetRef} style={{ display:'flex', gap:8, height:640, minHeight:0, marginBottom:20 }}>
          <ColDiv title="Spirits"    colItems={spiritsItems} colours={C.spirits} isWine={false} />
          <ColDiv title="White Wine" colItems={col2single}   colours={C.white}   isWine={true}  />
          <ColDiv title="Red Wine"   colItems={redItems}     colours={C.red}     isWine={true}  />
        </div>

        {/* 2-page preview */}
        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>2-page layout — page 1: Spirits & Fortified</div>
        <div ref={p1Ref} style={{ display:'flex', gap:8, height:580, minHeight:0, marginBottom:12 }}>
          <ColDiv title="Spirits"              colItems={col1p1}  colours={C.spirits}   isWine={false} />
          <ColDiv title="Spirits (cont.)"      colItems={col2p1}  colours={C.spirits}   isWine={false} />
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>2-page layout — page 2: Wines</div>
        <div ref={p2Ref} style={{ display:'flex', gap:8, height:580, minHeight:0, marginBottom:12 }}>
          <ColDiv title="White Wine" colItems={whiteItems} colours={C.white} isWine={true} />
          <ColDiv title="Red Wine"   colItems={col2wines}  colours={C.red}   isWine={true} />
        </div>
        {/* Hidden no-header page 2 for laminate printing */}
        <div ref={p2NoHdrRef} style={{ display:'flex', gap:8, height:580, minHeight:0, position:'absolute', left:'-9999px', top:0 }}>
          <ColDiv title="White Wine" colItems={whiteItems} colours={C.white} isWine={true} showHeader={false} />
          <ColDiv title="Red Wine"   colItems={col2wines}  colours={C.red}   isWine={true} showHeader={false} />
        </div>
      </div>
    </div>
  )
}
