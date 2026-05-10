import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { CATEGORIES } from '../lib/calculations'

const DEFAULT_SUPPLIERS = ['Dan Murphy', 'Coles Woolies', 'ACW']

const PRIORITY_COLORS = {
  CRITICAL: { bg: '#fee2e2', text: '#991b1b', badge: '#dc2626' },
  LOW:      { bg: '#fef9c3', text: '#854d0e', badge: '#ca8a04' },
  OK:       { bg: '#f0fdf4', text: '#166534', badge: '#16a34a' },
}

const SUPPLIER_COLORS = {
  'Dan Murphy':   '#1f4e79',
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
  const [publicMode, setPublicMode]     = useState(false)
  const [pin, setPin]                   = useState('')
  const [pinError, setPinError]         = useState(false)
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [error, setError]               = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [targetWeeks, setTargetWeeks]   = useState(6)
  const [view, setView]                 = useState('all')
  const [filterOrder, setFilterOrder]   = useState(true)
  const [showDetails, setShowDetails]   = useState(false)

  const [saving, setSaving]             = useState({})
  const [editingTarget, setEditingTarget] = useState(false)
  const [suppliers, setSuppliers]       = useState(DEFAULT_SUPPLIERS)
  const [supplierVendorNames, setSupplierVendorNames] = useState({}) // { appName: squareVendorName }
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [printing, setPrinting]         = useState(null)
  const [daysBack, setDaysBack]         = useState(60)
  const [viewMode, setViewMode]         = useState('reorder')
  const [mainTab, setMainTab]           = useState('home')
  const [salesPdfModal, setSalesPdfModal] = useState(false)
  const [sohModal, setSohModal]               = useState(false)

  const [orderQtyOverrides, setOrderQtyOverrides] = useState({}) // { itemName: qty } — session only
  const [poReceiving, setPoReceiving]         = useState(null)
  const [receiveModal, setReceiveModal]       = useState(null) // { supplier, items: [{name,...}] }
  const [refModal, setRefModal]               = useState(null) // { supplier } — order ref prompt
  const [refInput, setRefInput]               = useState('')
  const [receiveChecked, setReceiveChecked]   = useState({})   // { itemName: bool }
  const [receiveQtys, setReceiveQtys]         = useState({})   // { itemName: number } actual received qty
  const [squareReceiveResult, setSquareReceiveResult] = useState(null) // { ok, changes, error }
  const [receiptData,  setReceiptData]        = useState(null)
  const [receiptSaved, setReceiptSaved]       = useState(false)
  const [salesPdfLoading, setSalesPdfLoading] = useState(false)
  const [salesPeriod, setSalesPeriod]   = useState('month')
  const [salesCustom, setSalesCustom]   = useState({ start: '', end: '' })
  const [salesDay, setSalesDay]         = useState('')
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
  const [fromCache, setFromCache]       = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpenGroups, setSidebarOpenGroups] = useState({ 'Stock': false, 'Sales & Analytics': false, 'Operations': false, 'Reports': false, 'Help': false })
  const [wastageLoaded, setWastageLoaded] = useState(false)
  const [sellersLoading, setSellersLoading] = useState(false)
  const [sellersError, setSellersError] = useState(null)
  const [orderedItems, setOrderedItems]   = useState({})
  const [viewOrderModal, setViewOrderModal] = useState(null)
  const [priceListSettings, setPriceListSettings] = useState({}) // { itemName: { hidden: bool, priceOverride: num, label: str } }
  const [plSaving, setPlSaving]         = useState({})
  const [settingsAudit, setSettingsAudit] = useState({}) // { "ItemName__field": { ts, who } }

  useEffect(() => {
    if (sessionStorage.getItem('bar_authed') === 'yes') {
      setAuthed(true)
      if (sessionStorage.getItem('bar_readonly') === 'yes') setReadOnly(true)
    }
    // Pinless public price list link — ?public=pricelist bypasses PIN as read-only
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('public') === 'pricelist') {
        setAuthed(true)
        setReadOnly(true)
        setMainTab('pricelist')
        setPublicMode(true)
      }
    }
  }, [])

  async function checkPin() {
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      const data = await r.json()
      if (data.ok) {
        sessionStorage.setItem('bar_authed', 'yes')
        if (data.readonly) {
          sessionStorage.setItem('bar_readonly', 'yes')
          setReadOnly(true)
        } else {
          sessionStorage.removeItem('bar_readonly')
          setReadOnly(false)
        }
        setAuthed(true)
        setPinError(false)
        setPin('')
      } else {
        setPinError(true)
        setPin('')
      }
    } catch {
      setPinError(true)
      setPin('')
    }
  }

  const loadItems = useCallback(async (showRefresh = false, days = null) => {
    if (showRefresh) { setRefreshing(true) }
    else setLoading(true)
    setError(null)
    try {
      const effectiveDays = days || daysBack
      const refreshParam = showRefresh ? '&refresh=true' : ''
      const [r, ro] = await Promise.all([
        fetch(`/api/items?days=${effectiveDays}${refreshParam}`),
        fetch('/api/purchase-order')
      ])
      if (!r.ok) {
        let msg = 'Failed to load from Square'
        try { const e = await r.json(); msg = e.error || msg } catch {}
        throw new Error(msg)
      }
      let data
      try { data = await r.json() } catch { throw new Error('Invalid response from server — try refreshing') }
      setItems(data.items.map(i => i.supplier === 'Dan Murphys' ? { ...i, supplier: 'Dan Murphy' } : i))
      setTargetWeeks(data.targetWeeks)
      setLastUpdated(data.lastUpdated)
      setFromCache(data.fromCache === true)
      // Restore persisted order qty overrides from item settings
      const overrides = {}
      for (const item of data.items) {
        if (item.orderQtyOverride != null && item.orderQtyOverride !== '') {
          overrides[item.name] = Number(item.orderQtyOverride)
        }
      }
      setOrderQtyOverrides(overrides)
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
  }, [daysBack])

  useEffect(() => { loadItems() }, [loadItems])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.suppliers) setSuppliers(data.suppliers)
      if (data.supplierVendorNames) setSupplierVendorNames(data.supplierVendorNames || {})
    }).catch(() => {})
  }, [])

  // Reset best-sellers cache when sales period changes so it reloads fresh
  useEffect(() => { setSellersData(null) }, [daysBack])

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
      } else if (period === 'day' && custom.day) {
        start = new Date(custom.day + 'T00:00:00'); start.setHours(0,0,0,0)
        end   = new Date(custom.day + 'T23:59:59'); end.setHours(23,59,59,999)
        compareEnd   = new Date(start.getTime() - 1)
        compareStart = new Date(compareEnd); compareStart.setHours(0,0,0,0)
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




  function openReceiveModal(supplier, supplierItems) {
    const checked = {}
    const qtys = {}
    for (const i of supplierItems) {
      checked[i.name] = true
      const override = orderQtyOverrides[i.name]
      qtys[i.name] = override !== undefined ? override : (i.orderQty || 0)
    }
    setReceiveChecked(checked)
    setReceiveQtys(qtys)
    setSquareReceiveResult(null)
    setReceiveModal({ supplier, items: supplierItems })
  }

  async function confirmReceive() {
    const { supplier } = receiveModal
    const receivedNames = Object.entries(receiveChecked).filter(([, v]) => v).map(([k]) => k)
    const allItems = receiveModal.items.map(i => i.name)
    const allReceived = allItems.every(n => receiveChecked[n])
    setPoReceiving(supplier)
    try {
      // ── 1. Update Hub / Redis state (existing behaviour) ─────────────────
      const action = allReceived ? 'receive' : 'partialReceive'
      const body = allReceived
        ? { action, supplier }
        : { action: 'partialReceive', supplier, receivedItems: receivedNames }
      const r = await fetch('/api/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const d = await r.json()
      if (d.ok) {
        setOrderedItems(d.ordered)
        setOrderQtyOverrides(prev => {
          const next = { ...prev }
          for (const name of receivedNames) delete next[name]
          return next
        })
        for (const name of receivedNames) {
          if (orderQtyOverrides[name] !== undefined) saveSetting(name, 'orderQtyOverride', null)
        }

        // ── 2. Build receipt rows (for display in receipt modal) ──────────
        const receivedItems = receiveModal.items
          .filter(i => receiveChecked[i.name])
          .map(i => {
            const override = orderQtyOverrides[i.name]
            const nips = receiveQtys[i.name] !== undefined ? receiveQtys[i.name] : (override !== undefined ? override : i.orderQty)
            const btl  = i.isSpirit ? Math.ceil(nips / ((i.bottleML || 700) / (i.nipML || 30))) : null
            return { name: i.name, sku: i.sku || '', qty: i.isSpirit ? nips + ' nips (' + btl + ' btl)' : nips + ' units', unitCost: i.buyPrice || '' }
          })

        // ── 3. Update Square inventory ───────────────────────────────────
        const squareItems = receiveModal.items
          .filter(i => receiveChecked[i.name])
          .map(i => ({
            name:     i.name,
            quantity: receiveQtys[i.name] !== undefined ? receiveQtys[i.name] : (i.orderQty || 0),
            unit:     i.isSpirit ? 'nip' : 'each',
          }))
          .filter(it => it.quantity > 0)

        let sqResult = { skipped: true, reason: 'No items to receive' }
        if (squareItems.length > 0) {
          try {
            const sqRes = await fetch('/api/square/receive-inventory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: squareItems, reference: `${supplier} delivery` })
            })
            sqResult = await sqRes.json()
          } catch (sqErr) {
            sqResult = { error: sqErr.message }
          }
        }
        setSquareReceiveResult(sqResult)

        // ── 4. Auto-save report to OneDrive ──────────────────────────────
        const odItems = receiveModal.items.map(i => ({
          name: i.name,
          orderedQty: i.orderQty || 0,
          receivedQty: receiveChecked[i.name] ? (receiveQtys[i.name] !== undefined ? receiveQtys[i.name] : (i.orderQty || 0)) : 0,
          unit: i.isSpirit ? 'nip' : 'each',
          note: receiveChecked[i.name] ? '' : 'Not received this delivery',
        }))
        let oneDriveResult = null
        try {
          const odRes = await fetch('/api/onedrive/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: `${supplier} delivery`, receivedBy: '', locationName: 'Paynter Bar', items: odItems })
          })
          oneDriveResult = await odRes.json()
        } catch (odErr) {
          oneDriveResult = { skipped: true, reason: odErr.message }
        }

        const dateStr = new Date(Date.now() + 10*60*60*1000).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' })
        setReceiveModal(null)
        setReceiptData({ supplier, date: dateStr, items: receivedItems, sqResult, oneDriveResult })
        setReceiptSaved(false)
      }
    } finally {
      setPoReceiving(null)
    }
  }


  function generatePoExcel(supplier) {
    const poItems = items.filter(i =>
      i.supplier === supplier &&
      (orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] > 0 : i.orderQty > 0) &&
      !dontOrder(i) &&
      !orderedItems[i.name]
    ).map(i => {
      const ov  = orderQtyOverrides[i.name]
      const qty = i.isSpirit
        ? (ov !== undefined ? ov : (i.nipsToOrder || 0))
        : (ov !== undefined ? ov : (i.orderQty   || 0))
      const btl = i.isSpirit
        ? (ov !== undefined ? Math.ceil(ov / ((i.bottleML || 700) / (i.nipML || 30))) : (i.bottlesToOrder || 0))
        : null
      const notes = i.isSpirit ? `${btl} Bott` : ''
      return { ...i, _qty: qty, _btl: btl, _notes: notes }
    })
    const escape = v => (v == null || v === '' ? '' : (String(v).includes(',') || String(v).includes('"')) ? `"${String(v).replace(/"/g,'""')}"` : String(v))
    const rows = [['Item Name','Variation Name','SKU','GTIN','Vendor Code','Notes','Qty','Unit Cost']]
    poItems.forEach(item => {
      const unitCost = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice).toFixed(2) : ''
      rows.push([item.name, 'Regular', item.sku || '', '', supplierVendorNames[supplier] || '', item._notes, String(item._qty), unitCost])
    })
    const csv = rows.map(r => r.map(escape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date(Date.now() + 10*60*60*1000).toISOString().split('T')[0]
    a.href = url; a.download = `PO-${supplier.replace(/[^a-zA-Z0-9]/g,'-')}-${date}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function importOrderCsv(file) {
    const reader = new FileReader()
    reader.onload = async e => {
      const text = e.target.result.replace(/^\uFEFF/, '') // strip BOM
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      const header = lines[0].split(',').map(s => s.trim().replace(/"/g,''))
      const nameIdx = header.indexOf('Item Name')
      const qtyIdx  = header.indexOf('Qty')
      const skuIdx  = header.indexOf('SKU')
      const vendIdx = header.indexOf('Vendor Code')
      const notesIdx = header.indexOf('Notes')
      if (nameIdx < 0 || qtyIdx < 0) { alert('Unrecognised CSV format — needs Item Name and Qty columns'); return }
      const items = []
      let supplier = null
      for (let i = 1; i < lines.length; i++) {
        // simple CSV split (handles quoted fields)
        const row = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g)?.map(s => s.replace(/^"|"$/g,'').trim()) || lines[i].split(',').map(s => s.trim())
        const name = row[nameIdx]
        if (!name || name === 'Subtotal' || name === 'Total Due' || name === 'Vendor' || !name.match(/[a-zA-Z]/)) continue
        const qtyRaw = row[qtyIdx] || '0'
        const qty = parseInt(qtyRaw.replace(/[^0-9]/g,'')) || 0
        if (qty <= 0) continue
        const sku = skuIdx >= 0 ? row[skuIdx] || '' : ''
        const vend = vendIdx >= 0 ? row[vendIdx] || '' : ''
        const notes = notesIdx >= 0 ? row[notesIdx] || '' : ''
        const isSpirit = /nip|30ml|60ml/i.test(name)
        if (!supplier && vend) supplier = vend
        items.push({ name, orderQty: qty, sku, isSpirit })
      }
      if (!items.length) { alert('No items found in CSV'); return }
      // Match supplier to Hub supplier names
      const supplierMatch = supplier
        ? (suppliers.find(s => s.toLowerCase().includes(supplier.toLowerCase()) || supplier.toLowerCase().includes(s.split(' ')[0].toLowerCase())) || supplier)
        : 'Unknown'
      const r = await fetch('/api/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'place', supplier: supplierMatch, items })
      })
      const d = await r.json()
      if (d.ok) {
        setOrderedItems(d.ordered)
        alert(`Imported ${items.length} items for ${supplierMatch} as ON ORDER`)
      } else {
        alert('Import failed')
      }
    }
    reader.readAsText(file)
  }

  function generateOrderRef(supplier) {
    const ABBR = { 'Dan Murphy': 'DAN', 'Coles Woolies': 'COLE', 'ACW': 'ACW' }
    const abbr = ABBR[supplier] || supplier.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase()
    const now = new Date()
    const bne = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: '2-digit', year: '2-digit' }).format(now)
    const [d, m, y] = bne.split('/')
    return `${abbr}-${d}${m}${y}`
  }

  async function markAsOrdered(supplier, ref) {
    const poItems = items.filter(i =>
      i.supplier === supplier &&
      (orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] > 0 : i.orderQty > 0) &&
      !dontOrder(i)
    ).map(i => ({
      name: i.name,
      sku: i.sku || '',
      orderQty: orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] : (i.isSpirit ? i.nipsToOrder : i.orderQty),
      bottlesToOrder: i.bottlesToOrder || null,
      isSpirit: i.isSpirit || false,
    }))
    if (!poItems.length) { alert('No items to order for ' + supplier); return }
    const r = await fetch('/api/purchase-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'place', supplier, ref: ref || '', items: poItems })
    })
    const d = await r.json()
    if (d.ok) {
      setOrderedItems(d.ordered)
      setPrinting(null)
    }
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
    const r = await fetch('/api/wastage')
    if (!r.ok) throw new Error(`Server error ${r.status}`)
    const data = await r.json()
    setWastageLog(data.entries || [])
    setWastageLoaded(true)
  }

  async function loadSellersData() {
    setSellersLoading(true)
    setSellersError(null)
    try {
      const end   = new Date(); end.setHours(23,59,59,999)
      const start = new Date(); start.setDate(start.getDate() - daysBack); start.setHours(0,0,0,0)
      // dummy compare range (required by API but not used here)
      const compareEnd   = new Date(start.getTime() - 1)
      const compareStart = new Date(compareEnd); compareStart.setDate(compareStart.getDate() - daysBack)
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
        body: JSON.stringify({ itemName, field, value, who: readOnly ? 'volunteer' : 'committee' })
      })
      setItems(prev => prev.map(item => {
        if (item.name !== itemName) return item
        const numFields = ['pack','bottleML','nipML','stockOverride','buyPrice','sellPrice','sellPriceBottle','weeklyAvgOverride']
        const updated = { ...item, [field]: numFields.includes(field) ? (value === null ? null : Number(value)) : value }
        if (field === 'weeklyAvgOverride') {
          const avg = (value !== null && value !== '' ? Number(value) : item.squareWeeklyAvg) || 0
          const targetStock = Math.ceil(avg * targetWeeks)
          const onHand = updated.onHand || 0
          if (updated.isSpirit) {
            const nipsPerBottle = (updated.bottleML || 700) / (updated.nipML || 30)
            const nipsNeeded = Math.max(0, targetStock - onHand)
            const bottlesToOrder = nipsNeeded > 0 ? Math.ceil(nipsNeeded / nipsPerBottle) : 0
            const nipsToOrder = bottlesToOrder > 0 ? Math.ceil(bottlesToOrder * nipsPerBottle) : 0
            const weeksLeft = avg > 0 ? onHand / avg : 999
            return { ...updated, targetStock, nipsToOrder, bottlesToOrder, orderQty: nipsToOrder,
              priority: nipsToOrder > 0 ? (weeksLeft <= 2 ? 'CRITICAL' : 'LOW') : 'OK' }
          } else {
            const pack = updated.pack || 1
            const unitsNeeded = Math.max(0, targetStock - onHand)
            const orderQty = unitsNeeded > 0 ? Math.ceil(unitsNeeded / pack) * pack : 0
            const weeksLeft = avg > 0 ? onHand / avg : 999
            return { ...updated, targetStock, orderQty,
              priority: orderQty > 0 ? (weeksLeft <= 2 ? 'CRITICAL' : 'LOW') : 'OK' }
          }
        }
        return updated
      }))
      const auditKey = itemName + '__' + field
      if (value === null || value === '' || value === false) {
        setSettingsAudit(prev => { const n = { ...prev }; delete n[auditKey]; return n })
      } else {
        setSettingsAudit(prev => ({ ...prev, [auditKey]: { ts: new Date().toISOString(), who: readOnly ? 'volunteer' : 'committee' } }))
      }
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
    // Immediately recalculate targetStock and orderQty for all items using new weeks
    // without waiting for a full Square refresh (which takes ~50s due to Orders API)
    setItems(prev => prev.map(item => {
      const isSpirit = item.isSpirit
      const weeklyAvg = (item.weeklyAvgOverride != null ? item.weeklyAvgOverride : item.weeklyAvg) || 0
      const pack = item.pack || 1
      const targetStock = isSpirit
        ? Math.ceil(weeklyAvg * weeks)
        : Math.ceil(weeklyAvg * weeks)
      const unitsNeeded = Math.max(0, targetStock - (item.onHand || 0))
      const nipsPerBottle = item.nipsPerBottle || null
      const nipsToOrder = isSpirit && unitsNeeded > 0 && nipsPerBottle
        ? Math.ceil(Math.ceil(unitsNeeded / nipsPerBottle) * nipsPerBottle)
        : null
      const bottlesToOrder = isSpirit && unitsNeeded > 0 && nipsPerBottle
        ? Math.ceil(unitsNeeded / nipsPerBottle)
        : null
      const orderQty = isSpirit
        ? (nipsToOrder || 0)
        : (unitsNeeded === 0 ? 0 : Math.ceil(unitsNeeded / pack) * pack)
      const weeksLeft = isSpirit
        ? (item.onHand || 0) / (weeklyAvg || 1)
        : (item.onHand || 0) / (weeklyAvg || 1)
      const priority = (isSpirit ? nipsToOrder > 0 : orderQty > 0)
        ? (weeksLeft <= 2 ? 'CRITICAL' : 'LOW')
        : 'OK'
      return { ...item, targetStock, orderQty, nipsToOrder, bottlesToOrder, priority }
    }))
    // Also trigger background refresh to rebuild cache with correct targetWeeks
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
  async function savePriceListSetting(itemName, field, value, useItemSettings = false) {
    if (useItemSettings) {
      return saveSetting(itemName, field, value)
    }
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

  // Load price list settings and audit log on mount
  useEffect(() => {
    async function loadPriceListSettings() {
      try {
        const [plRes, auditRes] = await Promise.all([
          fetch('/api/settings?action=getPriceList'),
          fetch('/api/settings?action=getAudit'),
        ])
        if (plRes.ok)    { const d = await plRes.json();    setPriceListSettings(d.priceList || {}) }
        if (auditRes.ok) { const d = await auditRes.json(); setSettingsAudit(d.audit || {}) }
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
      const label = pl.label || item.name
      const bottleOnly = pl.bottleOnly || item.bottleOnly || /minchinbury|curtis legion/i.test(item.name)
      const rawVars = (item.variations || []).filter(v => {
        if (v.price == null) return false
        // Strip any glass variation for bottle-only items
        // Matches: "Glass", "Wine Glass", "Regular - Wine Glass" etc
        const isGlass = /glass/i.test(v.name)
        if (isGlass && bottleOnly) return false
        return true
      })
      // For bottle-only items: use explicit bottle price, fall back to non-glass variation price
      // Never use item.sellPrice for these as it may be the glass price from Square
      const bottlePrice = item.sellPriceBottle || item.squareSellPriceBottle
                       || rawVars.find(v => /bottle|regular/i.test(v.name))?.price
                       || rawVars[0]?.price
                       || null
      const price = bottleOnly ? bottlePrice
                  : item.sellPrice != null ? item.sellPrice
                  : rawVars.length === 1 ? rawVars[0].price
                  : item.squareSellPrice
      let variations = null
      if (!bottleOnly && rawVars.length > 1) {
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
      const spiritCatsPrint = ['Spirits','Fortified & Liqueurs']
      const wineCatsPrint = ['White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs']
      const serveML = spiritCatsPrint.includes(item.category) ? (item.nipML || 30)
                    : wineCatsPrint.includes(item.category) ? 150
                    : (item.containerML || 375)
      grouped[cat].push({ label, price, variations, alcoholPct: (settings[item.name] || {}).alcoholPct || item.alcoholPct || '', serveML })
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
            ${grouped[cat].map(({ label, price, variations, alcoholPct, serveML }) => {
              const abv = parseFloat(alcoholPct)
              const stdDrinksStr = abv && serveML ? (Math.ceil(abv / 100 * serveML * 0.789 / 10 * 10) / 10).toFixed(1) : ''
              const priceCell = variations
                ? '<table style="border-collapse:collapse;width:100%;line-height:1.3">' + variations.map(v => {
                    const vML = v.name === 'Glass' ? 150 : v.name === 'Bottle' ? 750 : serveML
                    const vSd = abv && vML ? (Math.ceil(abv / 100 * vML * 0.789 / 10 * 10) / 10).toFixed(1) : ''
                    return '<tr><td style="font-size:12px;color:#64748b;padding:3px 8px 3px 0;white-space:nowrap">' + v.name + (vSd ? ' <span style="color:#374151">(' + vSd + ' std)</span>' : '') + '</td><td style="font-size:14px;font-weight:700;font-family:Courier New,monospace;text-align:right;padding:3px 0;white-space:nowrap">$' + Number(v.price).toFixed(2) + '</td></tr>'
                  }).join('') + '</table>'
                : (price != null ? '$' + Number(price).toFixed(2) : '&mdash;')
              return '<tr><td class="nm">' + label + (!variations && alcoholPct ? '<span class="alc">' + alcoholPct + '%</span>' : '') + (!variations && stdDrinksStr ? '<span class="sd">' + stdDrinksStr + ' std</span>' : '') + '</td><td class="pr">' + priceCell + '</td></tr>'
            }).join('')}
          </table>
        </div>`).join('')
    }

    const hdr = `
      <div class="hdr">
        <img src="data:image/png;base64,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aW1yDEKyNO4H1lbZ2NgBFEnxF0L0jIcDZvMdAKQErTXeRbQuaNqGSKAsDU2bHNtobJhtp8VJYQxts7tQMUWBQNG2C5ZsoHe6cdj3Mfj3jR9h/IQAY1Kkwjl3G9Fmv6M3fUi01jgXEFkfO8aYf7ZX7/9dZk0/gh8opEjGPZIMd9gbo5AaoscYg21axuMhs2mNytU7EVBaY11Dt+LXusS6hrIY0LSLdM5cOAgpsV2VFXXjUULho2c4GDBfzIHAqDLMmya34VVEImVRUrcLikKnZkbWdaX0u10EAFPo9Lv3MmrvNN96J/IXhqKQtG1697s6ne7fwN5WKfsSvflbokuv9fgrhXdaid85q+8wsHvDlulX75VufTe8U+godCmV5fE9r/kdrq1Hjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evTo0aNHjx49evT4S4//H+jyqGxkz65mAAAAAElFTkSuQmCC" style="height:55px;flex-shrink:0" alt="Paynter Bar" />
        <div><div class="title">Paynter Bar</div><div class="sub">GemLife Palmwoods &nbsp;&middot;&nbsp; Current Prices &nbsp;&middot;&nbsp; Updated ${generated}</div></div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="text-align:center">
            <div id="qr-hdr" style="display:inline-block;background:#fff;padding:3px;border-radius:4px"></div>
            <div style="font-size:8px;color:#bfdbfe;margin-top:2px">Scan for live prices</div>
          </div>
          <div class="badge">Price List</div>
        </div>
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
  .alc { font-size: 10px; color: #374151; font-weight: 500; margin-left: 6px; font-family: Arial; }
  .sd  { font-size: 10px; color: #374151; font-weight: 500; margin-left: 6px; font-family: Arial; }
  .pr {
    padding: 7px 14px; text-align: right;
    font-size: 16px; font-weight: 700;
    font-family: 'Courier New', monospace;
    white-space: nowrap; width: 82px; vertical-align: top;
  }
  .vr { display: flex; justify-content: space-between; gap: 4px; line-height: 1.6; }
  .vn { font-size: 12px; color: #64748b; font-weight: 400; font-family: Arial; }

  .page-break { page-break-before: always; }

  

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hdr, .cat-hdr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</head><body>

  ${hdr}
  <div class="cols">${renderCards(page1cats)}</div>

  <div class="page-break">
    ${hdr}
    <div class="cols">${renderCards(page2cats)}</div>
  </div>

<script>
  const QR_URL = 'https://paynter-bar-hub.vercel.app/?public=pricelist'
  const opts = { width: 52, height: 52, colorDark: '#1e3a5f', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }
  if (typeof QRCode !== 'undefined') {
    document.querySelectorAll('#qr-hdr').forEach(el => new QRCode(el, { ...opts, text: QR_URL }))
  }
</script>
</body></html>`
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

    const totalValue = items.reduce((sum, i) => sum + (i.buyPrice != null && i.onHand > 0 ? Number(i.buyPrice) * Number(i.onHand) : 0), 0)
    const critItems  = items.filter(i => i.priority === 'CRITICAL')
    const lowItems   = items.filter(i => i.priority === 'LOW')
    const orderItems = items.filter(i => i.orderQty > 0 && !/do\s*n'?t\s+order|do\s+not\s+order/i.test(i.notes || ''))

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
          <td style="text-align:right;font-family:monospace;color:#64748b">${item.buyPrice ? "$" + Number(item.buyPrice).toFixed(2) : "—"}</td>
          <td style="text-align:right;font-family:monospace;font-weight:600">${item.buyPrice && item.onHand > 0 ? "$" + (Number(item.buyPrice) * Number(item.onHand)).toFixed(2) : "—"}</td>
        </tr>`
      }).join('')
      categorySections += `
        <tr class="cat-header"><td colspan="9">${cat} <span style="font-weight:400;font-size:11px">(${catItems.length} items)</span></td></tr>
        ${rows}
        <tr class="spacer"><td colspan="9"></td></tr>`
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
    <div class="summary-card" style="border-top:3px solid #16a34a"><div class="num" style="color:#16a34a;font-size:16px">$${totalValue.toFixed(2)}</div><div class="lbl">Total Inv. Value</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th>On Hand</th><th>Wkly Avg</th><th>Target</th><th style="text-align:center">Status</th><th>Order Qty</th><th>Supplier</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Total Value</th>
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
        [cell('Stock on Hand Report — Paynter Bar', sTitle), empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell('Period:', sMeta), cell(monthName, sMetaB), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell('Generated:', sMeta), cell(generated, sMeta), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell(`Sales avg: ${daysBack} days  |  Target: ${targetWeeks} weeks stock`, sMeta), empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [],
        [cell('SUMMARY', sSummHdr), empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [
          cell(`${items.length}  Total Items`, { font: { bold: true, sz: 11, color: { rgb: NAVY } }, alignment: { horizontal: 'center' } }),
          cell(`${critItems.length}  Critical`, { font: { bold: true, sz: 11, color: { rgb: RED } }, alignment: { horizontal: 'center' } }),
          cell(`${lowItems.length}  Low Stock`, { font: { bold: true, sz: 11, color: { rgb: AMBER } }, alignment: { horizontal: 'center' } }),
          cell(`${orderItems.length}  To Order`, { font: { bold: true, sz: 11, color: { rgb: BLUE } }, alignment: { horizontal: 'center' } }),
          cell(`$${totalValue.toFixed(2)}  Total Value`, { font: { bold: true, sz: 11, color: { rgb: '16A34A' } }, alignment: { horizontal: 'center' } }),
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
        cell('Supplier', sColHdr), cell('Unit Cost', { ...sColHdr, alignment: { horizontal: 'right' } }), cell('Total Value', { ...sColHdr, alignment: { horizontal: 'right' } })
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
            cell(item.buyPrice ? Number(item.buyPrice) : '', { ...ns, numFmt: '#,##0.00' }),
            cell(item.buyPrice && item.onHand > 0 ? Math.round(Number(item.buyPrice) * Number(item.onHand) * 100) / 100 : '', { ...ns, numFmt: '#,##0.00' }),
          ])
        })
        dataRows.push([]) // spacer
      }

      const allRows = [...summaryRows, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      ws['!cols'] = [{ wch: 44 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 16 }]
      ws['!rows'] = allRows.map((_, i) => i === 0 ? { hpt: 32 } : { hpt: 20 })
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock on Hand')
      const wbBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      // Inject freeze pane via JSZip since xlsx-js-style doesn't support !views
      const jszipScript = document.createElement('script')
      jszipScript.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
      document.head.appendChild(jszipScript)
      await new Promise(r => { jszipScript.onload = r })
      const zip = await window.JSZip.loadAsync(wbBuf)
      const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string')
      const freezeXml = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A10" sqref="A10"/></sheetView></sheetViews>'
      const patchedXml = sheetXml.replace('<sheetViews><sheetView workbookViewId="0"/></sheetViews>', freezeXml)
      zip.file('xl/worksheets/sheet1.xml', patchedXml)
      const outBuf = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const url = URL.createObjectURL(outBuf)
      const a = document.createElement('a'); a.href = url; a.download = `PaynterBar_SOH_${monthName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`; a.click()
      URL.revokeObjectURL(url)
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
    } else if (salesPeriod === 'day') {
      if (!salesCustom?.day) { setSalesPdfLoading(false); alert('Please select a date first'); return }
      start = new Date(salesCustom.day + 'T00:00:00'); start.setHours(0,0,0,0)
      end   = new Date(salesCustom.day + 'T23:59:59'); end.setHours(23,59,59,999)
      periodLabel = new Date(salesCustom.day + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      compareEnd   = new Date(start.getTime() - 1)
      compareStart = new Date(compareEnd); compareStart.setHours(0,0,0,0)
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
    const prevLabel = salesPeriod === 'financialYear' ? 'Prior FY' : salesPeriod === '3months' ? 'Prior 3 Mo' : salesPeriod === 'day' ? 'Prior Day' : 'Prior Period'

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
        [cell('Stock on Hand Report — Paynter Bar', sTitle), empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell('Period:', sMeta), cell(monthName, sMetaB), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell('Generated:', sMeta), cell(generated, sMeta), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [cell(`Sales avg: ${daysBack} days  |  Target: ${targetWeeks} weeks stock`, sMeta), empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [],
        [cell('SUMMARY', sSummHdr), empty(), empty(), empty(), empty(), empty(), empty(), empty(), empty()],
        [
          cell(`${items.length}  Total Items`, { font: { bold: true, sz: 11, color: { rgb: NAVY } }, alignment: { horizontal: 'center' } }),
          cell(`${critItems.length}  Critical`, { font: { bold: true, sz: 11, color: { rgb: RED } }, alignment: { horizontal: 'center' } }),
          cell(`${lowItems.length}  Low Stock`, { font: { bold: true, sz: 11, color: { rgb: AMBER } }, alignment: { horizontal: 'center' } }),
          cell(`${orderItems.length}  To Order`, { font: { bold: true, sz: 11, color: { rgb: BLUE } }, alignment: { horizontal: 'center' } }),
          cell(`$${totalValue.toFixed(2)}  Total Value`, { font: { bold: true, sz: 11, color: { rgb: '16A34A' } }, alignment: { horizontal: 'center' } }),
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
      ws['!cols'] = [{ wch: 44 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 22 }]
      ws['!rows'] = allRows.map((_, i) => i === 0 ? { hpt: 32 } : { hpt: 20 })
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stock on Hand')
      const wbBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      // Inject freeze pane via JSZip since xlsx-js-style doesn't support !views
      const jszipScript = document.createElement('script')
      jszipScript.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
      document.head.appendChild(jszipScript)
      await new Promise(r => { jszipScript.onload = r })
      const zip = await window.JSZip.loadAsync(wbBuf)
      const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string')
      const freezeXml = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A10" sqref="A10"/></sheetView></sheetViews>'
      const patchedXml = sheetXml.replace('<sheetViews><sheetView workbookViewId="0"/></sheetViews>', freezeXml)
      zip.file('xl/worksheets/sheet1.xml', patchedXml)
      const outBuf = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      const url = URL.createObjectURL(outBuf)
      const a = document.createElement('a'); a.href = url; a.download = `PaynterBar_SOH_${monthName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`; a.click()
      URL.revokeObjectURL(url)
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
    const orderItems = items.filter(i => i.supplier === supplier && (orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] > 0 : i.orderQty > 0) && !orderedItems[i.name] && !dontOrder(i))
    const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const rows = orderItems.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td style="text-align:right">${item.onHand}</td>
        <td style="text-align:right;font-weight:700">${(() => { const ov = orderQtyOverrides[item.name]; return item.isSpirit ? (ov !== undefined ? ov : (item.nipsToOrder || '-')) : (ov !== undefined ? ov : (item.orderQty || '-')) })()}</td>
        <td style="text-align:right">${item.isSpirit ? (orderQtyOverrides[item.name] !== undefined ? Math.ceil(orderQtyOverrides[item.name] / ((item.bottleML || 700) / (item.nipML || 30))) : (item.bottlesToOrder || '-')) : '-'}</td>
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

  function printDeliverySheet(supplier, supplierItems, ref) {
    const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const rows = supplierItems.map(item => {
      const override = orderQtyOverrides[item.name]
      const qty = override !== undefined ? override : (item.orderQty || 0)
      const qtyLabel = item.isSpirit
        ? `${qty} nips / ${Math.ceil(qty / ((item.bottleML || 700) / (item.nipML || 30)))} btl`
        : `${qty} units`
      return `<tr>
        <td style="text-align:center"><input type="checkbox" style="width:16px;height:16px"></td>
        <td>${item.name}</td>
        <td style="text-align:right;font-weight:700">${qtyLabel}</td>
        <td style="width:120px">&nbsp;</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>Delivery Checklist - ${supplier} - ${date}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;margin:20px}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}.ref{display:inline-block;background:#dcfce7;color:#166534;font-weight:700;font-family:monospace;padding:2px 10px;border-radius:4px;font-size:13px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1f2937;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:8px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:24px;font-size:11px;color:#9ca3af}@media print{body{margin:10px}input[type=checkbox]{-webkit-print-color-adjust:exact}}</style>
</head><body>
<h1>Delivery Checklist — ${supplier}</h1>
${ref ? `<div class="ref">${ref}</div>` : ''}
<div class="sub">Paynter Bar, GemLife Palmwoods | ${date} | ${supplierItems.length} item(s) on order</div>
<table><thead><tr><th style="width:36px">✓</th><th>Item</th><th style="text-align:right">Qty Ordered</th><th>Qty Received</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">Generated ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })} | Paynter Bar Reorder System</div>
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  async function exportPricingExcel() {
    if (!window.XLSX) {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
      document.head.appendChild(s)
      await new Promise(r => { s.onload = r })
    }
    const XLSX = window.XLSX
    const NAVY='1E3A5F', WHITE='FFFFFF', LGREY='F8FAFC'
    const RED='FEE2E2', ORANGE='FEF3C7', GREEN='F0FDF4'
    const DRED='991B1B', DORANGE='92400E', DGREEN='166534'
    const WINE_C = ['White Wine','Red Wine','Rose','Sparkling']

    const hdr = (v) => ({ v, s: { font:{bold:true,color:{rgb:WHITE}}, fill:{fgColor:{rgb:NAVY}}, alignment:{horizontal:'center',wrapText:true} } })
    const hdrR = (v) => ({ v, s: { font:{bold:true,color:{rgb:WHITE}}, fill:{fgColor:{rgb:NAVY}}, alignment:{horizontal:'right',wrapText:true} } })
    const cell = (v, bg, color, right, bold) => ({ v: v ?? '', s: { fill:{fgColor:{rgb:bg||LGREY}}, font:{color:{rgb:color||'0F172A'},bold:!!bold}, alignment:{horizontal:right?'right':'left'} } })

    const allItems = [...items].sort((a,b) => {
      const catA = CATEGORY_ORDER_LIST.indexOf(a.category), catB = CATEGORY_ORDER_LIST.indexOf(b.category)
      return catA !== catB ? catA - catB : a.name.localeCompare(b.name)
    })

    const rows = [
      [hdr('Item'), hdr('Category'), hdr('Supplier'), hdr('Unit'), hdrR('Buy'), hdrR('Sell'), hdrR('Sell/Bottle'), hdrR('Margin %'), hdrR('Btl Margin %'), hdrR('On Hand')]
    ]

    for (const item of allItems) {
      const isWine = WINE_C.includes(item.category)
      const forceBottle = item.category === 'Sparkling' || item.bottleOnly
      const sellUnit = item.isSpirit ? 'nip' : forceBottle ? 'bottle' : isWine ? (item.sellUnit || 'glass') : 'each'
      const servesPB = isWine && sellUnit === 'glass' ? 5 : 1

      // Replicate pricing viewMode sell price logic
      const vars = item.variations || []
      const glassVar = vars.find(v => v.name?.toLowerCase().includes('glass'))
      const bottleVar = vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
      const nipVar = vars.find(v => v.name?.toLowerCase().includes('nip') || v.name?.toLowerCase().includes('30ml'))
      const sellGlass = item.isSpirit
        ? (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (item.sellPrice != null ? Number(item.sellPrice) : null)
        : glassVar?.price != null ? Number(glassVar.price) : (item.sellPrice != null ? Number(item.sellPrice) : null)
      const sellBottle = bottleVar?.price != null ? Number(bottleVar.price) : (item.squareSellPrice != null ? Number(item.squareSellPrice) : null)
      const sell = isWine && sellUnit === 'bottle' ? sellBottle : sellGlass
      const buy = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice) : null

      // Margin calculation matching pricing viewMode
      let marginPct = null, btlMarginPct = null
      if (buy != null && sell != null && sell > 0) {
        if (item.isSpirit) {
          marginPct = (sell - buy) / sell * 100
        } else if (isWine && sellUnit === 'glass' && servesPB) {
          const rev = sell * servesPB
          marginPct = rev > 0 ? (rev - buy) / rev * 100 : null
        } else {
          marginPct = (sell - buy) / sell * 100
        }
      }
      if (isWine && sellBottle != null && buy != null && sellBottle > 0) {
        btlMarginPct = (sellBottle - buy) / sellBottle * 100
      }

      const mbg = (p) => p == null ? LGREY : p < 20 ? RED : p < 35 ? ORANGE : GREEN
      const mtc = (p) => p == null ? '475569' : p < 20 ? DRED : p < 35 ? DORANGE : DGREEN
      const mp = marginPct, bp = btlMarginPct

      rows.push([
        cell(item.name, LGREY, '0F172A', false, true),
        cell(item.category, LGREY, '64748B'),
        cell(item.supplier || '', LGREY, '64748B'),
        cell(sellUnit, LGREY, '475569'),
        { v: buy ?? '', s: { fill:{fgColor:{rgb:LGREY}}, alignment:{horizontal:'right'}, numFmt: buy!=null?'"$"#,##0.00':'@' } },
        { v: sell ?? '', s: { fill:{fgColor:{rgb:LGREY}}, alignment:{horizontal:'right'}, numFmt: sell!=null?'"$"#,##0.00':'@' } },
        { v: (isWine && sellBottle!=null) ? sellBottle : '', s: { fill:{fgColor:{rgb:LGREY}}, alignment:{horizontal:'right'}, numFmt:'"$"#,##0.00' } },
        { v: mp!=null ? Math.round(mp*10)/10 : '', t: mp!=null?'n':'s', s: { fill:{fgColor:{rgb:mbg(mp)}}, font:{color:{rgb:mtc(mp)},bold:true}, alignment:{horizontal:'right'} } },
        { v: bp!=null ? Math.round(bp*10)/10 : '', t: bp!=null?'n':'s', s: { fill:{fgColor:{rgb:mbg(bp)}}, font:{color:{rgb:mtc(bp)},bold:true}, alignment:{horizontal:'right'} } },
        { v: item.onHand ?? 0, s: { fill:{fgColor:{rgb:LGREY}}, alignment:{horizontal:'right'} } },
      ])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{wch:38},{wch:16},{wch:14},{wch:10},{wch:11},{wch:12},{wch:13},{wch:14},{wch:14},{wch:11}]
    ws['!autofilter'] = { ref: 'A1:J1' }
    ws['!sheetViews'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }]
    ws['!rows'] = [{ hpt: 36 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pricing Analysis')
    const date = new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'}).replace(/\//g,'-')
    XLSX.writeFile(wb, `PricingAnalysis-${date}.xlsx`)
  }

  function printPricingSheet() {
    const WINE_C = ['White Wine','Red Wine','Rose','Sparkling']
    const allItems = [...items].sort((a,b) => {
      const catA = CATEGORY_ORDER_LIST.indexOf(a.category), catB = CATEGORY_ORDER_LIST.indexOf(b.category)
      return catA !== catB ? catA - catB : a.name.localeCompare(b.name)
    })
    const rows = allItems.map(item => {
      const isWine = WINE_C.includes(item.category)
      const forceBottle = item.category === 'Sparkling' || item.bottleOnly
      const sellUnit = item.isSpirit ? 'nip' : forceBottle ? 'bottle' : isWine ? (item.sellUnit || 'glass') : 'each'
      const servesPB = isWine && sellUnit === 'glass' ? 5 : 1
      const vars = item.variations || []
      const glassVar = vars.find(v => v.name?.toLowerCase().includes('glass'))
      const bottleVar = vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
      const nipVar = vars.find(v => v.name?.toLowerCase().includes('nip') || v.name?.toLowerCase().includes('30ml'))
      const sellGlass = item.isSpirit
        ? (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (item.sellPrice != null ? Number(item.sellPrice) : null)
        : glassVar?.price != null ? Number(glassVar.price) : (item.sellPrice != null ? Number(item.sellPrice) : null)
      const sellBottle = bottleVar?.price != null ? Number(bottleVar.price) : (item.squareSellPrice != null ? Number(item.squareSellPrice) : null)
      const sell = isWine && sellUnit === 'bottle' ? sellBottle : sellGlass
      const buy = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice) : null
      let marginPct = null, btlMarginPct = null
      if (buy != null && sell != null && sell > 0) {
        if (item.isSpirit) marginPct = (sell-buy)/sell*100
        else if (isWine && sellUnit==='glass') { const rev=sell*servesPB; marginPct=rev>0?(rev-buy)/rev*100:null }
        else marginPct = (sell-buy)/sell*100
      }
      if (isWine && sellBottle!=null && buy!=null && sellBottle>0) btlMarginPct=(sellBottle-buy)/sellBottle*100
      const fmt = (n) => n!=null ? '$'+Number(n).toFixed(2) : '—'
      const fmtPct = (p) => p!=null ? p.toFixed(1)+'%' : '—'
      const mColor = (p) => p==null?'#94a3b8':p<20?'#991b1b':p<35?'#d97706':'#16a34a'
      return `<tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td style='text-align:center;font-size:10px'>${sellUnit}</td>
        <td style='text-align:right;font-family:monospace'>${fmt(buy)}</td>
        <td style='text-align:right;font-family:monospace'>${fmt(sell)}</td>
        <td style='text-align:right;font-family:monospace'>${isWine ? fmt(sellBottle) : ''}</td>
        <td style='text-align:right;font-weight:700;color:${mColor(marginPct)}'>${fmtPct(marginPct)}</td>
        <td style='text-align:right;font-weight:700;color:${mColor(btlMarginPct)}'>${isWine ? fmtPct(btlMarginPct) : ''}</td>
        <td style='text-align:right;color:#64748b'>${item.onHand??0}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>Pricing Analysis - Paynter Bar</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;margin:15px}h2{color:#1e3a5f;margin-bottom:4px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:16px;font-size:9px;color:#94a3b8}@media print{body{margin:8px}}</style>
</head><body>
<h2>Pricing Analysis \u2014 Paynter Bar</h2>
<p style='color:#64748b;font-size:10px;margin-bottom:10px'>${new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'})} \u00b7 ${allItems.length} items \u00b7 Margin shown on primary sell unit</p>
<table><thead><tr><th>Item</th><th>Category</th><th>Unit</th><th style='text-align:right'>Buy</th><th style='text-align:right'>Sell</th><th style='text-align:right'>Btl Sell</th><th style='text-align:right'>Margin</th><th style='text-align:right'>Btl Margin</th><th style='text-align:right'>Stock</th></tr></thead><tbody>${rows}</tbody></table>
<div class='footer'>Paynter Bar Hub \u00b7 GemLife Palmwoods \u00b7 All items including zero stock</div></body></html>`
    const w = window.open('','_blank')
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
      ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

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

  const dontOrder = item => /do\s*n'?t\s+order|do\s+not\s+order|do\s+not\s+restock|do\s*n'?t\s+restock/i.test(item.notes || '')

  const displayed = items
    .filter(item => view === 'all' || item.supplier === view)
    .filter(item => !filterOrder || (item.orderQty > 0 && !dontOrder(item)) || !!orderedItems[item.name])


  const onOrderCount = Object.keys(orderedItems).length
  const orderCount   = items.filter(i => i.orderQty > 0 && !orderedItems[i.name] && !dontOrder(i)).length
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
            { label: 'Stock', icon: '📦', items: [
              { icon: '🏠', label: 'Dashboard', tab: 'home', action: () => setMainTab('home') },
              { icon: '📦', label: 'Reorder Planner', tab: 'reorder', action: () => setMainTab('reorder') },
              { icon: '📋', label: 'Stocktake', tab: 'stocktake', action: () => setMainTab(t => t==='stocktake'?'reorder':'stocktake') },
            ]},
            { label: 'Sales & Analytics', icon: '📊', items: [
              { icon: '📊', label: 'Sales Report', tab: 'sales', action: () => { const n=mainTab==='sales'?'reorder':'sales'; setMainTab(n); if(n==='sales'&&!salesReport) loadSalesReport(salesPeriod,salesCustom) } },
              { icon: '📈', label: 'Quarterly Trends', tab: 'trends', action: () => { const n=mainTab==='trends'?'reorder':'trends'; setMainTab(n); if(n==='trends'&&!trendData) loadTrendData() } },
              { icon: '🏆', label: 'Best & Worst Sellers', tab: 'bestsellers', action: () => { const n=mainTab==='bestsellers'?'reorder':'bestsellers'; setMainTab(n); if(n==='bestsellers') loadSellersData() } },
            ]},
            { label: 'Operations', icon: '🗑️', items: [
              { icon: '🗑️', label: 'Wastage Log', tab: 'wastage', action: () => { const n=mainTab==='wastage'?'reorder':'wastage'; setMainTab(n); if(n==='wastage') loadWastageLog() } },
              ...(!readOnly ? [{ icon: '📝', label: 'Notes', tab: 'notes', action: () => { const n=mainTab==='notes'?'reorder':'notes'; setMainTab(n); if(n==='notes'&&!notesLoaded) loadNotes() } }] : []),
              { icon: '⭐', label: 'Specials', tab: 'specials', action: () => setMainTab(t => t==='specials'?'reorder':'specials') },
                 { icon: '🏷️', label: 'Price List', tab: 'pricelist', action: () => setMainTab(t => t==='pricelist'?'reorder':'pricelist') },
              { icon: '🖨️', label: 'Barcode Sheet', tab: 'barcodesheet', action: () => setMainTab(t => t==='barcodesheet'?'reorder':'barcodesheet') },
              { icon: '👥', label: 'Roster', tab: 'roster', action: () => window.open('/roster','_blank') },
            ]},
            { label: 'Reports', icon: '📋', items: [
              { icon: '📋', label: 'SOH Report', tab: 'soh', action: () => setSohModal(true) },
                 { icon: '🗓️', label: 'SOH History', tab: 'sohhistory', action: () => setMainTab(t => t==='sohhistory'?'reorder':'sohhistory') },
            ]},
            { label: 'Help', icon: '❓', items: [
              { icon: '❓', label: 'Help', tab: 'help', action: () => setMainTab(t => t==='help'?'reorder':'help') },
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
                    <button onClick={() => !SC && group.items.length > 1 && setSidebarOpenGroups(g => ({ ...g, [group.label]: !g[group.label] }))}
                      style={{ width: '100%', display: group.items.length === 1 && !SC ? 'none' : 'flex', alignItems: 'center', gap: 8, padding: SC ? '7px 0' : '6px 12px', background: 'none', border: 'none', cursor: 'pointer', justifyContent: SC ? 'center' : 'space-between', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{group.icon}</span>
                        {!SC && <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', whiteSpace: 'nowrap' }}>{group.label}</span>}
                      </div>
                      {!SC && <span style={{ fontSize: 9, color: '#475569', transition: 'transform 0.15s', transform: sidebarOpenGroups[group.label] ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>}
                    </button>
                    {(SC || sidebarOpenGroups[group.label] || group.items.length === 1) && group.items.map(item => {
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
        <header style={{ background: '#0f172a', color: '#fff', flexShrink: 0, display: publicMode ? 'none' : undefined }}>
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
                  {mainTab === 'sales' ? '📊 Sales Report' : mainTab === 'trends' ? '📈 Quarterly Trends' : mainTab === 'help' ? '❓ Help & Guide' : mainTab === 'pricelist' ? '🏷️ Price List' : mainTab === 'bestsellers' ? '🏆 Best & Worst Sellers' : mainTab === 'home' ? '🏠 Dashboard' : mainTab === 'stocktake' ? '📋 Stocktake' : mainTab === 'wastage' ? '🗑️ Wastage Log' : mainTab === 'notes' ? '📝 Notes' : mainTab === 'specials' ? '⭐ Specials Display' :'📦 Reorder Planner'}
                </h1>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {lastUpdated && <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace" }}>Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
              {mainTab !== 'home' && (
                <button style={{ ...styles.btn, padding: '7px 16px', fontSize: 12, background: '#1e3a5f' }} onClick={() => setMainTab('home')}>🏠 Dashboard</button>
              )}
              <button style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}), padding: '7px 16px', fontSize: 12 }} onClick={() => { loadItems(true); fetch('/api/fy-chart?refresh=true').catch(()=>{}) }} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh from Square'}</button>
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
              { label: '🗑️ Wastage Log',         action: () => { const n=mainTab==='wastage'?'reorder':'wastage'; setMainTab(n); if(n==='wastage') loadWastageLog() }, active: mainTab === 'wastage' },
              ...(!readOnly ? [{ label: '📝 Notes', action: () => { const n=mainTab==='notes'?'reorder':'notes'; setMainTab(n); if(n==='notes'&&!notesLoaded) loadNotes() }, active: mainTab === 'notes' }] : []),
              { label: '⭐ Specials',              action: () => setMainTab(t => t==='specials'?'reorder':'specials'), active: mainTab === 'specials' },
                { label: '🏷️ Price List',          action: () => setMainTab(t => t==='pricelist'?'reorder':'pricelist'), active: mainTab === 'pricelist' },
              { label: '🖨️ Barcode Sheet',       action: () => setMainTab(t => t==='barcodesheet'?'reorder':'barcodesheet'), active: mainTab === 'barcodesheet' },
              { label: '👥 Roster',              action: () => window.open('/roster','_blank'), active: false },
              { label: '📋 SOH Report',          action: () => setSohModal(true), active: false },
                { label: '🗓️ SOH History',         action: () => setMainTab(t => t==='sohhistory'?'reorder':'sohhistory'), active: mainTab === 'sohhistory' },
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

        {/* Receive Stock Modal — with per-item quantity inputs */}
        {receiveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>📦 Receive from {receiveModal.supplier}</div>
                <button onClick={() => setReceiveModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                Enter quantities received. Untick items not in this delivery — they stay on order.
              </p>

              {/* Column headings */}
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 90px 90px 72px', gap: '0 10px', padding: '6px 10px', background: '#f1f5f9', borderRadius: '6px 6px 0 0', borderBottom: '1px solid #e2e8f0', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span/>
                <span>Item</span>
                <span style={{ textAlign: 'right' }}>Ordered</span>
                <span style={{ textAlign: 'right' }}>Received</span>
                <span style={{ textAlign: 'center' }}>Status</span>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden', marginBottom: 14 }}>
                {/* Select all row */}
                <div style={{ padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox"
                    checked={receiveModal.items.every(i => receiveChecked[i.name])}
                    onChange={e => {
                      const next = {}
                      receiveModal.items.forEach(i => next[i.name] = e.target.checked)
                      setReceiveChecked(next)
                    }}
                    style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Select All</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                    {Object.values(receiveChecked).filter(Boolean).length} of {receiveModal.items.length} selected
                  </span>
                </div>

                {receiveModal.items.map(i => {
                  const override = orderQtyOverrides[i.name]
                  const orderedQty = override !== undefined ? override : (i.orderQty || 0)
                  const receivedQty = receiveQtys[i.name] !== undefined ? receiveQtys[i.name] : orderedQty
                  const isChecked = !!receiveChecked[i.name]
                  const isPartial = isChecked && receivedQty < orderedQty
                  const isOver    = isChecked && receivedQty > orderedQty
                  const statusLabel = !isChecked ? { text: 'Skip', color: '#94a3b8', bg: '#f8fafc' }
                    : isOver    ? { text: 'Over',    color: '#d97706', bg: '#fffbeb' }
                    : isPartial ? { text: 'Partial', color: '#ca8a04', bg: '#fffbeb' }
                    :             { text: 'Full',    color: '#16a34a', bg: '#f0fdf4' }
                  return (
                    <div key={i.name} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 90px 90px 72px', gap: '0 10px', alignItems: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9', background: isChecked ? '#fff' : '#fafafa', opacity: isChecked ? 1 : 0.6 }}>
                      <input type="checkbox" checked={isChecked}
                        onChange={() => setReceiveChecked(prev => ({ ...prev, [i.name]: !prev[i.name] }))}
                        style={{ width: 15, height: 15, cursor: 'pointer' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>{i.name}</div>
                        {i.isSpirit && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                          {Math.ceil(receivedQty / ((i.bottleML || 700) / (i.nipML || 30)))} btl
                        </div>}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, fontFamily: 'IBM Plex Mono, monospace', color: '#64748b' }}>
                        {orderedQty}<span style={{ fontSize: 10, marginLeft: 3 }}>{i.isSpirit ? 'nips' : 'units'}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <input
                          type="number" min="0" step="1"
                          value={receiveQtys[i.name] !== undefined ? receiveQtys[i.name] : orderedQty}
                          disabled={!isChecked}
                          onChange={e => setReceiveQtys(prev => ({ ...prev, [i.name]: Number(e.target.value) || 0 }))}
                          style={{ width: '100%', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 13,
                            border: isOver ? '1.5px solid #d97706' : isPartial ? '1.5px solid #ca8a04' : '1px solid #e2e8f0',
                            borderRadius: 5, padding: '3px 6px',
                            background: !isChecked ? '#f8fafc' : isOver ? '#fffbeb' : isPartial ? '#fffbeb' : '#f0fdf4',
                            color: !isChecked ? '#94a3b8' : '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: statusLabel.bg, color: statusLabel.color }}>
                          {statusLabel.text}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>Square inventory will update automatically on confirm.</span>
                <button onClick={() => setReceiveModal(null)}
                  style={{ padding: '8px 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={confirmReceive}
                  disabled={!Object.values(receiveChecked).some(v => v) || poReceiving}
                  style={{ padding: '8px 20px', background: Object.values(receiveChecked).some(v => v) ? '#16a34a' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {poReceiving ? '⏳ Updating…' : `✓ Confirm Receive`}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* RECEIPT MODAL — shown after confirming stock received */}
        {receiptData && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', maxHeight:'90vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#0f172a' }}>✅ Stock Received — {receiptData.supplier}</div>
                <button onClick={() => setReceiptData(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>✕</button>
              </div>

              {/* Items list */}
              <div style={{ background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0', padding:'12px 14px', marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:8, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{receiptData.date} — {receiptData.items.length} item{receiptData.items.length !== 1 ? 's' : ''}</div>
                {receiptData.items.map(i => (
                  <div key={i.name} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #e2e8f0', fontSize:13 }}>
                    <span style={{ fontWeight:600 }}>{i.name}{i.sku ? <span style={{ fontSize:11, color:'#94a3b8', marginLeft:6 }}>SKU: {i.sku}</span> : null}</span>
                    <span style={{ fontFamily:'monospace', fontSize:12, color:'#475569' }}>{i.qty}</span>
                  </div>
                ))}
              </div>

              {/* Square inventory status */}
              {receiptData.sqResult && (
                <div style={{ marginBottom:10, padding:'10px 14px', borderRadius:7,
                  background: receiptData.sqResult.error ? '#fff5f5' : !receiptData.sqResult.success ? '#fffbeb' : '#f0fdf4',
                  border: `1px solid ${receiptData.sqResult.error ? '#fca5a5' : !receiptData.sqResult.success ? '#fde68a' : '#86efac'}` }}>
                  <div style={{ fontSize:11, fontWeight:700, marginBottom:2, color: receiptData.sqResult.error ? '#dc2626' : !receiptData.sqResult.success ? '#ca8a04' : '#16a34a', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    {receiptData.sqResult.error ? '⚠ Square Update Failed' : !receiptData.sqResult.success ? '⚠ Square Not Updated' : '✓ Square Inventory Updated'}
                  </div>
                  <div style={{ fontSize:12, color:'#374151' }}>
                    {receiptData.sqResult.error
                      ? receiptData.sqResult.error
                      : !receiptData.sqResult.success
                      ? (receiptData.sqResult.reason || 'Variation IDs not found — update manually in Square Dashboard')
                      : `${receiptData.sqResult.changes} stock adjustment${receiptData.sqResult.changes !== 1 ? 's' : ''} applied`}
                  </div>
                </div>
              )}

              {/* OneDrive auto-save status */}
              {receiptData.oneDriveResult && (
                <div style={{ marginBottom:14, padding:'10px 14px', borderRadius:7,
                  background: receiptData.oneDriveResult.error ? '#fff5f5' : receiptData.oneDriveResult.skipped ? '#eff6ff' : '#f0fdf4',
                  border: `1px solid ${receiptData.oneDriveResult.error ? '#fca5a5' : receiptData.oneDriveResult.skipped ? '#bfdbfe' : '#86efac'}` }}>
                  <div style={{ fontSize:11, fontWeight:700, marginBottom:2, color: receiptData.oneDriveResult.error ? '#dc2626' : receiptData.oneDriveResult.skipped ? '#1e40af' : '#16a34a', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    {receiptData.oneDriveResult.error ? '⚠ OneDrive Save Failed' : receiptData.oneDriveResult.skipped ? 'ℹ OneDrive Not Configured' : '✓ Report Saved to OneDrive'}
                  </div>
                  <div style={{ fontSize:12, color:'#374151' }}>
                    {receiptData.oneDriveResult.skipped
                      ? (receiptData.oneDriveResult.reason || 'Set ONEDRIVE env vars to enable auto-save — see RECEIVE_FEATURE_SETUP.md')
                      : receiptData.oneDriveResult.error
                      ? receiptData.oneDriveResult.error
                      : receiptData.oneDriveResult.filename}
                  </div>
                  {receiptData.oneDriveResult.webUrl && (
                    <a href={receiptData.oneDriveResult.webUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:'#16a34a', display:'block', marginTop:4 }}>Open in OneDrive ↗</a>
                  )}
                </div>
              )}

              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setReceiptData(null)}
                  style={{ flex:1, padding:'9px 0', background:'#f1f5f9', color:'#475569', border:'none', borderRadius:6, fontSize:13, cursor:'pointer' }}>
                  Close
                </button>
                <button onClick={async () => {
                    try {
                      const sup = receiptData.supplier
                      const d = receiptData.date
                      const slug = sup.replace(/\s+/g,'').replace(/[^a-zA-Z0-9]/g,'')
                      const dateslug = d.replace(/\//g,'-')
                      const fname = 'RECV-' + slug + '-' + dateslug + '.xlsx'

                      // Load SheetJS with styles (same CDN used by SOH report)
                      if (!window.XLSX) {
                        const script = document.createElement('script')
                        script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
                        document.head.appendChild(script)
                        await new Promise(r => { script.onload = r })
                      }
                      const XLSX = window.XLSX
                      const NAVY = '1E3A5F'; const WHITE = 'FFFFFF'; const LGREY = 'F1F5F9'; const GREEN = '16A34A'

                      const hdr  = (v, right) => ({ v, s: { font: { bold: true, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: right ? 'right' : 'left' } } })
                      const meta = (v) => ({ v, s: { font: { sz: 10, color: { rgb: '64748B' } } } })
                      const txt  = (v, i) => ({ v: v || '', s: { fill: { fgColor: { rgb: i % 2 === 0 ? LGREY : WHITE } } } })
                      const qty  = (v, i) => ({ v: v || '', s: { fill: { fgColor: { rgb: i % 2 === 0 ? LGREY : WHITE } }, alignment: { horizontal: 'right' }, font: { bold: true } } })
                      const foot = (v) => ({ v, s: { font: { sz: 9, italic: true, color: { rgb: '94A3B8' } } } })

                      const rows = [
                        [{ v: 'Paynter Bar — Goods Received', s: { font: { bold: true, sz: 14, color: { rgb: NAVY } } } }, {v:'',s:{}}, {v:'',s:{}}],
                        [meta('Supplier'), meta(sup), {v:'',s:{}}],
                        [meta('Date'), meta(d), {v:'',s:{}}],
                        [meta('Items received'), meta(String(receiptData.items.length)), {v:'',s:{}}],
                        [{v:'',s:{}},{v:'',s:{}},{v:'',s:{}}],
                        [hdr('Item'), hdr('SKU'), hdr('Qty Received', true)],
                        ...receiptData.items.map((item, i) => [txt(item.name, i), txt(item.sku || '', i), qty(item.qty, i)]),
                        [{v:'',s:{}},{v:'',s:{}},{v:'',s:{}}],
                        [foot('Paynter Bar — GemLife Palmwoods'), foot(''), foot('Generated by Paynter Bar Hub')],
                      ]

                      const ws = XLSX.utils.aoa_to_sheet(rows)
                      ws['!cols'] = [{ wch: 42 }, { wch: 14 }, { wch: 18 }]
                      const wb = XLSX.utils.book_new()
                      XLSX.utils.book_append_sheet(wb, ws, 'Goods Received')
                      XLSX.writeFile(wb, fname)
                      setReceiptSaved(true)
                    } catch(e) { alert('Download failed: ' + e.message) }
                  }}
                  style={{ flex:2, padding:'9px 0', background: receiptSaved ? '#16a34a' : '#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  {receiptSaved ? '✓ Downloaded' : '📊 Download Receipt (Excel)'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Order Ref Prompt Modal */}
        {refModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ background:'#fff', borderRadius:10, padding:24, width:'100%', maxWidth:360, boxShadow:'0 16px 48px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:6 }}>Order Reference — {refModal.supplier}</div>
              <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>Auto-generated from today's date. Edit if you have a supplier order number.</p>
              <input
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', fontSize:15, fontWeight:700, fontFamily:'monospace', border:'2px solid #86efac', borderRadius:7, outline:'none', boxSizing:'border-box', letterSpacing:'0.05em' }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { markAsOrdered(refModal.supplier, refInput); setRefModal(null) } if (e.key === 'Escape') setRefModal(null) }}
              />
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button onClick={() => setRefModal(null)}
                  style={{ flex:1, padding:'9px 0', background:'#f1f5f9', color:'#475569', border:'none', borderRadius:6, fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={() => { markAsOrdered(refModal.supplier, refInput); setRefModal(null) }}
                  style={{ flex:2, padding:'9px 0', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  ✓ Mark as Ordered
                </button>
              </div>
            </div>
          </div>
        )}

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

        {error && items.length === 0 && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}
        {error && items.length > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', margin: '8px 20px', padding: '8px 14px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚠️ Refresh failed — showing cached data. <button onClick={() => loadItems(true)} style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, background: 'none', border: '1px solid #d97706', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: '#92400e' }}>Retry</button>
          </div>
        )}

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
                {/* Square vendor name mapping — small ✎ per supplier */}
                {showDetails && !readOnly && suppliers.map(s => {
                  const mapped = supplierVendorNames[s]
                  return (
                    <span key={s} title={`Square vendor name for ${s}: ${mapped || 'not set'}`}
                      style={{ fontSize: 11, color: mapped ? '#16a34a' : '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                      onClick={() => {
                        const v = prompt(`Square vendor name for "${s}"\n(must match exactly in Square Dashboard)`, mapped || s)
                        if (v === null) return
                        const updated = { ...supplierVendorNames, [s]: v.trim() }
                        setSupplierVendorNames(updated)
                        fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ itemName: '_global', field: 'supplierVendorNames', value: updated }) })
                      }}>
                      <span style={{ fontSize: 10 }}>✎</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{s.split(' ')[0]}</span>
                    </span>
                  )
                })}
                <div style={{ width: 1, background: '#e2e8f0', margin: '0 6px', alignSelf: 'stretch' }} />
                {viewMode === 'pricing' && (
                  <>
                    <button onClick={printPricingSheet}
                      style={{ ...styles.tab, color: '#047857', borderColor: '#047857', background: '#f0fdf4' }}>
                      🖨️ Print
                    </button>
                    <button onClick={exportPricingExcel}
                      style={{ ...styles.tab, color: '#047857', borderColor: '#047857', background: '#f0fdf4' }}>
                      📥 Excel
                    </button>
                  </>
                )}
                <button style={{ ...styles.tab, ...(viewMode === 'pricing' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' } : { color: '#7c3aed', borderColor: '#7c3aed' }) }}
                  onClick={() => setViewMode(v => v === 'pricing' ? 'reorder' : 'pricing')}>$ Pricing</button>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={styles.filterCheck}>
                  <input type="checkbox" checked={filterOrder} onChange={e => setFilterOrder(e.target.checked)} style={{ marginRight: 6 }} />
                  Order items only
                </label>
                <button onClick={() => setShowDetails(d => !d)}
                  style={{ background: showDetails ? '#1e3a5f' : '#f1f5f9', color: showDetails ? '#fff' : '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {showDetails ? '▲ Hide details' : '▼ Show details'}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Sales period:</span>
                  {[30, 60, 90].map(d => (
                    <button key={d}
                      style={{ ...styles.tab, padding: '4px 12px', fontSize: 12, ...(daysBack === d ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : {}) }}
                      onClick={() => { setDaysBack(d); loadItems(true, d) }}>{d}d</button>
                  ))}
                </div>




                <div style={{ position: 'relative' }}>
                  <button style={{ ...styles.btn, background: '#374151', fontSize: 12, padding: '6px 14px' }}
                    onClick={() => setPrinting(p => p === 'menu' ? null : 'menu')}>🖨️ Print Order List</button>
                  {printing === 'menu' && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setPrinting(null)} />
                  )}
                  {printing === 'menu' && (
                    <div style={styles.dropdown}>
                      {suppliers.map(s => (
                        <div key={s} style={{ borderBottom: '1px solid #f1f5f9', padding: '4px 0' }}>
                          <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</div>
                          <button style={styles.dropItem} onClick={() => { printOrderSheet(s); setPrinting(null) }}>
                            🖨️ Print Order List
                          </button>
                          <button style={{ ...styles.dropItem, color: '#16a34a', fontWeight: 700 }} onClick={() => { setRefInput(generateOrderRef(s)); setRefModal({ supplier: s }); setPrinting(null) }}>
                            ✓ Mark as Ordered
                          </button>
                        </div>
                      ))}

                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* On Order banner */}
            {onOrderCount > 0 && (() => {
              const bySupplier = {}
              for (const [name, info] of Object.entries(orderedItems)) {
                const key = info.supplier || 'Unknown'
                if (!bySupplier[key]) bySupplier[key] = []
                bySupplier[key].push({ name, ...info })
              }
              return (
                <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(bySupplier).map(([supplier, supplierItems]) => (
                    <div key={supplier} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🛒 {supplier}</span>
                      {supplierItems[0]?.ref && (
                        <span style={{ fontSize: 11, fontFamily: 'monospace', background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 4, fontWeight: 700 }}>{supplierItems[0].ref}</span>
                      )}
                      <span style={{ fontSize: 12, color: '#64748b' }}>{supplierItems.length} item{supplierItems.length !== 1 ? 's' : ''} on order</span>
                      <button onClick={() => setViewOrderModal({ supplier, items: supplierItems })}
                        style={{ fontSize: 11, background: 'none', border: '1px solid #86efac', borderRadius: 5, padding: '2px 10px', color: '#16a34a', fontWeight: 600, cursor: 'pointer' }}>
                        View
                      </button>
                      {!readOnly && (
                        <button onClick={() => printDeliverySheet(supplier, supplierItems, supplierItems[0]?.ref)}
                          style={{ fontSize: 11, background: 'none', border: '1px solid #86efac', borderRadius: 5, padding: '2px 10px', color: '#16a34a', fontWeight: 600, cursor: 'pointer' }}>
                          📋 Delivery List
                        </button>
                      )}
                      {!readOnly && (
                        <button onClick={() => { setRefInput(generateOrderRef(supplier)); setRefModal({ supplier }) }}
                          style={{ fontSize: 11, background: 'none', border: '1px solid #86efac', borderRadius: 5, padding: '2px 10px', color: '#16a34a', fontWeight: 600, cursor: 'pointer' }}>
                          ✓ Mark Ordered
                        </button>
                      )}
                      {!readOnly && (
                        <button onClick={() => openReceiveModal(supplier, supplierItems)}
                          disabled={poReceiving === supplier}
                          style={{ fontSize: 11, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 12px', cursor: 'pointer' }}>
                          {poReceiving === supplier ? '...' : 'Receive'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* View Order Modal */}
            {viewOrderModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={() => setViewOrderModal(null)}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 540, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto' }}
                  onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>🛒 {viewOrderModal.supplier} — Current Order</div>
                    <button onClick={() => setViewOrderModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>x</button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ background: '#1e3a5f', color: '#fff' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty Ordered</th>
                    </tr></thead>
                    <tbody>
                      {viewOrderModal.items.map((item, i) => (
                        <tr key={item.name} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                          <td style={{ padding: '7px 12px', color: '#0f172a' }}>{item.name}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>
                            {item.isSpirit ? item.orderQty + ' nips' : item.orderQty + ' units'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                    <button onClick={() => setViewOrderModal(null)}
                      style={{ padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                    {!readOnly && (
                      <button onClick={() => { openReceiveModal(viewOrderModal.supplier, viewOrderModal.items); setViewOrderModal(null) }}
                        style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>Receive This Order</button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {viewMode !== 'pricing' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, padding: '12px 16px', background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 10 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>📋</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>Step 1 — Review</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Check suggested quantities. Adjust Order Qty if needed.</div>
                </div>
                <div style={{ width: 1, background: '#bfdbfe' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>🛒</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>Step 2 — Order</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Print list for reference when ordering with supplier online. Click Mark as Ordered to track it here.</div>
                </div>
                <div style={{ width: 1, background: '#bfdbfe' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>📦</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>Step 3 — Receive</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>When delivery arrives, click Receive on the order banner. Enter actual quantities received.</div>
                </div>
                <div style={{ width: 1, background: '#bfdbfe' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>✅</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>Step 4 — Done</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Square inventory updates automatically. Download HTML receipt for your records.</div>
                </div>
              </div>
            )}
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={{ ...styles.th, width: 240 }}>Item</th>
                    <th style={{ ...styles.th, display: showDetails ? '' : 'none' }}>Category</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>On Hand</th>
                    <th style={{ ...styles.th, textAlign: 'right', display: showDetails ? '' : 'none' }}>Wkly Avg</th>
                    <th style={{ ...styles.th, textAlign: 'right', display: showDetails ? '' : 'none' }}>Target</th>
                    <th style={{ ...styles.th, textAlign: 'center', display: showDetails ? '' : 'none' }}>Pack</th>
                    <th style={{ ...styles.th, textAlign: 'center', display: showDetails ? '' : 'none' }}>Bottle Size</th>
                    <th style={{ ...styles.th, textAlign: 'center', display: showDetails ? '' : 'none' }}>Nip Size</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Order Qty</th>
                    <th style={{ ...styles.th, textAlign: 'right', display: showDetails ? '' : 'none' }}>Bottles</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Priority</th>
                    <th style={{ ...styles.th, width: 180 }}>Notes</th>
                    {viewMode === 'pricing' && <>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Buy Price</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Sell/Serve</th>
                      <th style={{ ...styles.th, textAlign: 'center', color: '#7c3aed' }}>Serve Size</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Serves/Btl</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed' }}>Margin</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={viewMode === 'pricing' ? 18 : 13} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                      {filterOrder ? 'No items to order this week.' : 'No items found.'}
                    </td></tr>
                  )}
                  {displayed.map((item, idx) => {
                    const p = PRIORITY_COLORS[item.priority]
                    const isOnOrder = !!orderedItems[item.name]
                    const rowBg = isOnOrder ? '#f0f9ff' : (item.orderQty > 0 ? p.bg : (idx % 2 === 0 ? '#fff' : '#f8fafc'))
                    return (
                      <tr key={item.name} style={{ background: rowBg }}>
                        <td style={{ ...styles.td, fontWeight: 500, fontSize: 13 }}>
                          {item.name}{item.buyPrice == null && viewMode === 'pricing' && <span title="No cost price set" style={{ marginLeft: 5, color: '#dc2626', fontSize: 9, fontWeight: 700 }}>●</span>}
                        </td>
                        <td style={{ ...styles.td, display: showDetails ? '' : 'none' }}>
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
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', display: showDetails ? '' : 'none' }}>
                          {readOnly
                            ? <span title={item.weeklyAvgOverride != null ? `Square avg: ${Math.round(item.squareWeeklyAvg)}` : ''}>
                                {Math.round(item.weeklyAvg)}{item.weeklyAvgOverride != null && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginLeft: 2 }}>★</span>}
                              </span>
                            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                {item.weeklyAvgOverride != null && (
                                  <button
                                    onClick={() => saveSetting(item.name, 'weeklyAvgOverride', null)}
                                    title={`Reset to Square avg (${item.squareWeeklyAvg})`}
                                    style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 0 }}>★</button>
                                )}
                                <input
                                  type="number" min="0" step="0.1"
                                  defaultValue={item.weeklyAvgOverride != null ? item.weeklyAvgOverride : Math.round(item.weeklyAvg)}
                                  key={item.name + '_wavg_' + item.weeklyAvgOverride}
                                  onBlur={e => {
                                    const v = parseFloat(e.target.value)
                                    if (isNaN(v)) return
                                    if (v === item.squareWeeklyAvg) saveSetting(item.name, 'weeklyAvgOverride', null)
                                    else saveSetting(item.name, 'weeklyAvgOverride', v)
                                  }}
                                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                                  style={{
                                    width: 58, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13,
                                    border: item.weeklyAvgOverride != null ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                                    borderRadius: 5, padding: '2px 4px',
                                    background: item.weeklyAvgOverride != null ? '#fffbeb' : '#f8fafc',
                                    color: item.weeklyAvgOverride != null ? '#92400e' : 'inherit'
                                  }}
                                />
                              </div>
                          }
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', display: showDetails ? '' : 'none' }}>{item.targetStock}</td>
                        <td style={{ ...styles.td, textAlign: 'center', display: showDetails ? '' : 'none' }}>
                          {!item.isSpirit ? (
                            <EditSelect value={String(item.pack || '')} options={['6', '18', '24', '30', '48']}
                              onChange={v => saveSetting(item.name, 'pack', Number(v))}
                              saving={saving[`${item.name}_pack`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center', display: showDetails ? '' : 'none' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.bottleML)} options={['700', '750', '1000']}
                              onChange={v => saveSetting(item.name, 'bottleML', Number(v))}
                              saving={saving[`${item.name}_bottleML`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center', display: showDetails ? '' : 'none' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.nipML || 30)} options={['30', '60']}
                              onChange={v => saveSetting(item.name, 'nipML', Number(v))}
                              saving={saving[`${item.name}_nipML`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15 }}>
                          {dontOrder(item)
                            ? <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, fontStyle: 'italic' }}>Do not restock</span>
                            : readOnly
                              ? (item.isSpirit ? (item.nipsToOrder > 0 ? item.nipsToOrder : '-') : (item.orderQty > 0 ? item.orderQty : '-'))
                              : (() => {
                                const calcQty = item.isSpirit ? item.nipsToOrder : item.orderQty
                                const override = orderQtyOverrides[item.name]
                                const display = override !== undefined ? override : (calcQty > 0 ? calcQty : 0)
                                const isEdited = override !== undefined && override !== calcQty
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                    {isEdited && <span title="Manually adjusted" style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>✎</span>}
                                    <input
                                      type="number" min="0" value={display}
                                      onChange={e => {
                                        const v = parseInt(e.target.value) || 0
                                        setOrderQtyOverrides(prev => ({ ...prev, [item.name]: v }))
                                        saveSetting(item.name, 'orderQtyOverride', v)
                                      }}
                                      style={{ width: 60, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 14,
                                        border: isEdited ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                                        borderRadius: 5, padding: '2px 6px', background: isEdited ? '#fffbeb' : '#f8fafc',
                                        color: isEdited ? '#92400e' : 'inherit' }}
                                    />
                                    {isEdited && (
                                      <button onClick={() => {
                                        setOrderQtyOverrides(prev => { const n = {...prev}; delete n[item.name]; return n })
                                        saveSetting(item.name, 'orderQtyOverride', null)
                                      }}
                                        title="Reset to calculated" style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>↺</button>
                                    )}
                                  </div>
                                )
                              })()
                          }
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', color: '#1f4e79', display: showDetails ? '' : 'none' }}>
                          {item.isSpirit ? (() => {
                            const btl = item.bottlesToOrder || 0
                            return btl > 0 ? btl : '-'
                          })() : '-'}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {orderedItems[item.name]
                              ? <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', background: '#0e7490', color: '#fff' }}>ON ORDER</span>
                              : <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', background: dontOrder(item) ? '#94a3b8' : p.badge, color: '#fff' }}>{dontOrder(item) ? 'RUNDOWN' : item.priority}</span>
                            }
                            {!readOnly && !orderedItems[item.name] && (
                              dontOrder(item)
                                ? <button onClick={() => {
                                    const cleaned = (item.notes || '').replace(/don'?t\s+order|do\s+not\s+order|don'?t\s+restock|do\s+not\s+restock/gi, '').trim()
                                    saveSetting(item.name, 'notes', cleaned)
                                  }}
                                  title="Remove Rundown flag"
                                  style={{ fontSize: 10, background: 'none', border: '1px solid #94a3b8', borderRadius: 4, padding: '1px 6px', color: '#64748b', cursor: 'pointer' }}>
                                  ↩ Undo
                                </button>
                                : <button onClick={() => {
                                    const note = (item.notes || '').trim()
                                    saveSetting(item.name, 'notes', note ? note + ' — Don\'t Order' : "Don't Order")
                                  }}
                                  title="Mark as Rundown — exclude from orders"
                                  style={{ fontSize: 10, background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 6px', color: '#94a3b8', cursor: 'pointer' }}>
                                  🚫 Rundown
                                </button>
                            )}
                          </div>
                        </td>

                        <td style={styles.td}>
                          <EditText value={item.notes || ''} onChange={v => saveSetting(item.name, 'notes', v)}
                            saving={saving[`${item.name}_notes`]} placeholder="Add note..." readOnly={readOnly} />
                        </td>
                        {viewMode === 'pricing' && (() => {
                          const WINE_CATS = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']
                          const isWine = WINE_CATS.includes(item.category)
                          const forceBottle = item.category === 'Sparkling' || item.bottleOnly
                          const sellUnit = item.isSpirit ? 'nip'
                                         : forceBottle ? 'bottle'
                                         : isWine ? (item.sellUnit || 'glass')
                                         : 'bottle'
                          const bottleML = item.isSpirit ? (item.bottleML || 700) : 750
                          const serveML = item.isSpirit ? (item.nipML || 30)
                                        : (isWine && sellUnit === 'glass') ? 150
                                        : null
                          const servesPerBottle = !item.isSpirit && !isWine ? null
                                                : sellUnit === 'bottle' ? 1
                                                : serveML ? +(bottleML / serveML).toFixed(1)
                                                : null

                          const buy = item.buyPrice !== '' && item.buyPrice != null ? Number(item.buyPrice) : null

                          // Resolve sell prices from Square variations (same logic as Price List tab)
                          const vars = item.variations || []
                          const glassVar  = vars.find(v => v.name.toLowerCase().includes('glass'))
                          const bottleVar = vars.find(v => v.name.toLowerCase().includes('bottle') || v.name.toLowerCase() === 'regular')
                          const nipVar    = vars.find(v => v.name.toLowerCase().includes('nip') || v.name.toLowerCase().includes('30ml') || v.name.toLowerCase().includes('60ml'))

                          // For spirits: prefer nip variation, then regular, then primary price
                          // For wines: glass variation for glass mode, bottle/regular for bottle mode
                          // For beer/other: just use primary Square price
                          const sellGlass = item.isSpirit
                            ? (nipVar || bottleVar || glassVar)?.price != null ? Number((nipVar || bottleVar || glassVar).price) : (item.sellPrice !== '' && item.sellPrice != null ? Number(item.sellPrice) : null)
                            : glassVar?.price != null ? Number(glassVar.price)
                            : (item.sellPrice !== '' && item.sellPrice != null ? Number(item.sellPrice) : null)

                          const sellBottle = bottleVar?.price != null ? Number(bottleVar.price)
                                           : (item.squareSellPrice != null ? Number(item.squareSellPrice) : null)

                          // Active sell price for this item/mode
                          const sell = (isWine && sellUnit === 'bottle') ? sellBottle : sellGlass

                          // Margin logic:
                          //   spirits:     buy=per nip, sell=per nip  → (sell−buy)/sell
                          //   wine glass:  buy=per bottle, sell=per glass → (sell×serves−buy)/(sell×serves)
                          //   wine bottle: buy=per bottle, sell=per bottle → (sell−buy)/sell
                          //   beer/other:  buy=per unit, sell=per unit → (sell−buy)/sell
                          let marginPct = null
                          if (buy != null && buy >= 0 && sell != null && sell > 0) {
                            if (item.isSpirit) {
                              // both per nip
                              marginPct = ((sell - buy) / sell) * 100
                            } else if (isWine && sellUnit === 'glass' && servesPerBottle) {
                              // buy per bottle, sell per glass
                              const rev = sell * servesPerBottle
                              marginPct = rev > 0 ? ((rev - buy) / rev) * 100 : null
                            } else {
                              // wine bottle, beer, other — both same unit
                              marginPct = ((sell - buy) / sell) * 100
                            }
                          }
                          const revenuePerBottle = (isWine && sellUnit === 'glass' && sell != null && servesPerBottle)
                            ? +(sell * servesPerBottle).toFixed(2) : null
                          const marginStr   = marginPct != null ? marginPct.toFixed(1) + '%' : '—'
                          const marginColor = marginPct == null ? '#94a3b8' : marginPct >= 40 ? '#16a34a' : marginPct >= 20 ? '#d97706' : '#dc2626'
                          return <>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <EditNumber value={buy ?? ''} placeholder="$0.00" decimals={2} prefix="$"
                                onChange={v => saveSetting(item.name, 'buyPrice', v)}
                                saving={saving[`${item.name}_buyPrice`]} min={0} readOnly={readOnly} />
                              {buy == null && !readOnly && <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, marginTop: 2 }}>No cost price set</div>}
                              {settingsAudit[`${item.name}__buyPrice`] && (
                                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
                                  ↺ {new Date(settingsAudit[`${item.name}__buyPrice`].ts).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
                                </div>
                              )}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>
                                  {(isWine && sellUnit === 'bottle' ? sellBottle : sellGlass) != null
                                    ? `$${(isWine && sellUnit === 'bottle' ? sellBottle : sellGlass).toFixed(2)}`
                                    : '—'}
                                </span>
                                <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                  {item.isSpirit ? 'per nip' : (isWine && sellUnit === 'bottle') ? 'per bottle' : isWine ? 'per glass' : ''} · Square
                                </span>
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center', fontSize: 11 }}>
                              {item.isSpirit ? (
                                <span style={{ color: '#64748b', fontFamily: 'IBM Plex Mono, monospace' }}>{serveML}ml nip</span>
                              ) : isWine ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  {(readOnly || forceBottle)
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
                                  }
                                  {!readOnly && item.category !== 'Sparkling' && (
                                    item.bottleOnly
                                      ? <button title="Remove bottle lock" onClick={() => {
                                            saveSetting(item.name, 'bottleOnly', false)
                                            setItems(prev => prev.map(i => i.name === item.name ? { ...i, bottleOnly: false } : i))
                                          }}
                                          style={{ fontSize: 9, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', lineHeight: 1.4 }}>
                                          🔒 unlock
                                        </button>
                                      : <button title="Always sell as bottle — locks out glass option" onClick={() => {
                                            saveSetting(item.name, 'bottleOnly', true)
                                            saveSetting(item.name, 'sellUnit', 'bottle')
                                            setItems(prev => prev.map(i => i.name === item.name ? { ...i, bottleOnly: true, sellUnit: 'bottle' } : i))
                                          }}
                                          style={{ fontSize: 9, color: '#94a3b8', background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', lineHeight: 1.4 }}>
                                          🔓 fix bottle
                                        </button>
                                  )}
                                </div>
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
            fromCache={fromCache}
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
        {mainTab === 'barcodesheet' && <BarcodeSheetView items={items} />}
        {mainTab === 'notes' && !readOnly && <NotesView items={items} notes={notesLog} readOnly={readOnly} onRefresh={loadNotes} />}
        {mainTab === 'notes' && readOnly && <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>📝 Notes are only visible to committee members.</div>}
        {mainTab === 'bestsellers' && <BestSellersView items={items} salesData={sellersData} loading={sellersLoading} error={sellersError} daysBack={daysBack} />}
        {mainTab === 'pricelist' && (
          <PriceListView
            items={items}
            settings={priceListSettings}
            readOnly={readOnly}
            saving={plSaving}
            onSave={savePriceListSetting}
            onPrint={generatePriceListPDF}
            publicMode={publicMode}
          />
        )}
        {mainTab === 'stocktake' && <StocktakeView items={items} readOnly={readOnly} onExport={exportStocktake} />}
          {mainTab === 'sohhistory' && <SohHistoryView />}
          {mainTab === 'specials' && !readOnly && <SpecialsView items={items} />}
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
  useEffect(() => { onRefresh().catch(() => {}) }, [])
  const REASONS = ['Breakage', 'Spoilage', 'Expired', 'Other']
  const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']
  const WINE_CATS   = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']
  const REASON_COLOR = {
    Breakage: { bg: '#fee2e2', text: '#dc2626' },
    Spoilage: { bg: '#fef9c3', text: '#ca8a04' },
    Expired:  { bg: '#ffedd5', text: '#ea580c' },
    Other:    { bg: '#f1f5f9', text: '#475569' },
  }

  // Unit options keyed by category group
  function getUnitOptions(item) {
    if (!item) return ['units']
    if (['Spirits', 'Fortified & Liqueurs'].includes(item.category)) return ['nips', 'bottles']
    if (['White Wine', 'Red Wine', 'Rose', 'Sparkling'].includes(item.category)) return ['glasses', 'bottles']
    return ['units']
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
  const [form, setForm]       = useState({ itemName: '', qty: '', unit: 'units', reason: 'Breakage', note: '', recordedBy: '', date: today })
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})

  const [refreshError, setRefreshError] = useState(null)

  async function refresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await onRefresh()
    } catch(e) {
      setRefreshError(e.message || 'Failed to load')
    }
    setRefreshing(false)
  }
  // Sync state
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncPreview, setSyncPreview]     = useState(null)
  const [syncLoading, setSyncLoading]     = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [syncResult, setSyncResult]       = useState(null)

  const unsyncedCount = log.filter(e => !e.squareSynced).length

  async function loadSyncPreview() {
    setSyncLoading(true)
    setSyncResult(null)
    setSyncPreview(null)
    try {
      const r = await fetch('/api/wastage-sync')
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      const d = await r.json()
      setSyncPreview(d)
    } catch(e) { setSyncPreview({ error: e.message }) }
    finally { setSyncLoading(false) }
  }

  async function executeSync(entryIds) {
    setSyncing(true)
    try {
      const r = await fetch('/api/wastage-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds })
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Sync failed')
      const d = await r.json()
      setSyncResult(d)
      await onRefresh()
      // Only reload preview if all succeeded — on failure keep result visible for debugging
      if (d.ok) loadSyncPreview()
    } catch(e) { setSyncResult({ ok: false, error: e.message }) }
    finally { setSyncing(false) }
  }

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

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {refreshError && <span style={{ fontSize: 11, color: '#dc2626' }}>⚠️ {refreshError}</span>}
        <button onClick={refresh} disabled={refreshing}
          style={{ padding: '6px 14px', background: refreshing ? '#94a3b8' : '#f1f5f9', color: refreshing ? '#fff' : '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer' }}>
          {refreshing ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

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
                    const units = getUnitOptions(selected)
                    setForm(f => ({ ...f, itemName: e.target.value, unit: units[0] }))
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
                {/* Unit — options depend on item category */}
                <div style={{ width: 100 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Unit</div>
                  {(() => {
                    const selectedItem = items.find(i => i.name === form.itemName)
                    const unitOpts = getUnitOptions(selectedItem)
                    return (
                      <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                        {unitOpts.map(u => <option key={u}>{u}</option>)}
                      </select>
                    )
                  })()}
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
            {!readOnly && unsyncedCount > 0 && (
              <button onClick={async () => {
                  if (!confirm(`Mark all ${unsyncedCount} unsynced entr${unsyncedCount === 1 ? 'y' : 'ies'} as already synced to Square?\n\nUse this when entries have been manually re-entered and were previously synced.`)) return
                  await fetch('/api/wastage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markAllSynced' }) })
                  await onRefresh()
                }}
                style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                ✓ Mark All as Synced
              </button>
            )}
            {!readOnly && (
              <button onClick={() => { setShowSyncModal(true); loadSyncPreview() }}
                style={{ fontSize: 11, background: unsyncedCount > 0 ? '#16a34a' : '#475569', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⬆ Sync to Square
                {unsyncedCount > 0 && (
                  <span style={{ background: '#fff', color: '#16a34a', fontWeight: 800, fontSize: 10, borderRadius: 99, padding: '1px 6px', lineHeight: 1.5 }}>{unsyncedCount}</span>
                )}
              </button>
            )}
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
                {['Date','Item','Qty','Reason','Note','By','Sq',''].map(h => (
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
                              {getUnitOptions(items.find(i => i.name === editForm.itemName)).map(u => <option key={u}>{u}</option>)}
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
                        <td style={{ padding: '6px 8px' }} />
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
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {entry.squareSynced
                            ? <span title={`Synced ${new Date(entry.squareSyncedAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short' })}${entry.conversionNote ? '\n' + entry.conversionNote : ''}`}
                                style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 700, padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap', cursor: 'default' }}>
                                ✓ Sq
                              </span>
                            : <span style={{ fontSize: 10, color: '#cbd5e1' }}>—</span>
                          }
                        </td>
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

      {/* ── SYNC MODAL ──────────────────────────────────────────────────────── */}
      {showSyncModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

            {/* Modal header */}
            <div style={{ background: '#0f172a', color: '#fff', borderRadius: '14px 14px 0 0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>⬆ Sync Wastage to Square</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>This will post WASTE adjustments to your Square inventory</div>
              </div>
              <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* Success/fail result banner */}
              {syncResult && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: syncResult.ok ? '#f0fdf4' : '#fee2e2', border: `1px solid ${syncResult.ok ? '#86efac' : '#fca5a5'}`, color: syncResult.ok ? '#166534' : '#991b1b', fontSize: 13, fontWeight: 600 }}>
                  {syncResult.ok ? '✓ ' : '✕ '}{syncResult.message || syncResult.error}
                  {syncResult.skippedItems?.length > 0 && (
                    <div style={{ marginTop: 8, fontWeight: 400, fontSize: 12 }}>
                      {syncResult.skippedItems.map((s, i) => (
                        <div key={i} style={{ padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
                          <strong>{s.itemName}</strong>: {s.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {syncLoading && (
                <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                  <div style={{ ...styles.spinner, margin: '0 auto 12px' }} />
                  Loading preview from Square...
                </div>
              )}

              {syncPreview?.error && (
                <div style={{ color: '#dc2626', padding: 16, background: '#fee2e2', borderRadius: 8, fontSize: 13 }}>
                  Error: {syncPreview.error}
                </div>
              )}

              {syncPreview && !syncPreview.error && (
                <>
                  {syncPreview.preview?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 14 }}>
                      ✓ All wastage entries are already synced to Square
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                        {syncPreview.preview.filter(p => p.canSync).length} entries ready to sync ·{' '}
                        {syncPreview.preview.filter(p => !p.canSync).length > 0 && (
                          <span style={{ color: '#d97706' }}>{syncPreview.preview.filter(p => !p.canSync).length} will be skipped (not in Square catalogue)</span>
                        )}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              {['Date','Item','Logged','→ Square deduction','Conversion','Sq Stock','Var ID','Status'].map(h => (
                                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {syncPreview.preview.map((p, idx) => (
                              <tr key={p.id} style={{ background: !p.canSync ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', opacity: !p.canSync ? 0.65 : 1 }}>
                                <td style={{ padding: '7px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                  {new Date(p.date).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short' })}
                                </td>
                                <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{p.itemName}</td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                  {p.qty} {p.unit}
                                </td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
                                  {p.canSync ? `−${p.squareQty} ${SPIRIT_CATS.includes(p.category) ? 'nips' : WINE_CATS.includes(p.category) ? 'btl' : 'units'}` : '—'}
                                </td>
                                <td style={{ padding: '7px 10px', fontSize: 11, color: '#64748b' }}>
                                  {p.conversionNote || <span style={{ color: '#cbd5e1' }}>1:1</span>}
                                </td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: p.squareOnHand > 0 ? '#16a34a' : '#dc2626' }}>
                                  {p.squareOnHand !== null ? p.squareOnHand : '—'}
                                </td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', userSelect: 'all' }}>
                                  {p.variationId ? p.variationId.slice(-8) : '—'}
                                </td>
                                <td style={{ padding: '7px 10px' }}>
                                  {p.canSync
                                    ? <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Ready</span>
                                    : <span title={p.skipReason} style={{ fontSize: 10, background: '#fef9c3', color: '#92400e', fontWeight: 700, padding: '2px 8px', borderRadius: 99, cursor: 'help' }}>Skip ⓘ</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            {syncPreview && !syncPreview.error && syncPreview.preview?.filter(p => p.canSync).length > 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc', borderRadius: '0 0 14px 14px' }}>
                <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                  style={{ padding: '9px 18px', background: '#e2e8f0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button
                  onClick={() => executeSync(syncPreview.preview.filter(p => p.canSync).map(p => p.id))}
                  disabled={syncing}
                  style={{ padding: '9px 20px', background: syncing ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer' }}>
                  {syncing
                    ? '⏳ Syncing...'
                    : `⬆ Sync ${syncPreview.preview.filter(p => p.canSync).length} entr${syncPreview.preview.filter(p => p.canSync).length === 1 ? 'y' : 'ies'} to Square`}
                </button>
              </div>
            )}
            {syncPreview && !syncPreview.error && syncPreview.preview?.length === 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderRadius: '0 0 14px 14px' }}>
                <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                  style={{ padding: '9px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}






// === BARCODE SHEET VIEW =====================================================
function BarcodeSheetView({ items }) {
  const [loaded, setLoaded] = useState(false)
  const allRef   = useRef(null)  // wrapper for all previews - used for SVG rasterisation
  const sheetRef = useRef(null)  // single-page 3-col
  const p1Ref    = useRef(null)  // 2-page: page 1 (Spirits + Fortified)
  const p2Ref    = useRef(null)  // 2-page: page 2 (White + Red/Rose)

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
        window.JsBarcode(svg, sku, { format: 'CODE128', width: 3, height: 100, displayValue: false, margin: 12 })
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

  const spiritsItems   = items.filter(i => i.category === 'Spirits' && (i.onHand || 0) > 0).sort((a,b) => a.name.localeCompare(b.name))
  const fortifiedItems = items.filter(i => i.category === 'Fortified & Liqueurs' && (i.onHand || 0) > 0).sort((a,b) => a.name.localeCompare(b.name))
  const whiteItems     = items.filter(i => i.category === 'White Wine' && getGlassSku(i) && (i.onHand || 0) > 0).sort((a,b) => a.name.localeCompare(b.name)).map(i => ({...i,_glass:true}))
  const roseItems      = items.filter(i => i.category === 'Rose' && getGlassSku(i) && (i.onHand || 0) > 0).sort((a,b) => a.name.localeCompare(b.name)).map(i => ({...i,_glass:true}))
  const redItems       = items.filter(i => i.category === 'Red Wine' && getGlassSku(i) && (i.onHand || 0) > 0 && !/minchinbury|curtis legion/i.test(i.name)).sort((a,b) => a.name.localeCompare(b.name)).map(i => ({...i,_glass:true}))

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
    .bc-col-hdr{flex:0 0 auto;padding:5px 8px;text-align:center;font-weight:900;font-size:17px;letter-spacing:.07em;text-transform:uppercase;color:#fff;}
    .bc-div{flex:0 0 22px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:#fff;border-top:1px solid #888;}
    .bc-row{flex:1;display:flex;border-top:1px solid #ccc;min-height:0;}
    .bc-label{flex:1;display:flex;align-items:center;padding:0 8px;font-weight:900;font-size:16px;word-break:break-word;border-right:1px solid #ccc;}
    .bc-cell{flex:1;display:flex;align-items:center;overflow:hidden;min-width:0;}
    .bc-cell img{width:100%;height:auto;display:block;}
  `

  function renderCol(colItems, colours, isWine) {
    let idx = 0
    return colItems.map((item, i) => {
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

  function ColDiv({ title, colItems, colours, isWine }) {
    return (
      <div className="bc-col">
        <div className="bc-col-hdr" style={{ background: colours.hdr }}>{title}</div>
        {renderCol(colItems, colours, isWine)}
      </div>
    )
  }

  const PAGE_CSS = (leftMargin, largeTitles = false) => `
    @page{size:A4 landscape;margin:6mm 8mm 6mm ${leftMargin};}
    html,body{height:100%;margin:0;padding:0;font-family:Arial,sans-serif;}
    .bc-page{height:100%;display:flex;flex-direction:column;}
    .bc-hdr{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;background:#1A2F45;color:#fff;padding:3px 8px;margin-bottom:4px;font-size:12px;font-weight:800;}
    .bc-hdr-date{font-size:10px;color:#cbd5e1;}
    .bc-cols{flex:1;display:flex;gap:5px;min-height:0;}
    ${COL_CSS}
    ${largeTitles ? '.bc-col-hdr{font-size:28px!important;padding:8px 10px!important;}' : ''}
    @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  `

  function printWindow(pages, leftMargin = '14mm', largeTitles = false) {
    const w = window.open('', '_blank')
    const dateStr = new Date(Date.now() + 10*60*60*1000).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' })
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

  function doPrint1Page() {
    printWindow([{ subtitle: 'By the Glass Barcodes', html: sheetRef.current?.innerHTML || '' }])
  }

  function doPrint2Page() {
    printWindow([
      { subtitle: 'Spirits & Fortified — Barcodes', html: p1Ref.current?.innerHTML || '' },
      { subtitle: 'Wines — By the Glass Barcodes',  html: p2Ref.current?.innerHTML || '' },
    ], '14mm', true)
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
          <ColDiv title="Spirits"              colItems={spiritsItems}   colours={C.spirits}   isWine={false} />
          <ColDiv title="Fortified & Liqueurs" colItems={fortifiedItems} colours={C.fortified} isWine={false} />
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>2-page layout — page 2: Wines</div>
        <div ref={p2Ref} style={{ display:'flex', gap:8, height:580, minHeight:0, marginBottom:12 }}>
          <ColDiv title="White Wine" colItems={whiteItems} colours={C.white} isWine={true} />
          <ColDiv title="Red Wine"   colItems={col2wines}  colours={C.red}   isWine={true} />
        </div>
      </div>
    </div>
  )
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────
function DashboardView({ items, lastUpdated, onNav, orderedItems = {}, fromCache = false }) {
  const [dashTab, setDashTab]   = useState('overview')
  const [fyData,  setFyData]    = useState(null)
  const [fyLoading, setFyLoading] = useState(false)
  const [fyError,   setFyError]   = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [revenueTarget, setRevenueTarget] = useState(null)
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const onOrderCount = Object.keys(orderedItems).length
  const dontOrderRe  = /do\s*n'?t\s+order|do\s+not\s+order|do\s+not\s+restock|do\s*n'?t\s+restock/i
  const critCount    = items.filter(i => i.priority === 'CRITICAL' && !dontOrderRe.test(i.notes || '')).length
  const lowCount     = items.filter(i => i.priority === 'LOW'      && !dontOrderRe.test(i.notes || '')).length
  const orderCount   = items.filter(i => i.orderQty > 0 && !orderedItems[i.name] && !/do\s*n'?t\s+order|do\s+not\s+order/i.test(i.notes || '')).length
  const totalItems   = items.length

  const now = new Date()
  const refreshedAgo = lastUpdated ? (() => {
    const mins = Math.floor((now - new Date(lastUpdated)) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins/60)}h ${mins%60}m ago`
  })() : 'Not yet refreshed'

  // Auto-load FY chart and weather on mount
  useEffect(() => {
    if (!fyData && !fyLoading) loadFyChart()
    if (!weatherData && !weatherLoading) loadWeather()
  }, [])

  // Load revenue target from settings
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const s = d.settings || d || {}
      if (d.revenueTarget) setRevenueTarget(Number(d.revenueTarget))
    }).catch(() => {})
  }, [])

  async function saveRevenueTarget(val) {
    const v = parseFloat(val)
    if (!isNaN(v) && v > 0) {
      setRevenueTarget(v)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: '__revenueTarget', field: 'revenueTarget', value: v, who: 'committee' })
      })
    }
    setEditingTarget(false)
  }

  async function loadWeather() {
    setWeatherLoading(true)
    try {
      // Palmwoods QLD: lat -26.70, lon 152.76
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=-26.70&longitude=152.76&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia%2FBrisbane&forecast_days=7'
      const r = await fetch(url)
      const d = await r.json()
      // Wed=3, Fri=5, Sun=0
      const days = d.daily.time.map((date, i) => ({
        date,
        dayOfWeek: new Date(date + 'T12:00:00').getDay(),
        code: d.daily.weathercode[i],
        max: Math.round(d.daily.temperature_2m_max[i]),
        min: Math.round(d.daily.temperature_2m_min[i]),
        rain: d.daily.precipitation_probability_max[i],
      }))
      setWeatherData(days)
    } catch(e) { setWeatherData([]) }
    finally { setWeatherLoading(false) }
  }

  async function loadFyChart(forceRefresh = false) {
    setFyLoading(true); setFyError(null)
    try {
      const url = forceRefresh ? '/api/fy-chart?refresh=true' : '/api/fy-chart'
      const r = await fetch(url)
      if (!r.ok) throw new Error('Failed to load FY chart')
      const d = await r.json()
      setFyData(d.months || [])
    } catch(e) { setFyError(e.message) }
    finally { setFyLoading(false) }
  }

  const features = [
    { icon: '📦', label: 'Reorder Planner',    desc: 'Stock levels, order quantities & supplier sheets', tab: 'reorder',    color: '#1e3a5f' },
    { icon: '📊', label: 'Sales Report',        desc: 'Period sales with category breakdown',             tab: 'sales',      color: '#7c3aed' },
    { icon: '📈', label: 'Quarterly Trends',    desc: 'Four-quarter category performance charts',         tab: 'trends',     color: '#0e7490' },
    { icon: '🏆', label: 'Best & Worst Sellers',desc: 'Top 10, slow sellers and items not moving',        tab: 'bestsellers',color: '#92400e' },
    { icon: '🏷️', label: 'Price List',          desc: 'Printable A4 price list for bar display',          tab: 'pricelist',  color: '#be185d' },
    { icon: '👥', label: 'Volunteer Roster',    desc: 'Volunteer scheduling (opens new tab)',             tab: 'roster',     color: '#065f46', external: true },
    { icon: '🗑️', label: 'Wastage Log',          desc: 'Record breakages, spoilage and expired stock',    tab: 'wastage',    color: '#92400e' },
    { icon: '❓', label: 'Help & Guide',         desc: 'Full documentation for all features',             tab: 'help',       color: '#475569' },
  ]

  const alertItems = items
    .filter(i => (i.priority === 'CRITICAL' || i.priority === 'LOW') && !dontOrderRe.test(i.notes || ''))
    .sort((a, b) => (a.priority === 'CRITICAL' ? 0 : 1) - (b.priority === 'CRITICAL' ? 0 : 1) || (a.onHand ?? 999) - (b.onHand ?? 999))

  const statCards = [
    { label: 'Critical',  value: critCount,    sub: 'below target',      color: '#dc2626', bg: '#fef2f2', action: () => onNav('reorder') },
    { label: 'Low Stock', value: lowCount,     sub: 'running low',       color: '#d97706', bg: '#fffbeb', action: () => onNav('reorder') },
    { label: 'To Order',  value: orderCount,   sub: 'need ordering',     color: '#2563eb', bg: '#eff6ff', action: () => onNav('reorder') },
    { label: 'On Order',  value: onOrderCount, sub: 'awaiting delivery', color: '#16a34a', bg: '#f0fdf4', action: () => onNav('reorder') },
    { label: 'Refreshed', value: refreshedAgo, sub: fromCache ? '📦 cached data' : '✅ live from Square', color: fromCache ? '#d97706' : '#475569', bg: fromCache ? '#fffbeb' : '#f8fafc', action: null },
  ]

  const dashTabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'alerts',   label: `⚠️ Stock Alerts${critCount + lowCount > 0 ? ` (${critCount + lowCount})` : ''}` },
  ]

  const fmt = v => '$' + Math.round(v).toLocaleString('en-AU')
  const tradingDays = [0, 3, 5] // Sun=0, Wed=3, Fri=5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Dashboard sub-tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 32px 0', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
        {dashTabs.map(t => (
          <button key={t.id} onClick={() => setDashTab(t.id)}
            style={{ padding: '7px 18px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', fontSize: 12, fontWeight: dashTab === t.id ? 700 : 400,
              background: dashTab === t.id ? '#fff' : 'transparent',
              color: dashTab === t.id ? '#0f172a' : '#64748b',
              borderBottom: dashTab === t.id ? '2px solid #fff' : '2px solid transparent',
              marginBottom: dashTab === t.id ? -2 : 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 32px', maxWidth: 1100, margin: '0 auto' }}>

          {/* Stat cards — always visible */}
          <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
            {statCards.map(({ label, value, sub, color, bg, action }) => (
              <div key={label} onClick={action || undefined}
                style={{ background: bg, borderRadius: 8, border: `1px solid ${color}33`, padding: '10px 14px', cursor: action ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (action) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.1, wordBreak: 'break-word' }}>{value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Overview tab — feature grid + FY chart + weather */}
          {dashTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Feature grid */}
              <div className="dash-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {features.map(f => (
                  <div key={f.tab}
                    onClick={() => f.external ? window.open('/roster', '_blank') : onNav(f.tab)}
                    style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{f.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}{f.external ? ' ↗' : ''}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, lineHeight: 1.4 }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* FY Sales chart + revenue target */}
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📊 FY Sales</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {fyData && <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed', fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(fyData.reduce((s, m) => s + m.revenue, 0))}</div>}
                    <button onClick={() => { setFyData(null); loadFyChart(true) }}
                      style={{ padding: '3px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>🔄</button>
                  </div>
                </div>
                {fyLoading
                  ? <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 12 }}>Loading sales...</div>
                  : fyError
                    ? <div style={{ color: '#dc2626', fontSize: 12 }}>⚠️ {fyError}</div>
                    : fyData && (() => {
                        const maxRev = Math.max(...fyData.map(m => m.revenue), 1)
                        const fyTotal = fyData.reduce((s, m) => s + m.revenue, 0)
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, paddingBottom: 20, paddingLeft: 40, position: 'relative' }}>
                              {[0.5, 1].map(pct => (
                                <div key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: 20 + pct * 94, pointerEvents: 'none' }}>
                                  <span style={{ fontSize: 8, color: '#94a3b8', position: 'absolute', left: 0, top: -5, whiteSpace: 'nowrap' }}>{fmt(maxRev * pct)}</span>
                                  <div style={{ position: 'absolute', left: 36, right: 0, borderTop: '1px dashed #f1f5f9' }} />
                                </div>
                              ))}
                              {fyData.map(m => {
                                const barH = Math.max(2, Math.round((m.revenue / maxRev) * 94))
                                return (
                                  <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                                    title={`${m.label}: ${fmt(m.revenue)}${m.partial ? ' (partial)' : ''}`}>
                                    <div style={{ width: '80%', height: barH, background: m.partial ? '#a78bfa' : '#7c3aed', borderRadius: '2px 2px 0 0', opacity: m.revenue === 0 ? 0.1 : 1 }} />
                                    <div style={{ fontSize: 8, color: m.partial ? '#7c3aed' : '#94a3b8', marginTop: 3 }}>{m.label}{m.partial ? '*' : ''}</div>
                                  </div>
                                )
                              })}
                            </div>
                            {revenueTarget && (() => {
                              const pct = Math.min(100, (fyTotal / revenueTarget) * 100)
                              const remaining = revenueTarget - fyTotal
                              const color = pct >= 100 ? '#16a34a' : pct >= 75 ? '#7c3aed' : pct >= 50 ? '#d97706' : '#dc2626'
                              return (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                                    <span style={{ color, fontWeight: 700 }}>Target: {pct.toFixed(1)}% of <span onClick={() => { setTargetInput(String(revenueTarget)); setEditingTarget(true) }} style={{ cursor: `pointer`, textDecoration: `underline dotted` }} title="Click to edit">{fmt(revenueTarget)}</span></span>
                                    <span style={{ color: remaining > 0 ? '#64748b' : '#16a34a' }}>{remaining > 0 ? `${fmt(remaining)} to go` : `🎉 Exceeded by ${fmt(-remaining)}`}</span>
                                  </div>
                                  <div style={{ background: '#e2e8f0', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
                                  </div>
                                </div>
                              )
                            })()}
                            {!revenueTarget && !editingTarget && (
                              <button onClick={() => { setTargetInput(''); setEditingTarget(true) }}
                                style={{ marginTop: 6, fontSize: 10, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer' }}>✎ Set revenue target</button>
                            )}
                            {editingTarget && (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                                <span style={{ fontSize: 11, color: '#64748b' }}>$</span>
                                <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                                  style={{ width: 80, fontSize: 11, border: '1px solid #7c3aed', borderRadius: 4, padding: '2px 6px' }}
                                  onKeyDown={e => e.key === 'Enter' && saveRevenueTarget(targetInput)} autoFocus />
                                <button onClick={() => saveRevenueTarget(targetInput)}
                                  style={{ fontSize: 10, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingTarget(false)}
                                  style={{ fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                              </div>
                            )}
                          </div>
                        )
                      })()
                }
              </div>

              {/* Weather */}
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>🌤️ Trading Weather</div>
                  <button onClick={() => { setWeatherData(null); loadWeather() }}
                    style={{ padding: '3px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>🔄</button>
                </div>
                {weatherLoading
                  ? <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading weather...</div>
                  : (() => {
                      const WMO = { 0:'☀️ Clear', 1:'🌤️ Mostly Clear', 2:'⛅ Partly Cloudy', 3:'☁️ Overcast', 45:'🌫️ Foggy', 48:'🌫️ Icy Fog', 51:'🌦️ Light Drizzle', 53:'🌦️ Drizzle', 55:'🌧️ Heavy Drizzle', 61:'🌧️ Light Rain', 63:'🌧️ Rain', 65:'🌧️ Heavy Rain', 80:'🌦️ Showers', 81:'🌧️ Showers', 82:'⛈️ Heavy Showers', 95:'⛈️ Thunderstorm', 96:'⛈️ Thunderstorm', 99:'⛈️ Thunderstorm' }
                      const dayName = d => new Date(d.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                      const days = weatherData || []
                      const rainColor = r => r >= 70 ? '#dc2626' : r >= 40 ? '#d97706' : '#16a34a'
                      if (days.length === 0) return <div style={{ color: '#94a3b8', fontSize: 12 }}>Weather data unavailable</div>
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                          {days.map(d => {
                            const isTrading = tradingDays.includes(d.dayOfWeek)
                            return (
                              <div key={d.date} style={{ background: isTrading ? '#eff6ff' : '#f8fafc', border: `1px solid ${isTrading ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>{new Date(d.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' })}</div>
                                  {isTrading && <span style={{ fontSize: 8, fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '0 3px', borderRadius: 2 }}>BAR</span>}
                                </div>
                                <div style={{ fontSize: 16, margin: '2px 0' }}>{(WMO[d.code] || '🌡️').split(' ')[0]}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{d.max}°<span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 9 }}>/{d.min}°</span></div>
                                <div style={{ fontSize: 9, color: rainColor(d.rain), fontWeight: 600, marginTop: 2 }}>💧{d.rain}%</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()
                }
              </div>

            </div>
          )}

          {/* Stock Alerts tab */}
          {dashTab === 'alerts' && (
            alertItems.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#16a34a', fontSize: 14 }}>✅ All items are at target stock levels</div>
              : <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Status','Item','Category','Supplier','On Hand','Target','To Order'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Status' ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alertItems.map((item, i) => {
                        const isCrit = item.priority === 'CRITICAL'
                        const isOnOrder = !!orderedItems[item.name]
                        return (
                          <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: isCrit ? '#fee2e2' : '#fef9c3', color: isCrit ? '#991b1b' : '#854d0e' }}>{isCrit ? 'CRITICAL' : 'LOW'}</span>
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>
                              {item.name}
                              {isOnOrder && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#16a34a' }}>🛒 On Order</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.category}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.supplier || '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: isCrit ? '#dc2626' : '#d97706' }}>{item.onHand ?? '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#64748b' }}>{item.targetStock ?? '—'}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: isOnOrder ? '#16a34a' : '#2563eb', fontWeight: item.orderQty > 0 ? 700 : 400 }}>
                              {isOnOrder ? '✓ Ordered' : item.orderQty > 0 ? item.orderQty : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
                    <button onClick={() => onNav('reorder')} style={{ padding: '6px 14px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      📦 Open Reorder Planner
                    </button>
                  </div>
                </div>
          )}


          <div style={{ marginTop: 14, fontSize: 10, color: '#cbd5e1', textAlign: 'center' }}>
            Paynter Bar Hub · GemLife Palmwoods · {totalItems} items tracked
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── BEST & WORST SELLERS VIEW ───────────────────────────────────────────────
function BestSellersView({ items, salesData, loading, error, daysBack = 90 }) {
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

  // Slow sellers: has stock, sold in period but in bottom 25% by units
  const itemsWithSales = salesData
    ? withData
        .filter(i => (i.onHand || 0) > 0 && (salesMap[i.name] || 0) > 0)
        .sort((a, b) => (salesMap[a.name] || 0) - (salesMap[b.name] || 0))
    : []
  const slowCutoff = Math.ceil(itemsWithSales.length * 0.25)
  const slowSellers = itemsWithSales.slice(0, slowCutoff)

  // Not selling at all: has stock, zero sales in period
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
      Loading {daysBack} days of sales data from Square...
    </div>
  )

  if (error) return <div style={{ ...styles.errorBox, margin: 24 }}><strong>Error:</strong> {error}</div>

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', alignSelf: 'center', fontWeight: 600 }}>
          📅 {daysBack}-day period
        </div>
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
function PriceListView({ items, settings, readOnly, saving, onSave, onPrint, publicMode = false }) {
  const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
  const [showOutOfStock, setShowOutOfStock] = useState(false)

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
    const isBottleOnly = item.bottleOnly || /minchinbury|curtis legion/i.test(item.name)
    if (isBottleOnly) return item.sellPriceBottle || item.squareSellPriceBottle
                           || (item.variations || []).find(v => /bottle|regular/i.test(v.name) && !/glass/i.test(v.name))?.price
                           || null
    if (item.sellPrice != null)       return item.sellPrice
    if (item.squareSellPrice != null) return item.squareSellPrice
    return null
  }

  function getVariations(item) {
    const isBottleOnly = item.bottleOnly || /minchinbury|curtis legion/i.test(item.name)
    if (isBottleOnly) return null
    const vars = (item.variations || []).filter(v => v.price != null)
    if (vars.length > 1) return normaliseVariations(vars)
    return null
  }

function isHidden(item) {
    return (settings[item.name] || {}).hidden === true
  }

  const visibleCount = items.filter(i => !isHidden(i)).length

  // Public mode - strip everything, show only category price cards
  if (publicMode) return (
    <div style={{ padding: '12px 16px', fontFamily: 'Arial, sans-serif', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ background: '#1e3a5f', color: '#fff', borderRadius: 8, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>🍺 Paynter Bar</div>
          <div style={{ fontSize: 11, color: '#bfdbfe', marginTop: 2 }}>GemLife Palmwoods · Current Prices</div>
        </div>
        <div style={{ fontSize: 10, color: '#bfdbfe', textAlign: 'right' }}>Prices may vary.<br/>See bar staff for details.</div>
      </div>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', color: '#fff', padding: '6px 14px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {grouped[cat].filter(item => !isHidden(item) && (item.onHand || 0) > 0).map((item, idx) => {
                const price   = getPrice(item)
                const vars    = getVariations(item)
                return (
                  <tr key={item.name} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 14px', fontSize: 14, color: '#0f172a' }}>{item.name}</td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
                      {vars ? (
                        <div>{vars.map(v => (
                          <div key={v.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                            <span style={{ color: '#64748b', fontFamily: 'Arial', fontWeight: 400 }}>{v.name}</span>
                            <span>${Number(v.price).toFixed(2)}</span>
                          </div>
                        ))}</div>
                      ) : price != null ? `$${Number(price).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )

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
            onClick={() => setShowOutOfStock(v => !v)}
            style={{ background: showOutOfStock ? '#f1f5f9' : '#fff', color: showOutOfStock ? '#374151' : '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            {showOutOfStock ? '👁 Showing Out of Stock' : '🚫 Hiding Out of Stock'}
          </button>
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
                  <th style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Alc%</th>
                  <th style={{ padding: '7px 14px', textAlign: 'center', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Std Drinks</th>
                  <th style={{ padding: '7px 14px', textAlign: 'right', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Price</th>

                </tr>
              </thead>
              <tbody>
                {grouped[cat].filter(item => showOutOfStock || (item.onHand || 0) > 0 || isHidden(item)).map((item, idx) => {
                  const hidden  = isHidden(item)
                  const price   = getPrice(item)
                  const rowBg   = idx % 2 === 0 ? '#fff' : '#f8fafc'

                  return (
                    <tr key={item.name} style={{ background: rowBg }}>
                      {/* Display name */}
                      <td style={{ padding: '7px 14px', fontSize: 13, color: '#0f172a' }}>
                        {item.name}
                      </td>

                      {/* Alc% — editable inline */}
                      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                        {readOnly
                          ? <span style={{ fontSize: 12, color: '#64748b' }}>{item.alcoholPct ? `${item.alcoholPct}%` : '—'}</span>
                          : <input
                              type="text" placeholder="—"
                              value={(settings[item.name] || {}).alcoholPct ?? item.alcoholPct ?? ''}
                              onChange={e => onSave(item.name, 'alcoholPct', e.target.value, true)}
                              style={{ width: 52, textAlign: 'center', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 6px', fontFamily: 'monospace', background: '#f8fafc' }}
                            />
                        }
                      </td>

                      {/* Standard drinks */}
                      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                        {(() => {
                          const abv = parseFloat(item.alcoholPct)
                          if (!abv) return <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                          const spiritCats = ['Spirits','Fortified & Liqueurs']
                          const wineCats = ['White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs']
                          const vars = getVariations(item)
                          if (vars) {
                            return (
                              <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
                                {vars.map(v => {
                                  const ml = v.name === 'Glass' ? 150 : v.name === 'Bottle' ? 750 : null
                                  const sd = ml ? (Math.ceil(abv / 100 * ml * 0.789 / 10 * 10) / 10).toFixed(1) : null
                                  return <tr key={v.name}><td style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '1px 0' }}>{sd ?? '—'}</td></tr>
                                })}
                              </table>
                            )
                          }
                          let ml = null
                          if (spiritCats.includes(item.category)) ml = item.nipML || 30
                          else if (wineCats.includes(item.category)) ml = 150
                          else ml = item.containerML || 375  // beer/cider — use stored container size
                          const sd = (Math.ceil(abv / 100 * ml * 0.789 / 10 * 10) / 10).toFixed(1)
                          return <span style={{ fontSize: 12, color: '#0f172a', fontFamily: 'monospace' }}>{sd}</span>
                        })()}
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
        setForm({ noteDate: '', itemName: '', comment: '', author: '' })
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
              <input type='text' value={form.author} onChange={e => ef('author', e.target.value)} placeholder='Your name'
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <button onClick={saveNote} disabled={saving || !form.comment.trim()}
              style={{ background: saving || !form.comment.trim() ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: saving || !form.comment.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? 'Saving...' : 'Save Note'}
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
                      {n.author && <span style={{ fontSize: 11, color: '#94a3b8' }}>- {n.author}</span>}
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
        { q: 'Print Order List', a: 'Click 🖨️ Print Order List and choose a supplier to generate a formatted A4 order sheet. Use this list when creating the Purchase Order manually in Square Dashboard.' },
      ]
    },
    {
      icon: '📬',
      title: 'On Order Tracking — Removed',
      items: []
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
        { q: 'Showing and hiding items', a: 'Click the Shown/Hidden toggle next to any item to include or exclude it from the printed price list. Items with zero stock are hidden by default — use the Hide/Show Out of Stock toggle in the toolbar to reveal them.' },
        { q: 'Prices', a: 'All prices come from Square. To change a price, update it in Square and click Refresh. Wine items with both a Glass and Bottle price show both, with Glass listed first.' },
        { q: 'Printing', a: 'Click 🖨️ Print Price List to open a two-page A4 portrait document in a two-column card layout. The Paynter Bar platypus logo appears in the navy header. In the print dialog set paper to A4, margins to None and scale to 100%.' },
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
        { q: 'Opening', a: 'Click 👥 Roster in the sidebar or top-right header. The roster is built into the Hub and opens at /roster — no separate app or login needed.' },
        { q: 'Bar display screen', a: 'The tablet display at /roster/display shows the current bar session, who is on duty, and sign-in status — it updates live. The Specials display at /roster/display/specials rotates through tonight\'s specials.' },
        { q: 'Duty manager', a: 'Duty managers can self-assign to a shift directly from the roster. Volunteers sign in via the bar display screen.' },
        { q: 'Wix iframe', a: 'The Roster is also embedded in the GemLife Palmwoods Wix community site via an iframe pointing to the Hub URL.' },
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
      icon: '⭐',
      title: 'Specials',
      items: [
        { q: 'Opening', a: 'Click ⭐ Specials in the sidebar. Manage tonight\u2019s special offers \u2014 add items with a name, price, optional description and a product image from the Square catalogue.' },
        { q: 'Adding a special', a: 'Click + Add Special, enter the name and price, optionally a description, then pick an image from your Square catalogue. Click Save to publish.' },
        { q: 'Display screen', a: 'Active specials rotate automatically on the bar tablet at /roster/display/specials \u2014 full-screen cards with product image, name and price on a dark background.' },
        { q: 'Print sheet', a: 'Click 🖨️ Print Sheet to open a formatted A4 printout of active specials \u2014 white background with floating product images, navy header and footer with Print and Hide buttons.' },
        { q: 'Editing & removing', a: 'Use the ✏️ edit button to update a special or ✕ to remove it. Changes appear on the display screen immediately.' },
      ]
    },
    {
      icon: '📅',
      title: 'SOH History',
      items: [
        { q: 'Opening', a: 'Click 📅 SOH History in the sidebar. Shows all saved monthly stock-on-hand snapshots with date, item count and total inventory value.' },
        { q: 'Automatic snapshots', a: 'A snapshot is taken automatically at 2am AEST on the 1st of each month. No manual action required.' },
        { q: 'Manual snapshot', a: 'Click 📸 Snapshot Now to capture current SOH data immediately \u2014 useful before or after a stocktake or to capture a mid-month position.' },
        { q: 'Excel export', a: 'Click 📊 Excel on any snapshot row to download a formatted spreadsheet of that snapshot with category subtotals and grand total.' },
        { q: 'Tracking trends', a: 'Each snapshot shows the date, item count and total inventory value. Use these to monitor inventory value trends from month to month.' },
      ]
    },
    {
      icon: '👁',
      title: 'Access Levels',
      items: [
        { q: 'Committee PIN (management)', a: 'Full access to all features \u2014 editing item settings, categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks, price list visibility, wastage editing, and all exports.' },
        { q: 'Read-only PIN (homeowners)', a: 'View-only access. All data is visible \u2014 stock levels, order quantities, sales reports, trends, price list, SOH and sales exports \u2014 but nothing can be edited. A READ ONLY badge appears in the header.' },
        { q: 'Pricing visibility', a: 'Buy prices and the $ Pricing view are only visible to committee members \u2014 hidden entirely for read-only users to keep cost prices confidential.' },
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
        {[['month','This Month'],['lastmonth','Last Month'],['3months','Last 3 Months'],['financialYear','Financial Year (May – Apr)'],['day','Single Day'],['custom','Custom Range']].map(([val, label]) => (
          <button key={val}
            style={{ ...styles.tab, ...(period === val ? styles.tabActive : {}) }}
            onClick={() => { setPeriod(val); if (val !== 'custom' && val !== 'day') onLoad(val, custom) }}>
            {label}
          </button>
        ))}
        {period === 'day' && (
          <input type="date" value={custom.day || ''} onChange={e => { const c2 = {...custom, day: e.target.value}; setCustom(c2); if (e.target.value) onLoad('day', c2) }}
            style={{ ...styles.supplierInput, width: 150 }} />
        )}
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
                    <th style={{ ...styles.th, display: showDetails ? '' : 'none' }}>Category</th>
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
  const [syncResult, setSyncResult]         = useState(null)
  const [autoSyncPrompt, setAutoSyncPrompt] = useState(false)
  const [autoSyncDismissed, setAutoSyncDismissed] = useState(false)
  const [showHistory, setShowHistory]       = useState(false)
  const [history, setHistory]               = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const d = await fetch('/api/stocktake-history').then(r => r.json())
      setHistory(d.history || [])
    } catch(e) { setHistory([]) }
    finally { setHistoryLoading(false) }
  }

  const exportHistoryToExcel = () => {
    if (!history?.length) return
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
    script.onload = () => {
      const XLSX  = window.XLSX
      const NAVY  = '0F172A', TEAL = '0E7490', PURPLE = '7C3AED'
      const WHITE = 'FFFFFF', LGREY = 'F1F5F9', LPUR = 'EDE9FE'

      const cell  = (v, s) => ({ v: v ?? '', s, t: typeof v === 'number' ? 'n' : 's' })
      const hStyle = {
        font: { bold: true, color: { rgb: WHITE }, sz: 10 },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: TEAL } } }
      }
      const hStyleL = { ...hStyle, alignment: { horizontal: 'left' } }
      const dayStyle = {
        font: { bold: true, sz: 11, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: PURPLE } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
      const syncStyle = {
        font: { bold: true, sz: 10, color: { rgb: NAVY } },
        fill: { fgColor: { rgb: LPUR } },
        alignment: { horizontal: 'left' },
      }

      const rows = []
      const merges = []

      // Title block
      rows.push([cell('Paynter Bar — Stocktake Sync History', { font: { bold: true, sz: 16, color: { rgb: NAVY } } }), ...Array(4).fill(cell(''))])
      rows.push([cell(`Exported: ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' })}`, { font: { sz: 10, color: { rgb: '64748B' } } }), ...Array(4).fill(cell(''))])
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } })
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } })
      rows.push([])

      // Column headers
      rows.push([
        cell('Item',            hStyleL),
        cell('Category',        hStyleL),
        cell('Square Qty Set',  hStyle),
        cell('Conversion',      hStyle),
        cell('Time',            hStyle),
      ])

      // Data rows grouped by day then sync
      for (const day of history) {
        const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-AU', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
        const dayRowIdx = rows.length
        rows.push([
          cell(`${dayLabel}  (${day.snapshots.length} sync${day.snapshots.length !== 1 ? 's' : ''})`, dayStyle),
          cell('', dayStyle), cell('', dayStyle), cell('', dayStyle), cell('', dayStyle),
        ])
        merges.push({ s: { r: dayRowIdx, c: 0 }, e: { r: dayRowIdx, c: 4 } })

        for (const snap of day.snapshots) {
          const timeStr = new Date(snap.ts).toLocaleTimeString('en-AU', {
            timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit'
          })
          const syncLabel = `Sync at ${timeStr}  —  ${snap.synced} synced${snap.skipped ? `, ${snap.skipped} skipped` : ''}${snap.failed ? `, ${snap.failed} failed` : ''}`
          const syncRowIdx = rows.length
          rows.push([
            cell(syncLabel, syncStyle),
            cell('', syncStyle), cell('', syncStyle), cell('', syncStyle), cell('', syncStyle),
          ])
          merges.push({ s: { r: syncRowIdx, c: 0 }, e: { r: syncRowIdx, c: 4 } })

          // Item rows
          const snapItems = snap.items || []
          snapItems.forEach((item, idx) => {
            const shade = idx % 2 === 0 ? WHITE : 'F8FAFC'
            const s  = { fill: { fgColor: { rgb: shade } }, font: { sz: 10 } }
            const sc = { ...s, alignment: { horizontal: 'center' } }
            const cat = item.category || ''
            rows.push([
              cell(item.name,  s),
              cell(cat,        { ...s, font: { sz: 10, color: { rgb: '64748B' } } }),
              cell(item.sqQty, { ...sc, font: { sz: 10, bold: true, color: { rgb: '16A34A' } } }),
              cell(item.note || '1:1', { ...s, font: { sz: 9, color: { rgb: '64748B' } } }),
              cell(timeStr,    { ...sc, font: { sz: 10, color: { rgb: '94A3B8' } } }),
            ])
          })
        }
        rows.push([]) // spacer between days
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 14 }, { wch: 36 }, { wch: 10 }]
      ws['!rows'] = rows.map((_, i) => i === 0 ? { hpt: 26 } : { hpt: 18 })
      ws['!merges'] = merges
      // ── Sheet 2: Flat filterable data ──────────────────────────────────
      const flatRows = []
      const fhStyle = {
        font: { bold: true, color: { rgb: WHITE }, sz: 10 },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: TEAL } } }
      }
      const fhStyleL = { ...fhStyle, alignment: { horizontal: 'left' } }
      flatRows.push([
        cell('Date',           fhStyleL),
        cell('Time',           fhStyle),
        cell('Item',           fhStyleL),
        cell('Category',       fhStyleL),
        cell('Square Qty Set', fhStyle),
        cell('Conversion',     fhStyleL),
        cell('Synced',         fhStyle),
        cell('Skipped',        fhStyle),
        cell('Failed',         fhStyle),
      ])

      for (const day of history) {
        const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en-AU', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        })
        for (const snap of day.snapshots) {
          const timeStr = new Date(snap.ts).toLocaleTimeString('en-AU', {
            timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit'
          })
          const snapItems = snap.items || []
          if (snapItems.length === 0) {
            // Row for syncs with no items (all skipped)
            flatRows.push([
              cell(dateLabel, {}), cell(timeStr, {}),
              cell('(no items synced)', { font: { color: { rgb: '94A3B8' }, italic: true } }),
              cell('', {}), cell('', {}), cell('', {}),
              cell(snap.synced,  {}), cell(snap.skipped, {}), cell(snap.failed || 0, {}),
            ])
          } else {
            snapItems.forEach((item, idx) => {
              const shade = idx % 2 === 0 ? WHITE : 'F8FAFC'
              const s  = { fill: { fgColor: { rgb: shade } }, font: { sz: 10 } }
              const sc = { ...s, alignment: { horizontal: 'center' } }
              flatRows.push([
                cell(dateLabel,      s),
                cell(timeStr,        sc),
                cell(item.name,      s),
                cell(item.category || '', { ...s, font: { sz: 10, color: { rgb: '64748B' } } }),
                cell(item.sqQty,     { ...sc, font: { sz: 10, bold: true, color: { rgb: '16A34A' } } }),
                cell(item.note || '1:1', { ...s, font: { sz: 9, color: { rgb: '64748B' } } }),
                cell(idx === 0 ? snap.synced  : '', sc),
                cell(idx === 0 ? snap.skipped : '', sc),
                cell(idx === 0 ? (snap.failed || 0) : '', sc),
              ])
            })
          }
        }
      }

      const ws2 = XLSX.utils.aoa_to_sheet(flatRows)
      ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 36 }, { wch: 20 }, { wch: 14 }, { wch: 36 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]
      ws2['!rows'] = flatRows.map((_, i) => i === 0 ? { hpt: 22 } : { hpt: 18 })
      // AutoFilter on header row covering all columns

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws,  'Summary')
      XLSX.utils.book_append_sheet(wb, ws2, 'Data')
      XLSX.writeFile(wb, `Paynter-Bar-Stocktake-History-${new Date().toISOString().split('T')[0]}.xlsx`)
    }
    document.head.appendChild(script)
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

  const openSyncModal = () => { setShowSyncModal(true); setAutoSyncPrompt(false); setAutoSyncDismissed(true); loadSyncPreview() }

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
      if (d.ok) { loadSyncPreview(); if (showHistory) loadHistory() }
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

      {/* History panel */}
      {showHistory && (
        <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📋 Stocktake Sync History</span>
            {history?.length > 0 && (
              <button onClick={exportHistoryToExcel}
                style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                📊 Export Excel
              </button>
            )}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {new Date(snap.ts).toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                      ✓ {snap.synced} synced{snap.skipped > 0 ? ` · ${snap.skipped} skipped` : ''}{snap.failed > 0 ? ` · ${snap.failed} failed` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {snap.items?.map((item, ii) => (
                      <span key={ii} style={{ fontSize: 10, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>
                        {item.name}: {item.sqQty}{item.note ? ` (${item.note})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

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
                  {syncResult.ok ? '✓ ' : '✕ '}{syncResult.message || syncResult.error}
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
                                      ? <span style={{ fontSize: 10, background: '#ede9fe', color: '#6d28d9', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Ready</span>
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
          </div>
        </div>
      )}
    </div>
  )
}


// === SPECIALS VIEW ============================================================
function SpecialsView({ items }) {
  const [specials, setSpecials] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', price_override: '', description: '', square_item_id: '', square_image_id: '', _imageUrl: '', active: true, display_order: 0 })
  const [itemSearch, setItemSearch] = useState('')
  const [catalogImages, setCatalogImages] = useState([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [imageSearch, setImageSearch] = useState('')

  useEffect(() => { loadSpecials() }, [])

  async function loadSpecials() {
    setLoading(true)
    try {
      const r = await fetch('/api/specials')
      const d = await r.json()
      setSpecials(d.specials || [])
    } finally { setLoading(false) }
  }

  async function loadCatalogImages() {
    if (catalogImages.length > 0) { setShowImagePicker(true); return }
    setLoadingImages(true)
    try {
      const r = await fetch('/api/catalog-images')
      const d = await r.json()
      setCatalogImages(d.items || [])
      setShowImagePicker(true)
    } finally { setLoadingImages(false) }
  }

  async function saveSpecial() {
    setSaving(true)
    try {
      const { _imageUrl, ...toSave } = form
      await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', special: { ...toSave, display_order: specials.length } }) })
      setForm({ name: '', price_override: '', description: '', square_item_id: '', square_image_id: '', _imageUrl: '', active: true, display_order: 0 })
      setShowAdd(false)
      setItemSearch('')
      setShowImagePicker(false)
      await loadSpecials()
    } finally { setSaving(false) }
  }

  async function deleteSpecial(id) {
    if (!confirm('Remove this special?')) return
    await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', special: { id } }) })
    await loadSpecials()
  }

  async function toggleActive(special) {
    await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', special: { ...special, active: !special.active } }) })
    await loadSpecials()
  }

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 8)
  const filteredImages = catalogImages.filter(i => i.name.toLowerCase().includes(imageSearch.toLowerCase()))

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>⭐ Specials Display</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Manage what shows on the bar display at{' '}
            <a href="/roster/display/specials" target="_blank" style={{ color: '#0e7490' }}>/roster/display/specials</a>
          </div>
        </div>
          <button onClick={() => {
            const active = specials.filter(s => s.active)
            if (!active.length) { alert('No active specials to print'); return }
            const cols = active.length === 1 ? '1fr' : active.length <= 2 ? '1fr 1fr' : '1fr 1fr 1fr'
            const nameSz = active.length <= 2 ? 16 : active.length <= 4 ? 12 : 10
            const priceSz = active.length <= 2 ? 28 : active.length <= 4 ? 22 : 18
            const dateStr = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const rows = active.map(s => {
              const img = s.image_url ? '<img src="' + s.image_url + '" style="width:100%;height:100%;object-fit:contain;padding:4mm;background:#fff" />' : '<div style="font-size:48pt;text-align:center">🍺</div>'
              const price = s.price_override ? '\$' + parseFloat(String(s.price_override).replace('\$','')).toFixed(2) : ''
              const desc = s.description ? '<div style="font-size:9pt;color:#94a3b8;margin-bottom:2mm">' + s.description + '</div>' : ''
              return '<div style="background:#fff;border-radius:4mm;overflow:hidden;border:1px solid #e2e8f0;display:flex;flex-direction:column"><div style="width:100%;aspect-ratio:1;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center">' + img + '</div><div style="padding:4mm;display:flex;flex-direction:column"><div style="font-size:' + nameSz + 'pt;font-weight:800;color:#1e3a5f;line-height:1.2;margin-bottom:2mm;min-height:' + (nameSz * 2.8).toFixed(0) + 'pt">' + s.name + '</div>' + desc + '<div style="font-size:' + priceSz + 'pt;font-weight:900;color:#c8a84b">' + price + '</div></div></div>'
            }).join("")
            const css = '@page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;width:210mm;height:297mm;overflow:hidden;background:#fff}.page{width:210mm;height:297mm;display:flex;flex-direction:column}.hdr{background:#1e3a5f;padding:12mm 14mm 8mm;text-align:center;border-bottom:3px solid #c8a84b}.grid{flex:1;display:grid;grid-template-columns:' + cols + ';gap:6mm;padding:8mm;align-content:center}.ftr{background:#1e3a5f;padding:5mm 14mm;text-align:center;border-top:2px solid #c8a84b}'
            const hdrHtml = '<div class="hdr"><div style="font-size:11pt;color:#94a3b8;letter-spacing:.15em;text-transform:uppercase;margin-bottom:3mm">GemLife Palmwoods</div><div style="font-size:28pt;font-weight:900;color:#c8a84b;text-transform:uppercase">Tonight&#39;s Specials</div><div style="font-size:10pt;color:#94a3b8;margin-top:3mm">' + dateStr + '</div></div>'
            const ftrHtml = '<div class="ftr"><div style="font-size:11pt;color:#c8a84b;font-weight:700;letter-spacing:.1em">Paynter Bar</div><div style="font-size:9pt;color:#64748b">See bar staff for details</div></div>'
            const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Specials</title><style>' + css + '</style></head><body><div class="page">' + hdrHtml + '<div class="grid">' + rows + '</div>' + ftrHtml + '</div><div style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px"><button onclick="window.print()" style="background:#1e3a5f;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer">Print</button><button onclick="this.parentElement.style.display=&quot;none&quot;" style="background:#e2e8f0;color:#374151;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer">Hide</button></div></body></html>'
            const w = window.open('', '_blank')
            w.document.write(html)
            w.document.close()
          }} style={{ background: '#c8a84b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Print Sheet
          </button>
        <button onClick={() => { setShowAdd(s => !s); setImageSearch('') }}
          style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Add Special
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>New Special</div>

          {/* Item search */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search Square Items</label>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Type to search..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            {itemSearch && filteredItems.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', marginTop: 4 }}>
                {filteredItems.map(item => (
                  <div key={item.name} onClick={() => {
                    setForm(f => ({ ...f, name: item.name, price_override: item.sellPrice ? '$' + item.sellPrice : '', square_item_id: item.sku || '' }))
                    setItemSearch('')
                  }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name}</span>
                    <span style={{ color: '#c8a84b', fontWeight: 700 }}>${item.sellPrice}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Display Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bombay Sapphire Gin"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Price</label>
              <input value={form.price_override} onChange={e => setForm(f => ({ ...f, price_override: e.target.value }))} placeholder="e.g. $3.00"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Description (optional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 30ml nip with mixer"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          {/* Image picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Product Image</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form._imageUrl
                ? <img src={form._imageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid #c8a84b' }} />
                : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍾</div>
              }
              <button onClick={loadCatalogImages} disabled={loadingImages}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {loadingImages ? 'Loading...' : form._imageUrl ? '🔄 Change Image' : '📷 Pick from Square'}
              </button>
              {form._imageUrl && <button onClick={() => setForm(f => ({ ...f, square_image_id: '', _imageUrl: '' }))}
                style={{ padding: '8px 12px', background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>✕</button>}
            </div>

            {/* Image grid picker */}
            {showImagePicker && (
              <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input value={imageSearch} onChange={e => setImageSearch(e.target.value)} placeholder="Search images..."
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, marginRight: 8 }} />
                  <button onClick={() => setShowImagePicker(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {filteredImages.map(img => (
                    <div key={img.imageId} onClick={() => { setForm(f => ({ ...f, square_image_id: img.imageId, _imageUrl: img.url })); setShowImagePicker(false) }}
                      style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: form.square_image_id === img.imageId ? '2px solid #c8a84b' : '2px solid transparent' }}>
                      <img src={img.url} alt={img.name} title={img.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
                      <div style={{ fontSize: 9, color: '#64748b', padding: '2px 3px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{img.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowAdd(false); setItemSearch(''); setShowImagePicker(false) }}
              style={{ flex: 1, padding: '9px 0', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveSpecial} disabled={saving || !form.name}
              style={{ flex: 2, padding: '9px 0', background: saving || !form.name ? '#94a3b8' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save Special'}
            </button>
          </div>
        </div>
      )}

      {/* Specials list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
      ) : specials.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
          <div style={{ fontSize: 15 }}>No specials yet — click Add Special to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {specials.map((s, idx) => (
            <div key={s.id} style={{ background: s.active ? '#fff' : '#f8fafc', border: `1px solid ${s.active ? '#e2e8f0' : '#f1f5f9'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.image_url ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🍾</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.active ? '#0f172a' : '#94a3b8' }}>{s.name}</div>
                {s.description && <div style={{ fontSize: 12, color: '#64748b' }}>{s.description}</div>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c8a84b', minWidth: 60, textAlign: 'right' }}>{s.price_override}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggleActive(s)}
                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, background: s.active ? '#f0fdf4' : '#fef9c3', color: s.active ? '#16a34a' : '#92400e', border: `1px solid ${s.active ? '#86efac' : '#fde047'}`, borderRadius: 6, cursor: 'pointer' }}>
                  {s.active ? 'Live' : 'Off'}
                </button>
                <button onClick={() => deleteSpecial(s.id)}
                  style={{ padding: '4px 10px', fontSize: 11, background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {specials.length > 0 && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
          💡 Display rotates every 6 seconds — <a href="/roster/display/specials" target="_blank" style={{ color: '#0369a1', fontWeight: 700 }}>Open display page ↗</a>
        </div>
      )}
    </div>
  )
}

// === SOH HISTORY VIEW =========================================================
function SohHistoryView() {
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
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
    document.head.appendChild(script)
    await new Promise(r => { script.onload = r })
    const XLSX = window.XLSX

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

    // Title
    rows.push([{ v: `Paynter Bar — Stock on Hand as at ${reportDateStr}`, s: { font: { bold: true, sz: 14, color: { rgb: NAVY } } } }, ...Array(6).fill(empty())])
    rows.push([{ v: `GemLife Palmwoods  ·  ${report.items_count} items  ·  Total Inventory Value: $${Number(report.total_value).toFixed(2)}`, s: { font: { sz: 10, color: { rgb: '64748B' }, italic: true } } }, ...Array(6).fill(empty())])
    rows.push([{ v: `Generated: ${new Date(report.generated_at).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} AEST`, s: { font: { sz: 9, color: { rgb: '94A3B8' } } } }, ...Array(6).fill(empty())])
    rows.push(Array(7).fill(empty()))
    rows.push([hdr('Item'), hdr('Category'), hdr('Supplier'), hdr('On Hand', true), hdr('Wkly Avg', true), hdr('Buy Price', true), hdr('Total Value', true)])

    // Group by category
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

    // Grand total
    rows.push([
      { v: 'GRAND TOTAL', s: { font: { bold: true, sz: 12, color: { rgb: WHITE } }, fill: { fgColor: { rgb: NAVY } } } },
      ...Array(5).fill({ v: '', s: { fill: { fgColor: { rgb: NAVY } } } }),
      { v: Number(report.total_value), s: { font: { bold: true, sz: 12, color: { rgb: GOLD } }, fill: { fgColor: { rgb: NAVY } }, alignment: { horizontal: 'right' }, numFmt: '$#,##0.00' } }
    ])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }]
    ws['!rows'] = [{ hpt: 28 }, { hpt: 16 }, { hpt: 14 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'SOH Report')
    XLSX.writeFile(wb, `SOH_${report.report_date}.xlsx`)
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
