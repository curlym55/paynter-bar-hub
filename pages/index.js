import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { CATEGORIES } from '../lib/calculations'

const DEFAULT_SUPPLIERS = ['Dan Murphys', 'Coles Woolies', 'ACW']

const PRIORITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', text: '#991b1b', badge: '#dc2626' },
  LOW:      { bg: '#fef9c3', text: '#854d0e', badge: '#ca8a04' },
  OK:       { bg: '#f0fdf4', text: '#166534', badge: '#16a34a' },
}

const SUPPLIER_COLORS = {
  'Dan Murphys':   '#1f4e79',
  'Coles Woolies': '#c2410c',
  'ACW':           '#166534',
}

const CATEGORY_ORDER_LIST = [
  'Beer','Cider','PreMix','White Wine','Red Wine','Rose',
  'Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks'
]

export default function Home() {
  const [authed, setAuthed]             = useState(false)
  const [readOnly, setReadOnly]         = useState(false)
  const [pin, setPin]                   = useState('')
  const [pinError, setPinError]         = useState(false)
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [error, setError]               = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [targetWeeks, setTargetWeeks]   = useState(6)
  const [view, setView]                 = useState('all')
  const [filterOrder, setFilterOrder]   = useState(false)
  const [saving, setSaving]             = useState({})
  const [editingTarget, setEditingTarget] = useState(false)
  const [suppliers, setSuppliers]       = useState(DEFAULT_SUPPLIERS)
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [printing, setPrinting]         = useState(null)
  const [daysBack, setDaysBack]         = useState(90)
  const [viewMode, setViewMode]         = useState('reorder')
  const [mainTab, setMainTab]           = useState('home')
  const [salesPdfModal, setSalesPdfModal] = useState(false)
  const [sohModal, setSohModal]               = useState(false)
  const [salesPdfLoading, setSalesPdfLoading] = useState(false)
  const [salesPeriod, setSalesPeriod]   = useState('month')
  const [salesCustom, setSalesCustom]   = useState({ start: '', end: '' })
  const [salesReport, setSalesReport]   = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError]     = useState(null)
  const [salesCategory, setSalesCategory] = useState('All')
  const [salesSort, setSalesSort]       = useState('units')
  const [trendData, setTrendData]       = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError]     = useState(null)
  const [sellersData, setSellersData]   = useState(null)
  const [wastageLog, setWastageLog]     = useState([])
  const [notesLog, setNotesLog]         = useState([])
  const [notesLoaded, setNotesLoaded]   = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpenGroups, setSidebarOpenGroups] = useState({ 'Stock': true, 'Sales & Analytics': true, 'Operations': false, 'Help': true })
  const [orderedItems, setOrderedItems] = useState({})
  const [wastageLoaded, setWastageLoaded] = useState(false)
  const [sellersLoading, setSellersLoading] = useState(false)
  const [sellersError, setSellersError] = useState(null)
  const [priceListSettings, setPriceListSettings] = useState({}) // { itemName: { hidden: bool, priceOverride: num, label: str } }
  const [plSaving, setPlSaving]         = useState({})

  useEffect(() => {
    if (sessionStorage.getItem('bar_authed') === 'yes') {
      setAuthed(true)
      if (sessionStorage.getItem('bar_readonly') === 'yes') setReadOnly(true)
    }
  }, [])

  function checkPin() {
    if (pin === '5554') {
      sessionStorage.setItem('bar_authed', 'yes')
      sessionStorage.setItem('bar_readonly', 'yes')
      setReadOnly(true)
      setAuthed(true)
      setPin('')
      return
    }
    if (pin === '3838') {
      sessionStorage.setItem('bar_authed', 'yes')
      sessionStorage.removeItem('bar_readonly')
      setAuthed(true)
      setPinError(false)
    } else {
      setPinError(true)
      setPin('')
    }
  }

  const loadItems = useCallback(async (showRefresh = false, days = null) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const effectiveDays = days || daysBack
      const [r, ro] = await Promise.all([
        fetch(`/api/items?days=${effectiveDays}`),
        fetch('/api/settings?action=getOrdered')
      ])
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to load')
      const data = await r.json()
      setItems(data.items)
      setTargetWeeks(data.targetWeeks)
      setLastUpdated(data.lastUpdated)
      if (ro.ok) {
        const od = await ro.json()
        setOrderedItems(od.ordered || {})
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.suppliers) setSuppliers(data.suppliers)
    }).catch(() => {})
  }, [])

  async function loadSalesReport(period, custom) {
    setSalesLoading(true)
    setSalesError(null)
    setSalesReport(null)
    try {
      const now = new Date()
      let start, end, compareStart, compareEnd

      if (period === 'month') {
        end   = new Date(now)
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth(), 1)
      } else if (period === 'lastmonth') {
        end   = new Date(now.getFullYear(), now.getMonth(), 0); end.setHours(23,59,59,999)
        start = new Date(end.getFullYear(), end.getMonth(), 1); start.setHours(0,0,0,0)
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth(), 1)
      } else if (period === '3months') {
        end   = new Date(now)
        start = new Date(now); start.setMonth(start.getMonth() - 3); start.setHours(0,0,0,0)
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd); compareStart.setMonth(compareStart.getMonth() - 3); compareStart.setHours(0,0,0,0)
      } else if (period === 'financialYear') {
        const fyStart = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1
        start = new Date(fyStart, 4, 1); start.setHours(0,0,0,0)
        end   = new Date(now)
        compareStart = new Date(fyStart - 1, 4, 1); compareStart.setHours(0,0,0,0)
        compareEnd   = new Date(start.getTime() - 1)
      } else if (period === 'custom' && custom.start && custom.end) {
        start = new Date(custom.start); start.setHours(0,0,0,0)
        end   = new Date(custom.end);   end.setHours(23,59,59,999)
        const days = Math.round((end - start) / 86400000) + 1
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd.getTime() - days * 86400000)
      } else return

      end.setHours(23,59,59,999)

      const params = new URLSearchParams({
        start:        start.toISOString(),
        end:          end.toISOString(),
        compareStart: compareStart.toISOString(),
        compareEnd:   compareEnd.toISOString(),
      })
      const r = await fetch(`/api/sales?${params}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      const data = await r.json()
      setSalesReport(data)
    } catch(e) {
      setSalesError(e.message)
    } finally {
      setSalesLoading(false)
    }
  }

  async function toggleOrdered(itemName, supplier) {
    const isOrdered = !!orderedItems[itemName]
    const newVal = isOrdered ? null : (supplier || '')
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setOrdered', itemName, value: newVal })
    })
    setOrderedItems(prev => {
      const next = { ...prev }
      if (isOrdered) delete next[itemName]
      else next[itemName] = { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }), supplier: supplier || '' }
      return next
    })
  }

  async function loadNotes() {
    try {
      const r = await fetch('/api/notes')
      const d = await r.json()
      setNotesLog(d.notes || [])
      setNotesLoaded(true)
    } catch(e) { console.error(e) }
  }

  async function loadWastageLog() {
    try {
      const r = await fetch('/api/wastage')
      const data = await r.json()
      setWastageLog(data.entries || [])
      setWastageLoaded(true)
    } catch(e) { console.error('Wastage load error', e) }
  }

  async function loadSellersData() {
    if (sellersData) return   // already loaded
    setSellersLoading(true)
    setSellersError(null)
    try {
      const end   = new Date(); end.setHours(23,59,59,999)
      const start = new Date(); start.setDate(start.getDate() - 90); start.setHours(0,0,0,0)
      // dummy compare range (required by API but not used here)
      const compareEnd   = new Date(start.getTime() - 1)
      const compareStart = new Date(compareEnd); compareStart.setDate(compareStart.getDate() - 90)
      const params = new URLSearchParams({
        start: start.toISOString(), end: end.toISOString(),
        compareStart: compareStart.toISOString(), compareEnd: compareEnd.toISOString(),
      })
      const r = await fetch(`/api/sales?${params}`)
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      const data = await r.json()
      setSellersData(data)
    } catch(e) {
      setSellersError(e.message)
    } finally {
      setSellersLoading(false)
    }
  }

  async function saveSetting(itemName, field, value) {
    const key = `${itemName}_${field}`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, field, value })
      })
      setItems(prev => prev.map(item => {
        if (item.name !== itemName) return item
        return { ...item, [field]: ['pack','bottleML','nipML','stockOverride'].includes(field) ? Number(value) : value }
      }))
    } finally {
      setSaving(s => { const n = { ...s }; delete n[key]; return n })
    }
  }

  async function saveTargetWeeks(val) {
    const weeks = Number(val)
    if (!weeks || weeks < 1 || weeks > 26) return
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: '_global', field: 'targetWeeks', value: weeks })
    })
    setTargetWeeks(weeks)
    setEditingTarget(false)
    loadItems(true)
  }

  async function addSupplier() {
    const name = newSupplierName.trim()
    if (!name) return
    const updated = [...suppliers, name]
    setSuppliers(updated)
    setNewSupplierName('')
    setAddingSupplier(false)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: '_global', field: 'suppliers', value: updated })
    })
  }


  // ── LOAD QUARTERLY TREND DATA ─────────────────────────────────────────────
  async function loadTrendData() {
    setTrendLoading(true)
    setTrendError(null)
    try {
      const now = new Date()
      const yr  = now.getFullYear()
      const mo  = now.getMonth() // 0-indexed

      // Build last 4 calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
      // Work out which quarter we're currently in, then go back 4 from the last completed one
      // Quarter index: 0=Jan-Mar, 1=Apr-Jun, 2=Jul-Sep, 3=Oct-Dec
      const currentQ = Math.floor(mo / 3)
      // Last completed quarter
      let q = currentQ - 1
      let y = yr
      if (q < 0) { q = 3; y = yr - 1 }

      const quarters = []
      for (let i = 0; i < 4; i++) {
        const startMonth = q * 3           // 0, 3, 6, or 9
        const endMonth   = startMonth + 2  // 2, 5, 8, or 11
        const lastDay    = new Date(y, endMonth + 1, 0).getDate()
        const start      = new Date(y, startMonth, 1, 0, 0, 0)
        const end        = new Date(y, endMonth, lastDay, 23, 59, 59)
        const qNames     = ['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec']
        quarters.unshift({ start, end, label: `${qNames[q]} ${y}` })
        q--
        if (q < 0) { q = 3; y-- }
      }

      const results = await Promise.all(quarters.map(async q => {
        const params = new URLSearchParams({ start: q.start.toISOString(), end: q.end.toISOString() })
        const r = await fetch(`/api/sales?${params}`)
        if (!r.ok) throw new Error('Failed to fetch quarter data')
        const d = await r.json()
        return { label: q.label, categories: d.categories, totals: d.totals }
      }))
      setTrendData(results)
    } catch(e) {
      setTrendError(e.message)
    } finally {
      setTrendLoading(false)
    }
  }

  // ── GENERATE AGM ANNUAL REPORT PDF ────────────────────────────────────────
  async function savePriceListSetting(itemName, field, value) {
    const key = `${itemName}_${field}`
    setPlSaving(s => ({ ...s, [key]: true }))
    try {
      const current = priceListSettings[itemName] || {}
      const updated = { ...priceListSettings, [itemName]: { ...current, [field]: value } }
      setPriceListSettings(updated)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setItem', name: `__pl_${itemName}`, field, value })
      })
    } finally {
      setPlSaving(s => ({ ...s, [key]: false }))
    }
  }

  // Load price list settings on mount alongside items
  useEffect(() => {
    async function loadPriceListSettings() {
      try {
        const r = await fetch('/api/settings?action=getPriceList')
        if (r.ok) {
          const d = await r.json()
          setPriceListSettings(d.priceList || {})
        }
      } catch(e) { /* silent */ }
    }
    if (authed) loadPriceListSettings()
  }, [authed])

  // ── GENERATE PRICE LIST PDF ───────────────────────────────────────────────
  function generatePriceListPDF(items, settings) {
    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const generated = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })

    // Group visible items by category
    const grouped = {}
    for (const item of items) {
      const pl  = settings[item.name] || {}
      if (pl.hidden) continue
      if ((item.onHand || 0) <= 0) continue   // skip zero stock
      const cat = item.category || 'Other'
      const price = item.sellPrice != null ? item.sellPrice : item.squareSellPrice
      const label = pl.label || item.name
      const rawVars = (item.variations || []).filter(v => v.price != null)
      let variations = null
      if (rawVars.length > 1) {
        variations = rawVars
          .map(v => {
            const n = v.name.toLowerCase()
            const name = n.includes('glass') || n.includes('wine glass') ? 'Glass'
                       : n.includes('bottle') || n === 'regular' ? 'Bottle'
                       : v.name
            return { ...v, name }
          })
          .sort((a, b) => a.name === 'Glass' ? -1 : b.name === 'Glass' ? 1 : 0)
      }
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({ label, price, variations })
    }

    const cats = CATEGORY_ORDER.filter(c => grouped[c])

    // Split categories into two balanced halves by item row count
    const itemCount = cat => grouped[cat].reduce((s, i) => s + (i.variations ? i.variations.length : 1), 0)
    const totalRows = cats.reduce((s, c) => s + itemCount(c), 0)
    let running = 0, splitAt = Math.ceil(cats.length / 2)
    for (let i = 0; i < cats.length; i++) {
      running += itemCount(cats[i])
      if (running >= totalRows / 2) { splitAt = i + 1; break }
    }
    const page1cats = cats.slice(0, splitAt)
    const page2cats = cats.slice(splitAt)

    function renderCards(pageCats) {
      return pageCats.map(cat => `
        <div class="card">
          <div class="cat-hdr">${cat}</div>
          <table>
            ${grouped[cat].map(({ label, price, variations }) => `
              <tr>
                <td class="nm">${label}</td>
                <td class="pr">${variations
                  ? `<table style="border-collapse:collapse;width:100%;line-height:1.3">${variations.map(v => `<tr><td style="font-size:12px;color:#64748b;padding:3px 8px 3px 0;white-space:nowrap">${v.name}</td><td style="font-size:14px;font-weight:700;font-family:Courier New,monospace;text-align:right;padding:3px 0;white-space:nowrap">$${Number(v.price).toFixed(2)}</td></tr>`).join('')}</table>`
                  : (price != null ? '$' + Number(price).toFixed(2) : '&mdash;')
                }</td>
              </tr>`).join('')}
          </table>
        </div>`).join('')
    }

    const hdr = `
      <div class="hdr">
        <div><div class="title">🍺 Paynter Bar</div><div class="sub">GemLife Palmwoods &nbsp;·&nbsp; Current Prices</div></div>
        <div class="badge">Price List</div>
      </div>`

    const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Paynter Bar Price List</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }

  .hdr {
    display: flex; justify-content: space-between; align-items: center;
    background: #1e40af; color: #fff;
    padding: 10px 16px; border-radius: 6px; margin-bottom: 10px;
  }
  .title { font-size: 20px; font-weight: 800; }
  .sub   { font-size: 10px; color: #bfdbfe; margin-top: 2px; }
  .badge { background: #f59e0b; color: #0f172a; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }

  .cols { columns: 2; column-gap: 10px; }

  .card {
    break-inside: avoid;
    border: 1px solid #e2e8f0; border-radius: 5px;
    overflow: hidden; margin-bottom: 8px;
    display: inline-block; width: 100%;
  }
  .cat-hdr {
    background: #1e3a5f; color: #fff;
    font-size: 13px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em;
    padding: 8px 14px;
  }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) td { background: #f8fafc; }
  .nm { padding: 7px 14px; font-size: 15px; }
  .pr {
    padding: 7px 14px; text-align: right;
    font-size: 16px; font-weight: 700;
    font-family: 'Courier New', monospace;
    white-space: nowrap; width: 82px; vertical-align: top;
  }
  .vr { display: flex; justify-content: space-between; gap: 4px; line-height: 1.6; }
  .vn { font-size: 12px; color: #64748b; font-weight: 400; font-family: Arial; }

  .page-break { page-break-before: always; }

  .ftr {
    text-align: center; font-size: 8.5px; color: #94a3b8;
    margin-top: 8px; padding-top: 4px;
    border-top: 1px solid #f1f5f9;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hdr, .cat-hdr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head><body>

  ${hdr}
  <div class="cols">${renderCards(page1cats)}</div>
  <div class="ftr">Page 1 of 2 &nbsp;·&nbsp; Prices current as of ${generated} &nbsp;·&nbsp; Paynter Bar, GemLife Palmwoods</div>

  <div class="page-break">
    ${hdr}
    <div class="cols">${renderCards(page2cats)}</div>
    <div class="ftr">Page 2 of 2 &nbsp;·&nbsp; Prices current as of ${generated} &nbsp;·&nbsp; Paynter Bar, GemLife Palmwoods</div>
  </div>

</body></html>`


    // ── PDF / Print ────────────────────────────────────────────────────────
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }

  async function generateStockReport(exportXlsx = false) {
    const date = new Date()
    const monthName = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
    const generated = date.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    // Group by category
    const byCategory = {}
    for (const item of items) {
      const cat = item.category || 'Uncategorised'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(item)
    }

    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const sortedCats = [...CATEGORY_ORDER.filter(c => byCategory[c]), ...Object.keys(byCategory).filter(c => !CATEGORY_ORDER.includes(c))]

    const critItems  = items.filter(i => i.priority === 'CRITICAL')
    const lowItems   = items.filter(i => i.priority === 'LOW')
    const orderItems = items.filter(i => i.orderQty > 0)

    let categorySections = ''
    for (const cat of sortedCats) {
      const catItems = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))
      const rows = catItems.map(item => {
        const priorityColor = item.priority === 'CRITICAL' ? '#dc2626' : item.priority === 'LOW' ? '#ca8a04' : '#16a34a'
        const rowBg = item.priority === 'CRITICAL' ? '#fff5f5' : item.priority === 'LOW' ? '#fffbeb' : '#fff'
        const orderQty = item.isSpirit
          ? (item.nipsToOrder > 0 ? `${item.nipsToOrder} nips (${item.bottlesToOrder} btl)` : '—')
          : (item.orderQty > 0 ? item.orderQty : '—')
        return `<tr style="background:${rowBg}">
          <td>${item.name}</td>
          <td style="text-align:right;font-family:monospace">${item.onHand}</td>
          <td style="text-align:right;font-family:monospace">${item.weeklyAvg}</td>
          <td style="text-align:right;font-family:monospace">${item.targetStock}</td>
          <td style="text-align:center;color:${priorityColor};font-weight:700;font-size:11px">${item.priority}</td>
          <td style="text-align:right;font-weight:${item.orderQty > 0 ? '700' : '400'}">${orderQty}</td>
          <td style="color:#64748b;font-size:11px">${item.supplier || ''}</td>
        </tr>`
      }).join('')
      categorySections += `
        <tr class="cat-header"><td colspan="7">${cat} <span style="font-weight:400;font-size:11px">(${catItems.length} items)</span></td></tr>
        ${rows}
        <tr class="spacer"><td colspan="7"></td></tr>`
    }

    const html = `<!DOCTYPE html><html><head><title>Stock on Hand — ${monthName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }
  .page { padding: 28px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
  .header-left h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .header-left p { font-size: 11px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
  .header-right strong { color: #0f172a; font-size: 13px; display: block; }
  .summary { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .summary-card { flex: 1; padding: 12px 16px; border-right: 1px solid #e2e8f0; }
  .summary-card:last-child { border-right: none; }
  .summary-card .num { font-size: 22px; font-weight: 700; font-family: monospace; color: #0f172a; }
  .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .summary-card.crit .num { color: #dc2626; }
  .summary-card.low .num  { color: #ca8a04; }
  .summary-card.ord .num  { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f172a; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  th:nth-child(2), th:nth-child(3), th:nth-child(4), th:nth-child(6) { text-align: right; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  tr.cat-header td { background: #f1f5f9; font-weight: 700; font-size: 11px; color: #374151; padding: 8px 10px; border-top: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
  tr.spacer td { height: 4px; background: #fff; border: none; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    body { font-size: 11px; }
    .page { padding: 16px; }
    tr { page-break-inside: avoid; }
    tr.cat-header { page-break-before: auto; }
  }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Stock on Hand Report</h1>
      <p>Paynter Bar — GemLife Palmwoods</p>
    </div>
    <div class="header-right">
      <strong>${monthName}</strong>
      Generated: ${generated}<br>
      Sales period: ${daysBack} days<br>
      Target: ${targetWeeks} weeks stock
    </div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="num">${items.length}</div><div class="lbl">Total Items</div></div>
    <div class="summary-card crit"><div class="num">${critItems.length}</div><div class="lbl">Critical Stock</div></div>
    <div class="summary-card low"><div class="num">${lowItems.length}</div><div class="lbl">Low Stock</div></div>
    <div class="summary-card ord"><div class="num">${orderItems.length}</div><div class="lbl">Items to Order</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th>On Hand</th><th>Wkly Avg</th><th>Target</th><th style="text-align:center">Status</th><th>Order Qty</th><th>Supplier</th>
    </tr></thead>
    <tbody>${categorySections}</tbody>
  </table>
  <div class="footer">
    <span>Paynter Bar Reorder System — Data from Square POS</span>
    <span>Page 1</span>
  </div>
</div></body></html>`

    // ── Excel export ──────────────────────────────────────────────────────
    if (exportXlsx) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
      document.head.appendChild(script)
      await new Promise(r => { script.onload = r })
      const XLSX = window.XLSX

      // ── Style helpers ────────────────────────────────────────────────────
      const NAVY  = '0F172A'
      const TEAL  = '0E7490'
      const WHITE = 'FFFFFF'
      const LGREY = 'F1F5F9'
      const RED   = 'DC2626'
      const AMBER = 'CA8A04'
      const GREEN = '16A34A'
      const BLUE  = '2563EB'

      const sTitle  = { font: { bold: true, sz: 16, color: { rgb: NAVY } } }
      const sMeta   = { font: { sz: 10, color: { rgb: '64748B' } } }
      const sMetaB  = { font: { bold: true, sz: 10, color: { rgb: NAVY } } }
      const sSummHdr = {
        font: { bold: true, sz: 11, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: NAVY } },
        border: { bottom: { style: 'thin', color: { rgb: TEAL } } }
      }
      const sCatHdr = {
        font: { bold: true, sz: 10, color: { rgb: '374151' } },
        fill: { fgColor: { rgb: LGREY } },
        border: { top: { style: 'medium', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } }
      }
      const sColHdr = {
        font: { bold: true, sz: 10, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: TEAL } },
        alignment: { horizontal: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: NAVY } } }
      }
      const sColHdrL = { ...sColHdr, alignment: { horizontal: 'left' } }

      const statusStyle = (priority) => {
        const col = priority === 'CRITICAL' ? RED : priority === 'LOW' ? AMBER : GREEN
        return { font: { bold: true, sz: 10, color: { rgb: col } }, alignment: { horizontal: 'center' } }
      }
      const rowStyle = (priority, idx) => {
        const bg = priority === 'CRITICAL' ? 'FFF5F5' : priority === 'LOW' ? 'FFFBEB' : idx % 2 === 0 ? WHITE : 'F8FAFC'
        return { fill: { fgColor: { rgb: bg } }, font: { sz: 10 }, alignment: { horizontal: 'left' } }
      }
      const numStyle = (priority, idx) => ({ ...rowStyle(priority, idx), alignment: { horizontal: 'center' } })

      const cell = (v, s) => ({ v, s, t: typeof v === 'number' ? 'n' : 's' })
      const empty = (s = {}) => ({ v: '', s })

      // ── Summary stats row ─────────────────────────────────────────────────
      const summaryRows = [
        [cell('Stock on Hand Report — Paynter Bar', sTitle), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell('Period:', sMeta), cell(monthName, sMetaB), empty(), empty(), empty(), empty(), empty()],
        [cell('Generated:', sMeta), cell(generated, sMeta), empty(), empty(), empty(), empty(), empty()],
        [cell(`Sales avg: ${daysBack} days  |  Target: ${targetWeeks} weeks stock`, sMeta), empty(), empty(), empty(), empty(), empty(), empty()],
        [],
        [cell('SUMMARY', sSummHdr), empty(), empty(), empty(), empty(), empty(), empty()],
        [
          cell(`${items.length}  Total Items`, { font: { bold: true, sz: 11, color: { rgb: NAVY } }, alignment: { horizontal: 'center' } }),
          cell(`${critItems.length}  Critical`, { font: { bold: true, sz: 11, color: { rgb: RED } }, alignment: { horizontal: 'center' } }),
          cell(`${lowItems.length}  Low Stock`, { font: { bold: true, sz: 11, color: { rgb: AMBER } }, alignment: { horizontal: 'center' } }),
          cell(`${orderItems.length}  To Order`, { font: { bold: true, sz: 11, color: { rgb: BLUE } }, alignment: { horizontal: 'center' } }),
          empty(), empty(), empty()
        ],
        [],
        // Column headers
        [
          cell('Item', sColHdrL),
          cell('On Hand', sColHdr),
          cell('Wkly Avg', sColHdr),
          cell('Target', sColHdr),
          cell('Status', sColHdr),
          cell('Order Qty', sColHdr),
          cell('Supplier', sColHdrL),
        ],
      ]

      // ── Data rows by category ─────────────────────────────────────────────
      const dataRows = []
      for (const cat of sortedCats) {
        const catItems = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))
        // Category header row
        dataRows.push([
          cell(`${cat.toUpperCase()}  (${catItems.length} items)`, sCatHdr),
          empty(sCatHdr), empty(sCatHdr), empty(sCatHdr), empty(sCatHdr), empty(sCatHdr), empty(sCatHdr)
        ])
        catItems.forEach((item, idx) => {
          const rs = rowStyle(item.priority, idx)
          const ns = numStyle(item.priority, idx)
          const orderQty = item.isSpirit
            ? (item.nipsToOrder > 0 ? `${item.nipsToOrder} nips (${item.bottlesToOrder} btl)` : '—')
            : (item.orderQty > 0 ? String(item.orderQty) : '—')
          dataRows.push([
            cell(item.name, rs),
            cell(item.onHand, ns),
            cell(item.weeklyAvg, ns),
            cell(item.targetStock, ns),
            cell(item.priority, statusStyle(item.priority)),
            cell(orderQty, { ...ns, font: { ...ns.font, bold: item.orderQty > 0 } }),
            cell(item.supplier || '', { ...rs, font: { sz: 10, color: { rgb: '64748B' } } }),
          ])
        })
        dataRows.push([]) // spacer
      }

      const allRows = [...summaryRows, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      ws['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 }]
      ws['!rows'] = allRows.map((_, i) => i === 0 ? { hpt: 26 } : { hpt: 18 })
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock on Hand')
      XLSX.writeFile(wb, `PaynterBar_SOH_${monthName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
      return
    }

    // ── PDF / Print ────────────────────────────────────────────────────────
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }

  async function generateSalesReport(exportXlsx = false) {
    setSalesPdfLoading(true)
    const now = new Date()

    let start, end, periodLabel, compareStart, compareEnd

    // Use the period currently selected in the Sales tab
    if (salesPeriod === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      end   = new Date(now); end.setHours(23,59,59,999)
      periodLabel = start.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }) + ' (MTD)'
      compareEnd   = new Date(start.getTime() - 1)
      compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth(), 1)
    } else if (salesPeriod === 'lastmonth') {
      end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0)
      periodLabel = start.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
      compareEnd   = new Date(start.getTime() - 1)
      compareStart = new Date(compareEnd.getFullYear(), compareEnd.getMonth(), 1)
    } else if (salesPeriod === '3months') {
      end   = new Date(now); end.setHours(23,59,59,999)
      start = new Date(now); start.setMonth(start.getMonth() - 3); start.setHours(0,0,0,0)
      periodLabel = `${start.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`
      compareEnd   = new Date(start.getTime() - 1)
      compareStart = new Date(compareEnd); compareStart.setMonth(compareStart.getMonth() - 3); compareStart.setHours(0,0,0,0)
    } else if (salesPeriod === 'financialYear') {
      const fyStart = now.getMonth() >= 4 ? now.getFullYear() : now.getFullYear() - 1
      start = new Date(fyStart, 4, 1, 0, 0, 0)
      end   = new Date(now); end.setHours(23,59,59,999)
      periodLabel = `Financial Year ${fyStart}–${String(fyStart + 1).slice(2)} (May–Apr)`
      compareStart = new Date(fyStart - 1, 4, 1, 0, 0, 0)
      compareEnd   = new Date(start.getTime() - 1)
    } else if (salesPeriod === 'custom') {
      if (!salesCustom?.start || !salesCustom?.end) { setSalesPdfLoading(false); alert('Please select a custom date range in the Sales tab first'); return }
      start = new Date(salesCustom.start + 'T00:00:00'); start.setHours(0,0,0,0)
      end   = new Date(salesCustom.end   + 'T00:00:00'); end.setHours(23,59,59,999)
      periodLabel = `${new Date(salesCustom.start).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(salesCustom.end).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
      const diffMs = end - start
      compareEnd   = new Date(start.getTime() - 1)
      compareStart = new Date(compareEnd.getTime() - diffMs)
    } else {
      setSalesPdfLoading(false); return
    }

    const params = new URLSearchParams({
      start: start.toISOString(), end: end.toISOString(),
      compareStart: compareStart.toISOString(), compareEnd: compareEnd.toISOString(),
    })

    let report
    try {
      const r = await fetch(`/api/sales?${params}`)
      if (!r.ok) throw new Error('Failed to fetch sales data')
      report = await r.json()
    } catch(e) {
      setSalesPdfLoading(false)
      alert('Could not fetch sales data: ' + e.message)
      return
    }

    setSalesPdfLoading(false)
    setSalesPdfModal(false)

    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const hasRev = report.items.some(i => i.revenue != null && i.revenue > 0)
    const generated = now.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const fmtRev = n => n ? `$${Number(n).toFixed(2)}` : '—'
    const fmtChg = n => n == null ? '—' : (n >= 0 ? '+' : '') + n + '%'
    const prevLabel = salesPeriod === 'financialYear' ? 'Prior FY' : salesPeriod === '3months' ? 'Prior 3 Mo' : 'Prior Period'

    if (exportXlsx) {
      // ── Excel export ──────────────────────────────────────────────────────
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
      document.head.appendChild(script)
      await new Promise(r => { script.onload = r })
      const XLSX = window.XLSX

      const wb = XLSX.utils.book_new()

      // ── Style helpers ──────────────────────────────────────────────────────
      const NAVY   = '0F172A'
      const TEAL   = '0E7490'
      const LGREY  = 'F1F5F9'
      const WHITE  = 'FFFFFF'
      const GREEN  = '16A34A'
      const RED    = 'DC2626'

      const sTitle = { font: { bold: true, sz: 16, color: { rgb: NAVY } } }
      const sMeta  = { font: { sz: 10, color: { rgb: '64748B' } } }
      const sSecHdr = {
        font: { bold: true, sz: 11, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: 'left' },
        border: { bottom: { style: 'thin', color: { rgb: TEAL } } }
      }
      const sColHdr = {
        font: { bold: true, sz: 10, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: TEAL } },
        alignment: { horizontal: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: NAVY } } }
      }
      const sColHdrL = { ...sColHdr, alignment: { horizontal: 'left' } }
      const sTotals = {
        font: { bold: true, sz: 10, color: { rgb: NAVY } },
        fill: { fgColor: { rgb: LGREY } },
        border: { top: { style: 'medium', color: { rgb: NAVY } } }
      }
      const sEven  = { fill: { fgColor: { rgb: WHITE } }, font: { sz: 10 } }
      const sOdd   = { fill: { fgColor: { rgb: 'F8FAFC' } }, font: { sz: 10 } }
      const sPct   = (shade) => ({ ...shade, numFmt: '0.0%', alignment: { horizontal: 'center' } })
      const sCurr  = (shade) => ({ ...shade, numFmt: '"$"#,##0', alignment: { horizontal: 'right' } })
      const sNum   = (shade) => ({ ...shade, alignment: { horizontal: 'center' } })

      const cell = (v, s) => ({ v, s, t: typeof v === 'number' ? 'n' : 's' })
      const empty = () => ({ v: '', s: {} })

      // ── Build rows ─────────────────────────────────────────────────────────
      const catDataRows = CATEGORY_ORDER.filter(c => report.categories[c]).map((c, idx) => {
        const cat = report.categories[c]
        const pct = report.totals.unitsSold > 0 ? (cat.unitsSold / report.totals.unitsSold) : 0
        const chg = cat.prevSold > 0 ? ((cat.unitsSold - cat.prevSold) / cat.prevSold) : null
        const shade = idx % 2 === 0 ? sEven : sOdd
        const row = [
          cell(c, { ...shade, font: { ...shade.font, bold: true } }),
          cell(cat.unitsSold, sNum(shade)),
          cell(cat.prevSold || 0, sNum(shade)),
          chg != null ? cell(chg, sPct(shade)) : cell('—', { ...shade, alignment: { horizontal: 'center' } }),
          cell(pct, sPct(shade)),
        ]
        if (hasRev) row.push(cell(cat.revenue || 0, sCurr(shade)))
        return row
      })

      const itemDataRows = report.items.filter(i => i.unitsSold > 0).map((i, idx) => {
        const shade = idx % 2 === 0 ? sEven : sOdd
        const chg = i.change != null ? i.change / 100 : null
        const row = [
          cell(i.name, { ...shade, font: { ...shade.font, bold: false } }),
          cell(i.category, { ...shade, font: { sz: 10, color: { rgb: '64748B' } } }),
          cell(i.unitsSold, sNum(shade)),
          cell(i.prevSold || 0, sNum(shade)),
          chg != null ? cell(chg, sPct(shade)) : cell('—', { ...shade, alignment: { horizontal: 'center' } }),
        ]
        if (hasRev) row.push(cell(i.revenue || 0, sCurr(shade)))
        return row
      })

      // ── Assemble worksheet ─────────────────────────────────────────────────
      const rows = [
        // Title block
        [cell('Sales Report — Paynter Bar', sTitle), empty(), empty(), empty(), empty(), ...(hasRev ? [empty()] : [])],
        [cell('Period:', sMeta), cell(periodLabel, { ...sMeta, font: { bold: true, sz: 10 } }), empty(), empty(), empty(), ...(hasRev ? [empty()] : [])],
        [cell('Generated:', sMeta), cell(generated, sMeta), empty(), empty(), empty(), ...(hasRev ? [empty()] : [])],
        [],
        // Summary section
        [cell('SUMMARY', sSecHdr), empty(), empty(), empty(), empty(), ...(hasRev ? [empty()] : [])],
        [cell('Total Units Sold', { font: { bold: true, sz: 10 } }), cell(report.totals.unitsSold, { font: { sz: 10 }, alignment: { horizontal: 'center' } }), cell(prevLabel, sMeta), cell(report.totals.prevSold || 0, { ...sMeta, alignment: { horizontal: 'center' } })],
        ...(hasRev ? [[cell('Total Revenue', { font: { bold: true, sz: 10 } }), cell(report.totals.revenue || 0, sCurr(sEven)), cell('Prior Revenue', sMeta), cell(report.totals.prevRev || 0, sCurr({ ...sMeta }))]] : []),
        [cell('Items Sold', { font: { bold: true, sz: 10 } }), cell(report.items.filter(i => i.unitsSold > 0).length, { font: { sz: 10 }, alignment: { horizontal: 'center' } })],
        [],
        // Category breakdown
        [cell('CATEGORY BREAKDOWN', sSecHdr), empty(), empty(), empty(), empty(), ...(hasRev ? [empty()] : [])],
        [
          cell('Category', sColHdrL),
          cell('Units Sold', sColHdr),
          cell(prevLabel, sColHdr),
          cell('Change %', sColHdr),
          cell('% of Total', sColHdr),
          ...(hasRev ? [cell('Revenue', sColHdr)] : [])
        ],
        ...catDataRows,
        [
          cell('TOTAL', sTotals),
          cell(report.totals.unitsSold, { ...sTotals, alignment: { horizontal: 'center' } }),
          cell(report.totals.prevSold || 0, { ...sTotals, alignment: { horizontal: 'center' } }),
          cell('', sTotals),
          cell(1, { ...sTotals, numFmt: '0.0%', alignment: { horizontal: 'center' } }),
          ...(hasRev ? [cell(report.totals.revenue || 0, { ...sTotals, numFmt: '"$"#,##0', alignment: { horizontal: 'right' } })] : [])
        ],
        [],
        // All items
        [cell('ALL ITEMS', sSecHdr), empty(), empty(), empty(), empty(), ...(hasRev ? [empty()] : [])],
        [
          cell('Item', sColHdrL),
          cell('Category', sColHdrL),
          cell('Units Sold', sColHdr),
          cell(prevLabel, sColHdr),
          cell('Change %', sColHdr),
          ...(hasRev ? [cell('Revenue', sColHdr)] : [])
        ],
        ...itemDataRows,
      ]

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, ...(hasRev ? [{ wch: 14 }] : [])]

      // Merge title cell across all columns
      const lastCol = hasRev ? 5 : 4
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } },
        { s: { r: rows.indexOf(rows.find((r,i) => i > 4 && r[0]?.v === 'CATEGORY BREAKDOWN')), c: 0 },
          e: { r: rows.indexOf(rows.find((r,i) => i > 4 && r[0]?.v === 'CATEGORY BREAKDOWN')), c: lastCol } },
      ]

      // Row heights
      ws['!rows'] = rows.map((_, i) => i === 0 ? { hpt: 28 } : { hpt: 18 })

      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report')
      XLSX.writeFile(wb, `PaynterBar_Sales_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
      return
    }

    // ── PDF (print) ───────────────────────────────────────────────────────────
    const top10 = report.items.filter(i => i.unitsSold > 0).slice(0, 10)
    const top10Rows = top10.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="text-align:center;color:#94a3b8;font-size:10px">${idx + 1}</td>
        <td>${item.name}</td>
        <td style="color:#64748b;font-size:11px">${item.category}</td>
        <td style="text-align:right;font-family:monospace;font-weight:700">${item.unitsSold}</td>
        <td style="text-align:right;font-family:monospace;color:#64748b">${item.prevSold || 0}</td>
        <td style="text-align:right;font-family:monospace;color:${(item.change||0) >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${fmtChg(item.change)}</td>
        ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(item.revenue)}</td>` : ''}
      </tr>`).join('')

    const catRows = CATEGORY_ORDER.filter(c => report.categories[c]).map((c, idx) => {
        const cat = report.categories[c]
        const pct = report.totals.unitsSold > 0 ? ((cat.unitsSold / report.totals.unitsSold) * 100).toFixed(1) : 0
        const chg = cat.prevSold > 0 ? +(((cat.unitsSold - cat.prevSold) / cat.prevSold) * 100).toFixed(1) : null
        return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td>${c}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700">${cat.unitsSold}</td>
          <td style="text-align:right;font-family:monospace;color:#64748b">${cat.prevSold || 0}</td>
          <td style="text-align:right;font-family:monospace;color:${chg >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${fmtChg(chg)}</td>
          <td style="text-align:right;color:#64748b">${pct}%</td>
          ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(cat.revenue)}</td>` : ''}
        </tr>`
      }).join('')

    const html = `<!DOCTYPE html><html><head><title>Sales Report — ${periodLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }
  .page { padding: 28px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
  .header-left h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .header-left p { font-size: 11px; color: #64748b; margin-top: 3px; }
  .header-right { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
  .header-right strong { color: #0f172a; font-size: 13px; display: block; }
  .summary { display: flex; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .summary-card { flex: 1; padding: 12px 16px; border-right: 1px solid #e2e8f0; }
  .summary-card:last-child { border-right: none; }
  .summary-card .num { font-size: 22px; font-weight: 700; font-family: monospace; color: #0f172a; }
  .summary-card .lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
  .summary-card .sub { font-size: 10px; color: #94a3b8; margin-top: 1px; }
  .section-title { font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #0f172a; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  .totals-row td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #e2e8f0; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { font-size: 11px; } .page { padding: 16px; } tr { page-break-inside: avoid; } }
</style>
</head><body><div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Sales Report</h1>
      <p>Paynter Bar — GemLife Palmwoods</p>
    </div>
    <div class="header-right">
      <strong>${periodLabel}</strong>
      Generated: ${generated}<br>
      Compared to: ${prevLabel}
    </div>
  </div>
  <div class="summary">
    <div class="summary-card">
      <div class="num">${report.totals.unitsSold}</div>
      <div class="lbl">Total Units Sold</div>
      <div class="sub">Prior: ${report.totals.prevSold || 0}</div>
    </div>
    ${hasRev ? `<div class="summary-card">
      <div class="num">${fmtRev(report.totals.revenue)}</div>
      <div class="lbl">Total Revenue</div>
      <div class="sub">Prior: ${fmtRev(report.totals.prevRev)}</div>
    </div>` : ''}
    <div class="summary-card">
      <div class="num">${report.items.filter(i => i.unitsSold > 0).length}</div>
      <div class="lbl">Items Sold</div>
    </div>
    <div class="summary-card">
      <div class="num" style="font-size:14px">${report.items[0]?.name.split(' ').slice(0,3).join(' ') || '—'}</div>
      <div class="lbl">Top Seller</div>
      <div class="sub">${report.items[0]?.unitsSold || 0} units</div>
    </div>
  </div>
  <div class="section-title">Category Breakdown</div>
  <table>
    <thead><tr>
      <th>Category</th><th style="text-align:right">Units Sold</th><th style="text-align:right">${prevLabel}</th>
      <th style="text-align:right">Change</th><th style="text-align:right">% of Total</th>
      ${hasRev ? '<th style="text-align:right">Revenue</th>' : ''}
    </tr></thead>
    <tbody>
      ${catRows}
      <tr class="totals-row">
        <td>TOTAL</td>
        <td style="text-align:right;font-family:monospace">${report.totals.unitsSold}</td>
        <td style="text-align:right;font-family:monospace;color:#64748b">${report.totals.prevSold || 0}</td>
        <td style="text-align:right">—</td><td style="text-align:right">100%</td>
        ${hasRev ? `<td style="text-align:right;font-family:monospace;color:#16a34a">${fmtRev(report.totals.revenue)}</td>` : ''}
      </tr>
    </tbody>
  </table>
  <div class="section-title">Top 10 Sellers</div>
  <table>
    <thead><tr>
      <th style="width:28px;text-align:center">#</th><th>Item</th><th>Category</th>
      <th style="text-align:right">Units Sold</th><th style="text-align:right">${prevLabel}</th>
      <th style="text-align:right">Change</th>
      ${hasRev ? '<th style="text-align:right">Revenue</th>' : ''}
    </tr></thead>
    <tbody>${top10Rows}</tbody>
  </table>
  <div class="footer">
    <span>Paynter Bar Hub — Data from Square POS</span>
    <span>Generated ${generated}</span>
  </div>
</div></body></html>`

    // ── Excel export ──────────────────────────────────────────────────────
    if (exportXlsx) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
      document.head.appendChild(script)
      await new Promise(r => { script.onload = r })
      const XLSX = window.XLSX

      // ── Style helpers ────────────────────────────────────────────────────
      const NAVY  = '0F172A'
      const TEAL  = '0E7490'
      const WHITE = 'FFFFFF'
      const LGREY = 'F1F5F9'
      const RED   = 'DC2626'
      const AMBER = 'CA8A04'
      const GREEN = '16A34A'
      const BLUE  = '2563EB'

      const sTitle  = { font: { bold: true, sz: 16, color: { rgb: NAVY } } }
      const sMeta   = { font: { sz: 10, color: { rgb: '64748B' } } }
      const sMetaB  = { font: { bold: true, sz: 10, color: { rgb: NAVY } } }
      const sSummHdr = {
        font: { bold: true, sz: 11, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: NAVY } },
        border: { bottom: { style: 'thin', color: { rgb: TEAL } } }
      }
      const sCatHdr = {
        font: { bold: true, sz: 10, color: { rgb: '374151' } },
        fill: { fgColor: { rgb: LGREY } },
        border: { top: { style: 'medium', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } }
      }
      const sColHdr = {
        font: { bold: true, sz: 10, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: TEAL } },
        alignment: { horizontal: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: NAVY } } }
      }
      const sColHdrL = { ...sColHdr, alignment: { horizontal: 'left' } }

      const statusStyle = (priority) => {
        const col = priority === 'CRITICAL' ? RED : priority === 'LOW' ? AMBER : GREEN
        return { font: { bold: true, sz: 10, color: { rgb: col } }, alignment: { horizontal: 'center' } }
      }
      const rowStyle = (priority, idx) => {
        const bg = priority === 'CRITICAL' ? 'FFF5F5' : priority === 'LOW' ? 'FFFBEB' : idx % 2 === 0 ? WHITE : 'F8FAFC'
        return { fill: { fgColor: { rgb: bg } }, font: { sz: 10 }, alignment: { horizontal: 'left' } }
      }
      const numStyle = (priority, idx) => ({ ...rowStyle(priority, idx), alignment: { horizontal: 'center' } })

      const cell = (v, s) => ({ v, s, t: typeof v === 'number' ? 'n' : 's' })
      const empty = (s = {}) => ({ v: '', s })

      // ── Summary stats row ─────────────────────────────────────────────────
      const summaryRows = [
        [cell('Stock on Hand Report — Paynter Bar', sTitle), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell('Period:', sMeta), cell(monthName, sMetaB), empty(), empty(), empty(), empty(), empty()],
        [cell('Generated:', sMeta), cell(generated, sMeta), empty(), empty(), empty(), empty(), empty()],
        [cell(`Sales avg: ${daysBack} days  |  Target: ${targetWeeks} weeks stock`, sMeta), empty(), empty(), empty(), empty(), empty(), empty()],
        [],
        [cell('SUMMARY', sSummHdr), empty(), empty(), empty(), empty(), empty(), empty()],
        [
          cell(`${items.length}  Total Items`, { font: { bold: true, sz: 11, color: { rgb: NAVY } }, alignment: { horizontal: 'center' } }),
          cell(`${critItems.length}  Critical`, { font: { bold: true, sz: 11, color: { rgb: RED } }, alignment: { horizontal: 'center' } }),
          cell(`${lowItems.length}  Low Stock`, { font: { bold: true, sz: 11, color: { rgb: AMBER } }, alignment: { horizontal: 'center' } }),
          cell(`${orderItems.length}  To Order`, { font: { bold: true, sz: 11, color: { rgb: BLUE } }, alignment: { horizontal: 'center' } }),
          empty(), empty(), empty()
        ],
        [],
        // Column headers
        [
          cell('Item', sColHdrL),
          cell('On Hand', sColHdr),
          cell('Wkly Avg', sColHdr),
          cell('Target', sColHdr),
          cell('Status', sColHdr),
          cell('Order Qty', sColHdr),
          cell('Supplier', sColHdrL),
        ],
      ]

      // ── Data rows by category ─────────────────────────────────────────────
      const dataRows = []
      for (const cat of sortedCats) {
        const catItems = byCategory[cat].sort((a, b) => a.name.localeCompare(b.name))
        // Category header row
        dataRows.push([
          cell(`${cat.toUpperCase()}  (${catItems.length} items)`, sCatHdr),
          empty(sCatHdr), empty(sCatHdr), empty(sCatHdr), empty(sCatHdr), empty(sCatHdr), empty(sCatHdr)
        ])
        catItems.forEach((item, idx) => {
          const rs = rowStyle(item.priority, idx)
          const ns = numStyle(item.priority, idx)
          const orderQty = item.isSpirit
            ? (item.nipsToOrder > 0 ? `${item.nipsToOrder} nips (${item.bottlesToOrder} btl)` : '—')
            : (item.orderQty > 0 ? String(item.orderQty) : '—')
          dataRows.push([
            cell(item.name, rs),
            cell(item.onHand, ns),
            cell(item.weeklyAvg, ns),
            cell(item.targetStock, ns),
            cell(item.priority, statusStyle(item.priority)),
            cell(orderQty, { ...ns, font: { ...ns.font, bold: item.orderQty > 0 } }),
            cell(item.supplier || '', { ...rs, font: { sz: 10, color: { rgb: '64748B' } } }),
          ])
        })
        dataRows.push([]) // spacer
      }

      const allRows = [...summaryRows, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      ws['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 }]
      ws['!rows'] = allRows.map((_, i) => i === 0 ? { hpt: 26 } : { hpt: 18 })
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock on Hand')
      XLSX.writeFile(wb, `PaynterBar_SOH_${monthName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
      return
    }

    // ── PDF / Print ────────────────────────────────────────────────────────
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }

  function printOrderSheet(supplier) {
    const orderItems = items.filter(i => i.supplier === supplier && i.orderQty > 0)
    const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const rows = orderItems.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td style="text-align:right">${item.onHand}</td>
        <td style="text-align:right;font-weight:700">${item.isSpirit ? (item.nipsToOrder || '-') : (item.orderQty || '-')}</td>
        <td style="text-align:right">${item.isSpirit && item.bottlesToOrder ? item.bottlesToOrder : '-'}</td>
        <td>${item.notes || ''}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Order - ${supplier} - ${date}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;margin:20px}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#1f2937;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:24px;font-size:11px;color:#9ca3af}@media print{body{margin:10px}}</style>
</head><body>
<h1>Order Sheet - ${supplier}</h1>
<div class="sub">Paynter Bar, GemLife Palmwoods | ${date} | ${orderItems.length} item(s) to order</div>
<table><thead><tr><th>Item</th><th>Category</th><th style="text-align:right">On Hand</th><th style="text-align:right">Order Qty</th><th style="text-align:right">Bottles</th><th>Notes</th></tr></thead>
<tbody>${rows}</tbody></table>
${orderItems.length === 0 ? '<p style="color:#6b7280;margin-top:16px">No items to order from this supplier this week.</p>' : ''}
<div class="footer">Generated ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })} | Paynter Bar Reorder System</div>
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  function exportStocktake() {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
    script.onload = () => {
      // Columns:
      // A=Item, B=Category, C=Supplier,
      // D=Cool Room, E=Store Room, F=Bar,
      // G=Total Count (=D+E+F)  [bottles (decimal) for spirits, units for others]
      // H=Nips/Bottle           [pre-filled for spirits, blank for others]
      // I=Total Nips            [=G*H for spirits, blank for others]
      // J=Square On Hand        [nips for spirits, units for others]
      // K=Difference            [=I-J for spirits, =G-J for others]

      const rows = displayed.map(item => ({
        'Item':           item.name,
        'Category':       item.category,
        'Supplier':       item.supplier,
        'Cool Room':      '',
        'Store Room':     '',
        'Bar':            '',
        'Total Count':    '',
        'Nips/Bottle':    item.isSpirit ? (item.bottleML || 700) / (item.nipML || 30) : '',
        'Total Nips':     '',
        'Square On Hand': item.onHand,
        'Difference':     '',
      }))

      const ws = window.XLSX.utils.json_to_sheet(rows)

      ws['!cols'] = [
        { wch: 40 }, // A Item
        { wch: 18 }, // B Category
        { wch: 16 }, // C Supplier
        { wch: 12 }, // D Cool Room
        { wch: 12 }, // E Store Room
        { wch: 8  }, // F Bar
        { wch: 13 }, // G Total Count
        { wch: 12 }, // H Nips/Bottle
        { wch: 12 }, // I Total Nips
        { wch: 16 }, // J Square On Hand
        { wch: 12 }, // K Difference
      ]
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }

      const range = window.XLSX.utils.decode_range(ws['!ref'])

      // Style header row — dark navy background, white bold text, taller row
      const headerStyle = {
        font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        fill:      { fgColor: { rgb: '0F172A' }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          bottom: { style: 'medium', color: { rgb: '2563EB' } }
        }
      }
      const cols = ['A','B','C','D','E','F','G','H','I','J','K']
      cols.forEach(col => {
        if (ws[`${col}1`]) ws[`${col}1`].s = headerStyle
      })
      ws['!rows'] = [{ hpt: 28 }] // taller header row

      // Format data rows
      displayed.forEach((item, idx) => {
        const row = idx + 2
        ws[`G${row}`] = { f: `D${row}+E${row}+F${row}`, t: 'n', z: '0.0' }

        if (item.isSpirit) {
          // Format pre-filled Nips/Bottle to 1dp
          if (ws[`H${row}`] && ws[`H${row}`].v !== '') {
            ws[`H${row}`] = { v: ws[`H${row}`].v, t: 'n', z: '0.0' }
          }
          ws[`I${row}`] = { f: `G${row}*H${row}`, t: 'n', z: '0.0' }
          ws[`K${row}`] = { f: `I${row}-J${row}`, t: 'n', z: '0.0' }
        } else {
          ws[`I${row}`] = { v: '', t: 's' }
          ws[`K${row}`] = { f: `G${row}-J${row}`, t: 'n', z: '0.0' }
        }
      })

      const wb = window.XLSX.utils.book_new()
      window.XLSX.utils.book_append_sheet(wb, ws, 'Stocktake')
      window.XLSX.writeFile(wb, `Paynter-Bar-Stocktake-${new Date().toISOString().split('T')[0]}.xlsx`)
    }
    document.head.appendChild(script)
  }

  const displayed = items
    .filter(item => view === 'all' || item.supplier === view)
    .filter(item => !filterOrder || item.orderQty > 0)

  const onOrderCount = Object.keys(orderedItems).length
  const orderCount   = items.filter(i => i.orderQty > 0 && !orderedItems[i.name]).length
  const critCount    = items.filter(i => i.priority === 'CRITICAL').length

  if (!authed) return (
    <div style={styles.loadWrap}>
      <div style={{ ...styles.loadBox, background: '#fff', padding: 40, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', minWidth: 300 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Paynter Bar Hub</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Enter PIN to continue</p>
        <input type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={e => { setPin(e.target.value); setPinError(false) }}
          onKeyDown={e => e.key === 'Enter' && checkPin()} placeholder="PIN" autoFocus
          style={{ width: '100%', fontSize: 24, textAlign: 'center', padding: '10px 16px', borderRadius: 8, border: pinError ? '2px solid #dc2626' : '2px solid #e2e8f0', outline: 'none', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.3em', marginBottom: 8, boxSizing: 'border-box' }} />
        {pinError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>Incorrect PIN. Try again.</p>}
        <button onClick={checkPin} style={{ width: '100%', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>Enter</button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={styles.loadWrap}>
      <div style={styles.loadBox}>
        <div style={styles.spinner} />
        <p style={{ color: '#64748b', marginTop: 16 }}>Loading Square data...</p>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>Paynter Bar Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          .sidebar { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
          .dash-stats   { grid-template-columns: repeat(5, 1fr) !important; }
          .dash-features { grid-template-columns: repeat(4, 1fr) !important; }
          @media (max-width: 768px) {
            .sidebar      { display: none  !important; }
            .mobile-menu-btn { display: block !important; }
            .stats-bar    { padding: 0 16px !important; }
            .stat-cell    { padding: 10px 14px !important; }
            .stat-num     { font-size: 18px !important; }
            .dash-stats   { grid-template-columns: repeat(2, 1fr) !important; }
            .dash-features { grid-template-columns: repeat(2, 1fr) !important; }
            .dash-wrap { padding: 12px 12px !important; }
            .view-wrap  { padding: 12px 12px !important; }
            .two-col-grid { grid-template-columns: 1fr !important; }
            .form-two-col { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </Head>
      <div style={styles.page}>
        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        {(() => {
          const SC = sidebarCollapsed
          const groups = [
            { label: 'Overview', icon: '🏠', items: [
              { icon: '🏠', label: 'Dashboard', tab: 'home', action: () => setMainTab('home') },
            ]},
            { label: 'Stock', icon: '📦', items: [
              { icon: '📦', label: 'Reorder Planner', tab: 'reorder', action: () => setMainTab('reorder') },
              { icon: '📋', label: 'Stocktake', tab: 'stocktake', action: () => setMainTab(t => t==='stocktake'?'reorder':'stocktake') },
            ]},
            { label: 'Sales & Analytics', icon: '📊', items: [
              { icon: '📊', label: 'Sales Report', tab: 'sales', action: () => { const n=mainTab==='sales'?'reorder':'sales'; setMainTab(n); if(n==='sales'&&!salesReport) loadSalesReport(salesPeriod,salesCustom) } },
              { icon: '📈', label: 'Quarterly Trends', tab: 'trends', action: () => { const n=mainTab==='trends'?'reorder':'trends'; setMainTab(n); if(n==='trends'&&!trendData) loadTrendData() } },
              { icon: '🏆', label: 'Best & Worst Sellers', tab: 'bestsellers', action: () => { const n=mainTab==='bestsellers'?'reorder':'bestsellers'; setMainTab(n); if(n==='bestsellers') loadSellersData() } },
            ]},
            { label: 'Operations', icon: '🗑️', items: [
              { icon: '🗑️', label: 'Wastage Log', tab: 'wastage', action: () => { const n=mainTab==='wastage'?'reorder':'wastage'; setMainTab(n); if(n==='wastage'&&!wastageLoaded) loadWastageLog() } },
              { icon: '📝', label: 'Notes', tab: 'notes', action: () => { const n=mainTab==='notes'?'reorder':'notes'; setMainTab(n); if(n==='notes'&&!notesLoaded) loadNotes() } },
              { icon: '🏷️', label: 'Price List', tab: 'pricelist', action: () => setMainTab(t => t==='pricelist'?'reorder':'pricelist') },
              { icon: '👥', label: 'Roster', tab: 'roster', action: () => window.open('https://paynter-bar-roster.vercel.app/','_blank') },
            ]},
            { label: 'Reports', icon: '📋', items: [
              { icon: '📋', label: 'SOH Report', tab: 'soh', action: () => setSohModal(true) },
            ]},
            { label: 'Help', icon: '❓', items: [
              { icon: '❓', label: 'Help & Guide', tab: 'help', action: () => setMainTab(t => t==='help'?'reorder':'help') },
            ]},
          ]
          return (
            <aside className="sidebar" style={{
              width: SC ? 52 : 210, minWidth: SC ? 52 : 210,
              background: '#0f172a', display: 'flex', flexDirection: 'column',
              transition: 'width 0.2s ease, min-width 0.2s ease',
              boxShadow: '2px 0 10px rgba(0,0,0,0.2)', zIndex: 200, overflowX: 'hidden',
            }}>
              {/* Brand */}
              <div style={{ padding: SC ? '14px 0' : '16px 14px 12px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 9, justifyContent: SC ? 'center' : 'flex-start', flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, background: '#0e7490', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🍺</div>
                {!SC && <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2, whiteSpace: 'nowrap' }}>Paynter Bar</div>
                  <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>GemLife Palmwoods</div>
                </div>}
              </div>
              {/* Nav groups */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
                {groups.map(group => (
                  <div key={group.label}>
                    <button onClick={() => !SC && setSidebarOpenGroups(g => ({ ...g, [group.label]: !g[group.label] }))}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: SC ? '7px 0' : '6px 12px', background: 'none', border: 'none', cursor: 'pointer', justifyContent: SC ? 'center' : 'space-between', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{group.icon}</span>
                        {!SC && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', whiteSpace: 'nowrap' }}>{group.label}</span>}
                      </div>
                      {!SC && <span style={{ fontSize: 9, color: '#475569', transition: 'transform 0.15s', transform: sidebarOpenGroups[group.label] ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>}
                    </button>
                    {(SC || sidebarOpenGroups[group.label]) && group.items.map(item => {
                      const isActive = mainTab === item.tab || (item.tab === 'reorder' && mainTab === 'reorder')
                      return (
                        <button key={item.tab} onClick={() => { item.action(); setMenuOpen(false) }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: SC ? '8px 0' : '7px 12px 7px 20px', background: isActive ? '#1e3a5f' : 'none', border: 'none', borderLeft: isActive && !SC ? '3px solid #0e7490' : '3px solid transparent', cursor: 'pointer', color: isActive ? '#e2e8f0' : '#94a3b8', fontSize: 12, fontWeight: isActive ? 600 : 400, justifyContent: SC ? 'center' : 'flex-start', transition: 'background 0.1s' }}>
                          <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                          {!SC && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              {/* Collapse toggle */}
              <div style={{ borderTop: '1px solid #1e293b', flexShrink: 0 }}>
                <button onClick={() => setSidebarCollapsed(c => !c)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: SC ? '10px 0' : '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', justifyContent: SC ? 'center' : 'flex-start', fontSize: 12 }}>
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{SC ? '»' : '«'}</span>
                  {!SC && <span>Collapse</span>}
                </button>
                {readOnly && !SC && <div style={{ padding: '6px 14px 10px', fontSize: 10, color: '#64748b', textAlign: 'center' }}>👁 Read only</div>}
              </div>
            </aside>
          )
        })()}

        {/* ── MAIN COLUMN ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>

        {/* Top bar */}
        <header style={{ background: '#0f172a', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Mobile hamburger */}
              <button className="mobile-menu-btn" onClick={() => setMenuOpen(o => !o)}
                style={{ display: 'none', background: menuOpen ? '#475569' : '#334155', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>
                {menuOpen ? '✕' : '☰'}
              </button>
              <div>
                {readOnly && <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.05em', marginRight: 8 }}>READ ONLY</span>}
                <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {mainTab === 'sales' ? '📊 Sales Report' : mainTab === 'trends' ? '📈 Quarterly Trends' : mainTab === 'help' ? '❓ Help & Guide' : mainTab === 'pricelist' ? '🏷️ Price List' : mainTab === 'bestsellers' ? '🏆 Best & Worst Sellers' : mainTab === 'home' ? '🏠 Dashboard' : mainTab === 'stocktake' ? '📋 Stocktake' : mainTab === 'wastage' ? '🗑️ Wastage Log' : mainTab === 'notes' ? '📝 Notes' : '📦 Reorder Planner'}
                </h1>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {lastUpdated && <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace" }}>Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}), padding: '7px 16px', fontSize: 12 }} onClick={() => loadItems(true)} disabled={refreshing}>{refreshing ? 'Refreshing...' : '🔄 Refresh'}</button>
            </div>
          </div>

          {/* Mobile dropdown menu */}
          <div style={{ display: menuOpen ? 'block' : 'none', background: '#1e293b', borderTop: '1px solid #334155' }}>
            {[
              { label: '🏠 Dashboard',           action: () => setMainTab('home'),        active: mainTab === 'home' },
              { label: '📦 Reorder Planner',     action: () => setMainTab('reorder'),     active: mainTab === 'reorder' },
              { label: '📋 Stocktake',           action: () => setMainTab(t => t==='stocktake'?'reorder':'stocktake'), active: mainTab === 'stocktake' },
              { label: '📊 Sales Report',        action: () => { const n=mainTab==='sales'?'reorder':'sales'; setMainTab(n); if(n==='sales'&&!salesReport) loadSalesReport(salesPeriod,salesCustom) }, active: mainTab === 'sales' },
              { label: '📈 Quarterly Trends',    action: () => { const n=mainTab==='trends'?'reorder':'trends'; setMainTab(n); if(n==='trends'&&!trendData) loadTrendData() }, active: mainTab === 'trends' },
              { label: '🏆 Best & Worst Sellers',action: () => { const n=mainTab==='bestsellers'?'reorder':'bestsellers'; setMainTab(n); if(n==='bestsellers') loadSellersData() }, active: mainTab === 'bestsellers' },
              { label: '🗑️ Wastage Log',         action: () => { const n=mainTab==='wastage'?'reorder':'wastage'; setMainTab(n); if(n==='wastage'&&!wastageLoaded) loadWastageLog() }, active: mainTab === 'wastage' },
              { label: '📝 Notes',               action: () => { const n=mainTab==='notes'?'reorder':'notes'; setMainTab(n); if(n==='notes'&&!notesLoaded) loadNotes() }, active: mainTab === 'notes' },
              { label: '🏷️ Price List',          action: () => setMainTab(t => t==='pricelist'?'reorder':'pricelist'), active: mainTab === 'pricelist' },
              { label: '👥 Roster',              action: () => window.open('https://paynter-bar-roster.vercel.app/','_blank'), active: false },
              { label: '📋 SOH Report',          action: () => setSohModal(true), active: false },
              { label: '❓ Help & Guide',        action: () => setMainTab(t => t==='help'?'reorder':'help'), active: mainTab === 'help' },
            ].map(({ label, action, active }) => (
              <button key={label} onClick={() => { action(); setMenuOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: active ? '#2d4a6e' : 'transparent', color: active ? '#60a5fa' : '#e2e8f0', border: 'none', borderBottom: '1px solid #2d3748', padding: '14px 20px', fontSize: 15, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="stats-bar" style={styles.statsBar}>
            <div style={styles.stat}>
              <span className="stat-num" style={styles.statNum}>{items.length}</span>
              <span style={styles.statLabel}>Total Items</span>
            </div>
            <div className="stat-cell" style={{ ...styles.stat, borderTopColor: '#dc2626' }}>
              <span style={{ ...styles.statNum, color: '#dc2626' }}>{critCount}</span>
              <span style={styles.statLabel}>Critical</span>
            </div>
            <div className="stat-cell" style={{ ...styles.stat, borderTopColor: '#2563eb' }}>
              <span style={{ ...styles.statNum, color: '#2563eb' }}>{orderCount}</span>
              <span style={styles.statLabel}>To Order</span>
            </div>
            <div className="stat-cell" style={{ ...styles.stat, borderTopColor: '#16a34a', cursor: 'pointer' }}
              onClick={() => setMainTab('reorder')}>
              <span style={{ ...styles.statNum, color: '#16a34a' }}>{onOrderCount}</span>
              <span style={styles.statLabel}>On Order</span>
            </div>
            <div className="stat-cell" style={{ ...styles.stat, borderTopColor: '#f59e0b' }}>
              {editingTarget ? (
                <input type="number" defaultValue={targetWeeks} style={styles.targetInput}
                  onBlur={e => saveTargetWeeks(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTargetWeeks(e.target.value)}
                  autoFocus min="1" max="26" />
              ) : (
                <span style={{ ...styles.statNum, color: '#f59e0b', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  onClick={() => setEditingTarget(true)} title="Click to edit">{targetWeeks}</span>
              )}
              <span style={styles.statLabel}>Target Weeks</span>
            </div>
          </div>
        </header>

        {sohModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>📋 SOH Report</div>
                <button onClick={() => setSohModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Export the current Stock on Hand as a formatted report.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { generateStockReport(false); setSohModal(false) }}
                  style={{ flex: 1, padding: '12px 0', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  🖨️ Print / PDF
                </button>
                <button onClick={() => { generateStockReport(true); setSohModal(false) }}
                  style={{ flex: 1, padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  📊 Excel
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}

        {/* SALES TAB */}
        {mainTab === 'sales' && (
          <SalesView
            period={salesPeriod} setPeriod={setSalesPeriod}
            custom={salesCustom} setCustom={setSalesCustom}
            report={salesReport} loading={salesLoading} error={salesError}
            category={salesCategory} setCategory={setSalesCategory}
            sort={salesSort} setSort={setSalesSort}
            onLoad={loadSalesReport}
            onExportPdf={() => generateSalesReport(false)}
            onExportXlsx={() => generateSalesReport(true)}
            exportLoading={salesPdfLoading}
          />
        )}

        {/* REORDER TAB */}
        {mainTab === 'reorder' && (
          <>
            <div style={styles.controls}>
              <div style={styles.viewTabs}>
                <button style={{ ...styles.tab, ...(view === 'all' ? styles.tabActive : {}) }}
                  onClick={() => setView('all')}>All Items</button>
                {suppliers.map(s => (
                  <button key={s} style={{ ...styles.tab, ...(view === s ? { ...styles.tabActive, background: SUPPLIER_COLORS[s] || '#374151', color: '#fff', borderColor: SUPPLIER_COLORS[s] || '#374151' } : {}) }}
                    onClick={() => setView(s)}>{s}</button>
                ))}
                {addingSupplier ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addSupplier(); if (e.key === 'Escape') setAddingSupplier(false) }}
                      placeholder="Supplier name..." style={styles.supplierInput} autoFocus />
                    <button style={{ ...styles.tab, background: '#16a34a', color: '#fff', borderColor: '#16a34a' }} onClick={addSupplier}>Add</button>
                    <button style={styles.tab} onClick={() => setAddingSupplier(false)}>Cancel</button>
                  </div>
                ) : (
                  <button style={{ ...styles.tab, borderStyle: 'dashed', color: '#64748b' }}
                    onClick={() => setAddingSupplier(true)}>+ Supplier</button>
                )}
                <div style={{ width: 1, background: '#e2e8f0', margin: '0 6px', alignSelf: 'stretch' }} />
                <button style={{ ...styles.tab, ...(viewMode === 'pricing' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' } : { color: '#7c3aed', borderColor: '#7c3aed' }) }}
                  onClick={() => setViewMode(v => v === 'pricing' ? 'reorder' : 'pricing')}>$ Pricing</button>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={styles.filterCheck}>
                  <input type="checkbox" checked={filterOrder} onChange={e => setFilterOrder(e.target.checked)} style={{ marginRight: 6 }} />
                  Order items only
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Sales period:</span>
                  {[30, 60, 90].map(d => (
                    <button key={d}
                      style={{ ...styles.tab, padding: '4px 12px', fontSize: 12, ...(daysBack === d ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : {}) }}
                      onClick={() => { setDaysBack(d); loadItems(true, d) }}>{d}d</button>
                  ))}
                </div>
                {view !== 'all' && (
                  <button style={{ ...styles.btn, background: '#0f172a', fontSize: 12, padding: '6px 14px' }}
                    onClick={() => printOrderSheet(view)}>Print {view} Order</button>
                )}
                <div style={{ position: 'relative' }}>
                  <button style={{ ...styles.btn, background: '#374151', fontSize: 12, padding: '6px 14px' }}
                    onClick={() => setPrinting(p => p === 'menu' ? null : 'menu')}>Print Order Sheet</button>
                  {printing === 'menu' && (
                    <div style={styles.dropdown}>
                      {suppliers.map(s => (
                        <button key={s} style={styles.dropItem}
                          onClick={() => { printOrderSheet(s); setPrinting(null) }}>
                          {s} ({items.filter(i => i.supplier === s && i.orderQty > 0).length} items)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {onOrderCount > 0 && (() => {
              // Group ordered items by supplier, then by date within each supplier
              const bySupplier = {}
              for (const [name, info] of Object.entries(orderedItems)) {
                const key = info.supplier || 'Unknown'
                if (!bySupplier[key]) bySupplier[key] = {}
                if (!bySupplier[key][info.date]) bySupplier[key][info.date] = []
                bySupplier[key][info.date].push(name)
              }

              async function markSupplierReceived(supplier) {
                const itemsForSupplier = Object.entries(orderedItems)
                  .filter(([, info]) => (info.supplier || 'Unknown') === supplier)
                  .map(([name]) => name)
                if (!confirm(`Mark ${itemsForSupplier.length} item${itemsForSupplier.length !== 1 ? 's' : ''} from ${supplier} as received?`)) return
                await Promise.all(itemsForSupplier.map(name =>
                  fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'setOrdered', itemName: name, value: null }) })
                ))
                setOrderedItems(prev => {
                  const next = { ...prev }
                  itemsForSupplier.forEach(name => delete next[name])
                  return next
                })
              }

              return (
                <div style={{ marginBottom: 10 }}>
                  {Object.entries(bySupplier).map(([supplier, dateGroups]) => {
                    const supplierItems = Object.values(dateGroups).flat()
                    return (
                      <div key={supplier} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 16px', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🛒 {supplier}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>— {supplierItems.length} item{supplierItems.length !== 1 ? 's' : ''} on order</span>
                          {!readOnly && (
                            <button onClick={() => markSupplierReceived(supplier)}
                              style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                              ✓ {supplier} Received
                            </button>
                          )}
                        </div>
                        {Object.entries(dateGroups).map(([date, names]) => (
                          <div key={date} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #bbf7d0' }}>
                            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, marginRight: 8 }}>Ordered {date}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>{names.join(' · ')}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={{ ...styles.th, width: 240 }}>Item</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>On Hand</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Wkly Avg</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Target</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Pack</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Bottle Size</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Nip Size</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Order Qty</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Bottles</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Priority</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>On Order</th>
                    <th style={{ ...styles.th, width: 180 }}>Notes</th>
                    {viewMode === 'pricing' && <>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Buy/Btl</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Sell/Serve</th>
                      <th style={{ ...styles.th, textAlign: 'center', color: '#7c3aed' }}>Serve Size</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Serves/Btl</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Margin</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={viewMode === 'pricing' ? 19 : 14} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                      {filterOrder ? 'No items to order this week.' : 'No items found.'}
                    </td></tr>
                  )}
                  {displayed.map((item, idx) => {
                    const p = PRIORITY_COLORS[item.priority]
                    const isOrdered = !!orderedItems[item.name]
                    const rowBg = isOrdered ? '#f0fdf4' : (item.orderQty > 0 ? p.bg : (idx % 2 === 0 ? '#fff' : '#f8fafc'))
                    return (
                      <tr key={item.name} style={{ background: rowBg }}>
                        <td style={{ ...styles.td, fontWeight: 500, fontSize: 13 }}>
                          {item.name}
                          {isOrdered && <span style={{ marginLeft: 6, fontSize: 10, background: '#16a34a', color: '#fff', borderRadius: 99, padding: '1px 7px', fontWeight: 700, verticalAlign: 'middle' }}>ON ORDER</span>}
                        </td>
                        <td style={styles.td}>
                          <EditSelect value={item.category} options={CATEGORIES}
                            onChange={v => saveSetting(item.name, 'category', v)}
                            saving={saving[`${item.name}_category`]} readOnly={readOnly} />
                        </td>
                        <td style={styles.td}>
                          <EditSelect value={item.supplier} options={suppliers}
                            onChange={v => saveSetting(item.name, 'supplier', v)}
                            saving={saving[`${item.name}_supplier`]} colorMap={SUPPLIER_COLORS} readOnly={readOnly} />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.onHand}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.weeklyAvg}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{item.targetStock}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <EditNumber value={item.pack} onChange={v => saveSetting(item.name, 'pack', v)}
                            saving={saving[`${item.name}_pack`]} min={1} readOnly={readOnly} />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.bottleML)} options={['700', '750', '1000']}
                              onChange={v => saveSetting(item.name, 'bottleML', Number(v))}
                              saving={saving[`${item.name}_bottleML`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.nipML || 30)} options={['30', '60']}
                              onChange={v => saveSetting(item.name, 'nipML', Number(v))}
                              saving={saving[`${item.name}_nipML`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }}>
                          {item.isSpirit
                            ? (item.nipsToOrder > 0 ? item.nipsToOrder : '-')
                            : (item.orderQty > 0 ? item.orderQty : '-')}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#1f4e79' }}>
                          {item.isSpirit ? (item.bottlesToOrder > 0 ? item.bottlesToOrder : '-') : '-'}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', background: p.badge, color: '#fff' }}>{item.priority}</span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {!readOnly && (
                            <button
                              onClick={() => toggleOrdered(item.name, item.supplier)}
                              title={isOrdered ? `Ordered ${orderedItems[item.name]?.date} — click to clear` : 'Mark as ordered'}
                              style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, border: 'none', cursor: 'pointer',
                                background: isOrdered ? '#dcfce7' : '#f1f5f9',
                                color: isOrdered ? '#16a34a' : '#94a3b8' }}>
                              {isOrdered ? `✓ ${orderedItems[item.name]?.date}` : '+ Order'}
                            </button>
                          )}
                          {readOnly && isOrdered && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>✓ {orderedItems[item.name]?.date}</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <EditText value={item.notes || ''} onChange={v => saveSetting(item.name, 'notes', v)}
                            saving={saving[`${item.name}_notes`]} placeholder="Add note..." readOnly={readOnly} />
                        </td>
                        {viewMode === 'pricing' && (() => {
                          // Categories sold by the glass (150ml) unless toggled to bottle
                          const WINE_CATS = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']
                          const isWine = WINE_CATS.includes(item.category)
                          // sellUnit: 'glass' or 'bottle' for wines; spirits always by nip; others by bottle
                          const sellUnit = item.isSpirit ? 'nip'
                                         : isWine ? (item.sellUnit || 'glass')
                                         : 'bottle'
                          // Bottle capacity — spirits use stored bottleML (700/750/1000ml)
                          // Wines default 750ml
                          const bottleML = item.isSpirit ? (item.bottleML || 700) : 750
                          // Serve size in mL — only meaningful for spirits and glass-sold wines
                          const serveML = item.isSpirit ? (item.nipML || 30)
                                        : (isWine && sellUnit === 'glass') ? 150
                                        : null
                          const servesPerBottle = !item.isSpirit && !isWine ? null
                                                : sellUnit === 'bottle' ? 1
                                                : serveML ? +(bottleML / serveML).toFixed(1)
                                                : null

                          const buy  = item.buyPrice  !== '' && item.buyPrice  != null ? Number(item.buyPrice)  : null
                          const sell = item.sellPrice !== '' && item.sellPrice != null ? Number(item.sellPrice) : null

                          // Revenue per bottle = sell/serve × serves
                          const revenuePerBottle = (sell != null && servesPerBottle != null) ? +(sell * servesPerBottle).toFixed(2) : sell
                          const marginPct = (buy != null && revenuePerBottle != null && revenuePerBottle > 0)
                            ? (((revenuePerBottle - buy) / revenuePerBottle) * 100) : null
                          const marginStr   = marginPct != null ? marginPct.toFixed(1) + '%' : '-'
                          const marginColor = marginPct == null ? '#94a3b8' : marginPct >= 40 ? '#16a34a' : marginPct >= 20 ? '#d97706' : '#dc2626'
                          const sellFromSq  = item.squareSellPrice != null && Number(item.sellPrice) === item.squareSellPrice
                          return <>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <EditNumber value={buy ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                                onChange={v => saveSetting(item.name, 'buyPrice', v)}
                                saving={saving[`${item.name}_buyPrice`]} min={0} readOnly={readOnly} />
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                <EditNumber value={sell ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                                  onChange={v => saveSetting(item.name, 'sellPrice', v)}
                                  saving={saving[`${item.name}_sellPrice`]} min={0} readOnly={readOnly} />
                                {sellFromSq && <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace' }}>from Square</span>}
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center', fontSize: 11 }}>
                              {item.isSpirit ? (
                                <span style={{ color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>{serveML}ml nip</span>
                              ) : isWine ? (
                                readOnly
                                  ? <span style={{ color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>{sellUnit === 'glass' ? '150ml glass' : 'Bottle'}</span>
                                  : <select value={sellUnit}
                                      onChange={e => {
                                        const v = e.target.value
                                        saveSetting(item.name, 'sellUnit', v)
                                        setItems(prev => prev.map(i => i.name === item.name ? { ...i, sellUnit: v } : i))
                                      }}
                                      style={{ fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 4px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
                                      <option value="glass">150ml glass</option>
                                      <option value="bottle">Bottle</option>
                                    </select>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>—</span>
                              )}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#64748b' }}>
                              {(item.isSpirit || isWine) ? (servesPerBottle ?? '—') : <span style={{ color: '#94a3b8' }}>—</span>}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: marginColor }}>
                              {marginStr}
                              {servesPerBottle != null && servesPerBottle > 1 && revenuePerBottle != null && (
                                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>${revenuePerBottle.toFixed(2)}/btl rev</div>
                              )}
                            </td>
                          </>
                        })()}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {mainTab === 'home' && (
          <DashboardView
            items={items}
            lastUpdated={lastUpdated}
            orderedItems={orderedItems}
            onNav={(tab) => {
              setMainTab(tab)
              if (tab === 'sales' && !salesReport) loadSalesReport(salesPeriod, salesCustom)
              if (tab === 'trends' && !trendData) loadTrendData()
              if (tab === 'bestsellers') loadSellersData()
            }}
          />
        )}
        {mainTab === 'trends' && <TrendsView data={trendData} loading={trendLoading} error={trendError} />}
        {mainTab === 'wastage' && <WastageView items={items} log={wastageLog} readOnly={readOnly} onRefresh={loadWastageLog} />}
        {mainTab === 'notes' && <NotesView items={items} notes={notesLog} readOnly={readOnly} onRefresh={loadNotes} />}
        {mainTab === 'bestsellers' && <BestSellersView items={items} salesData={sellersData} loading={sellersLoading} error={sellersError} />}
        {mainTab === 'pricelist' && (
          <PriceListView
            items={items}
            settings={priceListSettings}
            readOnly={readOnly}
            saving={plSaving}
            onSave={savePriceListSetting}
            onPrint={generatePriceListPDF}
          />
        )}
        {mainTab === 'stocktake' && <StocktakeView items={items} readOnly={readOnly} onExport={exportStocktake} />}
        {mainTab === 'help' && <HelpTab />}

        <footer style={styles.footer}>
          Paynter Bar Hub — GemLife Palmwoods | Data from Square POS | {items.length} items tracked
        </footer>
      </div>{/* end main column */}
    </div>{/* end styles.page */}
    </>
  )
}

// ─── WASTAGE LOG VIEW ─────────────────────────────────────────────────────────
function WastageView({ items, log, readOnly, onRefresh }) {
  const REASONS = ['Breakage', 'Spoilage', 'Expired', 'Other']
  const REASON_COLOR = {
    Breakage: { bg: '#fee2e2', text: '#dc2626' },
    Spoilage: { bg: '#fef9c3', text: '#ca8a04' },
    Expired:  { bg: '#ffedd5', text: '#ea580c' },
    Other:    { bg: '#f1f5f9', text: '#475569' },
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }) // YYYY-MM-DD
  const [form, setForm]       = useState({ itemName: '', qty: '', unit: 'units', reason: 'Breakage', note: '', recordedBy: '', date: today })
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})

  const filtered = log.filter(e => {
    if (filter !== 'All' && e.reason !== filter) return false
    if (dateFrom && new Date(e.date) < new Date(dateFrom + 'T00:00:00+10:00')) return false
    if (dateTo   && new Date(e.date) > new Date(dateTo   + 'T23:59:59+10:00')) return false
    return true
  })

  // Summary by reason
  const summary = REASONS.map(r => ({
    reason: r,
    count: log.filter(e => e.reason === r).length,
    ...REASON_COLOR[r]
  }))

  async function submit() {
    if (!form.itemName || !form.qty) return alert('Please select an item and enter a quantity')
    setSaving(true)
    try {
      const selected = items.find(i => i.name === form.itemName)
      const r = await fetch('/api/wastage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, category: selected?.category || '', date: form.date ? new Date(form.date + 'T12:00:00+10:00').getTime() : Date.now() })
      })
      if (!r.ok) throw new Error((await r.json()).error)
      await onRefresh()
      setForm({ itemName: '', qty: '', unit: 'units', reason: 'Breakage', note: '', recordedBy: '', date: today })
      setShowForm(false)
    } catch(e) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this wastage entry?')) return
    await fetch(`/api/wastage?id=${id}`, { method: 'DELETE' })
    await onRefresh()
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setEditForm({
      itemName:   entry.itemName,
      qty:        entry.qty,
      unit:       entry.unit || 'units',
      reason:     entry.reason,
      note:       entry.note || '',
      recordedBy: entry.recordedBy || '',
      date:       new Date(entry.date).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }),
    })
  }

  function cancelEdit() { setEditingId(null); setEditForm({}) }

  async function saveEdit(entry) {
    try {
      const selected = items.find(i => i.name === editForm.itemName)
      const r = await fetch(`/api/wastage?id=${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          category: selected?.category || entry.category || '',
          date: editForm.date ? new Date(editForm.date + 'T12:00:00+10:00').getTime() : entry.date,
        })
      })
      if (!r.ok) throw new Error((await r.json()).error)
      await onRefresh()
      cancelEdit()
    } catch(e) { alert('Error: ' + e.message) }
  }

  function printReport() {
    const rows = filtered.map(e => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${new Date(e.date).toLocaleDateString('en-AU', { timeZone:'Australia/Brisbane', day:'numeric', month:'short', year:'numeric' })}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600">${e.itemName}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${e.category}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;font-weight:700">${e.qty} ${e.unit}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${e.reason}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${e.note || '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${e.recordedBy || '—'}</td>
      </tr>`).join('')

    const summaryRows = REASONS.map(r => {
      const entries = log.filter(e => e.reason === r)
      return `<tr><td style="padding:5px 10px;font-size:12px">${r}</td><td style="padding:5px 10px;text-align:center;font-size:12px;font-weight:700">${entries.length}</td></tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head>
      <title>Wastage Report — Paynter Bar</title>
      <style>
        @page { size: A4 portrait; margin: 15mm }
        body { font-family: Arial, sans-serif; color: #0f172a; }
        h1 { font-size: 18px; margin: 0 0 4px }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 16px }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px }
        th { background: #1e3a5f; color: #fff; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left }
        th.c { text-align: center }
        .summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap }
        .sum-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; min-width: 80px; text-align: center }
        .footer { margin-top: 16px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px }
      </style>
    </head><body>
      <h1>🗑️ Wastage Log Report</h1>
      <div class="meta">
        Paynter Bar · GemLife Palmwoods<br>
        Generated: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}<br>
        Filter: ${filter} · ${filtered.length} entries
      </div>
      <div class="summary">
        ${REASONS.map(r => {
          const n = log.filter(e => e.reason === r).length
          return `<div class="sum-card"><div style="font-size:11px;color:#64748b">${r}</div><div style="font-size:20px;font-weight:800">${n}</div></div>`
        }).join('')}
        <div class="sum-card"><div style="font-size:11px;color:#64748b">Total</div><div style="font-size:20px;font-weight:800">${log.length}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Item</th><th>Category</th><th class="c">Qty</th>
          <th>Reason</th><th>Note</th><th>Recorded By</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Paynter Bar Hub · Wastage Log</div>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  return (
    <div className="view-wrap" style={{ padding: '16px', maxWidth: 960, margin: '0 auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {[...summary, { reason: 'Total', count: log.length, bg: '#f8fafc', text: '#0f172a' }].map(s => (
          <div key={s.reason}
            onClick={() => setFilter(s.reason === 'Total' ? 'All' : s.reason)}
            style={{ background: s.bg, border: `1px solid ${s.text}33`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', flex: '1 1 80px', minWidth: 70,
              outline: filter === (s.reason === 'Total' ? 'All' : s.reason) ? `2px solid ${s.text}` : 'none' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{s.reason}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.text, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Log entry form */}
      {!readOnly && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
          <div
            style={{ background: '#92400e', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setShowForm(f => !f)}>
            🗑️ Record Wastage
            <span style={{ fontSize: 16 }}>{showForm ? '▲' : '▼'}</span>
          </div>
          {showForm && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Item dropdown */}
                <div style={{ flex: 2, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Item *</div>
                  <select value={form.itemName} onChange={e => {
                    const selected = items.find(i => i.name === e.target.value)
                    setForm(f => ({ ...f, itemName: e.target.value, unit: selected?.isSpirit ? 'bottles' : 'units' }))
                  }} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                    <option value="">— Select item —</option>
                    {[...new Set(items.map(i => i.category))].filter(Boolean).sort().map(cat => (
                      <optgroup key={cat} label={cat}>
                        {items.filter(i => i.category === cat).sort((a,b) => a.name.localeCompare(b.name)).map(i => (
                          <option key={i.name} value={i.name}>{i.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {/* Qty */}
                <div style={{ width: 80 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Qty *</div>
                  <input type="number" min="0.1" step="0.1" value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                {/* Unit */}
                <div style={{ width: 100 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Unit</div>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                    <option>units</option>
                    <option>bottles</option>
                    <option>nips</option>
                    <option>cases</option>
                    <option>packs</option>
                  </select>
                </div>
                {/* Reason */}
                <div style={{ width: 130 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Reason *</div>
                  <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                    {REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                {/* Date */}
                <div style={{ width: 150 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Date *</div>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Note */}
                <div style={{ flex: 2, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Note</div>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="e.g. Dropped on delivery, found in fridge"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                {/* Recorded by */}
                <div style={{ width: 160 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Recorded by</div>
                  <input value={form.recordedBy} onChange={e => setForm(f => ({ ...f, recordedBy: e.target.value }))}
                    placeholder="Your name"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={submit} disabled={saving}
                    style={{ ...styles.btn, background: '#92400e', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : '✓ Record'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <div style={{ background: '#1e3a5f', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {filter === 'All' ? 'All Entries' : filter} — {filtered.length} records
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#93c5fd' }}>From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, background: '#1e40af', color: '#fff', colorScheme: 'dark' }} />
              <span style={{ fontSize: 11, color: '#93c5fd' }}>To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, background: '#1e40af', color: '#fff', colorScheme: 'dark' }} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }}
                  style={{ fontSize: 11, background: '#475569', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff' }}>✕ Clear</button>
              )}
            </div>
            <button onClick={printReport}
              style={{ fontSize: 11, background: '#0e7490', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
              🖨️ Print Report
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No wastage entries recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Date','Item','Qty','Reason','Note','By',''].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Qty' ? 'center' : 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => {
                const rc = REASON_COLOR[entry.reason] || REASON_COLOR.Other
                const isEditing = editingId === entry.id
                const inp = { fontSize: 12, border: '1px solid #93c5fd', borderRadius: 4, padding: '3px 6px', width: '100%', boxSizing: 'border-box' }
                return (
                  <tr key={entry.id} style={{ background: isEditing ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', outline: isEditing ? '2px solid #3b82f6' : 'none' }}>
                    {isEditing ? (
                      <>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={inp} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select value={editForm.itemName} onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))} style={inp}>
                            {items.map(i => <option key={i.name}>{i.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input type="number" value={editForm.qty} min="0" step="0.1" onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))} style={{ ...inp, width: 55 }} />
                            <select value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inp, width: 65 }}>
                              {['units','bottles','nips','cans','glasses','kegs'].map(u => <option key={u}>{u}</option>)}
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} style={inp}>
                            {REASONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Note..." style={inp} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input value={editForm.recordedBy} onChange={e => setEditForm(f => ({ ...f, recordedBy: e.target.value }))} placeholder="Name..." style={inp} />
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveEdit(entry)} style={{ fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}>✓</button>
                            <button onClick={cancelEdit} style={{ fontSize: 11, background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(entry.date).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{entry.itemName}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                          {entry.qty} <span style={{ fontSize: 10, color: '#94a3b8' }}>{entry.unit}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: rc.bg, color: rc.text, fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>{entry.reason}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', maxWidth: 200 }}>{entry.note || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b' }}>{entry.recordedBy || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {!readOnly && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => startEdit(entry)}
                                style={{ fontSize: 11, background: '#eff6ff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#2563eb' }}>✏️</button>
                              <button onClick={() => deleteEntry(entry.id)}
                                style={{ fontSize: 11, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
        Wastage records stored in the cloud · visible to all management team members
      </div>
    </div>
  )
}


// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView({ items, lastUpdated, onNav, orderedItems = {} }) {
  const critCount    = items.filter(i => i.priority === 'CRITICAL').length
  const lowCount     = items.filter(i => i.priority === 'LOW').length
  const onOrderCount = Object.keys(orderedItems).length
  const orderCount   = items.filter(i => i.orderQty > 0 && !orderedItems[i.name]).length
  const totalItems = items.length

  const now = new Date()
  const refreshedAgo = lastUpdated ? (() => {
    const mins = Math.floor((now - new Date(lastUpdated)) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins/60)}h ${mins%60}m ago`
  })() : 'Not yet refreshed'

  const features = [
    { icon: '📦', label: 'Reorder Planner',     desc: 'Stock levels, order quantities & supplier sheets', tab: 'reorder',     color: '#1e3a5f' },
    { icon: '📊', label: 'Sales Report',          desc: 'Period sales with category breakdown',             tab: 'sales',        color: '#7c3aed' },
    { icon: '📈', label: 'Quarterly Trends',      desc: 'Four-quarter category performance charts',         tab: 'trends',       color: '#0e7490' },
    { icon: '🏆', label: 'Best & Worst Sellers',  desc: 'Top 10, slow sellers and items not moving',        tab: 'bestsellers',  color: '#92400e' },
    { icon: '🏷️', label: 'Price List',            desc: 'Printable A4 price list for bar display',          tab: 'pricelist',    color: '#be185d' },
    { icon: '👥', label: 'Volunteer Roster',      desc: 'Volunteer scheduling (opens new tab)',             tab: 'roster',       color: '#065f46', external: true },
    { icon: '🗑️', label: 'Wastage Log',            desc: 'Record breakages, spoilage and expired stock',    tab: 'wastage',      color: '#92400e' },
    { icon: '❓', label: 'Help & Guide',           desc: 'Full documentation for all features',             tab: 'help',         color: '#475569' },
  ]

  return (
    <div className="dash-wrap" style={{ padding: '20px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Compact header row: stats + refresh */}
      <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Critical',      value: critCount,    sub: 'below target',    color: '#dc2626', bg: '#fef2f2', action: () => onNav('reorder') },
          { label: 'Low Stock',     value: lowCount,     sub: 'running low',     color: '#d97706', bg: '#fffbeb', action: () => onNav('reorder') },
          { label: 'To Order',      value: orderCount,   sub: 'need ordering',   color: '#2563eb', bg: '#eff6ff', action: () => onNav('reorder') },
          { label: 'On Order',      value: onOrderCount, sub: 'awaiting delivery', color: '#16a34a', bg: '#f0fdf4', action: () => onNav('reorder') },
          { label: 'Refreshed',     value: refreshedAgo, sub: 'Square data',     color: '#475569', bg: '#f8fafc', action: null },
        ].map(({ label, value, sub, color, bg, action }) => (
          <div key={label}
            onClick={action || undefined}
            style={{ background: bg, borderRadius: 8, border: `1px solid ${color}33`, padding: '10px 14px', cursor: action ? 'pointer' : 'default' }}
            onMouseEnter={e => { if (action) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.1, wordBreak: 'break-word' }}>{value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Feature grid — 4 columns */}
      <div className="dash-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {features.map(f => (
          <div key={f.tab}
            onClick={() => f.external ? window.open('https://paynter-bar-roster.vercel.app/', '_blank') : onNav(f.tab)}
            style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {f.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}{f.external ? ' ↗' : ''}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
        Paynter Bar Hub · GemLife Palmwoods · {totalItems} items tracked
      </div>
    </div>
  )
}


// ─── BEST & WORST SELLERS VIEW ───────────────────────────────────────────────
function BestSellersView({ items, salesData, loading, error }) {
  const today = new Date()

  // Build sales map from Orders API data
  const salesMap = {}
  if (salesData) {
    for (const item of salesData.items || []) {
      salesMap[item.name] = (salesMap[item.name] || 0) + item.unitsSold
    }
  }

  const withData = items.filter(i => i.weeklyAvg != null)
  const sorted   = [...withData].sort((a, b) => (b.weeklyAvg || 0) - (a.weeklyAvg || 0))
  const top10    = sorted.slice(0, 10)
  const maxAvg   = top10[0]?.weeklyAvg || 1

  // Slow sellers: has stock, sold in last 90 days but in bottom 25% by units
  const itemsWithSales = salesData
    ? withData
        .filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) > 0)
        .sort((a, b) => (salesMap[a.name] || 0) - (salesMap[b.name] || 0))
    : []
  const slowCutoff = Math.ceil(itemsWithSales.length * 0.25)
  const slowSellers = itemsWithSales.slice(0, slowCutoff)

  // Not selling at all: has stock, zero sales in 90 days
  const notSelling = salesData
    ? withData.filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) === 0)
        .sort((a, b) => (b.onHand || 0) - (a.onHand || 0))
    : []

  // Consistent stars: top 20% weekly avg that also appear in Orders API sales
  const avgThreshold = sorted[Math.floor(sorted.length * 0.2)]?.weeklyAvg || 0
  const consistent = sorted.filter(i =>
    (i.weeklyAvg || 0) >= avgThreshold && (salesData ? (salesMap[i.name] || 0) > 0 : true)
  )

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64, color: '#64748b' }}>
      <div style={{ ...styles.spinner, margin: '0 auto 16px' }} />
      Loading 90 days of sales data from Square...
    </div>
  )

  if (error) return <div style={{ ...styles.errorBox, margin: 24 }}><strong>Error:</strong> {error}</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Top Seller',      value: top10[0]?.name.split(' ').slice(0,3).join(' ') || '—', sub: top10[0] ? `${top10[0].weeklyAvg} / week` : '', color: '#16a34a' },
          { label: 'Items Tracked',   value: withData.length,   sub: `${items.length} total`,              color: '#2563eb' },
          { label: 'Slow Sellers',    value: slowSellers.length, sub: 'bottom 25% with stock',             color: '#d97706' },
          { label: 'Not Selling',     value: notSelling.length,  sub: 'zero sales, has stock',             color: '#dc2626' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 18px', flex: 1, minWidth: 150 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Top 10 sellers */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: '#14532d', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            🏆 Top 10 Sellers — Weekly Average
          </div>
          {top10.map((item, idx) => {
            const barPct = Math.round((item.weeklyAvg / maxAvg) * 100)
            return (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: idx < 9 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', width: 18, textAlign: 'right', flexShrink: 0 }}>{idx + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ marginTop: 3, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: '#16a34a', borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{item.weeklyAvg}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>/wk</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Slow sellers */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#92400e', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              🐢 Slow Sellers — Bottom 25% (Last 90 Days)
            </div>
            {slowSellers.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {salesData ? 'No slow sellers identified ✓' : 'Loading...'}
              </div>
            ) : slowSellers.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: idx < slowSellers.length - 1 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fffbeb' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category} · {item.onHand} in stock</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#d97706' }}>{salesMap[item.name] || 0}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>units / 90 days</div>
                </div>
              </div>
            ))}
          </div>

          {/* Not selling */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ background: '#7f1d1d', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              ⚠️ Not Selling — Zero Sales, Has Stock
            </div>
            {notSelling.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {salesData ? 'Everything is selling ✓' : 'Loading...'}
              </div>
            ) : notSelling.map((item, idx) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: idx < notSelling.length - 1 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fef2f2' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{item.category} · {item.onHand} in stock</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>0 sold</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>last 90 days</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        Based on Square Orders API · 90 day window · {salesData ? `${(salesData.items||[]).length} items analysed` : 'Loading...'}
      </div>
    </div>
  )
}


// ─── PRICE LIST VIEW ──────────────────────────────────────────────────────────
function PriceListView({ items, settings, readOnly, saving, onSave, onPrint }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']

  // Group items by category
  const grouped = {}
  for (const item of items) {
    const cat = item.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const cats = CATEGORY_ORDER.filter(c => grouped[c])


  // Normalise Square variation names for display and sort Glass before Bottle
  function normaliseVariations(vars) {
    return vars
      .map(v => {
        const n = v.name.toLowerCase()
        const label = n.includes('glass') || n.includes('wine glass') ? 'Glass'
                    : n.includes('bottle') || n === 'regular' ? 'Bottle'
                    : v.name
        return { ...v, name: label }
      })
      .sort((a, b) => {
        if (a.name === 'Glass') return -1
        if (b.name === 'Glass') return 1
        return 0
      })
  }

  function getPrice(item) {
    if (item.sellPrice != null)       return item.sellPrice
    if (item.squareSellPrice != null) return item.squareSellPrice
    return null
  }

  function getVariations(item) {
    const vars = (item.variations || []).filter(v => v.price != null)
    if (vars.length > 1) return normaliseVariations(vars)
    return null
  }

function isHidden(item) {
    return (settings[item.name] || {}).hidden === true
  }

  const visibleCount = items.filter(i => !isHidden(i)).length

  return (
    <div className="view-wrap" style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Price List — From Square</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {visibleCount} items · Prices from Square
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>

          <button
            style={{ background: '#be185d', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            onClick={() => onPrint(items, settings)}>
            🖨️ Print Price List
          </button>
        </div>
      </div>

      {/* Category sections */}
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: '8px 8px 0 0', padding: '8px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {cat}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '7px 14px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Price</th>

                </tr>
              </thead>
              <tbody>
                {grouped[cat].filter(item => (item.onHand || 0) > 0 || isHidden(item)).map((item, idx) => {
                  const hidden  = isHidden(item)
                  const price   = getPrice(item)
                  const rowBg   = idx % 2 === 0 ? '#fff' : '#f8fafc'

                  return (
                    <tr key={item.name} style={{ background: rowBg }}>
                      {/* Display name */}
                      <td style={{ padding: '7px 14px', fontSize: 13, color: '#0f172a' }}>
                        {item.name}
                      </td>


                      {/* Price — from Square only */}
                      <td style={{ padding: '7px 14px', textAlign: 'right' }}>
                        {(() => {
                          const variations = getVariations(item)
                          if (variations) {
                            return (
                              <table style={{ borderCollapse: 'collapse', marginLeft: 'auto' }}>
                                {variations.map(v => (
                                  <tr key={v.name}>
                                    <td style={{ fontSize: 10, color: '#64748b', paddingRight: 8, whiteSpace: 'nowrap' }}>{v.name}</td>
                                    <td style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>${Number(v.price).toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr><td colSpan={2} style={{ fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>Square</td></tr>
                              </table>
                            )
                          }
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: price != null ? '#0f172a' : '#cbd5e1' }}>
                                {price != null ? `$${Number(price).toFixed(2)}` : '—'}
                              </span>
                              {price != null && <span style={{ fontSize: 9, color: '#94a3b8' }}>Square</span>}
                              {price == null && !readOnly && <span style={{ fontSize: 9, color: '#dc2626' }}>Set in Square</span>}
                            </div>
                          )
                        })()}
                      </td>


                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}


// ─── TRENDS VIEW ──────────────────────────────────────────────────────────────
const TREND_CAT_COLORS = {
  'Beer':                 '#2563eb',
  'Cider':                '#0891b2',
  'PreMix':               '#7c3aed',
  'White Wine':           '#ca8a04',
  'Red Wine':             '#dc2626',
  'Rose':                 '#db2777',
  'Sparkling':            '#0f766e',
  'Fortified & Liqueurs': '#9a3412',
  'Spirits':              '#4338ca',
  'Soft Drinks':          '#16a34a',
  'Snacks':               '#64748b',
}
const TREND_CHART_W = 680, TREND_CHART_H = 200, TREND_PAD_L = 50, TREND_PAD_T = 20, TREND_PAD_R = 20, TREND_PAD_B = 40

function CategoryChart({ cat, data, hasRev }) {
  const chartW = TREND_CHART_W, chartH = TREND_CHART_H, padL = TREND_PAD_L, padT = TREND_PAD_T, padR = TREND_PAD_R
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - TREND_PAD_B
  const vals   = data.map(q => q.categories[cat]?.unitsSold || 0)
  const revs   = data.map(q => q.categories[cat]?.revenue  || 0)
  const maxVal = Math.max(...vals, 1)
  const color  = TREND_CAT_COLORS[cat] || '#2563eb'
  const barW   = Math.floor(innerW / data.length) - 16
  const trend  = vals[vals.length-1] - vals[0]
  const trendColor = trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#64748b'
  const trendIcon  = trend > 0 ? '▲' : trend < 0 ? '▼' : '→'
  const total      = vals.reduce((s, v) => s + v, 0)

  const bars = data.map((q, i) => {
    const bh = Math.round((vals[i] / maxVal) * innerH)
    const x  = padL + i * (innerW / data.length) + 8
    const y  = padT + innerH - bh
    return (
      <g key={i}>
        <rect x={x} y={y} width={barW} height={bh} fill={color} rx={3} opacity={0.85}/>
        <text x={x + barW/2} y={y - 5} textAnchor="middle" fontSize={10} fill="#0f172a" fontWeight="600">{vals[i]}</text>
        <text x={x + barW/2} y={padT + innerH + 14} textAnchor="middle" fontSize={9} fill="#475569">{q.label.split(' ').slice(0,2).join(' ')}</text>
        {hasRev && <text x={x + barW/2} y={padT + innerH + 26} textAnchor="middle" fontSize={8} fill="#16a34a">${revs[i] ? revs[i].toFixed(0) : '—'}</text>}
      </g>
    )
  })

  const grids = [0.5, 1].map(pct => {
    const y   = padT + innerH - Math.round(pct * innerH)
    const val = Math.round(pct * maxVal)
    return (
      <g key={pct}>
        <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#e2e8f0" strokeWidth={1}/>
        <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{val}</text>
      </g>
    )
  })

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: color }}/>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{cat}</span>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
          <span style={{ color: '#64748b' }}>4-quarter total: <strong style={{ color: '#0f172a' }}>{total.toLocaleString()} units</strong></span>
          <span style={{ color: trendColor, fontWeight: 700 }}>{trendIcon} {Math.abs(trend)} units {trend >= 0 ? 'up' : 'down'} vs 4 qtrs ago</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + (hasRev ? 10 : 0)}`} style={{ overflow: 'visible' }}>
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1}/>
        <line x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH} stroke="#cbd5e1" strokeWidth={1}/>
        {grids}
        {bars}
      </svg>
    </div>
  )
}

function TrendsView({ data, loading, error }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>Loading quarterly data from Square...</div>
      <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>This may take a few seconds</div>
    </div>
  )
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>
      <div style={{ fontSize: 14 }}>Could not load trend data: {error}</div>
    </div>
  )
  if (!data) return null

  const allCats    = CATEGORY_ORDER.filter(c => data.some(q => q.categories[c]))
  const hasRev     = data.some(q => q.totals.revenue > 0)
  const qLabels    = data.map(q => q.label)
  const grandTotals = data.map(q => q.totals.unitsSold)
  const maxGrand   = Math.max(...grandTotals, 1)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '18px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Quarterly Sales Trends</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>Last 4 quarters — units sold by category</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {qLabels.map((q, i) => (
              <div key={i} style={{ fontSize: 10, background: '#f1f5f9', borderRadius: 4, padding: '3px 8px', color: '#475569' }}>
                {q}: <strong>{grandTotals[i].toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
        <svg width="100%" viewBox="0 0 680 60" style={{ overflow: 'visible' }}>
          {data.map((q, i) => {
            const bh = Math.round((grandTotals[i] / maxGrand) * 40)
            const x  = 10 + i * 165
            const y  = 50 - bh
            return (
              <g key={i}>
                <rect x={x} y={y} width={150} height={bh} fill="#0f172a" rx={3} opacity={0.15}/>
                <rect x={x} y={y} width={150} height={bh} fill="#2563eb" rx={3} opacity={0.6}/>
                <text x={x + 75} y={y - 4} textAnchor="middle" fontSize={10} fill="#0f172a" fontWeight="700">{grandTotals[i].toLocaleString()}</text>
                <text x={x + 75} y={58} textAnchor="middle" fontSize={9} fill="#64748b">{q.label}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {allCats.map(cat => <CategoryChart key={cat} cat={cat} data={data} hasRev={hasRev} />)}
    </div>
  )
}


// ─── NOTES VIEW ────────────────────────────────────────────────────────────────
function NotesView({ items, notes, readOnly, onRefresh }) {
  const [form, setForm]         = useState({ noteDate: '', itemName: '', comment: '', author: '' })
  const [saving, setSaving]     = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState({})

  // Default date to today Brisbane time
  const todayBrisbane = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
  const ef  = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const eef = (f, v) => setEditForm(p => ({ ...p, [f]: v }))

  function startEdit(n) {
    setEditingId(n.id)
    setEditForm({ noteDate: n.noteDate, itemName: n.itemName || '', comment: n.comment, author: n.author || '' })
  }

  function cancelEdit() { setEditingId(null); setEditForm({}) }

  function printNotes() {
    const rows = filtered.map(n => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;white-space:nowrap">
          ${new Date(n.noteDate + 'T12:00:00').toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0e7490">
          ${n.itemName || '—'}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px">
          ${n.comment.replace(/</g,'&lt;').replace(/>/g,'&gt;')}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;white-space:nowrap">
          ${n.author || '—'}
        </td>
      </tr>`).join('')

    const filterDesc = (filterFrom || filterTo)
      ? `${filterFrom || '…'} to ${filterTo || '…'}`
      : 'All dates'

    const html = `<!DOCTYPE html><html><head>
      <title>Notes Report — Paynter Bar</title>
      <style>
        @page { size: A4 portrait; margin: 15mm }
        body { font-family: Arial, sans-serif; color: #0f172a; }
        h1 { font-size: 18px; margin: 0 0 4px }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 16px }
        table { width: 100%; border-collapse: collapse }
        th { background: #5b21b6; color: #fff; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left }
        tr:nth-child(even) td { background: #f8fafc }
        .footer { margin-top: 16px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px }
      </style>
    </head><body>
      <h1>📝 Notes Report</h1>
      <div class="meta">
        Paynter Bar · GemLife Palmwoods<br>
        Generated: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}<br>
        Period: ${filterDesc} · ${filtered.length} note${filtered.length !== 1 ? 's' : ''}
      </div>
      <table>
        <thead><tr>
          <th style="width:90px">Date</th>
          <th style="width:140px">Item</th>
          <th>Comment</th>
          <th style="width:100px">Author</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Paynter Bar Hub · GemLife Palmwoods</div>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  async function saveNote() {
    if (!form.comment.trim()) return
    setSaving(true)
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, noteDate: form.noteDate || todayBrisbane })
      })
      setForm({ noteDate: '', itemName: '', comment: '', author: '' })
      setShowForm(false)
      onRefresh()
    } catch(e) { alert('Save failed') }
    setSaving(false)
  }

  async function updateNote() {
    if (!editForm.comment.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/notes?id=${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      setEditingId(null)
      setEditForm({})
      onRefresh()
    } catch(e) { alert('Update failed') }
    setSaving(false)
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    await fetch(`/api/notes?id=${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const filtered = notes.filter(n => {
    if (filterFrom && n.noteDate < filterFrom) return false
    if (filterTo   && n.noteDate > filterTo)   return false
    return true
  })

  const itemNames = [...new Set((items || []).map(i => i.name))].sort()

  return (
    <div className="view-wrap" style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>📝 Notes</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Bar observations, stock notes and general comments</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={printNotes} disabled={filtered.length === 0}
            style={{ background: filtered.length === 0 ? '#94a3b8' : '#0e7490', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer' }}>
            🖨️ Print
          </button>
          {!readOnly && (
            <button onClick={() => setShowForm(s => !s)}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {showForm ? '✕ Cancel' : '+ Add Note'}
            </button>
          )}
        </div>
      </div>

      {/* Add note form */}
      {showForm && !readOnly && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>New Note</div>
          <div className="form-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</label>
              <input type="date" value={form.noteDate || todayBrisbane} onChange={e => ef('noteDate', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item (optional)</label>
              <select value={form.itemName} onChange={e => ef('itemName', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                <option value="">— General note —</option>
                {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment *</label>
            <textarea value={form.comment} onChange={e => ef('comment', e.target.value)} rows={3}
              placeholder="Enter your note or observation..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author</label>
              <input type="text" value={form.author} onChange={e => ef('author', e.target.value)} placeholder="Your name"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <button onClick={saveNote} disabled={saving || !form.comment.trim()}
              style={{ background: saving || !form.comment.trim() ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: saving || !form.comment.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? 'Saving...' : '✓ Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Filter:</span>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>to</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo('') }}
            style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{filtered.length} note{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14 }}>{notes.length === 0 ? 'No notes yet. Add the first one above.' : 'No notes match the selected date range.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(n => (
            <div key={n.id} style={{ background: '#fff', border: `1px solid ${editingId === n.id ? '#7c3aed' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 20px' }}>
              {editingId === n.id ? (
                /* ── Inline edit form ── */
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 14 }}>Edit Note</div>
                  <div className="form-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</label>
                      <input type="date" value={editForm.noteDate} onChange={e => eef('noteDate', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item</label>
                      <select value={editForm.itemName} onChange={e => eef('itemName', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                        <option value="">— General note —</option>
                        {[...new Set((items || []).map(i => i.name))].sort().map(nm => <option key={nm} value={nm}>{nm}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment *</label>
                    <textarea value={editForm.comment} onChange={e => eef('comment', e.target.value)} rows={3}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author</label>
                      <input type="text" value={editForm.author} onChange={e => eef('author', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={cancelEdit}
                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={updateNote} disabled={saving || !editForm.comment.trim()}
                        style={{ background: saving || !editForm.comment.trim() ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: saving || !editForm.comment.trim() ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : '✓ Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Read view ── */
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '3px 10px', borderRadius: 99 }}>
                        {new Date(n.noteDate + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {n.itemName && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0e7490', background: '#ecfeff', padding: '3px 10px', borderRadius: 99 }}>
                          {n.itemName}
                        </span>
                      )}
                      {n.author && <span style={{ fontSize: 11, color: '#94a3b8' }}>— {n.author}</span>}
                    </div>
                    <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>{n.comment}</div>
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEdit(n)}
                        style={{ background: '#f5f3ff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}
                        title="Edit note">✏️ Edit</button>
                      <button onClick={() => deleteNote(n.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 16, padding: '0 4px' }}
                        title="Delete note">✕</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── HELP TAB ─────────────────────────────────────────────────────────────────
function HelpTab() {
  const sections = [
    {
      icon: '🏠',
      title: 'Dashboard',
      items: [
        { q: 'Home screen', a: 'The Dashboard is the home screen. It shows live stock status at a glance — Critical items, Low Stock, items to order, and when data was last refreshed from Square.' },
        { q: 'Status cards', a: 'The Critical, Low Stock and To Order cards are clickable — tap any of them to jump straight to the Reorder Planner filtered to those items.' },
        { q: 'Feature tiles', a: 'All app features are accessible from the Dashboard via clickable tiles. The Volunteer Roster tile opens in a new tab.' },
        { q: 'Refreshing data', a: 'Click Refresh in the top-right header to pull the latest stock levels, prices and sales data from Square POS. The Dashboard shows how long ago data was last refreshed.' },
      ]
    },
    {
      icon: '🔐',
      title: 'Getting Started',
      items: [
        { q: 'Logging in', a: 'Enter your PIN on the login screen. Committee PIN gives full access. The read-only PIN gives view-only access. Your session stays active until you close the browser tab.' },
        { q: 'Refreshing data', a: 'Click Refresh in the top-right to pull the latest stock levels and sales from Square POS. Always reflects current Square data.' },
        { q: 'Sales period', a: 'The 30d / 60d / 90d buttons set how many days of sales history are used to calculate weekly averages. 90 days gives the most stable average; 30 days is more responsive to recent trends.' },
        { q: 'Navigation', a: 'On desktop, all tabs appear as buttons in the top-right header. On mobile, tap the ☰ menu icon to access all features.' },
      ]
    },
    {
      icon: '📦',
      title: 'Reorder Planner',
      items: [
        { q: 'Reading the table', a: 'Each row shows current stock (On Hand), weekly average sales, target stock level, and how much to order. Red = CRITICAL (below target), yellow = LOW, green = OK.' },
        { q: 'Order Qty vs Bottles', a: 'For spirits and fortified wines, Order Qty shows nips needed and Bottles shows full bottles to buy (rounded up). For all other items, Order Qty shows units to order.' },
        { q: 'Target Weeks', a: 'Click the number in the header stats bar to change how many weeks of stock to hold. Default is 6 weeks. Affects all items target stock calculations.' },
        { q: 'Filtering to order items', a: 'Tick \"Order items only\" in the controls bar to hide items that don\'t need ordering — useful when preparing orders.' },
        { q: 'Supplier tabs', a: 'Click a supplier name to filter the table to just that supplier. Use + Supplier to add a new supplier.' },
        { q: 'Editing item settings', a: 'Click any value in the Category, Supplier, Pack, Bottle Size or Nip Size columns to edit inline. Changes save automatically and are shared with all committee members.' },
        { q: 'Adding notes', a: 'Click the Notes column for any item to add a note (e.g. \"Discontinued\", \"Check price\"). Notes are saved and visible to all.' },
        { q: 'Print Order Sheet', a: 'Click Print Order Sheet then choose a supplier to open a formatted, print-ready order form for that supplier. Use your browser Print dialog or Save as PDF.' },
      ]
    },
    {
      icon: '📬',
      title: 'On Order Tracking',
      items: [
        { q: 'What it does', a: 'When you place an order, click Mark as Ordered next to items in the Reorder Planner. They move off the \"To Order\" count and into the \"On Order\" banner so you know what\'s been actioned.' },
        { q: 'On Order banner', a: 'Ordered items appear in a grouped banner at the top of the Reorder Planner, organised by supplier. Each supplier group shows the order date and which items were ordered.' },
        { q: 'Marking delivery received', a: 'When stock arrives, click ✓ [Supplier] Received in the On Order banner. This clears all items for that supplier from the On Order list in one step.' },
        { q: 'To Order vs On Order', a: '\"To Order\" count in the stats bar only shows items not yet actioned. \"On Order\" shows items that have been ordered but not yet received. The two counts are mutually exclusive.' },
      ]
    },
    {
      icon: '🥃',
      title: 'Spirits & Fortified Wines',
      items: [
        { q: 'How spirits are tracked', a: 'Square tracks spirits in nips (30ml standard, 60ml for Baileys, Galway Pipe Port and Penfolds Club Port). All calculations — weekly average, target stock, order quantities — stay in nips throughout.' },
        { q: 'Bottle Size column', a: 'Set to 700ml, 750ml or 1000ml per item. Determines how many nips per bottle (e.g. 700ml ÷ 30ml = 23.3 nips). Affects order quantities and stocktake calculations.' },
        { q: 'Nip Size column', a: 'Most spirits are 30ml. Baileys Irish Cream, Galway Pipe Port and Penfolds Club Port are served as 60ml nips. Must be set correctly for accurate order quantities.' },
        { q: 'Order quantities', a: 'Shows nips needed to reach target stock. Bottles column shows full bottles to buy (always rounded up). Example: need 70 nips from 700ml bottle → Order Qty 70, Bottles 3.' },
      ]
    },
    {
      icon: '💲',
      title: 'Pricing Mode',
      items: [
        { q: 'Enabling pricing', a: 'Click $ Pricing in the controls bar to reveal Buy Price, Sell Price and Margin % columns. This view is only available to committee members.' },
        { q: 'Sell prices from Square', a: 'Sell prices are imported automatically from your Square catalogue. All price changes must be made in Square — this keeps Square as the single source of truth.' },
        { q: 'Margin calculation', a: 'Margin % = (Sell − Buy) ÷ Sell × 100. Green = 40%+, amber = 20–40%, red = below 20%. Requires both buy and sell price to be set.' },
        { q: 'Buy prices', a: 'Click the Buy Price cell for any item and type the cost price. Saved to the cloud and shared across all management team sessions.' },
      ]
    },
    {
      icon: '📊',
      title: 'Sales Tab',
      items: [
        { q: 'Opening', a: 'Click 📊 Sales in the top-right header. Data is fetched live from Square\'s Orders API — allow a few seconds to load.' },
        { q: 'Period selector', a: 'Five periods available: This Month (month to date), Last Month (prior completed month), Last 3 Months (rolling window), Financial Year (May 1 – Apr 30, auto-calculated), and Custom Range (pick any start and end date). Each period automatically compares against the equivalent prior period.' },
        { q: 'Category breakdown', a: 'The category bar shows units and revenue per category. Click any tile to filter the item table to that category. Click again (or ALL) to reset.' },
        { q: 'Revenue figures', a: 'Revenue comes directly from Square transaction records — the actual price charged at time of sale.' },
        { q: 'Sort order', a: 'Toggle between By Units and By Revenue using the buttons above the item table.' },
        { q: 'Print / PDF export', a: 'Once data is loaded, click 🖨️ Print / PDF to open a formatted A4 report for the current period. Includes summary, category breakdown and full item list with prior period comparisons.' },
        { q: 'Excel export', a: 'Click 📊 Excel to download a formatted spreadsheet for the current period. Includes colour-coded headings, category breakdown, % of total, change % and revenue columns.' },
      ]
    },
    {
      icon: '🏆',
      title: 'Best & Worst Sellers',
      items: [
        { q: 'Opening', a: 'Click 🏆 Sellers in the top-right header. The report fetches 90 days of Orders API data from Square — allow a few seconds to load.' },
        { q: 'Top 10 Sellers', a: 'Ranked by weekly average from Square inventory data, with a bar chart showing relative performance. Your most reliable, high-volume items.' },
        { q: 'Slow Sellers', a: 'The bottom 25% of items that are selling but very slowly over the last 90 days. Useful for identifying items to reduce ordering on or consider dropping.' },
        { q: 'Not Selling', a: 'Items with stock on hand but zero sales recorded in the last 90 days. Strong candidates for discontinuing or running down stock.' },
      ]
    },
    {
      icon: '📈',
      title: 'Quarterly Trends',
      items: [
        { q: 'Opening', a: 'Click 📈 Trends in the top-right header. The chart loads the last 4 completed calendar quarters automatically.' },
        { q: 'Reading the charts', a: 'Each category gets its own bar chart showing units sold per quarter. A trend indicator (▲ up, ▼ down, → stable) shows the direction from earliest to most recent quarter.' },
        { q: 'Summary panel', a: 'The top panel shows total units sold across all categories for each quarter with a mini bar chart for quick visual comparison.' },
        { q: 'Revenue data', a: 'Where available from Square, revenue figures are shown alongside unit counts for each quarter and category.' },
      ]
    },
    {
      icon: '🗑️',
      title: 'Wastage Log',
      items: [
        { q: 'Recording wastage', a: 'Click 🗑️ Wastage in the header to open the Wastage Log. Select the item, quantity, unit, reason (breakage, spoilage, expired, other) and an optional note. Click Record to save.' },
        { q: 'Editing entries', a: 'Committee members can click the ✏️ edit button on any row to modify an entry inline — change the date, item, quantity, reason, note or recorded-by name. Click ✓ to save or ✕ to cancel.' },
        { q: 'Deleting entries', a: 'Click the ✕ delete button on any row to permanently remove a wastage entry. Committee access only.' },
        { q: 'Filtering by date', a: 'Use the date range pickers at the top to filter the log to a specific period. Leave blank to see all entries.' },
        { q: 'Summary strip', a: 'The coloured cards at the top show total wastage counts broken down by reason across the filtered period.' },
        { q: 'Notes print', a: 'The 🖨️ Print button exports the currently filtered wastage entries as a formatted A4 table.' },
      ]
    },
    {
      icon: '📝',
      title: 'Notes',
      items: [
        { q: 'What notes are for', a: 'The Notes tab is a shared log for bar committee communications — handover notes, supplier follow-ups, operational reminders, anything the committee needs to track.' },
        { q: 'Adding a note', a: 'Select an item (or leave as General), type your note and click Save. Notes are timestamped and saved with your name.' },
        { q: 'Editing notes', a: 'Committee members can click ✏️ to edit any note inline. Click ✓ to save or ✕ to cancel.' },
        { q: 'Filtering', a: 'Use the date range pickers to filter to a specific period, or use the item dropdown to filter notes for a specific product.' },
        { q: 'Print', a: 'Click 🖨️ Print to export the currently filtered notes as a formatted A4 table — useful for handover documentation.' },
      ]
    },
    {
      icon: '🏷️',
      title: 'Price List',
      items: [
        { q: 'Opening', a: 'Click 🏷️ Price List in the top-right header. The editor shows all items grouped by category with their current Square prices.' },
        { q: 'Showing and hiding items', a: 'Click the Shown/Hidden toggle next to any item to include or exclude it from the printed price list. Items with zero stock in Square are automatically excluded.' },
        { q: 'Prices', a: 'All prices come from Square. To change a price, update it in Square and click Refresh. Wine items with both a Glass and Bottle price show both, with Glass listed first.' },
        { q: 'Printing', a: 'Click 🖨️ Print Price List to open a two-page A4 portrait document in a two-column card layout. In the print dialog set paper to A4, margins to None and scale to 100%.' },
        { q: 'Edit access', a: 'The Shown/Hidden toggle is only available to committee members. Read-only users can view the price list but cannot make changes.' },
      ]
    },
    {
      icon: '📋',
      title: 'SOH Report',
      items: [
        { q: 'Opening', a: 'Click 📋 SOH Report in the top-right header. A small modal appears with two export options.' },
        { q: '🖨️ Print / PDF', a: 'Opens a formatted A4 Stock on Hand report in a new tab — all items by category with On Hand qty, weekly average, target stock, order status and supplier. Print or save as PDF from the browser dialog.' },
        { q: '📊 Excel', a: 'Downloads a formatted Excel spreadsheet of the current SOH data. Includes a summary block (total items, critical, low stock, to order counts), colour-coded category headers, and per-item rows with status highlighted in red/amber/green.' },
        { q: 'Data source', a: 'The SOH report reflects whatever is currently loaded in the Reorder Planner — always click Refresh first to ensure data is current.' },
      ]
    },
    {
      icon: '📤',
      title: 'Other Exports',
      items: [
        { q: 'Print Order Sheet', a: 'In the Reorder Planner, click Print Order Sheet and choose a supplier to open a formatted, print-ready order form for that supplier.' },
        { q: 'Stocktake Export', a: 'Downloads an Excel spreadsheet for quarterly stocktakes. Count columns for Cool Room, Store Room and Bar. For spirits, enter decimal bottles (e.g. 4.5) — the sheet calculates nips automatically and shows the variance against Square.' },
        { q: 'Notes Print', a: 'In the Notes tab, click 🖨️ Print to export the current filtered notes as a formatted A4 table.' },
        { q: 'Wastage Print', a: 'In the Wastage Log, click 🖨️ Print to export the current filtered wastage entries as a formatted A4 table.' },
      ]
    },
    {
      icon: '👥',
      title: 'Volunteer Roster',
      items: [
        { q: 'Opening', a: 'Click 👥 Roster in the top-right header to open the volunteer roster app in a new tab. The roster runs independently at paynter-bar-roster.vercel.app.' },
        { q: 'How they connect', a: 'The two apps are separate — the roster link is a shortcut for convenience. All roster changes are made within the roster app itself.' },
      ]
    },
    {
      icon: '⚙️',
      title: 'Settings & Administration',
      items: [
        { q: 'Shared settings', a: 'All settings (categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks, price list visibility) are saved to the cloud and shared instantly across all management sessions.' },
        { q: 'Adding suppliers', a: 'Use the + Supplier button in the controls bar of the Reorder Planner. Assign items to suppliers by clicking the Supplier column inline.' },
        { q: 'Item categories', a: 'Available categories: Beer, Cider, PreMix, White Wine, Red Wine, Rose, Sparkling, Fortified & Liqueurs, Spirits, Soft Drinks, Snacks. Spirits and Fortified & Liqueurs items get the bottle and nip size columns.' },
        { q: 'Square POS connection', a: 'The app connects to Square via API. Stock levels, sales and prices update on every Refresh. Square is always the source of truth — all transactions and price changes are made in Square.' },
      ]
    },
    {
      icon: '👁',
      title: 'Access Levels',
      items: [
        { q: 'Committee PIN (management)', a: 'Full access to all features — editing item settings, categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks, price list visibility, wastage editing, and all exports.' },
        { q: 'Read-only PIN (homeowners)', a: 'View-only access. All data is visible — stock levels, order quantities, sales reports, trends, price list, SOH and sales exports — but nothing can be edited. A READ ONLY badge appears in the header.' },
        { q: 'Pricing visibility', a: 'Buy prices and the $ Pricing view are only visible to committee members — hidden entirely for read-only users to keep cost prices confidential.' },
        { q: 'Wastage and Notes', a: 'Read-only users can view the Wastage Log and Notes tab but cannot add, edit or delete entries.' },
      ]
    },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px 32px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, background: '#0f172a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍺</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Paynter Bar Hub</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>GemLife Palmwoods — Bar Management System</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          This app manages bar operations for the Paynter Bar Management Team. It connects directly to Square POS to provide
          live stock levels, sales analytics, automated reorder calculations, seller performance reports and management reports — all in one place.
          Settings and changes made by any management team member are shared across all devices instantly.
        </p>
      </div>

      {/* Procedures document download */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0e7490 100%)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>📄 Stock Ordering & Inventory Procedures</div>
          <div style={{ fontSize: 12, color: '#bfdbfe', lineHeight: 1.6 }}>
            Complete procedures document — ordering, PO creation, invoice filing, goods receipt, History Report and wastage recording.
          </div>
        </div>
        <button
          onClick={() => window.open('/PaynterHubProcedures.pdf', '_blank')}
          style={{ background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          📄 View & Print Procedures
        </button>
      </div>

      {sections.map(section => (
        <div key={section.title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontSize: 18 }}>{section.icon}</span>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section.title}</h3>
          </div>
          <div>
            {section.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', borderBottom: idx < section.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ width: 220, minWidth: 220, padding: '11px 20px', borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{item.q}</span>
                </div>
                <div style={{ flex: 1, padding: '11px 20px' }}>
                  <span style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{item.a}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.8 }}>
          Paynter Bar Hub — Built for Paynter Bar Committee, GemLife Palmwoods<br />
          Data source: Square POS · Settings stored in Vercel KV · Deployed on Vercel
        </p>
      </div>
    </div>
  )
}


// ─── SALES REPORT VIEW ────────────────────────────────────────────────────────
function SalesView({ period, setPeriod, custom, setCustom, report, loading, error, category, setCategory, sort, setSort, onLoad, onExportPdf, onExportXlsx, exportLoading }) {
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
        {[['month','This Month'],['lastmonth','Last Month'],['3months','Last 3 Months'],['financialYear','Financial Year (May – Apr)'],['custom','Custom Range']].map(([val, label]) => (
          <button key={val}
            style={{ ...styles.tab, ...(period === val ? styles.tabActive : {}) }}
            onClick={() => { setPeriod(val); if (val !== 'custom') onLoad(val, custom) }}>
            {label}
          </button>
        ))}
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
                    <th style={styles.th}>Category</th>
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

// ─── EDIT COMPONENTS ──────────────────────────────────────────────────────────
function EditSelect({ value, options, onChange, saving, colorMap, readOnly }) {
  const [editing, setEditing] = useState(false)
  if (readOnly) { const color = colorMap ? colorMap[value] : null; return <span style={{ fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}>{value}</span> }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <select defaultValue={value} autoFocus style={styles.inlineSelect}
      onChange={e => { onChange(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  const color = colorMap ? colorMap[value] : null
  return <span style={{ cursor: 'pointer', fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}
    onClick={() => setEditing(true)} title="Click to edit">{value}</span>
}

function EditNumber({ value, onChange, saving, min, placeholder, decimals, prefix, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (readOnly) { const display = decimals && (value !== '' && value != null) ? `${prefix || ''}${Number(value).toFixed(decimals)}` : (value !== '' && value != null ? `${prefix || ''}${value}` : '—'); return <span style={{ fontSize: 12, color: '#374151', fontFamily: 'IBM Plex Mono, monospace' }}>{display}</span> }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>...</span>
  if (editing) return (
    <input type="number" value={val} min={min || 0} step={decimals ? 0.01 : 1} style={styles.inlineInput}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== '') onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      autoFocus />
  )
  if (value === '' || value === null || value === undefined) return (
    <span style={{ cursor: 'pointer', color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' }}
      onClick={() => setEditing(true)}>{placeholder || 'Set'}</span>
  )
  const display = decimals ? `${prefix || ''}${Number(value).toFixed(decimals)}` : value
  return <span style={{ cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}
    onClick={() => setEditing(true)} title="Click to edit">{display}</span>
}

function EditText({ value, onChange, saving, placeholder, readOnly }) {
  if (readOnly) return <span style={{ fontSize: 12, color: value ? '#374151' : '#e2e8f0' }}>{value || '—'}</span>
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <input type="text" value={val} style={{ ...styles.inlineInput, width: 160, textAlign: 'left' }}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      autoFocus placeholder={placeholder} maxLength={120} />
  )
  return <span style={{ cursor: 'pointer', fontSize: 12, color: value ? '#374151' : '#cbd5e1', fontStyle: value ? 'normal' : 'italic' }}
    onClick={() => setEditing(true)} title="Click to edit">{value || placeholder}</span>
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = {
  page:          { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'IBM Plex Sans', sans-serif", overflowX: 'hidden', display: 'flex', flexDirection: 'row' },
  loadWrap:      { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' },
  loadBox:       { textAlign: 'center' },
  spinner:       { width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #1f4e79', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' },
  header:        { background: '#0f172a', color: '#fff' },
  headerInner:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 12px', flexWrap: 'wrap', gap: 12 },
  headerTop:     { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo:          { fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: '#cbd5e1', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono', monospace" },
  logoSub:       { fontSize: 11, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace" },
  title:         { fontSize: 22, fontWeight: 700, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' },
  headerRight:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  lastUpdated:   { fontSize: 12, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace" },
  btn:           { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  btnDisabled:   { background: '#334155', cursor: 'not-allowed' },
  statsBar:      { display: 'flex', borderTop: '1px solid #334155', padding: '0 32px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  stat:          { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 24px', borderRight: '1px solid #334155', gap: 2, borderTopWidth: 3, borderTopStyle: 'solid', borderTopColor: 'transparent' },
  statNum:       { fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#f8fafc' },
  statLabel:     { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' },
  targetInput:   { width: 50, fontSize: 20, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: 4, textAlign: 'center', padding: '2px 4px' },
  errorBox:      { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', margin: '16px 32px', padding: '12px 16px', borderRadius: 6, fontSize: 13 },
  controls:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 12 },
  viewTabs:      { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  tab:           { padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif" },
  tabActive:     { background: '#0f172a', color: '#fff', borderColor: '#0f172a' },
  filterCheck:   { display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' },
  supplierInput: { fontSize: 13, border: '1px solid #3b82f6', borderRadius: 6, padding: '6px 10px', fontFamily: "'IBM Plex Sans', sans-serif", width: 160 },
  dropdown:      { position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 200 },
  dropItem:      { display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#374151', fontFamily: "'IBM Plex Sans', sans-serif" },
  tableWrap:     { overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' },
  thead:         { background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 },
  th:            { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td:            { padding: '9px 14px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  inlineSelect:  { fontSize: 12, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 4px', background: '#eff6ff', color: '#1d4ed8', fontFamily: "'IBM Plex Sans', sans-serif" },
  inlineInput:   { width: 70, fontSize: 13, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 6px', background: '#eff6ff', color: '#1d4ed8', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace" },
  footer:        { textAlign: 'center', padding: '24px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #e2e8f0', background: '#fff' },
}


// ─── STOCKTAKE VIEW ────────────────────────────────────────────────────────────
function StocktakeView({ items, readOnly, onExport }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']

  // counts keyed by item name: { coolRoom, storeRoom, bar }
  const [counts, setCounts] = useState({})
  const [countsLoaded, setCountsLoaded] = useState(false)
  const [filterCat, setFilterCat] = useState('All')
  const [mobileMode, setMobileMode] = useState(false)
  const [mobileIdx, setMobileIdx] = useState(0)
  const [showDiffs, setShowDiffs] = useState(false)

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
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
    script.onload = () => {
      const XLSX = window.XLSX
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

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
      ws['!rows'] = rows.map((_, i) => i === 0 ? { hpt: 24 } : i === 3 ? { hpt: 24 } : { hpt: 18 })
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stocktake')
      XLSX.writeFile(wb, `Paynter-Bar-Stocktake-${new Date().toISOString().split('T')[0]}.xlsx`)
    }
    document.head.appendChild(script)
  }

  const printBlankSheet = () => {
    const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })
    let lastCat = null
    let rows = ''
    sortedItems.forEach((item, idx) => {
      if (item.category !== lastCat) {
        lastCat = item.category
        rows += `<tr class="cat-row"><td colspan="8">${item.category}</td></tr>`
      }
      const shade = idx % 2 === 0 ? '#fff' : '#f8fafc'
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
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f172a; color: #fff; padding: 6px 8px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
  th.item-col { text-align: left; width: 32%; }
  th.input-col { text-align: center; width: 10%; }
  th.total-col { text-align: center; width: 8%; background: #1e3a5f; }
  th.nips-col { text-align: center; width: 8%; background: #134e4a; }
  th.sq-col { text-align: center; width: 8%; }
  th.diff-col { text-align: center; width: 8%; background: #1e3a5f; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  td.item-name { font-size: 11px; font-weight: 500; }
  td.input-cell { text-align: center; border-left: 1px solid #e2e8f0; }
  td.total-cell { text-align: center; background: #f0f9ff; border-left: 2px solid #bae6fd; font-weight: 700; }
  td.sq-cell { text-align: center; color: #64748b; font-family: monospace; }
  td.diff-cell { text-align: center; background: #fefce8; border-left: 2px solid #fef08a; }
  .write-box { display: inline-block; width: 52px; height: 20px; border-bottom: 1.5px solid #94a3b8; }
  tr.cat-row td { background: #f1f5f9; font-weight: 700; font-size: 10px; color: #374151; padding: 6px 8px; border-top: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.04em; }
  td.nips-cell { text-align: center; color: #0f766e; font-family: monospace; font-weight: 700; font-size: 11px; background: #f0fdfa; border-left: 1px solid #99f6e4; }
  .nips-ref { display: inline-block; background: #ccfbf1; border-radius: 4px; padding: 1px 5px; font-size: 10px; }
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
        <button onClick={resetAll}
          style={{ padding: '7px 14px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          🗑 Clear All
        </button>
      </div>

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
    </div>
  )
}
