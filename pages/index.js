import { useState, useEffect, useCallback, useRef } from 'react'
import Head from 'next/head'
import { CATEGORIES, calculateItem } from '../lib/calculations'
import { styles } from '../lib/barStyles'
import { DEFAULT_SUPPLIERS, PRIORITY_COLORS, SUPPLIER_COLORS, CATEGORY_ORDER_LIST } from '../lib/constants'
import WastageView from '../components/bar/views/WastageView'
import NotesView from '../components/bar/views/NotesView'
import SpecialsView from '../components/bar/views/SpecialsView'
import StocktakeView from '../components/bar/views/StocktakeView'
import SohHistoryView from '../components/bar/views/SohHistoryView'
import MonthlyReportView from '../components/bar/views/MonthlyReportView'
import DashboardView from '../components/bar/views/DashboardView'
import BarcodeSheetView from '../components/bar/views/BarcodeSheetView'
import PriceListView from '../components/bar/views/PriceListView'
import { xlsAOAtoWS } from '../lib/excel/xlsAOAtoWS'
import { xlsDownload } from '../lib/excel/xlsDownload'
import { loadExcelJS } from '../lib/excel/loadExcelJS'
import HelpTab from '../components/bar/views/HelpTab'
import SalesView from '../components/bar/views/SalesView'
import EditSelect from '../components/bar/EditSelect'
import EditNumber from '../components/bar/EditNumber'
import EditText from '../components/bar/EditText'
import { getSpecialPrice } from '../lib/utils/getSpecialPrice'




// ── ExcelJS helpers — module-level so available to all components ─────────



// Sidebar colour themes. Module-scoped so both the sidebar and the
// Settings > Appearance panel can read them.
const THEMES = {
  navy:     { name:'Navy',     sbBg:'#0f172a', sbBorder:'#1e293b', sbActive:'#1e3a5f', accent:'#0e7490', navText:'#f1f5f9', navMuted:'#64748b', navItem:'#94a3b8', brandBg:'#0e7490' },
  midnight: { name:'Midnight', sbBg:'#09090b', sbBorder:'#27272a', sbActive:'#3b0764', accent:'#7c3aed', navText:'#fafafa',  navMuted:'#71717a', navItem:'#a1a1aa',  brandBg:'#7c3aed' },
  forest:   { name:'Forest',   sbBg:'#0f1f16', sbBorder:'#1c3326', sbActive:'#1a3828', accent:'#16a34a', navText:'#f0fdf4',  navMuted:'#4d7c60', navItem:'#86efac',  brandBg:'#16a34a' },
  slate:    { name:'Slate',    sbBg:'#1e2a3a', sbBorder:'#2d3f55', sbActive:'#2d4a6e', accent:'#3b82f6', navText:'#f1f5f9',  navMuted:'#64748b', navItem:'#93c5fd',  brandBg:'#3b82f6' },
  light:    { name:'Light',    sbBg:'#f8fafc', sbBorder:'#e2e8f0', sbActive:'#dbeafe', accent:'#1e3a5f', navText:'#0f172a',  navMuted:'#94a3b8', navItem:'#475569',  brandBg:'#1e3a5f' },
}

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
  const [showDetails, setShowDetails]   = useState(false)

  const [saving, setSaving]             = useState({})
  const [rundownItems, setRundownItems]   = useState({})
  const [documents, setDocuments]         = useState([])
  const [docsLoading, setDocsLoading]     = useState(false)
  const [lastOrderSummary, setLastOrderSummary] = useState(null)
  const [docSupFilter, setDocSupFilter]   = useState('all')
  const [docSearch, setDocSearch]         = useState('')
  const [docStatusFilter, setDocStatusFilter] = useState('all')
  const [docInvoiceUploading, setDocInvoiceUploading] = useState({})
  const [docEmailSending,     setDocEmailSending]     = useState({})
  const [docEmailSent,        setDocEmailSent]        = useState({})
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSubTab, setSettingsSubTab] = useState('suppliers')
  const [oneDriveStatus, setOneDriveStatus] = useState(null) // null=unchecked, {ok,name,email,error}
  const [settingsTargetWeeks, setSettingsTargetWeeks] = useState(null)
  const [settingsAuditData, setSettingsAuditData] = useState(null)
  const [phSubTab, setPhSubTab] = useState('import')
  const [pricingSubTab, setPricingSubTab] = useState('avgprices')
  const [showPriceDetail, setShowPriceDetail] = useState(false)
  const [phPdf, setPhPdf] = useState(null)
  const [phExtracting, setPhExtracting] = useState(false)
  const [phExtracted, setPhExtracted] = useState(null)
  const [phSaving, setPhSaving] = useState(false)
  const [phAvgData, setPhAvgData] = useState(null)

  // autoUpdateBuyPrices removed — update logic is inline in the Average Prices tab

  const loadPhReport = async (days, sup) => {
    setPhLoading(true)
    setPhAvgData(null)
    try {
      const r = await fetch(`/api/invoices/avg-prices?days=${days || 90}&supplier=${encodeURIComponent(sup)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Load failed')
      setPhAvgData(d)
      const sups = d.db_suppliers || [...new Set(d.items?.map(i => i.supplier).filter(Boolean))].sort()
      setPhDbSuppliers(sups)
    } catch (e) {
      alert('Failed to load report: ' + e.message)
    }
    setPhLoading(false)
  }
  const [phSupFilter, setPhSupFilter] = useState('all')
  const [phDbSuppliers, setPhDbSuppliers] = useState([])
  const [phLoading, setPhLoading] = useState(false)
  const [phActiveOnly, setPhActiveOnly] = useState(true)
  const [priceReviewModal, setPriceReviewModal] = useState(false)
  const [phManageData, setPhManageData] = useState(null)
  const [phManageLoading, setPhManageLoading] = useState(false)
  const [phMatching, setPhMatching] = useState(false)
  const [phManageSaving,   setPhManageSaving]   = useState({})
  const [phAuditItems,     setPhAuditItems]     = useState(null)
  const [phAuditSelected,  setPhAuditSelected]  = useState(new Set())
  const [phAuditDeleting,  setPhAuditDeleting]  = useState(false)
  const [phSaveResult, setPhSaveResult] = useState(null)
  const [phHubNames, setPhHubNames] = useState([])
  const [editingTarget, setEditingTarget] = useState(false)
  const [suppliers, setSuppliers]       = useState(DEFAULT_SUPPLIERS)
  const [supplierVendorNames, setSupplierVendorNames] = useState({}) // { appName: squareVendorName }
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [daysBack, setDaysBack]         = useState(60)
  const [viewMode, setViewMode]         = useState('reorder')
  const [mainTab, setMainTab]           = useState('home')
  const [orderQtyOverrides, setOrderQtyOverrides] = useState({}) // { itemName: qty } — session only
  const [poReceiving, setPoReceiving]         = useState(null)
  const [receiveModal, setReceiveModal]       = useState(null) // { supplier, items: [{name,...}] }
  const [invoiceFile, setInvoiceFile]         = useState(null) // { name, base64, mimeType }
  const [receiveChecked, setReceiveChecked]   = useState({})   // { itemName: bool }
  const [receiveQtys, setReceiveQtys]         = useState({})   // { itemName: number } actual received qty
  const [squareReceiveResult, setSquareReceiveResult] = useState(null) // { ok, changes, error }
  const [receiptData,  setReceiptData]        = useState(null)
  const [receiptSaved, setReceiptSaved]       = useState(false)
  const [salesPdfLoading, setSalesPdfLoading] = useState(false)
  const [salesPeriod, setSalesPeriod]   = useState('month')
  const [salesCustom, setSalesCustom]   = useState({ start: '', end: '' })
  const [salesReport, setSalesReport]   = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError]     = useState(null)
  const [salesCategory, setSalesCategory] = useState('All')
  const [salesSort, setSalesSort]       = useState('units')
  const [wastageLog, setWastageLog]     = useState([])
  const [notesLog, setNotesLog]         = useState([])
  const [notesLoaded, setNotesLoaded]   = useState(false)
  const [fromCache, setFromCache]       = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hubTheme, setHubTheme] = useState(() => {
    try { return localStorage.getItem('hubTheme') || 'navy' } catch { return 'navy' }
  })
  useEffect(() => { try { localStorage.setItem('hubTheme', hubTheme) } catch {} }, [hubTheme])
  const [wastageLoaded, setWastageLoaded] = useState(false)
  const [orderedItems, setOrderedItems]   = useState({})
  const [orderAgainItems, setOrderAgainItems] = useState(new Set())
  const [orderWizard, setOrderWizard] = useState(null)  // null or { step:1-4, supplier, poRef, saving }
  const [orderMode, setOrderMode]     = useState('weekly') // 'weekly' | 'additional'
  const [wizInvoiceFile, setWizInvoiceFile] = useState(null) // invoice attached during ordering
  const [wizQtys, setWizQtys] = useState({})
  const [viewOrderModal, setViewOrderModal] = useState(null)
  const [priceListSettings, setPriceListSettings] = useState({}) // { itemName: { hidden: bool, priceOverride: num, label: str } }
  const [plSaving, setPlSaving]         = useState({})

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
      const [r, ro, rundownRes] = await Promise.all([
        fetch(`/api/items?days=${effectiveDays}${refreshParam}`),
        fetch('/api/purchase-order'),
        fetch('/api/rundown'),
      ])
      const rundownData = await rundownRes.json().catch(() => ({}))
      if (rundownData.rundown) setRundownItems(rundownData.rundown)
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

  useEffect(() => { loadItems(); loadLastOrderSummary(); loadDocuments() }, [loadItems])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.suppliers) setSuppliers(data.suppliers)
      if (data.supplierVendorNames) setSupplierVendorNames(data.supplierVendorNames || {})
    }).catch(() => {})
  }, [])

  async function loadLastOrderSummary() {
    try {
      const r = await fetch('/api/documents/list')
      const d = await r.json()
      const docs = (d.documents || []).filter(doc => doc.status === 'received' && doc.receive_date)
      if (docs.length) {
        const last = docs.sort((a, b) => new Date(b.receive_date) - new Date(a.receive_date))[0]
        setLastOrderSummary(last)
      }
    } catch {}
  }

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




  // Default GST-inclusive flag by supplier when the AI extract doesn't specify.
  // ACW invoices are ex-GST; Dan Murphy's and Coles/Woolies are GST-inclusive.
  // Getting this wrong mis-costs items by ~9%, so we default per-supplier rather
  // than a blanket true/false.
  function defaultGstIncluded(supplier, extracted) {
    if (extracted === true || extracted === false) return extracted
    const s = (supplier || '').toLowerCase()
    if (s.includes('acw')) return false
    return true // Dan Murphy's, Coles/Woolies and anything else default inc-GST
  }

  function openReceiveModal(supplier, supplierItems, ref) {
    supplierItems = supplierItems.filter(i => (i.orderQty || 0) > 0)
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
    // Check if an invoice is already saved for this PO
    const existingDoc = documents.find(d => d.po_ref === (ref || '') && (d.invoice_url || d.invoice_onedrive_url || d.invoice_path))
    if (existingDoc) {
      const existingName = existingDoc.invoice_onedrive_url
        ? existingDoc.invoice_onedrive_url.split('/').pop().split('?')[0]
        : (ref ? `${ref}-Invoice` : 'Invoice')
      setInvoiceFile({ name: decodeURIComponent(existingName), base64: null, mimeType: 'application/pdf', saved: true, alreadySaved: true })
    } else {
      setInvoiceFile(null)
    }
    setReceiveModal({ supplier, ref: ref || '', items: supplierItems })
  }

  async function confirmReceive() {
    const { supplier } = receiveModal
    const receivedNames = Object.entries(receiveChecked).filter(([, v]) => v).map(([k]) => k)
    const allItems = receiveModal.items.map(i => i.name)
    const allReceived = allItems.every(n => receiveChecked[n])
    setPoReceiving(receiveModal.ref || supplier)
    try {
      // ── 1. Update Hub / Redis state (existing behaviour) ─────────────────
      const ref = receiveModal.ref
      const action = ref ? 'receiveByRef' : allReceived ? 'receive' : 'partialReceive'
      const body = ref
        ? { action: 'receiveByRef', ref, receivedItems: allReceived ? null : receivedNames }
        : allReceived
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
            const btl  = i.isSpirit ? (v => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(nips / ((i.bottleML || 700) / (i.nipML || 30))) : null
            return { name: i.name, sku: i.sku || '', qty: i.isSpirit ? nips + ' nips (' + btl + ' btl)' : nips + ' units', unitCost: i.buyPrice || '', orderQty: i.orderQty || 0 }
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
          orderedQty: (orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] : i.orderQty) || 0,
          receivedQty: receiveChecked[i.name] ? (receiveQtys[i.name] !== undefined ? receiveQtys[i.name] : ((orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] : i.orderQty) || 0)) : 0,
          unit: i.isSpirit ? 'nip' : 'each',
          note: receiveChecked[i.name] ? '' : 'Not received this delivery',
        }))
        let oneDriveResult = null
        try {
          const odRes = await fetch('/api/onedrive/save-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: receiveModal.ref || '',
              supplier,
              receivedBy: 'Bar Manager',
              locationName: 'Paynter Bar',
              items: odItems
            })
          })
          oneDriveResult = await odRes.json()
          if (oneDriveResult?.webUrl) fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'update_urls', po_ref: receiveModal.ref||supplier, receipt_onedrive_url: oneDriveResult.webUrl }) }).catch(()=>null)
        } catch (odErr) {
          oneDriveResult = { skipped: true, reason: odErr.message }
        }

        const dateStr = new Date().toLocaleDateString('en-AU', { timeZone:'Australia/Brisbane', day:'2-digit', month:'short', year:'numeric' })
        // Never fall back to the bare supplier name — if two deliveries both
        // have no ref, they'd collide on the same Supabase document row and
        // clearing one order's invoice would silently clear the other's too.
        const poRef = receiveModal.ref || `${supplier}-${Date.now()}`
        // Save document record to Supabase (receive report)
        fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            action: 'receive', po_ref: poRef, supplier,
            receive_date: new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Brisbane'}),
            item_count: receivedItems.length,
            items: receivedItems.map(i => ({ name: i.name, orderedQty: i.orderQty||0, receivedQty: receiveQtys[i.name]||i.orderQty||0, unit: i.isSpirit ? 'nips' : 'units' }))
          }) }).catch(()=>null)
        // Upload invoice to Supabase if attached
        if (invoiceFile) {
          const ext = invoiceFile.name.split('.').pop()
          const invName = `${poRef.replace(/\s/g,'_')}-Invoice.${ext}`
          fetch('/api/onedrive/save-invoice', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ filename: invName, base64: invoiceFile.base64, mimeType: invoiceFile.mimeType, supplier }) })
            .then(r => {
              if (!r.ok) { console.error('[invoice upload] HTTP error:', r.status); return null }
              return r.json()
            }).then(d => {
              if (!d) return
              if (d.ok && d.webUrl) {
                fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ action:'update_urls', po_ref: poRef, invoice_onedrive_url: d.webUrl }) })
              } else if (d.skipped) {
                console.warn('[invoice upload] OneDrive skipped:', d.reason)
              } else {
                console.warn('[invoice upload] unexpected response:', d)
              }
            }).catch(e => {
              console.error('[invoice upload] error:', e)
            })
          fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'invoice', po_ref: poRef, supplier, file_base64: invoiceFile.base64, file_name: invName, file_mime: invoiceFile.mimeType }) }).catch(()=>null)

          // Auto-extract prices into buy_price_history (background, non-blocking)
          // Haiku name-matching runs first so rows land with correct item_name_hub
          if (invoiceFile.mimeType === 'application/pdf' || invoiceFile.name.toLowerCase().endsWith('.pdf')) {
            ;(async () => {
              try {
                const extRes = await fetch('/api/invoices/extract', { method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ pdf_base64: invoiceFile.base64 }) })
                if (!extRes.ok) return
                const d = await extRes.json()
                if (!d?.items?.length) return

                // Run Haiku name-matching so rows land with proper item_name_hub
                let matchMap = {}
                const hubNames = items.map(i => i.name).filter(Boolean)
                if (hubNames.length) {
                  try {
                    const mRes = await fetch('/api/invoices/match-names', { method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ raw_names: d.items.map(i => i.item_name_raw), hub_names: hubNames }) })
                    if (mRes.ok) {
                      const mData = await mRes.json()
                      for (const m of mData.matches || []) if (m.hub) matchMap[m.raw] = m.hub
                    }
                  } catch { /* matching failed — save with raw names as fallback */ }
                }

                await fetch('/api/invoices/save', { method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({
                    invoice_ref: d.invoice_ref || poRef,
                    supplier: d.supplier || supplier,
                    invoice_date: d.invoice_date || dateStr,
                    gst_included: defaultGstIncluded(d.supplier || supplier, d.gst_included),
                    items: d.items.map(i => ({
                      ...i, include: true,
                      item_name_hub: matchMap[i.item_name_raw] || i.item_name_raw,
                    })),
                  })
                })
              } catch { /* silent — never block the receive flow */ }
            })()
          }
        }
        setReceiveModal(null)
        setInvoiceFile(null)
        setReceiptData({ supplier, ref: receiveModal.ref || '', date: dateStr, items: receivedItems, sqResult, oneDriveResult })
        setReceiptSaved(false)
      }
    } finally {
      setPoReceiving(null)
    }
  }


  async function loadDocuments() {
    setDocsLoading(true)
    try {
      const r = await fetch('/api/documents/list')
      const d = await r.json()
      const docs = d.documents || []
      setDocuments(docs)
      // Seed email-sent state from DB — only flag if treasurer_emailed_at is actually set
      const alreadySent = {}
      docs.filter(doc => doc.treasurer_emailed_at).forEach(doc => { alreadySent[doc.id] = doc.treasurer_emailed_at })
      setDocEmailSent(alreadySent)
    } catch {}
    setDocsLoading(false)
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
        ? (ov !== undefined ? (v => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(ov / ((i.bottleML || 700) / (i.nipML || 30))) : (i.bottlesToOrder || 0))
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
    const date = new Date().toLocaleDateString('en-CA', { timeZone:'Australia/Brisbane' })
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


  async function resavePO(supplier, ordered, ref) {
    // Flatten — find the entry for THIS specific order (supplier + ref) per item,
    // since an item can now appear on more than one order at once.
    const flat = []
    for (const [name, entries] of Object.entries(ordered)) {
      const match = (entries || []).find(e => e.supplier === supplier && (!ref || e.ref === ref))
      if (match) flat.push({ name, ...match })
    }
    if (!flat.length) return
    const updatedItems = flat.map(f => ({ name: f.name, sku: f.sku||'', orderQty: f.orderQty, bottlesToOrder: f.bottlesToOrder||null, isSpirit: f.isSpirit||false }))
    // Same rule as confirmReceive — never collapse to the bare supplier name
    const poRef = ref || flat[0].ref || `${supplier}-${Date.now()}`
    const orderDate = flat[0].date || new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',year:'numeric'})
    fetch('/api/onedrive/save-po', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ po_ref: poRef, supplier, order_date: orderDate, items: updatedItems }) })
      .then(r => r.json()).then(d => {
        if (d.webUrl) fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'update_urls', po_ref: poRef, po_onedrive_url: d.webUrl }) }).catch(()=>null)
      }).catch(()=>null)
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

  async function saveSetting(itemName, field, value) {
    const key = `${itemName}_${field}`
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName, field, value, who: readOnly ? 'volunteer' : 'BMT' })
      })
      setItems(prev => prev.map(item => {
        if (item.name !== itemName) return item
        const numFields = ['pack','bottleML','nipML','stockOverride','buyPrice','sellPrice','sellPriceBottle','weeklyAvgOverride']
        const updated = { ...item, [field]: numFields.includes(field) ? (value === null ? null : Number(value)) : value }
        if (['weeklyAvgOverride', 'bottleML', 'nipML', 'pack', 'minStock', 'maxStock'].includes(field)) {
          const recalc = calculateItem(updated, {
            minStock: updated.minStock,
            maxStock: updated.maxStock,
            targetWeeksOverride: updated.targetWeeksOverride,
            weeklyAvgOverride: updated.weeklyAvgOverride,
            stockOverride: updated.stockOverride,
            bottleML: updated.bottleML,
            nipML: updated.nipML,
          }, targetWeeks, daysBack)
          return { ...updated, ...recalc }
        }
        return updated
      }))
      // For supplier changes, reload items to reflect new grouping
      if (field === 'supplier') loadItems(false)
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

  async function deleteSupplier(name) {
    const itemsUsingSupplier = items.filter(i => i.supplier === name).length
    const msg = itemsUsingSupplier > 0
      ? `Remove "${name}"? ${itemsUsingSupplier} item(s) are assigned to this supplier — they will become unassigned.`
      : `Remove "${name}"?`
    if (!confirm(msg)) return
    const updated = suppliers.filter(s => s !== name)
    setSuppliers(updated)
    if (view === name) setView('all')
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: '_global', field: 'suppliers', value: updated })
    })
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
      if ((item.onHand || 0) <= 0 && !pl.showOnPrint) continue   // skip zero stock unless flagged
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
                    return '<tr><td style="font-size:12px;color:#64748b;padding:3px 8px 3px 0;white-space:nowrap">' + v.name + (vSd ? ' <span style="color:#374151">(' + vSd + ' std)</span>' : '') + '</td><td style="font-size:13px;font-weight:700;font-family:Courier New,monospace;text-align:right;padding:3px 0;white-space:nowrap">$' + Number(v.price).toFixed(2) + '</td></tr>'
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
  @page { size: A4 portrait; margin: 9mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }

  .hdr {
    display: flex; justify-content: space-between; align-items: center;
    background: #1e40af; color: #fff;
    padding: 6px 12px; border-radius: 4px; margin-bottom: 7px;
  }
  .title { font-size: 16px; font-weight: 800; }
  .sub   { font-size: 9px; color: #bfdbfe; margin-top: 1px; }
  .badge { background: #f59e0b; color: #0f172a; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 99px; }

  .cols { columns: 2; column-gap: 8px; }

  .card {
    border: 1px solid #e2e8f0; border-radius: 4px;
    overflow: hidden; margin-bottom: 6px;
    display: inline-block; width: 100%;
  }
  .cat-hdr {
    background: #1e3a5f; color: #fff;
    font-size: 13px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em;
    padding: 7px 12px;
    break-after: avoid; column-break-after: avoid;
  }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) td { background: #f8fafc; }
  .nm { padding: 7px 13px; font-size: 15px; }
  .alc { font-size: 9px; color: #374151; font-weight: 500; margin-left: 4px; font-family: Arial; }
  .sd  { font-size: 9px; color: #374151; font-weight: 500; margin-left: 4px; font-family: Arial; }
  .pr {
    padding: 7px 13px; text-align: right;
    font-size: 15px; font-weight: 700;
    font-family: 'Courier New', monospace;
    white-space: nowrap; width: 82px; vertical-align: top;
  }
  .vr { display: flex; justify-content: space-between; gap: 4px; line-height: 1.6; }
  .vn { font-size: 12px; color: #64748b; font-weight: 400; font-family: Arial; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hdr, .cat-hdr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
</head><body>

  ${hdr}
  <div class="cols">${renderCards(cats)}</div>

<script>
  const QR_URL = 'https://paynter-bar-hub.vercel.app/?public=pricelist'
  const opts = { width: 52, height: 52, colorDark: '#1e3a5f', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }
  if (typeof QRCode !== 'undefined') {
    document.querySelectorAll('#qr-hdr').forEach(el => new QRCode(el, { ...opts, text: QR_URL }))
  }
</script>
</body></html>`
    const w = window.open('', '_blank')
    if (!w) { alert('Popup blocked — please allow popups for this site and try again.'); return }
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
    const critItems  = items.filter(i => i.priority === 'CRITICAL' && !rundownItems[i.name])
    const lowItems   = items.filter(i => i.priority === 'LOW' && !rundownItems[i.name])
    const orderItems = items.filter(i => i.orderQty > 0 && !rundownItems[i.name] && !/do\s*n'?t\s+order|do\s+not\s+order/i.test(i.notes || ''))

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
      await loadExcelJS()

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
      const wb = new window.ExcelJS.Workbook()
      xlsAOAtoWS(wb, allRows, 'Stock on Hand', {
        cols: [{ wch:44 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:14 },{ wch:20 },{ wch:22 },{ wch:14 },{ wch:16 }],
        rowHeights: allRows.map((_, i) => i === 0 ? { hpt:32 } : { hpt:20 }),
        merges: [{ s:{r:0,c:0}, e:{r:0,c:6} }, { s:{r:3,c:0}, e:{r:3,c:6} }, { s:{r:5,c:0}, e:{r:5,c:6} }],
        freeze: 9,
      })
      await xlsDownload(wb, `PaynterBar_SOH_${monthName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
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

    const CATEGORY_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
    const hasRev = report.items.some(i => i.revenue != null && i.revenue > 0)
    const generated = now.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const fmtRev = n => n ? `$${Number(n).toFixed(2)}` : '—'
    const fmtChg = n => n == null ? '—' : (n >= 0 ? '+' : '') + n + '%'
    const prevLabel = salesPeriod === 'financialYear' ? 'Prior FY' : salesPeriod === '3months' ? 'Prior 3 Mo' : salesPeriod === 'day' ? 'Prior Day' : 'Prior Period'

    if (exportXlsx) {
      await loadExcelJS()
      const wb = new window.ExcelJS.Workbook()

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


      const lastCol2 = hasRev ? 5 : 4
      const salesMerges = [
        { s:{r:0,c:0}, e:{r:0,c:lastCol2} },
        { s:{r:4,c:0}, e:{r:4,c:lastCol2} },
      ]
      xlsAOAtoWS(wb, rows, 'Sales Report', {
        cols: [{ wch:36 },{ wch:18 },{ wch:12 },{ wch:12 },{ wch:12 },...(hasRev ? [{ wch:14 }] : [])],
        rowHeights: rows.map((_, i) => i === 0 ? { hpt:28 } : { hpt:18 }),
        merges: salesMerges,
        freeze: 0,
      })
      await xlsDownload(wb, `PaynterBar_Sales_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
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
      await loadExcelJS()

      // Build category groupings fresh (generateSalesReport has its own scope)
      const byCategory = {}
      for (const item of items) {
        const cat = item.category || 'Uncategorised'
        if (!byCategory[cat]) byCategory[cat] = []
        byCategory[cat].push(item)
      }
      const CATEGORY_ORDER_XLS = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
      const sortedCats = [...CATEGORY_ORDER_XLS.filter(c => byCategory[c]), ...Object.keys(byCategory).filter(c => !CATEGORY_ORDER_XLS.includes(c))]
      const totalValue = items.reduce((sum, i) => sum + (i.buyPrice != null && i.onHand > 0 ? Number(i.buyPrice) * Number(i.onHand) : 0), 0)
      const critItems  = items.filter(i => i.priority === 'CRITICAL' && !rundownItems[i.name])
      const lowItems   = items.filter(i => i.priority === 'LOW' && !rundownItems[i.name])
      const orderItems = items.filter(i => i.orderQty > 0 && !rundownItems[i.name])

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
      const wb = new window.ExcelJS.Workbook()
      xlsAOAtoWS(wb, allRows, 'Stock on Hand', {
        cols: [{ wch:44 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:14 },{ wch:20 },{ wch:22 }],
        rowHeights: allRows.map((_, i) => i === 0 ? { hpt:32 } : { hpt:20 }),
        merges: [{ s:{r:0,c:0}, e:{r:0,c:6} }, { s:{r:3,c:0}, e:{r:3,c:6} }, { s:{r:5,c:0}, e:{r:5,c:6} }],
        freeze: 9,
      })
      await xlsDownload(wb, `PaynterBar_SOH_${monthName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
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
    const orderItems = items.filter(i => {
      if (i.supplier !== supplier || dontOrder(i)) return false
      const hasOverride = orderQtyOverrides[i.name] !== undefined && orderQtyOverrides[i.name] > 0
      const autoQty = i.orderQty > 0
      const alreadyOnOrder = !!orderedItems[i.name]
      // Always show manually overridden items; auto-calculated only if not already on another order
      return hasOverride || (autoQty && !alreadyOnOrder)
    })
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
<style>body{font-family:Arial,sans-serif;font-size:13px;margin:20px}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#1f2937;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:24px;font-size:11px;color:#9ca3af}.print-btn{display:inline-flex;align-items:center;gap:6px;background:#1f2937;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:16px}@media print{.print-btn{display:none}body{margin:10px}}</style>
</head><body>
<button class="print-btn" onclick="window.print()">🖨️ Print this sheet</button>
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
  }

  function printDeliverySheet(supplier, supplierItems, ref) {
    const date = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    const rows = supplierItems.map(item => {
      const override = orderQtyOverrides[item.name]
      const qty = override !== undefined ? override : (item.orderQty || 0)
      // Use stored bottlesToOrder directly — avoids rounding mismatch from recalculating
      const btlOverride = override !== undefined
        ? (v => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(override / ((item.bottleML || 700) / (item.nipML || 30)))
        : (item.bottlesToOrder || null)
      const qtyLabel = item.isSpirit
        ? `${qty} nips / ${btlOverride ?? '?'} btl`
        : `${qty} units`
      return `<tr>
        <td style="text-align:center"><input type="checkbox" style="width:16px;height:16px"></td>
        <td>${item.name}</td>
        <td style="text-align:right;font-weight:700">${qtyLabel}</td>
        <td style="width:120px">&nbsp;</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>Delivery Checklist - ${supplier} - ${date}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;margin:20px}
  h1{font-size:18px;margin-bottom:4px}
  .sub{color:#666;font-size:12px;margin-bottom:16px}
  .ref{display:inline-block;background:#dcfce7;color:#166534;font-weight:700;font-family:monospace;padding:2px 10px;border-radius:4px;font-size:13px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th{background:#1f2937;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}
  td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even) td{background:#f9fafb}
  .footer{margin-top:24px;font-size:11px;color:#9ca3af}
  .toolbar{display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap}
  .btn{padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
  .btn-print{background:#1e3a5f;color:#fff}
  .btn-close{background:#f1f5f9;color:#374151;border:1px solid #e2e8f0}
  @media print{.toolbar{display:none}body{margin:10px}input[type=checkbox]{-webkit-print-color-adjust:exact}}
</style>
</head><body>
<div class="toolbar">
  <button class="btn btn-print" onclick="window.print()">🖨️ Print</button>
  <button class="btn btn-close" onclick="window.close()">✕ Close</button>
  <span style="font-size:12px;color:#666">Tip: tap Close to return to the app</span>
</div>
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
  }

  async function exportAvgPriceReport() {
    if (!window.ExcelJS) {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
      document.head.appendChild(s)
      await new Promise(r => { s.onload = r })
    }
    const ExcelJS = window.ExcelJS
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Avg Price Review')
    const TARGET = 40
    const WINE_C = ['White Wine','Red Wine','Rose','Sparkling']
    const mceil  = (v, m) => Math.ceil(v / m) * m
    const NAVY   = '0F172A'
    const GREEN  = '166534'
    const AMBER  = '92400E'
    const RED    = '991B1B'

    // Fetch avg prices (all time, all suppliers)
    let avgPriceMap = {}
    try {
      const r = await fetch('/api/invoices/avg-prices?days=90')
      const d = await r.json()
      for (const row of d.items || [])
        avgPriceMap[row.matched_hub_key] = { avg: row.avg_unit_price_ex_gst, buy: row.buy_price_inc_gst, count: row.invoice_count, min: row.min_price_inc_gst, max: row.max_price_inc_gst, nips: row.nips_per_bottle }
    } catch { alert('Failed to load invoice data'); return }

    ws.columns = [
      { header: 'Item',                  key: 'name',         width: 38 },
      { header: 'Category',              key: 'cat',          width: 16 },
      { header: 'Supplier',              key: 'sup',          width: 14 },
      { header: 'Current Buy Price',     key: 'curBuy',       width: 16 },
      { header: 'Avg Invoice Price',     key: 'avgBuy',       width: 16 },
      { header: '# Invoices',            key: 'invCount',     width: 12 },
      { header: 'Min Buy',               key: 'minBuy',       width: 12 },
      { header: 'Max Buy',               key: 'maxBuy',       width: 12 },
      { header: 'Sell (glass/unit)',     key: 'sell',         width: 13 },
      { header: 'Markup % (glass/unit)', key: 'curMarkup',    width: 15 },
      { header: 'Avg Markup % (glass)',  key: 'avgMarkup',    width: 15 },
      { header: 'Sell (bottle)',         key: 'sellBtl',      width: 13 },
      { header: 'Markup % (bottle)',     key: 'curMarkupBtl', width: 15 },
      { header: 'Avg Markup % (bottle)', key: 'avgMarkupBtl', width: 15 },
      { header: 'Sugg Sell (40%)',       key: 'suggSell',     width: 14 },
      { header: 'Notes',                 key: 'notes',        width: 32 },
    ]

    const hRow = ws.getRow(1)
    hRow.eachCell(cell => {
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+NAVY } }
      cell.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 }
      cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true }
    })
    hRow.height = 32

    const mColor = (p) => p == null ? null : p >= 40 ? { argb:'FFF0FDF4' } : p >= 25 ? { argb:'FFFEF3C7' } : { argb:'FFFEE2E2' }
    const mFont  = (p) => p == null ? null : p >= 40 ? GREEN : p >= 25 ? AMBER : RED

    const allItems = [...items].filter(i => !rundownItems[i.name]).sort((a,b) => {
      const co = { Beer:0,Cider:1,PreMix:2,'White Wine':3,'Red Wine':4,Rose:5,Sparkling:6,'Fortified & Liqueurs':7,Spirits:8,'Soft Drinks':9,Snacks:10 }
      return ((co[a.category]??99)-(co[b.category]??99)) || a.name.localeCompare(b.name)
    })

    let rNum = 1
    for (const item of allItems) {
      const isWine   = WINE_C.includes(item.category)
      const avg      = avgPriceMap[item.name] || null
      const vars     = item.variations || []
      const glassVar = vars.find(v => v.name?.toLowerCase().includes('glass'))
      const bottleVar= vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
      const nipVar   = vars.find(v => v.name?.toLowerCase().includes('nip'))

      const nipML    = item.nipML || 30
      const bottleML = item.bottleML || 700
      const nipsPerBtl = item.isSpirit ? (avg?.nips ?? (bottleML / nipML)) : null

      // Avg buy price inc GST — computed server-side in avg-prices.js, use directly
      const avgBuyIncGst = avg?.buy ?? null
      const minBuyIncGst = avg?.min ?? null
      const maxBuyIncGst = avg?.max ?? null

      // Current manual buy price
      const curBuy = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice) : null

      // Sell price
      const serves = isWine && glassVar ? (item.servesPerBottle || (50/11)) : 1  // 50/11 = 4.545 — matches Square's 11/50-bottle-per-glass portion (includes overpour buffer)
      const sellPrice = item.isSpirit
        ? (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (item.sellPrice ? Number(item.sellPrice) : null)
        : glassVar?.price != null ? Number(glassVar.price)
        : bottleVar?.price != null ? Number(bottleVar.price)
        : item.squareSellPrice != null ? Number(item.squareSellPrice) : null

      const revenue = sellPrice != null ? sellPrice * serves : null
      const curMarkup  = curBuy  != null && curBuy  > 0 && revenue != null ? Math.round((revenue - curBuy)  / curBuy  * 1000) / 10 : null
      const avgMarkup  = avgBuyIncGst != null && avgBuyIncGst > 0 && revenue != null ? Math.round((revenue - avgBuyIncGst) / avgBuyIncGst * 1000) / 10 : null
      const suggSell   = (avgBuyIncGst ?? curBuy) != null ? mceil((avgBuyIncGst ?? curBuy) * 1.40 / serves, 0.25) : null

      // Bottle sell price & markup — for wines that also have a bottle variation
      const bottleSellPrice = bottleVar?.price != null ? Number(bottleVar.price) : (item.sellPriceBottle ? Number(item.sellPriceBottle) : null)
      const curMarkupBtl  = isWine && bottleSellPrice != null && curBuy != null && curBuy > 0
        ? Math.round((bottleSellPrice - curBuy) / curBuy * 1000) / 10 : null
      const avgMarkupBtl  = isWine && bottleSellPrice != null && avgBuyIncGst != null && avgBuyIncGst > 0
        ? Math.round((bottleSellPrice - avgBuyIncGst) / avgBuyIncGst * 1000) / 10 : null

      rNum++
      const row = ws.addRow({
        name:         item.name,
        cat:          item.category,
        sup:          item.supplier || '',
        curBuy:       curBuy ?? '',
        avgBuy:       avgBuyIncGst ?? '',
        invCount:     avg?.count ?? '',
        minBuy:       minBuyIncGst ?? '',
        maxBuy:       maxBuyIncGst ?? '',
        sell:         sellPrice ?? '',
        curMarkup:    curMarkup ?? '',
        avgMarkup:    avgMarkup ?? '',
        sellBtl:      bottleSellPrice ?? '',
        curMarkupBtl: curMarkupBtl ?? '',
        avgMarkupBtl: avgMarkupBtl ?? '',
        suggSell:     suggSell ?? '',
        notes:        '',
      })

      const fmt3 = '"$"#,##0.000'
      const fmt2 = '"$"#,##0.00'
      const fmtPct = '0.0"%"'
      if (curBuy != null)       row.getCell('curBuy').numFmt    = fmt3
      if (avgBuyIncGst != null) row.getCell('avgBuy').numFmt    = fmt3
      if (minBuyIncGst != null) row.getCell('minBuy').numFmt    = fmt3
      if (maxBuyIncGst != null) row.getCell('maxBuy').numFmt    = fmt3
      if (sellPrice != null)    row.getCell('sell').numFmt      = fmt2
      if (suggSell != null)     row.getCell('suggSell').numFmt  = fmt2
      if (curMarkup != null) {
        row.getCell('curMarkup').numFmt = fmtPct
        const mc = mColor(curMarkup); if (mc) row.getCell('curMarkup').fill = { type:'pattern', pattern:'solid', fgColor:mc }
        const mf = mFont(curMarkup); if (mf) row.getCell('curMarkup').font = { bold:true, color:{ argb:'FF'+mf } }
      }
      if (avgMarkup != null) {
        row.getCell('avgMarkup').numFmt = fmtPct
        const mc = mColor(avgMarkup); if (mc) row.getCell('avgMarkup').fill = { type:'pattern', pattern:'solid', fgColor:mc }
        const mf = mFont(avgMarkup); if (mf) row.getCell('avgMarkup').font = { bold:true, color:{ argb:'FF'+mf } }
      }
      if (bottleSellPrice != null) row.getCell('sellBtl').numFmt = fmt2
      if (curMarkupBtl != null) {
        row.getCell('curMarkupBtl').numFmt = fmtPct
        const mc = mColor(curMarkupBtl); if (mc) row.getCell('curMarkupBtl').fill = { type:'pattern', pattern:'solid', fgColor:mc }
        const mf = mFont(curMarkupBtl); if (mf) row.getCell('curMarkupBtl').font = { bold:true, color:{ argb:'FF'+mf } }
      }
      if (avgMarkupBtl != null) {
        row.getCell('avgMarkupBtl').numFmt = fmtPct
        const mc = mColor(avgMarkupBtl); if (mc) row.getCell('avgMarkupBtl').fill = { type:'pattern', pattern:'solid', fgColor:mc }
        const mf = mFont(avgMarkupBtl); if (mf) row.getCell('avgMarkupBtl').font = { bold:true, color:{ argb:'FF'+mf } }
      }
      // Highlight if avg buy differs from current buy by >10%
      if (curBuy != null && avgBuyIncGst != null) {
        const diff = Math.abs(curBuy - avgBuyIncGst) / avgBuyIncGst
        if (diff > 0.10) {
          row.getCell('notes').value = `⚠ Buy price differs from avg by ${(diff*100).toFixed(0)}%`
          row.getCell('notes').font  = { italic:true, color:{ argb:'FF'+AMBER }, size:9 }
        }
      }

      const rowBg = rNum % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'
      row.eachCell({ includeEmpty:true }, cell => {
        if (!cell.fill || !cell.fill.fgColor || cell.fill.fgColor.argb === rowBg)
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:rowBg } }
        cell.alignment = { vertical:'middle' }
      })
    }

    ws.views = [{ state:'frozen', ySplit:1 }]
    ws.autoFilter = { from:'A1', to:'M1' }

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-')
    a.href = url; a.download = `AvgPriceReview-${date}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportBelow40Report() {
    if (!window.ExcelJS) {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
      document.head.appendChild(s)
      await new Promise(r => { s.onload = r })
    }
    const ExcelJS = window.ExcelJS
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Below 40% Markup')

    const NAVY='0F172A', WHITE='FFFFFFFF', RED='991B1B', AMBER='92400E', GREEN='166534'
    const WINE_C = ['White Wine','Red Wine','Rose','Sparkling']
    const mceil = (v, m) => Math.ceil(v / m) * m
    const mColor = p => p == null ? null : p >= 40 ? { argb:'FFF0FDF4' } : p >= 25 ? { argb:'FFFEF3C7' } : { argb:'FFFEE2E2' }
    const mFont  = p => p == null ? null : p >= 40 ? GREEN : p >= 25 ? AMBER : RED

    // Fetch avg prices
    let avgPriceMap = {}
    try {
      const r = await fetch('/api/invoices/avg-prices?days=90')
      const d = await r.json()
      for (const row of d.items || [])
        avgPriceMap[row.matched_hub_key] = { avg: row.avg_unit_price_ex_gst, buy: row.buy_price_inc_gst, count: row.invoice_count, nips: row.nips_per_bottle }
    } catch { alert('Failed to load invoice data'); return }

    ws.columns = [
      { header: 'Item',               key: 'name',         width: 38 },
      { header: 'Category',           key: 'cat',          width: 16 },
      { header: 'Supplier',           key: 'sup',          width: 14 },
      { header: 'Buy Price',          key: 'curBuy',       width: 14 },
      { header: 'Avg Invoice Price',  key: 'avgBuy',       width: 16 },
      { header: 'Sell Price',         key: 'sell',         width: 12 },
      { header: 'Sell Unit',          key: 'sellUnit',     width: 12 },
      { header: 'Markup %',           key: 'markup',       width: 13 },
      { header: 'Sugg Sell (40%)',    key: 'suggSell',     width: 14 },
    ]

    const hRow = ws.getRow(1)
    hRow.eachCell(cell => {
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+NAVY } }
      cell.font = { bold:true, color:{ argb:WHITE }, size:11 }
      cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true }
    })
    hRow.height = 32

    const allItems = [...items].filter(i => !rundownItems[i.name]).sort((a,b) => {
      const co = { Beer:0,Cider:1,PreMix:2,'White Wine':3,'Red Wine':4,Rose:5,Sparkling:6,'Fortified & Liqueurs':7,Spirits:8,'Soft Drinks':9,Snacks:10 }
      return ((co[a.category]??99)-(co[b.category]??99)) || a.name.localeCompare(b.name)
    })

    let rNum = 1
    for (const item of allItems) {
      const isWine   = WINE_C.includes(item.category)
      const avg      = avgPriceMap[item.name] || null
      const vars     = item.variations || []
      const glassVar = vars.find(v => v.name?.toLowerCase().includes('glass'))
      const bottleVar= vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
      const nipVar   = vars.find(v => v.name?.toLowerCase().includes('nip'))

      const nipML    = item.nipML || 30
      const bottleML = item.bottleML || 700
      const nipsPerBtl = item.isSpirit ? (avg?.nips ?? (bottleML / nipML)) : null

      const avgBuyIncGst = avg?.buy ?? null

      const curBuy = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice) : null

      // Build sell scenarios to check
      const scenarios = []

      if (item.isSpirit) {
        const nipPrice = (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (item.sellPrice ? Number(item.sellPrice) : null)
        if (nipPrice != null) scenarios.push({ sell: nipPrice, unit: 'nip', serves: 1 })
      } else if (isWine) {
        const servesGlass = item.servesPerBottle || (50/11)  // matches Square's 11/50-bottle-per-glass portion
        if (glassVar?.price != null) scenarios.push({ sell: Number(glassVar.price), unit: `glass ×${servesGlass}`, serves: servesGlass })
        if (bottleVar?.price != null) scenarios.push({ sell: Number(bottleVar.price), unit: 'bottle', serves: 1 })
      } else {
        const unitPrice = glassVar?.price ?? bottleVar?.price ?? item.squareSellPrice
        if (unitPrice != null) scenarios.push({ sell: Number(unitPrice), unit: 'unit', serves: 1 })
      }

      for (const sc of scenarios) {
        const revenue    = sc.sell * sc.serves
        const curMarkup  = curBuy != null && curBuy > 0 ? Math.round((revenue - curBuy) / curBuy * 1000) / 10 : null
        const avgMarkup  = avgBuyIncGst != null && avgBuyIncGst > 0 ? Math.round((revenue - avgBuyIncGst) / avgBuyIncGst * 1000) / 10 : null
        const below = (curMarkup != null && curMarkup < 40) || (avgMarkup != null && avgMarkup < 40)
        if (!below) continue

        const suggSell = (avgBuyIncGst ?? curBuy) != null ? mceil((avgBuyIncGst ?? curBuy) * 1.40 / sc.serves, 0.25) : null
        rNum++
        const row = ws.addRow({
          name:      item.name,
          cat:       item.category,
          sup:       item.supplier || '',
          curBuy:    curBuy ?? '',
          avgBuy:    avgBuyIncGst ?? '',
          sell:      sc.sell,
          sellUnit:  sc.unit,
          markup:    curMarkup ?? '',
          suggSell:  suggSell ?? '',
        })

        const fmt3 = '"$"#,##0.000', fmt2 = '"$"#,##0.00', fmtPct = '0.0"%"'
        if (curBuy != null)       row.getCell('curBuy').numFmt   = fmt3
        if (avgBuyIncGst != null) row.getCell('avgBuy').numFmt   = fmt3
        row.getCell('sell').numFmt     = fmt2
        if (suggSell != null)     row.getCell('suggSell').numFmt = fmt2
        if (curMarkup != null) {
          row.getCell('markup').numFmt = fmtPct
          const mc = mColor(curMarkup); if (mc) row.getCell('markup').fill = { type:'pattern', pattern:'solid', fgColor:mc }
          const mf = mFont(curMarkup); if (mf) row.getCell('markup').font = { bold:true, color:{ argb:'FF'+mf } }
        }

        const rowBg = rNum % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'
        row.eachCell({ includeEmpty:true }, cell => {
          if (!cell.fill?.fgColor || cell.fill.fgColor.argb === rowBg)
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:rowBg } }
          cell.alignment = { vertical:'middle' }
        })
      }
    }

    // Summary row
    const total = rNum - 1
    ws.addRow([])
    const sumRow = ws.addRow({ name: `${total} items / scenarios below 40% markup target — Generated ${new Date().toLocaleDateString('en-AU', { timeZone:'Australia/Brisbane', day:'2-digit', month:'short', year:'numeric' })}` })
    sumRow.getCell('name').font = { bold:true, color:{ argb:'FF'+RED }, size:11 }

    ws.views = [{ state:'frozen', ySplit:1 }]
    ws.autoFilter = { from:'A1', to:'I1' }

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-')
    a.href = url; a.download = `Below40Markup-${date}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPricingExcel(markupTarget = 40) {
    if (!window.ExcelJS) {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
      document.head.appendChild(s)
      await new Promise(r => { s.onload = r })
    }
    const ExcelJS = window.ExcelJS
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Pricing Analysis')

    const TARGET    = 40
    const WINE_C    = ['White Wine','Red Wine','Rose','Sparkling']
    const mceil     = (v, m) => Math.ceil(v / m) * m
    const fmtPct    = p => p != null ? `${p.toFixed(1)}%` : ''
    const NAVY      = '0F172A'
    const TEAL      = '0E7490'
    const GREEN     = '166534'
    const AMBER     = '92400E'
    const RED       = '991B1B'
    const BLUE      = '0369A1'
    const LGREY     = 'F8FAFC'
    const mColor    = (p) => p == null ? null : p >= 40 ? { argb:'FFF0FDF4' } : p >= 25 ? { argb:'FFFEF3C7' } : { argb:'FFFEE2E2' }
    const mFont     = (p) => p == null ? null : p >= 40 ? GREEN : p >= 25 ? AMBER : RED

    // Buy prices are manual only — no avg price fetch

    // ── Column definitions ──────────────────────────────────────────────────
    ws.columns = [
      { header: 'Item',              key: 'name',       width: 38 },
      { header: 'Category',          key: 'cat',        width: 16 },
      { header: 'Supplier',          key: 'sup',        width: 14 },
      { header: 'Buy ($/btl·unit)',  key: 'buy',        width: 16 },
      { header: 'Sell (glass/unit)', key: 'sellGlass',  width: 14 },
      { header: 'Sell (bottle)',     key: 'sellBottle', width: 12 },
      { header: 'Markup % (glass/unit)', key: 'markup', width: 15 },
      { header: 'Markup % (btl)',   key: 'markupBtl',  width: 13 },
      { header: 'Sugg Sell (glass)', key: 'suggSell',   width: 13 },
      { header: 'Sugg Sell (btl)',  key: 'suggBtl',    width: 13 },
      { header: 'On Hand',           key: 'onHand',     width: 10 },
      { header: 'Notes',             key: 'notes',      width: 36 },
    ]

    // ── Header row styling ──────────────────────────────────────────────────
    const hRow = ws.getRow(1)
    hRow.eachCell(cell => {
      cell.fill   = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+NAVY } }
      cell.font   = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 }
      cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true }
    })
    hRow.height = 32

    // ── Items ───────────────────────────────────────────────────────────────
    const allItems = [...items]
      .filter(i => !rundownItems[i.name])
      .sort((a,b) => {
        const co = { Beer:0,Cider:1,PreMix:2,'White Wine':3,'Red Wine':4,Rose:5,Sparkling:6,'Fortified & Liqueurs':7,Spirits:8,'Soft Drinks':9,Snacks:10 }
        const cd = (co[a.category]??99) - (co[b.category]??99)
        return cd !== 0 ? cd : a.name.localeCompare(b.name)
      })

    let rNum = 1

    for (const item of allItems) {
      const isWine    = WINE_C.includes(item.category)
      const isSpirit  = item.isSpirit
      const vars      = item.variations || []
      const glassVar  = vars.find(v => v.name?.toLowerCase().includes('glass'))
      const bottleVar = vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
      const nipVar    = vars.find(v => v.name?.toLowerCase().includes('nip') || v.name?.toLowerCase().includes('30ml'))
      // Buy price — manual only
      const buy = item.buyPrice != null && item.buyPrice !== '' ? Number(item.buyPrice) : null

      // Sell prices
      const sellGlassPrice  = isSpirit
        ? (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (item.sellPrice != null ? Number(item.sellPrice) : null)
        : glassVar?.price != null ? Number(glassVar.price)
        : bottleVar?.price != null ? Number(bottleVar.price)
        : item.squareSellPrice != null ? Number(item.squareSellPrice) : null
      const sellBottlePrice = bottleVar?.price != null ? Number(bottleVar.price)
        : item.squareSellPriceBottle != null ? Number(item.squareSellPriceBottle) : null

      // Markup: for wines use glass × 5 vs bottle cost; for spirits use nip vs nip cost; for others use unit
      const serves = isWine && glassVar ? 5 : 1
      const revenue = sellGlassPrice != null ? sellGlassPrice * serves : null
      const markup  = buy != null && buy > 0 && revenue != null ? Math.round((revenue - buy) / buy * 1000) / 10 : null

      // Suggested sell prices rounded UP to nearest $0.25 at 40% markup
      const suggSell    = buy != null ? mceil(buy * (1 + TARGET/100) / serves, 0.25) : null
      const suggBtl     = buy != null && isWine ? mceil(buy * (1 + TARGET/100), 0.25) : null
      const markupBtlVal = buy != null && buy > 0 && sellBottlePrice != null && isWine
        ? Math.round((sellBottlePrice - buy) / buy * 1000) / 10 : null

      rNum++
      const row = ws.addRow({
        name:       item.name,
        cat:        item.category,
        sup:        item.supplier || '',
        buy:        buy ?? '',
        sellGlass:  sellGlassPrice ?? '',
        sellBottle: isWine ? (sellBottlePrice ?? '') : '',
        markup:     '',
        markupBtl:  '',
        suggSell:   suggSell ?? '',
        suggBtl:    suggBtl ?? '',
        onHand:     item.onHand ?? 0,
        notes:      '',
      })

      // Format numeric cells
      if (buy != null)            { row.getCell('buy').numFmt      = '"$"#,##0.000' }
      if (sellGlassPrice != null) { row.getCell('sellGlass').numFmt = '"$"#,##0.00' }
      if (sellBottlePrice != null && isWine) { row.getCell('sellBottle').numFmt = '"$"#,##0.00' }
      if (suggSell != null)       { row.getCell('suggSell').numFmt  = '"$"#,##0.00' }
      if (suggBtl  != null)       { row.getCell('suggBtl').numFmt   = '"$"#,##0.00' }

      row.getCell('onHand').numFmt = '#,##0'

      // Markup cells — plain values (no formulas avoids Excel XML corruption)
      row.getCell('markup').value = markup ?? ''
      if (markup != null) {
        row.getCell('markup').numFmt = '0.0"%"'
        const mc = mColor(markup)
        if (mc) row.getCell('markup').fill = { type:'pattern', pattern:'solid', fgColor:mc }
        const mf = mFont(markup)
        if (mf) row.getCell('markup').font = { bold:true, color:{ argb:'FF'+mf } }
      }
      if (markupBtlVal != null) {
        row.getCell('markupBtl').value  = markupBtlVal
        row.getCell('markupBtl').numFmt = '0.0"%"'
        const mc2 = mColor(markupBtlVal)
        if (mc2) row.getCell('markupBtl').fill = { type:'pattern', pattern:'solid', fgColor:mc2 }
        const mf2 = mFont(markupBtlVal)
        if (mf2) row.getCell('markupBtl').font = { bold:true, color:{ argb:'FF'+mf2 } }
      }
      // Row styling
      const rowBg = rNum % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'
      row.eachCell({ includeEmpty:true }, cell => {
        if (!cell.fill || cell.fill.fgColor?.argb === rowBg) {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:rowBg } }
        }
        cell.alignment = { vertical:'middle' }
      })
      row.getCell('markup').alignment = { vertical:'middle', horizontal:'center' }
      row.getCell('onHand').alignment  = { vertical:'middle', horizontal:'right' }


    }

    // ── Column header note for wines ────────────────────────────────────────
    ws.getRow(1).getCell('buy').note = 'Per bottle (wines) · Per nip (spirits) · Per unit (others). Manually entered buy price.'

    // ── Freeze header ───────────────────────────────────────────────────────
    ws.views = [{ state:'frozen', ySplit:1 }]
    ws.autoFilter = { from:'A1', to:'L1' }

    // ── Summary section ─────────────────────────────────────────────────────
    ws.addRow([])
    const sumRow = ws.addRow(['SUMMARY', '', '', '', '', '', '', '', '', '', '', '', ''])
    sumRow.getCell(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+NAVY } }
    sumRow.getCell(1).font = { bold:true, color:{ argb:'FFFFFFFF' } }
    ws.mergeCells(`A${sumRow.number}:L${sumRow.number}`)

    const activeItems = allItems.filter(i => !rundownItems[i.name])
    const withBuy     = activeItems.filter(i => i.buyPrice != null && i.buyPrice !== '')
    const belowTarget = withBuy.filter(i => {
      const buy = Number(i.buyPrice)
      if (!buy) return false
      const vars = i.variations || []
      const glassVar = vars.find(v => v.name?.toLowerCase().includes('glass'))
      const bottleVar = vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
      const nipVar = vars.find(v => v.name?.toLowerCase().includes('nip'))
      const sell = i.isSpirit
        ? (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (i.sellPrice ? Number(i.sellPrice) : null)
        : glassVar?.price != null ? Number(glassVar.price) : (bottleVar?.price != null ? Number(bottleVar.price) : (i.squareSellPrice != null ? Number(i.squareSellPrice) : null))
      if (sell == null) return false
      const isWine = WINE_C.includes(i.category)
      const serves = isWine && glassVar ? 5 : 1
      const markup = (sell * serves - buy) / buy * 100
      return markup < TARGET
    })

    const stats = [
      ['Total active items tracked', activeItems.length],
      ['Items with price data', withBuy.length],
      ['Items below 40% markup target', belowTarget.length],
      ['Report generated', new Date().toLocaleString('en-AU', { timeZone:'Australia/Brisbane' })],
    ]
    for (const [label, value] of stats) {
      const r = ws.addRow([label, '', value])
      r.getCell(1).font  = { bold:false, color:{ argb:'FF374151' } }
      r.getCell(3).font  = { bold:true,  color:{ argb:'FF'+NAVY } }
      r.getCell(3).alignment = { horizontal:'left' }
      ws.mergeCells(`A${r.number}:B${r.number}`)
    }

    // ── Download ────────────────────────────────────────────────────────────
    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-')
    a.href = url; a.download = `PricingAnalysis-${date}.xlsx`; a.click()
    URL.revokeObjectURL(url)
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
      let markupPct = null, btlMarkupPct = null
      if (buy != null && sell != null && buy > 0) {
        if (item.isSpirit) markupPct = (sell-buy)/buy*100
        else if (isWine && sellUnit==='glass') { const rev=sell*servesPB; markupPct=buy>0?(rev-buy)/buy*100:null }
        else markupPct = (sell-buy)/buy*100
      }
      if (isWine && sellBottle!=null && buy!=null && buy>0) btlMarkupPct=(sellBottle-buy)/buy*100
      const fmt = (n) => n!=null ? '$'+Number(n).toFixed(2) : '—'
      const fmtPct = (p) => p!=null ? p.toFixed(1)+'%' : '—'
      const mColor = (p) => p==null?'#94a3b8':p<25?'#991b1b':p<40?'#d97706':'#16a34a'
      return `<tr>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td style='text-align:center;font-size:10px'>${sellUnit}</td>
        <td style='text-align:right;font-family:monospace'>${fmt(buy)}</td>
        <td style='text-align:right;font-family:monospace'>${fmt(sell)}</td>
        <td style='text-align:right;font-family:monospace'>${isWine ? fmt(sellBottle) : ''}</td>
        <td style='text-align:right;font-weight:700;color:${mColor(markupPct)}'>${fmtPct(markupPct)}</td>
        <td style='text-align:right;font-weight:700;color:${mColor(btlMarkupPct)}'>${isWine ? fmtPct(btlMarkupPct) : ''}</td>
        <td style='text-align:right;color:#64748b'>${item.onHand??0}</td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>Pricing Analysis - Paynter Bar</title>
<style>body{font-family:Arial,sans-serif;font-size:11px;margin:15px}h2{color:#1e3a5f;margin-bottom:4px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:16px;font-size:9px;color:#94a3b8}@media print{body{margin:8px}}</style>
</head><body>
<h2>Pricing Analysis \u2014 Paynter Bar</h2>
<p style='color:#64748b;font-size:10px;margin-bottom:10px'>${new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'})} \u00b7 ${allItems.length} items \u00b7 Markup shown on primary sell unit</p>
<table><thead><tr><th>Item</th><th>Category</th><th>Unit</th><th style='text-align:right'>Buy</th><th style='text-align:right'>Sell</th><th style='text-align:right'>Btl Sell</th><th style='text-align:right'>Markup</th><th style='text-align:right'>Btl Markup</th><th style='text-align:right'>Stock</th></tr></thead><tbody>${rows}</tbody></table>
<div class='footer'>Paynter Bar Hub \u00b7 GemLife Palmwoods \u00b7 All items including zero stock</div></body></html>`
    const w = window.open('','_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 500)
  }

  function exportStocktake() {
    ;(async () => {
      await loadExcelJS()
      const ExcelJS = window.ExcelJS
      const wbSt = new ExcelJS.Workbook()
      const wsSt = wbSt.addWorksheet('Stocktake')
      wsSt.views = [{ state:'frozen', ySplit:1 }]
      wsSt.columns = [
        { width:40 },{ width:18 },{ width:16 },{ width:12 },{ width:12 },{ width:8 },
        { width:13 },{ width:12 },{ width:12 },{ width:16 },{ width:12 },
      ]
      const hRow = wsSt.addRow(['Item','Category','Supplier','Cool Room','Store Room','Bar','Total Count','Nips/Bottle','Total Nips','Square On Hand','Difference'])
      hRow.height = 28
      hRow.eachCell(cell => {
        cell.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:12 }
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0F172A' } }
        cell.alignment = { horizontal:'center', vertical:'center', wrapText:true }
        cell.border = { bottom:{ style:'medium', color:{ argb:'FF2563EB' } } }
      })
      displayed.forEach((item, idx) => {
        const rowNum = idx + 2
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'
        const nipsPerBottle = item.isSpirit ? +((item.bottleML || 700) / (item.nipML || 30)).toFixed(1) : ''
        const row = wsSt.addRow([
          item.name, item.category, item.supplier, '', '', '',
          { formula: `D${rowNum}+E${rowNum}+F${rowNum}` },
          nipsPerBottle || '',
          item.isSpirit ? { formula: `G${rowNum}*H${rowNum}` } : '',
          item.onHand,
          item.isSpirit ? { formula: `I${rowNum}-J${rowNum}` } : { formula: `G${rowNum}-J${rowNum}` },
        ])
        row.eachCell({ includeEmpty:true }, (cell, cn) => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bg } }
          if (cn > 3) cell.alignment = { horizontal:'center' }
          if ([7,8,9,11].includes(cn)) cell.numFmt = '0.0'
        })
        row.getCell(1).font = { size:11 }
        row.getCell(2).font = { size:10, color:{ argb:'FF64748B' } }
        row.getCell(3).font = { size:10, color:{ argb:'FF64748B' } }
      })
      await xlsDownload(wbSt, `Paynter-Bar-Stocktake-${new Date().toISOString().split('T')[0]}.xlsx`)
    })()
  }

  const dontOrder = item => !!rundownItems[item.name]

  const displayed = items
    .filter(item => view === 'all' || item.supplier === view)


  const onOrderCount = Object.keys(orderedItems).length
  const orderCount   = items.filter(i => i.orderQty > 0 && !orderedItems[i.name] && !dontOrder(i)).length
  const critCount    = items.filter(i => i.priority === 'CRITICAL' && !dontOrder(i)).length

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

  // ── NAV DEFINITION ─ component-level so both sidebar and mobile drawer can access it ──
  const NAV_ITEMS = [
    { icon: '❓', label: 'Help & Guide',     tab: 'help',         topLevel: true, action: () => setMainTab(t => t==='help'?'reorder':'help') },
    { divider: true, section: null },
    { icon: '🏠', label: 'Dashboard',        tab: 'home',         topLevel: true, action: () => { setMainTab('home'); setMenuOpen(false) } },
    { icon: '📦', label: 'Stock Items', tab: 'reorder',      topLevel: true, action: () => setMainTab('reorder') },
    { icon: '🗑️', label: 'Wastage Log',      tab: 'wastage',      topLevel: true, action: () => { const n=mainTab==='wastage'?'reorder':'wastage'; setMainTab(n); if(n==='wastage') loadWastageLog() } },
    { divider: true, section: 'Stock' },
    { icon: '📋', label: 'Stocktake',        tab: 'stocktake',    action: () => setMainTab(t => t==='stocktake'?'reorder':'stocktake') },
    { icon: '🗓️', label: 'SOH History',      tab: 'sohhistory',   action: () => setMainTab(t => t==='sohhistory'?'reorder':'sohhistory') },
    { icon: '📅', label: 'Monthly Report',  tab: 'monthlyreport', action: () => setMainTab(t => t==='monthlyreport'?'reorder':'monthlyreport') },
    { divider: true, section: 'Analytics' },
    { icon: '📊', label: 'Sales Report',     tab: 'sales',        action: () => { const n=mainTab==='sales'?'reorder':'sales'; setMainTab(n); if(n==='sales'&&!salesReport) loadSalesReport(salesPeriod,salesCustom) } },
    { divider: true, section: 'Manage' },
    { icon: '⭐', label: 'Specials',          tab: 'specials',     action: () => setMainTab(t => t==='specials'?'reorder':'specials') },
    { icon: '🏷️', label: 'Price List',       tab: 'pricelist',    action: () => setMainTab(t => t==='pricelist'?'reorder':'pricelist') },
    { icon: '💲', label: 'Pricing',           tab: 'pricing',      action: () => setMainTab(t => t==='pricing'?'reorder':'pricing') },
    ...(!readOnly ? [{ icon: '📝', label: 'Notes', tab: 'notes', action: () => { const n=mainTab==='notes'?'reorder':'notes'; setMainTab(n); if(n==='notes'&&!notesLoaded) loadNotes() } }] : []),
    { divider: true, section: 'Records' },
    { icon: '📁', label: 'PO Documents',     tab: 'documents',    action: () => { const n=mainTab==='documents'?'reorder':'documents'; setMainTab(n); if(n==='documents') loadDocuments() } },
    { icon: '📄', label: 'Price History',    tab: 'pricehistory', action: () => setMainTab(t => t==='pricehistory'?'reorder':'pricehistory') },
    { icon: '🖨️', label: 'Barcode Sheet',    tab: 'barcodesheet', action: () => setMainTab(t => t==='barcodesheet'?'reorder':'barcodesheet') },
    { icon: '👥', label: 'Roster',            tab: 'roster',       action: () => window.open('/roster','_blank') },
    ...(!readOnly ? [
      { divider: true, section: null },
      { icon: '⚙️', label: 'Settings', tab: 'settings', topLevel: true, action: () => { setMainTab(t => t==='settings'?'reorder':'settings'); fetch('/api/settings?action=getAudit').then(r=>r.json()).then(d => setSettingsAuditData(d.audit || {})) } },
    ] : []),
  ]

  return (
    <>
      <Head>
        <title>Paynter Bar Hub</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          .sidebar { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
          .mobile-drawer { display: none !important; }
          .mobile-backdrop { display: none !important; }
          .dash-stats   { grid-template-columns: repeat(5, 1fr) !important; }
          .dash-features { grid-template-columns: repeat(4, 1fr) !important; }
          @media (max-width: 900px) {
            .sidebar      { display: none  !important; }
            .mobile-menu-btn { display: block !important; }
            .mobile-drawer {
              display: flex !important;
              position: fixed; top: 0; left: 0; height: 100%; width: 280px;
              background: #0f172a; z-index: 1000;
              transform: translateX(-100%);
              transition: transform 0.25s ease;
              overflow-y: auto; box-shadow: 4px 0 24px rgba(0,0,0,0.5);
              flex-direction: column;
            }
            .mobile-drawer.open { transform: translateX(0); }
            .mobile-backdrop {
              display: none !important; position: fixed; inset: 0;
              background: rgba(0,0,0,0.5); z-index: 999;
            }
            .mobile-backdrop.open { display: block !important; }
            .stats-bar    { padding: 0 16px !important; }
            .stat-cell    { padding: 10px 14px !important; min-width: 70px; }
            .stat-num     { font-size: 18px !important; }
            .dash-stats   { grid-template-columns: repeat(2, 1fr) !important; }
            .dash-features { grid-template-columns: repeat(2, 1fr) !important; }
            .dash-wrap { padding: 12px 12px !important; }
            .view-wrap  { padding: 12px 12px !important; }
            .two-col-grid { grid-template-columns: 1fr !important; }
            .form-two-col { grid-template-columns: 1fr !important; }
            input[type=number], input[type=text], input[type=date], input[type=password], select, textarea {
              min-height: 44px !important;
              font-size: 16px !important;
            }
          }
        `}</style>
      </Head>
      <div style={styles.page}>
        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        {(() => {
          const SC = sidebarCollapsed

          const navItems = NAV_ITEMS

          const T = THEMES[hubTheme] || THEMES.navy

          return (
            <>
            <style>{`
              :root { --sb-accent: ${T.accent}; }
            `}</style>
            <aside className="sidebar" style={{
              width: SC ? 52 : 210, minWidth: SC ? 52 : 210,
              background: T.sbBg, display: 'flex', flexDirection: 'column',
              transition: 'width 0.2s ease, min-width 0.2s ease',
              boxShadow: '2px 0 10px rgba(0,0,0,0.2)', zIndex: 200, overflowX: 'hidden',
            }}>
              {/* Brand */}
              <div style={{ padding: SC ? '14px 0' : '16px 14px 12px', borderBottom: `1px solid ${T.sbBorder}`, display: 'flex', alignItems: 'center', gap: 9, justifyContent: SC ? 'center' : 'flex-start', flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, background: T.brandBg, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🍺</div>
                {!SC && <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.navText, lineHeight: 1.2, whiteSpace: 'nowrap' }}>Paynter Bar</div>
                  <div style={{ fontSize: 10, color: T.navMuted, whiteSpace: 'nowrap' }}>GemLife Palmwoods</div>
                </div>}
              </div>
              {/* Flat nav */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
                {navItems.map((item, idx) => {
                  if (item.divider) return (
                    <div key={idx}>
                      <div style={{ margin: SC ? '3px 6px' : '3px 12px', height: 1, background: T.sbBorder }} />
                      {item.section && !SC && (
                        <div style={{ padding: '6px 14px 2px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.navMuted }}>
                          {item.section}
                        </div>
                      )}
                    </div>
                  )
                  const isActive = mainTab === item.tab
                  return (
                    <button key={item.tab + idx} onClick={() => { item.action(); setMenuOpen(false) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                        padding: SC ? '8px 0' : item.topLevel ? '8px 12px' : '6px 12px 6px 22px',
                        background: isActive ? T.sbActive : 'none', border: 'none',
                        borderLeft: isActive && !SC ? `3px solid ${T.accent}` : '3px solid transparent',
                        cursor: 'pointer',
                        color: isActive ? T.navText : item.topLevel ? T.navText : T.navItem,
                        fontSize: 12, fontWeight: isActive ? 700 : item.topLevel ? 600 : 400,
                        justifyContent: SC ? 'center' : 'flex-start', transition: 'background 0.1s' }}>
                      <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                      {!SC && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                    </button>
                  )
                })}
              </div>
              {/* Collapse */}
              <div style={{ borderTop: `1px solid ${T.sbBorder}`, flexShrink: 0 }}>
                {/* Theme picker now lives in Settings > Appearance */}
                <button onClick={() => setSidebarCollapsed(c => !c)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: SC ? '12px 0' : '10px 14px', minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: T.navMuted, justifyContent: SC ? 'center' : 'flex-start', fontSize: 12 }}>
                  <span style={{ fontSize: 16, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{SC ? '»' : '«'}</span>
                  {!SC && <span>Collapse</span>}
                </button>
                {readOnly && !SC && <div style={{ padding: '0 14px 10px', fontSize: 10, color: T.navMuted, textAlign: 'center' }}>👁 Read only</div>}
              </div>
            </aside>
            </>
          )
        })()}

        {/* ── MAIN COLUMN ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0, overflowX: 'hidden', overflowY: 'visible' }}>

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
                  {mainTab === 'sales' ? '📊 Sales Report' : mainTab === 'help' ? '❓ Help & Guide' : mainTab === 'pricelist' ? '🏷️ Price List' : mainTab === 'pricing' ? '💲 Pricing' : mainTab === 'home' ? '🏠 Dashboard' : mainTab === 'stocktake' ? '📋 Stocktake' : mainTab === 'wastage' ? '🗑️ Wastage Log' : mainTab === 'notes' ? '📝 Notes' : mainTab === 'specials' ? '⭐ Specials Display' : mainTab === 'documents' ? '📁 PO Documents' : mainTab === 'settings' ? '⚙️ Settings' : mainTab === 'pricehistory' ? '📄 Price History' :'📦 Stock Items'}
                </h1>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {lastUpdated && <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace" }}>Updated {new Date(lastUpdated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button style={{ ...styles.btn, ...(refreshing ? styles.btnDisabled : {}), padding: '7px 16px', fontSize: 12 }} onClick={() => { loadItems(true) }} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh from Square'}</button>
            </div>
          </div>

          {/* Mobile slide-in drawer — mobile only, desktop unaffected */}
          <div className={`mobile-backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
          <div className={`mobile-drawer${menuOpen ? ' open' : ''}`}>
            {/* Drawer header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #1e293b', flexShrink:0 }}>
              <span style={{ color:'#94a3b8', fontSize:13, fontWeight:700, letterSpacing:'0.08em' }}>PAYNTER BAR HUB</span>
              <button onClick={() => setMenuOpen(false)}
                style={{ background:'none', border:'none', color:'#94a3b8', fontSize:22, cursor:'pointer', lineHeight:1, padding:'2px 6px' }}>✕</button>
            </div>
            {/* Nav items — driven by NAV_ITEMS, same source as icon sidebar */}
            {NAV_ITEMS.map((item, idx) => {
              if (item.divider) return (
                <div key={`div-${idx}`}>
                  {item.section && (
                    <div style={{ padding:'10px 20px 4px', color:'#475569', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                      {item.section}
                    </div>
                  )}
                </div>
              )
              const isActive = mainTab === item.tab
              return (
                <button key={item.tab + idx} onClick={() => { item.action(); setMenuOpen(false) }}
                  style={{ display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
                    background: isActive ? 'rgba(96,165,250,0.12)' : 'transparent',
                    color: isActive ? '#60a5fa' : '#cbd5e1',
                    border:'none', borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
                    padding:'12px 20px', fontSize:15, fontWeight: isActive ? 700 : 400, cursor:'pointer' }}>
                  {item.icon && <span style={{ fontSize:16, width:20, textAlign:'center', flexShrink:0 }}>{item.icon}</span>}
                  {item.label}
                </button>
              )
            })}
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
            <div className="stat-cell" style={{ ...styles.stat, borderTopColor: '#16a34a', cursor: onOrderCount > 0 ? 'pointer' : 'default' }}
              onClick={() => {
                if (!onOrderCount) return
                // Flatten — an item may appear on more than one order at once
                const flat = []
                for (const [name, arr] of Object.entries(orderedItems)) {
                  for (const info of (arr || [])) {
                    if ((info.orderQty || 0) > 0) flat.push([name, info])
                  }
                }
                if (!flat.length) return
                const firstSupplier = flat[0][1].supplier
                const firstRef = flat[0][1].ref || ''
                const supplierItems = flat
                  .filter(([, info]) => info.supplier === firstSupplier && (info.ref || '') === firstRef)
                  .map(([name, info]) => ({ name, ...info }))
                setViewOrderModal({ supplier: firstSupplier, items: supplierItems, ref: firstRef })
              }}>
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


        {/* ── ORDER WIZARD ──────────────────────────────────────────── */}
            {orderWizard && (() => {
              const wiz = orderWizard
              // Build order items per supplier — use effective qty (override takes precedence over auto)
              const orderBySup = {}
              for (const sup of suppliers) {
                const supItems = items.filter(i => {
                  const effectiveQty = orderQtyOverrides[i.name] !== undefined ? orderQtyOverrides[i.name] : i.orderQty
                  return i.supplier === sup &&
                    (orderMode === 'additional' || effectiveQty > 0) &&
                    !rundownItems[i.name] &&
                    !/do\s*n'?t\s+order|do\s+not\s+order/i.test(i.notes || '')
                })
                if (supItems.length > 0) orderBySup[sup] = supItems
              }
              const suppliersToOrder = Object.keys(orderBySup)
              // If no suppliers have items to order, allow manual selection from all suppliers
              const allSuppliers = suppliers
              const activeSup = wiz.supplier || suppliersToOrder[0] || allSuppliers[0]
              // Base items for this supplier with order qty > 0
              const baseSupItems = orderBySup[activeSup] || []
              // Also include any manually added items (in wizQtys but not in baseSupItems)
              const baseNames = new Set(baseSupItems.map(i => i.name))
              const addedSupItems = items.filter(i =>
                i.supplier === activeSup &&
                !baseNames.has(i.name) &&
                wizQtys[i.name] != null &&
                wizQtys[i.name] > 0
              )
              const supItems = [...baseSupItems, ...addedSupItems]
              // Single-supplier mode — only process the one supplier this wizard was opened for

              const STEPS = ['Review Quantities', 'Place Order', 'Record Confirmation', 'Done']

              return (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                  <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:640, maxHeight:'90vh', overflowY:'auto', WebkitOverflowScrolling:'touch', boxShadow:'0 24px 80px rgba(0,0,0,0.4)' }}>

                    {/* Header */}
                    <div style={{ background:'linear-gradient(135deg,#1e3a5f,#0e7490)', borderRadius:'16px 16px 0 0', padding:'20px 24px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                        <div style={{ color:'#fff', fontWeight:800, fontSize:16 }}>
                          📋 {orderMode === 'additional' ? 'Additional Order' : 'Weekly Order'}
                        </div>
                        <button onClick={() => { setOrderWizard(null); setWizInvoiceFile(null) }} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 }}>✕ Exit</button>
                      </div>
                      {/* Progress bar */}
                      <div style={{ display:'flex', gap:4 }}>
                        {STEPS.map((s, i) => (
                          <div key={i} style={{ flex:1 }}>
                            <div style={{ height:4, borderRadius:2, background: i < wiz.step ? '#fff' : 'rgba(255,255,255,0.3)' }} />
                            <div style={{ color: i < wiz.step ? '#fff' : 'rgba(255,255,255,0.5)', fontSize:10, marginTop:4, textAlign:'center', fontWeight: i === wiz.step-1 ? 700 : 400 }}>
                              {i+1}. {s}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding:'24px' }}>

                    {/* STEP 1: Review Quantities */}
                    {wiz.step === 1 && (
                      <div>
                        <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Review quantities to order</div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, color:'#64748b' }}>Supplier:</span>
                          <select value={activeSup} onChange={e => setOrderWizard(prev => ({ ...prev, supplier: e.target.value }))}
                            style={{ padding:'6px 12px', border:'2px solid #0e7490', borderRadius:6, fontSize:13, fontWeight:700, color:'#1e3a5f', cursor:'pointer' }}>
                            {suppliersToOrder.length > 0
                              ? suppliersToOrder.map(sup => <option key={sup} value={sup}>{sup} ({orderBySup[sup].length} items)</option>)
                              : allSuppliers.map(sup => <option key={sup} value={sup}>{sup}</option>)
                            }
                          </select>
                          {suppliersToOrder.length === 0 && (
                            <span style={{ fontSize:11, color:'#d97706', fontWeight:600 }}>⚠️ All items on order — use + Add item below to add extras</span>
                          )}
                          <button onClick={() => {
                            const date = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' })
                            const rows = supItems
                              .filter(item => (wizQtys[item.name] ?? (item.isSpirit ? item.nipsToOrder : item.orderQty)) > 0)
                              .map(item => {
                                const qty = wizQtys[item.name] ?? (item.isSpirit ? item.nipsToOrder : item.orderQty)
                                const unit = item.isSpirit ? `${qty} nips (${item.bottlesToOrder || Math.ceil(qty / ((item.bottleML||700)/(item.nipML||30)))} btl)` : `${qty} units`
                                const crit = item.priority === 'CRITICAL' ? ' ⚠' : ''
                                return `<tr>
                                  <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:${item.priority==='CRITICAL'?'700':'400'};color:${item.priority==='CRITICAL'?'#dc2626':'#111'}">${item.name}${crit}</td>
                                  <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#64748b">${item.onHand}</td>
                                  <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${unit}</td>
                                  <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;width:120px"></td>
                                </tr>`
                              }).join('')
                            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order List — ${activeSup} — ${date}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;margin:24px}
  h2{font-size:18px;margin:0 0 4px}
  .sub{color:#64748b;font-size:12px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse}
  th{background:#1e3a5f;color:#fff;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  th:nth-child(2),th:nth-child(3){text-align:right}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{margin-top:20px;font-size:10px;color:#94a3b8}
  @media print{body{margin:10px}}
</style></head><body>
<h2>Suggested Order — ${activeSup}</h2>
<div class="sub">Paynter Bar, GemLife Palmwoods &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; ⚠ = CRITICAL</div>
<table>
  <thead><tr>
    <th>Item</th>
    <th>On Hand</th>
    <th>Suggested Qty</th>
    <th>Actual Qty</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Generated by Paynter Bar Hub · Quantities are suggestions — adjust as needed before placing order</div>
</body></html>`
                            const w = window.open('', '_blank')
                            if (!w) { alert('Popup blocked — please allow popups and try again'); return }
                            w.document.write(html)
                            w.document.close()
                            setTimeout(() => { w.focus(); w.print() }, 400)
                          }}
                          style={{ padding:'6px 14px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', marginLeft:'auto' }}>
                            🖨️ Print Order List
                          </button>
                        </div>

                        {/* Items table */}
                        <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', marginBottom:20 }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                            <thead>
                              <tr style={{ background:'#f1f5f9' }}>
                                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#374151' }}>Item</th>
                                <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, color:'#374151', width:80 }}>On Hand</th>
                                <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, color:'#374151', width:100 }}>Order Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(orderMode === 'additional' ? supItems : supItems.filter(item => (wizQtys[item.name] ?? (item.isSpirit ? item.nipsToOrder : item.orderQty)) > 0)).map((item, i) => (
                                <tr key={item.name} style={{ background: i%2===0?'#fff':'#f8fafc', borderTop:'1px solid #f1f5f9' }}>
                                  <td style={{ padding:'10px 14px' }}>
                                    <div style={{ fontWeight:600, color:'#0f172a', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                      {item.name}
                                      {orderedItems[item.name] && (
                                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:4, background:'#dcfce7', color:'#16a34a', whiteSpace:'nowrap' }}>🛒 ON ORDER</span>
                                      )}
                                    </div>
                                    {item.priority === 'CRITICAL' && <span style={{ fontSize:10, color:'#dc2626', fontWeight:700 }}>● CRITICAL</span>}
                                  </td>
                                  <td style={{ padding:'10px 14px', textAlign:'center', color:'#64748b' }}>{item.onHand}</td>
                                  <td style={{ padding:'10px 14px', textAlign:'center' }}>
                                    <input type="number" min={0} value={wizQtys[item.name] ?? item.orderQty}
                                      onChange={e => setWizQtys(prev => ({ ...prev, [item.name]: Number(e.target.value) }))}
                                      style={{ width:70, padding:'5px 8px', border:'2px solid #0e7490', borderRadius:6, textAlign:'center', fontWeight:700, fontSize:13 }} />
                                    <div style={{ fontSize:10, color:'#94a3b8' }}>{item.isSpirit ? 'nips' : 'units'}</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Add extra item not flagged for ordering */}
                        {(() => {
                          const alreadyInList = new Set(supItems.map(i => i.name))
                          const addableItems = items.filter(i =>
                            i.supplier === activeSup &&
                            !alreadyInList.has(i.name) &&
                            !rundownItems[i.name]
                          )
                          if (addableItems.length === 0) return null
                          return (
                            <div style={{ marginBottom:16, padding:'10px 14px', background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:8 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>+ Add item not flagged for ordering</div>
                              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                                <select id="wiz-add-item"
                                  onChange={e => {
                                    const name = e.target.value
                                    const item = addableItems.find(i => i.name === name)
                                    const qtyEl = document.getElementById('wiz-add-qty')
                                    const unitEl = document.getElementById('wiz-add-unit')
                                    if (item?.isSpirit) {
                                      if (qtyEl) qtyEl.value = '1'
                                      if (unitEl) unitEl.textContent = 'btl'
                                    } else {
                                      if (qtyEl) qtyEl.value = '1'
                                      if (unitEl) unitEl.textContent = 'units'
                                    }
                                  }}
                                  style={{ flex:1, minWidth:180, padding:'6px 10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:12, color:'#374151' }}>
                                  <option value="">Select item…</option>
                                  {addableItems.map(i => (
                                    <option key={i.name} value={i.name}>{i.name}{i.isSpirit ? ' 🥃' : ''} (on hand: {i.onHand ?? 0})</option>
                                  ))}
                                </select>
                                <input type="number" inputMode="numeric" id="wiz-add-qty" min={1} defaultValue={1}
                                  placeholder="Qty"
                                  style={{ width:70, padding:'6px 8px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:12, textAlign:'center' }} />
                                <span id="wiz-add-unit" style={{ fontSize:11, color:'#94a3b8', minWidth:28 }}>units</span>
                                <button onClick={() => {
                                  const sel = document.getElementById('wiz-add-item')
                                  const qtyEl = document.getElementById('wiz-add-qty')
                                  const name = sel?.value
                                  const qty = Number(qtyEl?.value) || 1
                                  if (!name) return
                                  const item = addableItems.find(i => i.name === name)
                                  if (!item) return
                                  // For spirits, qty input is bottles — convert to nips
                                  const nipsPerBottle = item.isSpirit ? Math.round((item.bottleML || 700) / (item.nipML || 30)) : null
                                  const finalQty = item.isSpirit ? qty * nipsPerBottle : qty
                                  setWizQtys(prev => ({ ...prev, [name]: finalQty }))
                                  setOrderWizard(prev => ({ ...prev, _addedItems: { ...(prev._addedItems || {}), [name]: true } }))
                                  if (sel) sel.value = ''
                                  if (qtyEl) qtyEl.value = '1'
                                  const unitEl = document.getElementById('wiz-add-unit')
                                  if (unitEl) unitEl.textContent = 'units'
                                }}
                                  style={{ padding:'6px 14px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                  Add
                                </button>
                              </div>
                            </div>
                          )
                        })()}

                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>

                          <button onClick={() => setOrderWizard(prev => ({ ...prev, step: 2 }))}
                            style={{ background:'#1e3a5f', color:'#fff', border:'none', borderRadius:8, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                            Quantities look good →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Confirm & Adjust Order */}
                    {wiz.step === 2 && (
                      <div>
                        <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Confirm your order</div>
                        <div style={{ fontSize:13, color:'#64748b', marginBottom:12 }}>Place the order with <strong>{activeSup}</strong> then update quantities below to match what was actually ordered — remove unavailable items by setting qty to 0.</div>

                        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:10, marginBottom:14, fontSize:12 }}>
                          💡
                          {activeSup === "Dan Murphy's" && " Dan Murphy's: danmurphys.com.au → My Account → Order History"}
                          {activeSup === 'Coles Woolies' && ' Coles: coles.com.au — Woolworths: woolworths.com.au'}
                          {activeSup === 'ACW' && ' ACW: acwsunshine.com.au'}
                          {!["Dan Murphy's",'Coles Woolies','ACW'].includes(activeSup) && ` Place your order with ${activeSup} then update quantities below.`}
                        </div>

                        {/* Editable qty table — same as step 1 but framed as "confirm what you actually ordered" */}
                        <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                            <thead>
                              <tr style={{ background:'#1e3a5f', color:'#fff' }}>
                                <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>Item</th>
                                <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600 }}>Suggested</th>
                                <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600 }}>Qty Ordered</th>
                                {supItems.some(i => i.isSpirit) && <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600 }}>Bottles</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {supItems.map((item, i) => {
                                const suggested = item.isSpirit ? (item.nipsToOrder || item.orderQty) : item.orderQty
                                const qty = wizQtys[item.name] ?? suggested
                                const btl = item.isSpirit && qty > 0 ? (v => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(qty / ((item.bottleML || 700) / (item.nipML || 30))) : null
                                const removed = qty === 0
                                return (
                                  <tr key={item.name} style={{ background: removed ? '#fef2f2' : i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom:'1px solid #f1f5f9', opacity: removed ? 0.6 : 1 }}>
                                    <td style={{ padding:'6px 12px', fontWeight:500, color: removed ? '#94a3b8' : '#0f172a', textDecoration: removed ? 'line-through' : 'none' }}>{item.name}</td>
                                    <td style={{ padding:'6px 12px', textAlign:'right', color:'#94a3b8', fontSize:12 }}>
                                      {item.isSpirit ? `${suggested} nips` : `${suggested} units`}
                                    </td>
                                    <td style={{ padding:'6px 12px', textAlign:'right' }}>
                                      <input type="number" min={0} value={qty}
                                        onChange={e => setWizQtys(prev => ({ ...prev, [item.name]: Math.max(0, Number(e.target.value)) }))}
                                        style={{ width:70, padding:'3px 8px', border:'1px solid #cbd5e1', borderRadius:5, fontSize:13, textAlign:'right',
                                          background: removed ? '#fef2f2' : qty !== suggested ? '#fffbeb' : '#fff',
                                          color: removed ? '#dc2626' : qty !== suggested ? '#d97706' : '#0f172a', fontWeight:600 }} />
                                      <span style={{ fontSize:11, color:'#94a3b8', marginLeft:4 }}>{item.isSpirit ? 'nips' : 'units'}</span>
                                    </td>
                                    {supItems.some(i2 => i2.isSpirit) && (
                                      <td style={{ padding:'6px 12px', textAlign:'right', fontFamily:'monospace', color:'#64748b', fontSize:12 }}>
                                        {btl != null ? `${btl} btl` : '—'}
                                      </td>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {supItems.some(i => (wizQtys[i.name] ?? (i.isSpirit ? i.nipsToOrder : i.orderQty)) !== (i.isSpirit ? i.nipsToOrder : i.orderQty)) && (
                          <div style={{ fontSize:11, color:'#d97706', marginBottom:12 }}>
                            ⚠️ Some quantities differ from suggestions — amber values will be recorded as ordered.
                          </div>
                        )}

                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <button onClick={() => setOrderWizard(prev => ({ ...prev, step: 1 }))}
                            style={{ background:'#f1f5f9', color:'#374151', border:'none', borderRadius:8, padding:'12px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                            ← Back
                          </button>
                          <button onClick={async () => {
                            // Pre-populate poRef with auto-generated Hub PO number if not already set
                            if (!wiz.poRef) {
                              try {
                                const r = await fetch('/api/purchase-order?action=previewNumber')
                                const d = await r.json()
                                const ABBR = { "Dan Murphy's": 'DAN', 'Coles Woolies': 'COLE', 'ACW': 'ACW' }
                                const abbr = ABBR[activeSup] || activeSup.replace(/[^a-zA-Z]/g,'').slice(0,4).toUpperCase()
                                const brisDate = new Intl.DateTimeFormat('en-AU', { timeZone:'Australia/Brisbane', day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date()).replace(/\//g,' ')
                                setOrderWizard(prev => ({ ...prev, step: 3, poRef: `${abbr}-PO-${d.num}-${brisDate}` }))
                              } catch {
                                setOrderWizard(prev => ({ ...prev, step: 3 }))
                              }
                            } else {
                              setOrderWizard(prev => ({ ...prev, step: 3 }))
                            }
                          }} style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:8, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                            ✓ I've placed the order →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Record PO Reference */}
                    {wiz.step === 3 && (
                      <div>
                        <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Confirm the PO reference</div>
                        <div style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>The Hub PO number has been pre-filled. You can append or replace it with the supplier's confirmation number if you have one.</div>

                        <div style={{ marginBottom:20 }}>
                          <label style={{ display:'block', fontWeight:600, color:'#374151', marginBottom:6, fontSize:13 }}>
                            PO Reference
                          </label>
                          <input type="text" placeholder="e.g. COLE-PO-101-31 05 2025"
                            value={wiz.poRef}
                            onChange={e => setOrderWizard(prev => ({ ...prev, poRef: e.target.value }))}
                            style={{ width:'100%', padding:'12px 16px', border:'2px solid #0e7490', borderRadius:8, fontSize:15, fontWeight:600, boxSizing:'border-box', fontFamily:'monospace' }}
                            autoFocus />
                          <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>Supplier confirmation number (if any) can be appended — e.g. COLE-PO-101-31 05 2025 / 1666</div>
                        </div>

                        {/* Optional invoice attachment */}
                        <div style={{ marginBottom:20, padding:'14px 16px', background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:8 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>📎 Attach Invoice (optional)</div>
                          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:10 }}>If you have the invoice already, attach it now. It will be saved to OneDrive immediately.</div>
                          {!wizInvoiceFile ? (
                            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }}
                                onChange={async e => {
                                  const file = e.target.files?.[0]
                                  if (!file) return
                                  setWizInvoiceFile({ name: file.name, uploading: true })
                                  const base64 = await new Promise(resolve => {
                                    const reader = new FileReader()
                                    reader.onload = () => resolve(reader.result.split(',')[1])
                                    reader.readAsDataURL(file)
                                  })
                                  const poRef = wiz.poRef.trim()
                                  const ext = file.name.split('.').pop()
                                  const invName = poRef ? `${poRef.replace(/\s/g,'_')}-Invoice.${ext}` : file.name
                                  // Save to OneDrive immediately
                                  const odRes = await fetch('/api/onedrive/save-invoice', { method:'POST', headers:{'Content-Type':'application/json'},
                                    body: JSON.stringify({ filename:invName, base64, mimeType:file.type, supplier:activeSup }) }).catch(()=>null)
                                  const odData = odRes ? await odRes.json().catch(()=>({})) : {}
                                  setWizInvoiceFile({ name:invName, base64, mimeType:file.type, uploading:false, saved:!!odData.webUrl, webUrl:odData.webUrl||null })
                                }} />
                              <span style={{ fontSize:12, color:'#3b82f6', textDecoration:'underline' }}>Select PDF or image…</span>
                            </label>
                          ) : (
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              {wizInvoiceFile.uploading
                                ? <span style={{ fontSize:12, color:'#d97706', fontWeight:600 }}>⏳ Uploading…</span>
                                : <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>✓ {wizInvoiceFile.name}{wizInvoiceFile.saved ? ' — saved to OneDrive' : ''}</span>
                              }
                              {!wizInvoiceFile.uploading && (
                                <button onClick={() => setWizInvoiceFile(null)}
                                  style={{ fontSize:11, background:'none', border:'1px solid #e2e8f0', borderRadius:4, padding:'2px 8px', cursor:'pointer', color:'#64748b' }}>Remove</button>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <button onClick={() => setOrderWizard(prev => ({ ...prev, step: 2 }))}
                            style={{ background:'#f1f5f9', color:'#374151', border:'none', borderRadius:8, padding:'12px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                            ← Back
                          </button>
                          <button disabled={wiz.saving} onClick={async () => {
                            setOrderWizard(prev => ({ ...prev, saving: true, saveError: null }))
                            const poRef = wiz.poRef.trim() || `${activeSup.replace(/\s/g,'')}-${Date.now()}`
                            const orderItems = {}
                            for (const item of supItems) {
                              orderItems[item.name] = { supplier: activeSup, date: new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',year:'numeric'}), ref: poRef, orderQty: wizQtys[item.name] ?? item.orderQty, isSpirit: item.isSpirit, sku: item.sku }
                            }
                            // Build items as array — exclude zero-qty items
                            // hasOverride:true forces the API to overwrite any stale existing entry for these items
                            const poItemsArr = supItems.filter(item => (wizQtys[item.name] ?? (item.isSpirit ? item.nipsToOrder : item.orderQty)) > 0).map(item => ({
                              name: item.name,
                              sku: item.sku || '',
                              orderQty: wizQtys[item.name] ?? (item.isSpirit ? item.nipsToOrder : item.orderQty),
                              bottlesToOrder: item.bottlesToOrder || null,
                              isSpirit: item.isSpirit || false,
                              hasOverride: true,
                            }))
                            const r = await fetch('/api/purchase-order', { method:'POST', headers:{'Content-Type':'application/json'},
                              body: JSON.stringify({ action:'place', supplier: activeSup, ref: poRef, items: poItemsArr }) }).catch(()=>null)
                            const d = r ? await r.json().catch(()=>({})) : {}
                            if (!d.ok) {
                              setOrderWizard(prev => ({ ...prev, saving: false, saveError: d.error || 'Failed to save order — please try again.' }))
                              return
                            }
                            setOrderedItems(d.ordered)
                            // Create document record + save PO to OneDrive
                            const poDocRef = d.ref || poRef
                            const poOrderDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
                            fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                              body: JSON.stringify({ action:'order', po_ref: poDocRef, supplier: activeSup, order_date: poOrderDate, item_count: poItemsArr.length }) }).catch(()=>null)
                            // Link invoice to PO record if already uploaded
                            if (wizInvoiceFile?.webUrl) {
                              fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify({ action:'update_urls', po_ref: poDocRef, invoice_onedrive_url: wizInvoiceFile.webUrl }) }).catch(()=>null)
                            }
                            fetch('/api/onedrive/save-po', { method:'POST', headers:{'Content-Type':'application/json'},
                              body: JSON.stringify({ po_ref: poDocRef, supplier: activeSup,
                                order_date: new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',year:'numeric'}),
                                items: poItemsArr.map(i => ({ name:i.name, sku:i.sku||'', orderQty:i.orderQty, bottlesToOrder:i.bottlesToOrder||null, isSpirit:i.isSpirit||false })) }) })
                              .then(r => r.json()).then(od => {
                                if (od.webUrl) fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                                  body: JSON.stringify({ action:'update_urls', po_ref: poDocRef, po_onedrive_url: od.webUrl }) })
                              }).catch(()=>null)
                            // Single supplier — always go to done
                            setOrderWizard(prev => ({ ...prev, step: 4, saving: false, saveError: null }))
                          }} style={{ background: wiz.saving ? '#94a3b8' : '#1e3a5f', color:'#fff', border:'none', borderRadius:8, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                            {wiz.saving ? '⏳ Saving…' : '✓ Mark as Ordered →'}
                          </button>
                        </div>
                        {wiz.saveError && (
                          <div style={{ marginTop:12, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontSize:13, fontWeight:600 }}>
                            ⚠️ {wiz.saveError}
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 4: Done */}
                    {wiz.step === 4 && (
                      <div style={{ textAlign:'center', padding:'16px 0' }}>
                        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                        <div style={{ fontSize:20, fontWeight:800, color:'#0f172a', marginBottom:8 }}>All done!</div>
                        <div style={{ fontSize:14, color:'#64748b', marginBottom:24, lineHeight:1.6 }}>
                          Your orders have been recorded. When deliveries arrive, tap the <strong>Receive Delivery</strong> banner that appears on the Dashboard.
                        </div>
                        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:14, marginBottom:24, fontSize:13, textAlign:'left' }}>
                          <strong style={{ color:'#166534' }}>What happens next:</strong>
                          <ul style={{ margin:'8px 0 0', paddingLeft:20, color:'#374151', lineHeight:1.8 }}>
                            <li>A delivery banner will appear on the Dashboard when stock arrives</li>
                            <li>Tap it to record what was received and attach the invoice</li>
                            <li>Square inventory updates automatically</li>
                          </ul>
                        </div>
                        <button onClick={() => setOrderWizard(null)}
                          style={{ background:'#1e3a5f', color:'#fff', border:'none', borderRadius:8, padding:'14px 40px', fontSize:15, fontWeight:700, cursor:'pointer' }}>
                          Return to Dashboard
                        </button>
                      </div>
                    )}

                    </div>
                  </div>
                </div>
              )
            })()}

        {/* Receive Stock Modal — with per-item quantity inputs */}
        {receiveModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>📦 Receive from {receiveModal.supplier}</div>
                <button onClick={() => setReceiveModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>
              {/* PO Reference — visible and editable */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'7px 12px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:7 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#64748b', whiteSpace:'nowrap' }}>PO Ref:</span>
                <input
                  type="text"
                  value={receiveModal.ref || ''}
                  onChange={e => setReceiveModal(prev => ({ ...prev, ref: e.target.value }))}
                  placeholder="e.g. CW-PO-001-25Jun (used in invoice filename)"
                  style={{ flex:1, fontSize:12, fontFamily:'monospace', fontWeight:600, color:'#0f172a', border:'1px solid #cbd5e1', borderRadius:5, padding:'4px 8px', background: receiveModal.ref ? '#f0fdf4' : '#fffbeb' }}
                />
                {!receiveModal.ref && (
                  <span style={{ fontSize:10, color:'#d97706', fontWeight:700, whiteSpace:'nowrap' }}>⚠ No ref set</span>
                )}
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
                <div style={{ padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input type="checkbox"
                    checked={receiveModal.items.every(i => receiveChecked[i.name])}
                    onChange={e => {
                      const next = {}
                      receiveModal.items.forEach(i => next[i.name] = e.target.checked)
                      setReceiveChecked(next)
                    }}
                    style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Select All</span>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                    <button onClick={() => {
                      const next = {}; const qtys = {}
                      receiveModal.items.forEach(i => {
                        next[i.name] = true
                        const override = orderQtyOverrides[i.name]
                        qtys[i.name] = override !== undefined ? override : (i.orderQty || 0)
                      })
                      setReceiveChecked(next); setReceiveQtys(qtys)
                    }} style={{ padding:'2px 8px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:4, fontSize:10, fontWeight:700, color:'#16a34a', cursor:'pointer' }}>
                      ✓ All Full
                    </button>
                    <button onClick={() => {
                      const next = {}; const qtys = {}
                      receiveModal.items.forEach(i => {
                        next[i.name] = true
                        const override = orderQtyOverrides[i.name]
                        const ordered = override !== undefined ? override : (i.orderQty || 0)
                        qtys[i.name] = Math.max(0, Math.floor(ordered * 0.5))
                      })
                      setReceiveChecked(next); setReceiveQtys(qtys)
                    }} style={{ padding:'2px 8px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:4, fontSize:10, fontWeight:700, color:'#d97706', cursor:'pointer' }}>
                      ½ All Partial
                    </button>
                  </div>
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
                          {(v => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(receivedQty / ((i.bottleML || 700) / (i.nipML || 30)))} btl
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

              {/* Invoice file picker */}
              <div style={{ marginBottom: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', background: invoiceFile ? '#f0fdf4' : '#fafafa' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>📎 Attach Supplier Invoice</div>
                <div style={{ fontSize: 11, color: '#d97706', marginBottom: 6 }}>⚠️ Recommended — needed to email the treasurer and extract pricing data</div>
                {invoiceFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {invoiceFile.uploading
                      ? <span style={{ fontSize: 13, color: '#d97706', fontWeight: 600, flex: 1 }}>⏳ Uploading {invoiceFile.name}…</span>
                      : invoiceFile.alreadySaved
                        ? <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, flex: 1 }}>✓ {invoiceFile.name} — previously saved</span>
                        : invoiceFile.saved
                          ? <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, flex: 1 }}>✓ {invoiceFile.name} — saved to OneDrive</span>
                          : <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600, flex: 1 }}>✓ {invoiceFile.name}</span>
                    }
                    {!invoiceFile.uploading && (
                      <button onClick={() => setInvoiceFile(null)}
                        style={{ fontSize: 11, background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: '#64748b' }}>
                        {invoiceFile.alreadySaved ? 'Replace' : 'Remove'}
                      </button>
                    )}
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setInvoiceFile({ name: file.name, base64: null, mimeType: file.type, uploading: true })
                        const base64 = await new Promise(resolve => {
                          const reader = new FileReader()
                          reader.onload = () => resolve(reader.result.split(',')[1])
                          reader.readAsDataURL(file)
                        })
                        // Save to OneDrive immediately — same as PO Documents upload
                        const poRef = receiveModal.ref || receiveModal.supplier
                        const ext = file.name.split('.').pop()
                        const invName = `${poRef.replace(/\s/g,'_')}-Invoice.${ext}`
                        const supplier = receiveModal.supplier
                        // Save to Supabase storage
                        fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ action:'invoice', po_ref:poRef, supplier, file_base64:base64, file_name:invName, file_mime:file.type }) }).catch(()=>null)
                        // Save to OneDrive
                        const odRes = await fetch('/api/onedrive/save-invoice', { method:'POST', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ filename:invName, base64, mimeType:file.type, supplier }) }).catch(()=>null)
                        const odData = odRes ? await odRes.json().catch(()=>({})) : {}
                        if (odData.webUrl) {
                          fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ action:'update_urls', po_ref:poRef, invoice_onedrive_url:odData.webUrl }) }).catch(()=>null)
                        }
                        setInvoiceFile({ name: invName, base64, mimeType: file.type, uploading: false, saved: !!odData.webUrl })
                      }} />
                    <span style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'underline' }}>Select PDF or image…</span>
                  </label>
                )}
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
            <div style={{ background:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', maxHeight:'90vh', overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#0f172a' }}>✅ Stock Received — {receiptData.supplier}</div>
                  {receiptData.ref && <div style={{ fontSize:11, fontFamily:'monospace', color:'#16a34a', marginTop:2, fontWeight:700 }}>{receiptData.ref}</div>}
                </div>
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
                  {receiptData.sqResult.success && receiptData.sqResult.skipped?.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#d97706' }}>
                      ⚠ {receiptData.sqResult.skipped.length} item{receiptData.sqResult.skipped.length !== 1 ? 's' : ''} not found in Square — update manually: {receiptData.sqResult.skipped.join(', ')}
                    </div>
                  )}
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

              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={() => setReceiptData(null)}
                  style={{ flex:1, padding:'9px 0', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  ✓ Done
                </button>
                {/* Download locally — prominent only when OneDrive failed, otherwise subtle */}
                <button onClick={async () => {
                    try {
                      const sup = receiptData.supplier
                      const d = receiptData.date
                      const ref = receiptData.ref || ''
                      const slug = sup.replace(/\s+/g,'').replace(/[^a-zA-Z0-9]/g,'')
                      const dateslug = d.replace(/\//g,'-')
                      const safeRef = ref ? ref.replace(/\s+/g, '_') : ''
                      const fname = safeRef ? `${safeRef}-Receipt.xlsx` : 'RECV-' + slug + '-' + dateslug + '.xlsx'

                      if (!window.ExcelJS) {
                        const s = document.createElement('script')
                        s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
                        document.head.appendChild(s)
                        await new Promise(r => { s.onload = r })
                      }
                      const wb = new window.ExcelJS.Workbook()
                      const ws = wb.addWorksheet('Goods Received')

                      ws.views = [{ state: 'frozen', ySplit: ref ? 7 : 6 }]
                      ws.columns = [
                        { key: 'item', width: 42 },
                        { key: 'sku',  width: 16 },
                        { key: 'qty',  width: 18 },
                      ]

                      const NAVY = 'FF1E3A5F', WHITE = 'FFFFFFFF', LGREY = 'FFF1F5F9'

                      // Title
                      ws.addRow(['Paynter Bar — Goods Received', '', ''])
                      ws.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } }
                      ws.getRow(1).height = 22

                      // Metadata rows
                      const metaStyle = (cell) => { cell.font = { size: 10, color: { argb: 'FF64748B' } } }
                      const addMeta = (label, val) => {
                        const r = ws.addRow([label, val, ''])
                        metaStyle(r.getCell(1)); metaStyle(r.getCell(2))
                      }
                      addMeta('Supplier', sup)
                      addMeta('Date', d)
                      if (ref) addMeta('PO Reference', ref)
                      addMeta('Items received', String(receiptData.items.length))
                      ws.addRow([])

                      // Header row
                      const hRow = ws.addRow(['Item', 'SKU', 'Qty Received'])
                      hRow.eachCell(cell => {
                        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: NAVY } }
                        cell.font = { bold: true, color: { argb: WHITE } }
                        cell.alignment = { horizontal: cell.col === 3 ? 'right' : 'left', vertical: 'middle' }
                      })
                      hRow.height = 18

                      // Data rows
                      receiptData.items.forEach((item, i) => {
                        const row = ws.addRow([item.name, item.sku || '', item.qty])
                        const bg = { type:'pattern', pattern:'solid', fgColor:{ argb: i%2===0 ? LGREY : WHITE } }
                        row.getCell(1).fill = bg; row.getCell(1).font = { size: 12 }
                        row.getCell(2).fill = bg; row.getCell(2).font = { size: 11, color: { argb: 'FF64748B' } }
                        row.getCell(3).fill = bg; row.getCell(3).font = { bold: true, size: 12 }
                        row.getCell(3).alignment = { horizontal: 'right' }
                      })

                      ws.addRow([])
                      const foot = ws.addRow(['Paynter Bar — GemLife Palmwoods', '', 'Generated by Paynter Bar Hub'])
                      ;[1,2,3].forEach(c => { foot.getCell(c).font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } } })

                      const buf = await wb.xlsx.writeBuffer()
                      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = fname; a.click()
                      URL.revokeObjectURL(url)
                      setReceiptSaved(true)
                    } catch(e) { alert('Download failed: ' + e.message) }
                  }}
                  style={{
                    padding: receiptData.oneDriveResult?.error ? '9px 16px' : '6px 12px',
                    background: receiptSaved ? '#16a34a' : receiptData.oneDriveResult?.error ? '#dc2626' : '#f1f5f9',
                    color: receiptSaved ? '#fff' : receiptData.oneDriveResult?.error ? '#fff' : '#64748b',
                    border: 'none', borderRadius: 6,
                    fontSize: receiptData.oneDriveResult?.error ? 13 : 11,
                    fontWeight: receiptData.oneDriveResult?.error ? 700 : 500,
                    cursor: 'pointer'
                  }}>
                  {receiptSaved ? '✓ Downloaded' : receiptData.oneDriveResult?.error ? '📥 Download locally (OneDrive failed)' : '📥 Download locally'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Order Ref Prompt Modal */}

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
            showDetails={showDetails}
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

                <div style={{ width: 1, background: '#e2e8f0', margin: '0 6px', alignSelf: 'stretch' }} />

                <div style={{ width: 1, background: '#e2e8f0', margin: '0 6px', alignSelf: 'stretch' }} />
                {viewMode === 'pricing' && (
                  <>
                    <button onClick={printPricingSheet}
                      style={{ ...styles.tab, color: '#047857', borderColor: '#047857', background: '#f0fdf4' }}>
                      🖨️ Print
                    </button>
                    <button onClick={() => exportPricingExcel(40)}
                      style={{ ...styles.tab, color: '#047857', borderColor: '#047857', background: '#f0fdf4' }}>
                      📥 Excel
                    </button>
                  </>
                )}
                <button style={{ ...styles.tab, ...(viewMode === 'pricing' ? { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' } : { color: '#7c3aed', borderColor: '#7c3aed' }) }}
                  onClick={() => setViewMode(v => v === 'pricing' ? 'reorder' : 'pricing')}>$ Pricing</button>

              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>

                {(() => {
                  const missingBuy = items.filter(i => i.buyPrice == null).length
                  return missingBuy > 0 ? (
                    <button onClick={() => setViewMode('pricing')}
                      title="Click to open Pricing view to set buy prices"
                      style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:5, fontSize:11, color:'#dc2626', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                      ⚠️ {missingBuy} item{missingBuy>1?'s':''} missing buy price
                    </button>
                  ) : null
                })()}
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




              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <th style={{ ...styles.th, width: 200, minWidth: 140 }}>Item</th>
                    <th style={{ ...styles.th, width: 90, display: showDetails ? '' : 'none' }}>Category</th>
                    <th style={{ ...styles.th, width: 90, minWidth: 70 }}>Supplier</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 68 }}>On Hand</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 60, display: showDetails ? '' : 'none' }}>Avg</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 60, display: showDetails ? '' : 'none' }}>Target</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 68, display: showDetails ? '' : 'none' }}>Min Stock</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 68, display: showDetails ? '' : 'none' }}>Max Stock</th>
                    <th style={{ ...styles.th, textAlign: 'center', width: 50, display: showDetails ? '' : 'none' }}>Pack</th>
                    <th style={{ ...styles.th, textAlign: 'center', width: 60, display: showDetails ? '' : 'none' }}>Btl mL</th>
                    <th style={{ ...styles.th, textAlign: 'center', width: 52, display: showDetails ? '' : 'none' }}>Nip mL</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 68, display: showDetails ? '' : 'none' }}>Order Qty</th>
                    <th style={{ ...styles.th, textAlign: 'right', width: 52, display: showDetails ? '' : 'none' }}>Btls</th>
                    <th style={{ ...styles.th, textAlign: 'center', width: 90 }}>Priority</th>
                    <th style={{ ...styles.th, width: 120 }}>Notes</th>
                    {viewMode === 'pricing' && <>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed', width: 72, minWidth: 72 }}>Buy</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed', width: 68, minWidth: 68 }}>Sell</th>
                      <th style={{ ...styles.th, textAlign: 'center', color: '#7c3aed', width: 58, minWidth: 58 }}>Unit</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed', width: 48, minWidth: 48 }}>×</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed', width: 68, minWidth: 68 }}>Markup</th>
                      <th style={{ ...styles.th, textAlign: 'right', color: '#7c3aed', width: 72, minWidth: 72 }}>Sugg</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 && (
                    <tr><td colSpan={viewMode === 'pricing' ? 18 : 13} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                      'No items found.'
                    </td></tr>
                  )}
                  {displayed.map((item, idx) => {
                    const p = PRIORITY_COLORS[item.priority]
                    const isOnOrder = !!orderedItems[item.name]
                    const rowBg = isOnOrder ? '#f0f9ff' : (item.orderQty > 0 ? p.bg : (idx % 2 === 0 ? '#fff' : '#f8fafc'))
                    return (
                      <tr key={item.name} style={{ background: rowBg }}>
                        <td style={{ ...styles.td, fontWeight: 500, fontSize: 13 }}>
                          {item.name}
                          {item.buyPrice == null && !item.isSpirit && (
                            <span title="No buy price set — affects markup and stock value calculations"
                              style={{ marginLeft:5, background:'#fef2f2', color:'#dc2626', fontSize:9, fontWeight:700, padding:'1px 4px', borderRadius:3, border:'1px solid #fca5a5', whiteSpace:'nowrap' }}>$ missing</span>
                          )}
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
                        <td style={{ ...styles.td, textAlign: 'right', display: showDetails ? '' : 'none' }}>
                          <input
                            type="number" min="0" step="1"
                            placeholder="—"
                            defaultValue={item.minStock ?? ''}
                            key={item.name + '_minstock'}
                            onBlur={e => {
                              const v = e.target.value.trim()
                              const val = v === '' ? null : Number(v)
                              if (val === (item.minStock ?? null)) return
                              saveSetting(item.name, 'minStock', val)
                              setItems(prev => prev.map(i => {
                                if (i.name !== item.name) return i
                                const updated = { ...i, minStock: val }
                                const recalc = calculateItem(updated, { minStock: val, maxStock: i.maxStock, targetWeeksOverride: i.targetWeeksOverride, weeklyAvgOverride: i.weeklyAvgOverride, stockOverride: i.stockOverride, bottleML: i.bottleML, nipML: i.nipML }, targetWeeks, daysBack)
                                return { ...updated, ...recalc }
                              }))
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                            style={{
                              width: 58, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13,
                              border: item.minStock != null ? '1px solid #0ea5e9' : '1px solid #e2e8f0',
                              borderRadius: 5, padding: '2px 4px',
                              background: item.minStock != null ? '#f0f9ff' : '#f8fafc',
                              color: item.minStock != null ? '#0369a1' : 'inherit'
                            }}
                          />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right', display: showDetails ? '' : 'none' }}>
                          <input
                            type="number" min="0" step="1"
                            placeholder="—"
                            title={item.stockLimitConflict
                              ? 'Max is below Min — the Min floor wins, so this Max is being ignored.'
                              : item.exceedsMaxStock
                                ? `Ordering a full pack takes stock to ${item.projectedStock}, above this max.`
                                : 'Never build stock above this level. Leave blank for no ceiling.'}
                            defaultValue={item.maxStock ?? ''}
                            key={item.name + '_maxstock'}
                            onBlur={e => {
                              const v = e.target.value.trim()
                              const val = v === '' ? null : Number(v)
                              if (val === (item.maxStock ?? null)) return
                              saveSetting(item.name, 'maxStock', val)
                              setItems(prev => prev.map(i => {
                                if (i.name !== item.name) return i
                                const updated = { ...i, maxStock: val }
                                const recalc = calculateItem(updated, { minStock: i.minStock, maxStock: val, targetWeeksOverride: i.targetWeeksOverride, weeklyAvgOverride: i.weeklyAvgOverride, stockOverride: i.stockOverride, bottleML: i.bottleML, nipML: i.nipML }, targetWeeks, daysBack)
                                return { ...updated, ...recalc }
                              }))
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                            style={{
                              width: 58, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13,
                              border: item.stockLimitConflict ? '1px solid #dc2626'
                                    : item.exceedsMaxStock   ? '1px solid #d97706'
                                    : item.maxStock != null  ? '1px solid #0ea5e9' : '1px solid #e2e8f0',
                              borderRadius: 5, padding: '2px 4px',
                              background: item.stockLimitConflict ? '#fef2f2'
                                        : item.exceedsMaxStock   ? '#fffbeb'
                                        : item.maxStock != null  ? '#f0f9ff' : '#f8fafc',
                              color: item.stockLimitConflict ? '#991b1b'
                                   : item.exceedsMaxStock   ? '#92400e'
                                   : item.maxStock != null  ? '#0369a1' : 'inherit'
                            }}
                          />
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center', display: showDetails ? '' : 'none' }}>
                          {!item.isSpirit ? (
                            <EditSelect value={String(item.pack || '')} options={['1', '6', '12', '18', '24', '30', '48']}
                              onChange={v => saveSetting(item.name, 'pack', Number(v))}
                              saving={saving[`${item.name}_pack`]} readOnly={readOnly} />
                          ) : <span style={{ color: '#e2e8f0' }}>—</span>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center', display: showDetails ? '' : 'none' }}>
                          {item.isSpirit ? (
                            <EditSelect value={String(item.bottleML || 700)} options={['700', '750', '1000']}
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
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', fontSize: 15, display: showDetails ? '' : 'none' }}>
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
                            const effectiveNips = orderQtyOverrides[item.name] !== undefined ? orderQtyOverrides[item.name] : (item.nipsToOrder || 0)
                            const btl = effectiveNips > 0 ? (v => v - Math.floor(v) <= 0.05 ? Math.floor(v) : Math.ceil(v))(effectiveNips / ((item.bottleML || 700) / (item.nipML || 30))) : 0
                            return btl > 0 ? btl : '-'
                          })() : '-'}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {orderedItems[item.name]
                              ? <>
                                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', background: '#0e7490', color: '#fff' }}>ON ORDER</span>
                                  {!readOnly && (
                                    <button onClick={() => setOrderAgainItems(prev => {
                                      const n = new Set(prev)
                                      if (n.has(item.name)) n.delete(item.name)
                                      else n.add(item.name)
                                      return n
                                    })} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, border: '1px solid #cbd5e1', background: orderAgainItems.has(item.name) ? '#fef9c3' : '#f8fafc', color: orderAgainItems.has(item.name) ? '#854d0e' : '#64748b', cursor: 'pointer', fontWeight: 600 }}>
                                      {orderAgainItems.has(item.name) ? '✓ Order Again' : '+ Order Again'}
                                    </button>
                                  )}
                                </>
                              : <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', background: dontOrder(item) ? '#94a3b8' : p.badge, color: '#fff' }}>{dontOrder(item) ? 'RUNDOWN' : item.priority}</span>
                            }
                            {!readOnly && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11, color: dontOrder(item) ? '#64748b' : '#94a3b8', userSelect: 'none' }}
                                title="Rundown — exclude from orders">
                                <input type="checkbox"
                                  checked={!!dontOrder(item)}
                                  onChange={async () => {
                                    const newVal = !rundownItems[item.name]
                                    setRundownItems(prev => { const n = {...prev}; if (newVal) n[item.name]=true; else delete n[item.name]; return n })
                                    await fetch('/api/rundown', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: item.name, value: newVal }) })
                                  }}
                                  style={{ width: 13, height: 13, cursor: 'pointer', accentColor: '#94a3b8' }}
                                />
                                Rundown
                              </label>
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
                                        // 165ml = Square's true glass portion (11/50 of a 750ml bottle),
                                        // not the literal 150ml pour — this bakes in the overpour buffer
                                        // so bottleML/serveML below gives the real 4.545 glasses/bottle.
                                        : (isWine && sellUnit === 'glass') ? 165
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

                          // Markup logic:
                          //   spirits:     buy=per nip, sell=per nip  → (sell−buy)/buy
                          //   wine glass:  buy=per bottle, sell=per glass → (sell×serves−buy)/buy
                          //   wine bottle: buy=per bottle, sell=per bottle → (sell−buy)/buy
                          //   beer/other:  buy=per unit, sell=per unit → (sell−buy)/buy
                          let markupPct = null
                          if (buy != null && buy > 0 && sell != null && sell > 0) {
                            if (item.isSpirit) {
                              // both per nip
                              markupPct = ((sell - buy) / buy) * 100
                            } else if (isWine && sellUnit === 'glass' && servesPerBottle) {
                              // buy per bottle, sell per glass
                              const rev = sell * servesPerBottle
                              markupPct = (rev - buy) / buy * 100
                            } else {
                              // wine bottle, beer, other — both same unit
                              markupPct = ((sell - buy) / buy) * 100
                            }
                          }
                          const revenuePerBottle = (isWine && sellUnit === 'glass' && sell != null && servesPerBottle)
                            ? +(sell * servesPerBottle).toFixed(2) : null
                          const markupStr   = markupPct != null ? markupPct.toFixed(1) + '%' : '—'
                          const markupColor = markupPct == null ? '#94a3b8' : markupPct >= 40 ? '#16a34a' : markupPct >= 25 ? '#d97706' : '#dc2626'
                          return <>
                            <td style={{ ...styles.td, textAlign: 'right' }}>
                              <EditNumber
                                value={item.buyPrice !== '' && item.buyPrice != null ? Number(item.buyPrice) : ''}
                                placeholder="—"
                                decimals={3}
                                prefix="$"
                                onChange={v => saveSetting(item.name, 'buyPrice', v)}
                                saving={saving[`${item.name}_buyPrice`]}
                                min={0}
                                readOnly={readOnly}
                              />
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
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: markupColor }}>
                              {markupStr}
                              {servesPerBottle != null && servesPerBottle > 1 && revenuePerBottle != null && (
                                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>${revenuePerBottle.toFixed(2)}/btl rev</div>
                              )}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: '#7c3aed' }}>
                              {buy != null ? (() => { const mceil2=(v,m)=>Math.ceil(v/m)*m; const srv2=servesPerBottle&&!item.isSpirit&&(item.category&&['White Wine','Red Wine','Rose','Sparkling'].includes(item.category))&&sellUnit==='glass'?servesPerBottle:1; return `$${mceil2(buy*1.40/srv2,0.25).toFixed(2)}` })() : '—'}
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
            rundownItems={rundownItems}
            orderCount={orderCount}
            critCount={critCount}
            onOrderCount={onOrderCount}
            onStartOrder={(mode) => {
              const q = {}
              setOrderMode(mode)
              for (const i of items) {
                if (rundownItems[i.name]) continue
                if (mode === 'additional') {
                  q[i.name] = 0
                } else {
                  if (orderQtyOverrides[i.name] !== undefined) {
                    q[i.name] = orderQtyOverrides[i.name]
                  } else {
                    q[i.name] = i.isSpirit ? (i.nipsToOrder || i.orderQty) : i.orderQty
                  }
                }
              }
              setWizQtys(q)
              setOrderWizard({ step: 1, supplier: null, poRef: '', saving: false })
            }}
            onNav={(tab) => {
              setMainTab(tab)
              if (tab === 'sales' && !salesReport) loadSalesReport(salesPeriod, salesCustom)
            }}
            readOnly={readOnly}
            poReceiving={poReceiving}
            onViewOrder={(supplier, items, ref) => setViewOrderModal({ supplier, items, ref: ref || '' })}
            onReceive={(supplier, supplierItems, ref) => openReceiveModal(supplier, supplierItems, ref)}
            onPrintDelivery={(supplier, supplierItems, ref) => printDeliverySheet(supplier, supplierItems, ref)}
            lastOrderSummary={lastOrderSummary}
          />
        )}
        {mainTab === 'wastage' && <WastageView items={items} log={wastageLog} readOnly={readOnly} onRefresh={loadWastageLog} />}
        {mainTab === 'settings' && !readOnly && (
          <div style={{ padding: '16px 0', maxWidth: 720 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>⚙️ Settings</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Manage suppliers, reorder defaults and app configuration</div>

            {/* Sub-tab strip */}
            <div style={{ display:'flex', gap:6, marginBottom:20, borderBottom:'2px solid #e2e8f0', paddingBottom:0 }}>
              {[['suppliers','🏭 Suppliers'],['mappings','🔗 Square Mappings'],['reorder','⚙️ Reorder Defaults'],['appearance','🎨 Appearance'],['access','🔐 App Access']].map(([t,label]) => (
                <button key={t} onClick={() => setSettingsSubTab(t)}
                  style={{ padding:'8px 16px', border:'none', borderBottom: settingsSubTab===t ? '2px solid #1e3a5f' : '2px solid transparent',
                    background:'none', fontSize:13, fontWeight: settingsSubTab===t ? 700 : 500,
                    color: settingsSubTab===t ? '#1e3a5f' : '#64748b', cursor:'pointer', marginBottom:-2 }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── APPEARANCE ─────────────────────────────────────────── */}
            {settingsSubTab === 'appearance' && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>Sidebar Theme</div>
                <div style={{ padding:16 }}>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
                    Changes the sidebar colour scheme. This is saved on this device only — each person can pick their own.
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:10 }}>
                    {Object.entries(THEMES).map(([key, th]) => {
                      const active = hubTheme === key
                      return (
                        <button key={key} onClick={() => setHubTheme(key)}
                          style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', cursor:'pointer',
                            background: active ? '#f0f9ff' : '#fff',
                            border: active ? '2px solid #0e7490' : '1px solid #e2e8f0',
                            borderRadius:8, textAlign:'left' }}>
                          {/* Mini sidebar preview */}
                          <div style={{ width:30, height:38, borderRadius:4, background:th.sbBg, border:`1px solid ${th.sbBorder}`,
                            flexShrink:0, padding:3, display:'flex', flexDirection:'column', gap:2 }}>
                            <div style={{ height:5, borderRadius:1, background:th.brandBg }} />
                            <div style={{ height:3, borderRadius:1, background:th.sbActive }} />
                            <div style={{ height:3, borderRadius:1, background:th.navItem, opacity:0.5 }} />
                            <div style={{ height:3, borderRadius:1, background:th.navItem, opacity:0.5 }} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>{th.name}</div>
                            {active && <div style={{ fontSize:10, color:'#0e7490', fontWeight:700 }}>✓ Active</div>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── SUPPLIERS ──────────────────────────────────────────── */}
            {settingsSubTab === 'suppliers' && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>Suppliers</div>
                <div style={{ padding:16 }}>
                  {suppliers.map(s => (
                    <div key={s} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#f8fafc', borderRadius:6, marginBottom:6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', background: SUPPLIER_COLORS[s] || '#374151' }} />
                        <span style={{ fontWeight:600, fontSize:14 }}>{s}</span>
                        {supplierVendorNames[s] && <span style={{ fontSize:11, color:'#64748b', background:'#e2e8f0', padding:'1px 6px', borderRadius:4 }}>Square: {supplierVendorNames[s]}</span>}
                      </div>
                      <button onClick={() => deleteSupplier(s)} style={{ padding:'3px 10px', background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:5, fontSize:11, fontWeight:700, cursor:'pointer' }}>🗑 Remove</button>
                    </div>
                  ))}
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    {addingSupplier ? (
                      <>
                        <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
                          onKeyDown={e => { if(e.key==='Enter') addSupplier(); if(e.key==='Escape') setAddingSupplier(false) }}
                          placeholder="Supplier name..." autoFocus
                          style={{ flex:1, padding:'6px 10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:13 }} />
                        <button onClick={addSupplier} style={{ padding:'6px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer' }}>Add</button>
                        <button onClick={() => setAddingSupplier(false)} style={{ padding:'6px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, cursor:'pointer' }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setAddingSupplier(true)} style={{ padding:'6px 14px', background:'#f1f5f9', border:'1px dashed #94a3b8', borderRadius:6, fontSize:13, cursor:'pointer', color:'#64748b' }}>+ Add Supplier</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SQUARE MAPPINGS ────────────────────────────────────── */}
            {settingsSubTab === 'mappings' && (
              <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>Square Vendor Names</div>
                <div style={{ padding:16 }}>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Map each supplier to their name in Square — used to match invoices and filter Square reports.</div>
                  {suppliers.map(s => (
                    <div key={s} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <span style={{ width:140, fontWeight:600, fontSize:13 }}>{s}</span>
                      <input defaultValue={supplierVendorNames[s] || ''}
                        onBlur={async e => {
                          const val = e.target.value.trim()
                          const updated = { ...supplierVendorNames }
                          if (!val) delete updated[s]; else updated[s] = val
                          setSupplierVendorNames(updated)
                          await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ itemName:'_global', field:'supplierVendorNames', value: updated }) })
                        }}
                        placeholder={`Square name for ${s}...`}
                        style={{ flex:1, padding:'5px 10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:13 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── REORDER DEFAULTS ───────────────────────────────────── */}
            {settingsSubTab === 'reorder' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>Reorder Defaults</div>
                  <div style={{ padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ width:200, fontSize:13, fontWeight:600 }}>Default target weeks</span>
                      <input type="number" defaultValue={settingsTargetWeeks ?? targetWeeks} min={1} max={26}
                        onBlur={async e => {
                          const val = Number(e.target.value)
                          if (!val || val < 1) return
                          setTargetWeeks(val)
                          setSettingsTargetWeeks(val)
                          await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ itemName:'_global', field:'targetWeeks', value: val }) })
                        }}
                        style={{ width:80, padding:'5px 10px', border:'1px solid #cbd5e1', borderRadius:6, fontSize:13 }} />
                      <span style={{ fontSize:12, color:'#64748b' }}>weeks of stock to maintain</span>
                    </div>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>Data Backup</div>
                  <div style={{ padding:16 }}>
                    <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>All settings auto-backup to Supabase on every change. Use this to manually sync if needed.</div>
                    <button onClick={async () => {
                      setSettingsSaving(true)
                      const r = await fetch('/api/admin/sync-to-supabase')
                      setSettingsSaving(false)
                      alert(r.ok ? '✓ Sync complete — all data backed up to Supabase.' : '✗ Sync failed — check Vercel logs.')
                    }} style={{ padding:'7px 18px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                      {settingsSaving ? '⏳ Syncing…' : '☁️ Sync Redis → Supabase'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── APP ACCESS ─────────────────────────────────────────── */}
            {settingsSubTab === 'access' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {/* OneDrive Connection Status */}
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>OneDrive Connection</div>
                  <div style={{ padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      {oneDriveStatus === null && (
                        <span style={{ fontSize:13, color:'#64748b' }}>Not checked yet</span>
                      )}
                      {oneDriveStatus?.ok === true && (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:18 }}>✅</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>Connected</div>
                            {oneDriveStatus.email && <div style={{ fontSize:11, color:'#64748b' }}>{oneDriveStatus.email}</div>}
                          </div>
                        </div>
                      )}
                      {oneDriveStatus?.ok === false && (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:18 }}>❌</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'#dc2626' }}>Not connected</div>
                            <div style={{ fontSize:11, color:'#64748b' }}>{oneDriveStatus.error || 'Token expired or missing'}</div>
                          </div>
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                        <button onClick={async () => {
                          setOneDriveStatus(null)
                          const r = await fetch('/api/onedrive/status').catch(() => null)
                          const d = r ? await r.json().catch(() => ({ ok: false, error: 'Request failed' })) : { ok: false, error: 'Request failed' }
                          setOneDriveStatus(d)
                        }} style={{ padding:'6px 14px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          🔍 Check Status
                        </button>
                        <a href="/api/onedrive/auth" target="_blank" rel="noreferrer"
                          style={{ padding:'6px 14px', background:'#1e3a5f', color:'#fff', borderRadius:6, fontSize:12, fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                          🔗 Reconnect OneDrive
                        </a>
                      </div>
                    </div>
                    {oneDriveStatus?.ok === false && (
                      <div style={{ marginTop:10, padding:'8px 12px', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:6, fontSize:12, color:'#dc2626' }}>
                        Click <strong>Reconnect OneDrive</strong> and sign in with <strong>paynterbar@gemwoods.com.au</strong> to restore OneDrive saves and email attachments.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>App PIN Management</div>
                  <div style={{ padding:16 }}>
                    <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>The app uses two PINs — the BMT PIN for full management access, and the read-only PIN for homeowner viewing access.</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>BMT Management PIN</div>
                          <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Full access — edit prices, receive orders, manage settings</div>
                        </div>
                        <code style={{ fontSize:11, color:'#475569', background:'#e2e8f0', padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap' }}>PIN_COMMITTEE</code>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Read-Only PIN</div>
                          <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>View-only access — stock levels, sales, price list. No editing.</div>
                        </div>
                        <code style={{ fontSize:11, color:'#475569', background:'#e2e8f0', padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap' }}>PIN_READONLY</code>
                      </div>
                    </div>

                    <div style={{ marginTop:16, padding:'12px 14px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1d4ed8', marginBottom:6 }}>🔒 How to change a PIN</div>
                      <div style={{ fontSize:12, color:'#1e40af', lineHeight:1.75 }}>
                        PINs are stored as environment variables in Vercel — never in the app&apos;s database or code. To change one:
                        <ol style={{ margin:'6px 0 0', paddingLeft:18 }}>
                          <li>Open Vercel → the <strong>paynter-bar-hub</strong> project → <strong>Settings → Environment Variables</strong></li>
                          <li>Edit <code>PIN_COMMITTEE</code> or <code>PIN_READONLY</code>, then save</li>
                          <li>Go to <strong>Deployments</strong> and click <strong>Redeploy</strong> on the latest deployment</li>
                        </ol>
                        <div style={{ marginTop:8 }}>
                          The new PIN takes effect once that redeploy finishes. Anyone already signed in stays signed in until their 12-hour session expires.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>Recent Changes</span>
                    <button onClick={() => fetch('/api/settings?action=getAudit').then(r=>r.json()).then(d => setSettingsAuditData(d.audit||{}))}
                      style={{ fontSize:11, background:'rgba(255,255,255,0.15)', border:'none', borderRadius:4, padding:'2px 8px', color:'#fff', cursor:'pointer' }}>↻ Refresh</button>
                  </div>
                  <div style={{ padding:16 }}>
                    {!settingsAuditData ? (
                      <div style={{ color:'#94a3b8', fontSize:12 }}>Loading…</div>
                    ) : Object.keys(settingsAuditData).length === 0 ? (
                      <div style={{ color:'#94a3b8', fontSize:12 }}>No changes recorded yet.</div>
                    ) : (() => {
                      const FIELD_LABELS = { buyPrice:'Buy Price', sellPrice:'Sell Price', sellPriceBottle:'Bottle Sell Price', supplier:'Supplier', category:'Category', pack:'Pack Size', bottleML:'Bottle mL', nipML:'Nip mL', targetWeeksOverride:'Target Weeks', weeklyAvgOverride:'Weekly Avg Override', stockOverride:'Stock Override', notes:'Notes', bottleOnly:'Bottle Only' }
                      const entries = Object.entries(settingsAuditData)
                        .map(([key, val]) => {
                          const parts = key.split('__')
                          const field = parts.pop()
                          const itemName = parts.join('__')
                          // Carry oldValue/newValue through — the table reads e.oldValue / e.newValue.
                          return { itemName, field, ts: val.ts, who: val.who, oldValue: val.oldValue, newValue: val.newValue }
                        })
                        .sort((a,b) => new Date(b.ts) - new Date(a.ts))
                        .slice(0, 30)
                      return (
                        <div style={{ maxHeight:320, overflowY:'auto' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                            <thead>
                              <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
                                {['Date','Item','Field','Old Value','New Value','By'].map(h => (
                                  <th key={h} style={{ padding:'4px 8px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((e, i) => (
                                <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0 ? '#fff' : '#f8fafc' }}>
                                  <td style={{ padding:'5px 8px', color:'#64748b', whiteSpace:'nowrap' }}>
                                    {new Date(e.ts).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric', timeZone:'Australia/Brisbane' })}
                                    <span style={{ marginLeft:4, color:'#94a3b8' }}>
                                      {new Date(e.ts).toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', timeZone:'Australia/Brisbane' })}
                                    </span>
                                  </td>
                                  <td style={{ padding:'5px 8px', fontWeight:500 }}>{e.itemName}</td>
                                  <td style={{ padding:'5px 8px' }}>
                                    <span style={{ background:'#e0f2fe', color:'#0369a1', padding:'1px 6px', borderRadius:3, fontSize:11, fontWeight:600 }}>
                                      {FIELD_LABELS[e.field] || e.field}
                                    </span>
                                  </td>
                                  <td style={{ padding:'5px 8px', color:'#94a3b8', fontStyle: e.oldValue == null ? 'italic' : 'normal' }}>{e.oldValue != null ? String(e.oldValue) : '—'}</td>
                                  <td style={{ padding:'5px 8px', fontWeight:600, color:'#0f172a' }}>{e.newValue != null ? String(e.newValue) : '—'}</td>
                                  <td style={{ padding:'5px 8px', color:'#64748b' }}>{e.who || 'BMT'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mainTab === 'pricehistory' && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {['import','manage'].map(t => (
                <button key={t} onClick={() => { setPhSubTab(t); setPhSaveResult(null) }}
                  style={{ padding:'7px 18px', borderRadius:6, border:'1px solid #e2e8f0', fontWeight:700, fontSize:13, cursor:'pointer',
                    background: phSubTab===t ? '#1e3a5f' : '#f8fafc', color: phSubTab===t ? '#fff' : '#374151' }}>
                  {t === 'import' ? '📄 Import Invoice' : '🔧 Manage History'}
                </button>
              ))}
            </div>

            {/* ── IMPORT TAB ─────────────────────────────────────── */}
            {phSubTab === 'import' && (
              <div style={{ maxWidth: 900 }}>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
                  <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>Upload Supplier Invoice (PDF)</div>
                  <div style={{ padding:16 }}>
                    <div style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Upload one or more supplier invoices (PDF). Claude will automatically extract all items and prices for review before saving.</div>
                    {!phExtracted ? (
                      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                        <label style={{ cursor:'pointer' }}>
                          <input type="file" accept=".pdf" multiple style={{ display:'none' }}
                            onChange={e => {
                              const files = Array.from(e.target.files || [])
                              if (!files.length) return
                              Promise.all(files.map(file => new Promise(resolve => {
                                const reader = new FileReader()
                                reader.onload = () => resolve({ name: file.name, base64: reader.result.split(',')[1] })
                                reader.readAsDataURL(file)
                              }))).then(pdfs => setPhPdf(pdfs))
                            }} />
                          <span style={{ padding:'7px 16px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                            {phPdf ? `✓ ${phPdf.length} file${phPdf.length > 1 ? 's' : ''} selected` : '📎 Select PDF(s)…'}
                          </span>
                        </label>
                        {phPdf?.length > 0 && (
                          <div style={{ fontSize:12, color:'#64748b' }}>
                            {phPdf.map(f => f.name).join(', ')}
                          </div>
                        )}
                        {phPdf?.length > 0 && (
                          <button onClick={async () => {
                            setPhExtracting(true)
                            const allItems = []
                            for (let idx = 0; idx < phPdf.length; idx++) {
                              const pdf = phPdf[idx]
                              setPhExtracted({ _progress: `Extracting ${idx + 1} of ${phPdf.length}: ${pdf.name}…` })
                              try {
                                const r = await fetch('/api/invoices/extract', {
                                  method:'POST', headers:{'Content-Type':'application/json'},
                                  body: JSON.stringify({ pdf_base64: pdf.base64 })
                                })
                                const d = await r.json()
                                if (!r.ok) throw new Error(d.error)
                                allItems.push({ ...d, source_file: pdf.name, items: d.items.map(i => ({ ...i, include: true, item_name_hub: i.item_name_raw })) })
                              } catch (e) {
                                allItems.push({ source_file: pdf.name, error: e.message })
                              }
                            }
                            setPhExtracted({ invoices: allItems })
                            setPhExtracting(false)
                          }} disabled={phExtracting}
                            style={{ padding:'7px 18px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            {phExtracting ? '⏳ Extracting…' : `🔍 Extract ${phPdf.length} Invoice${phPdf.length > 1 ? 's' : ''}`}
                          </button>
                        )}
                      </div>
                    ) : phExtracted?._progress ? (
                      <div style={{ padding:'12px 16px', background:'#eff6ff', borderRadius:8, fontSize:13, color:'#1d4ed8', fontWeight:600 }}>
                        ⏳ {phExtracted._progress}
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'#16a34a' }}>
                          ✓ Extracted {phExtracted.invoices?.filter(i=>!i.error).length} of {phExtracted.invoices?.length} invoice(s)
                        </span>
                        <button onClick={() => { setPhExtracted(null); setPhPdf(null) }}
                          style={{ fontSize:11, padding:'2px 8px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:4, cursor:'pointer' }}>
                          Start over
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {phSaveResult && (
                  <div style={{ marginTop:10, padding:'10px 14px', borderRadius:8, fontWeight:600, fontSize:13,
                    background: phSaveResult.type==='ok' ? '#f0fdf4' : phSaveResult.type==='warn' ? '#fffbeb' : '#fef2f2',
                    color: phSaveResult.type==='ok' ? '#16a34a' : phSaveResult.type==='warn' ? '#d97706' : '#dc2626',
                    border: `1px solid ${phSaveResult.type==='ok' ? '#bbf7d0' : phSaveResult.type==='warn' ? '#fde68a' : '#fca5a5'}` }}>
                    {phSaveResult.msg}
                  </div>
                )}

                {phExtracted?.invoices && (
                  <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13, display:'flex', justifyContent:'space-between' }}>
                      <span>Review Extracted Items</span>
                      <span style={{ fontSize:11, opacity:0.7 }}>{phExtracted.invoices.reduce((s,inv) => s + (inv.items?.filter(i=>i.include).length||0), 0)} items selected across {phExtracted.invoices.filter(i=>!i.error).length} invoices</span>
                    </div>
                    <div style={{ padding:'8px 12px', fontSize:12, color:'#64748b', background:'#f8fafc' }}>
                      Edit <strong>Hub Name</strong> to match your Hub item exactly, adjust <strong>Units/Pack</strong> if needed, untick to exclude.
                    </div>
                    {phExtracted.invoices.map((inv, invIdx) => (
                      <div key={invIdx}>
                        {inv.error ? (
                          <div style={{ padding:'10px 16px', background:'#fef2f2', color:'#dc2626', fontSize:12 }}>
                            ✗ {inv.source_file}: {inv.error}
                          </div>
                        ) : (
                          <>
                            <div style={{ padding:'6px 14px', background:'#e0f2fe', fontSize:11, fontWeight:700, color:'#0369a1', borderTop:'2px solid #bae6fd' }}>
                              {inv.supplier} · {inv.invoice_ref} · {inv.invoice_date} · {inv.source_file}
                              <span style={{ marginLeft:8, fontWeight:400 }}>{inv.gst_included ? 'Prices inc GST' : 'Prices ex GST'}</span>
                            </div>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                              <thead>
                                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                                  <th style={{ padding:'5px 8px', width:32 }}></th>
                                  {['Invoice Description','Hub Name','Match','Qty','Units/Pack','Invoice Price','Per Unit ex GST'].map(h => (
                                    <th key={h} style={{ padding:'5px 8px', textAlign: h==='Match'?'center':'left', fontWeight:700, color:'#374151', fontSize:11 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {inv.items.map((item, i) => {
                                  const unitPrice = inv.gst_included
                                    ? item.invoice_unit_price / item.units_per_pack / 1.10
                                    : item.invoice_unit_price / item.units_per_pack
                                  return (
                                    <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: item.include ? (i%2===0?'#fff':'#f8fafc') : '#fef2f2', opacity: item.include?1:0.5 }}>
                                      <td style={{ padding:'4px 8px', textAlign:'center' }}>
                                        <input type="checkbox" checked={item.include}
                                          onChange={e => setPhExtracted(prev => ({ ...prev, invoices: prev.invoices.map((inv2,ii) => ii!==invIdx ? inv2 : { ...inv2, items: inv2.items.map((it,j) => j===i ? {...it, include: e.target.checked} : it) }) }))} />
                                      </td>
                                      <td style={{ padding:'4px 8px', color:'#64748b', maxWidth:200, fontSize:11 }}>{item.item_name_raw}</td>
                                      <td style={{ padding:'4px 8px' }}>
                                        <input value={item.item_name_hub}
                                          onChange={e => setPhExtracted(prev => ({ ...prev, invoices: prev.invoices.map((inv2,ii) => ii!==invIdx ? inv2 : { ...inv2, items: inv2.items.map((it,j) => j===i ? {...it, item_name_hub: e.target.value} : it) }) }))}
                                          style={{ width:'100%', minWidth:160, padding:'2px 5px', border: items.some(it => it.name === item.item_name_hub) ? '1px solid #86efac' : '1px solid #fca5a5', borderRadius:4, fontSize:11, background: items.some(it => it.name === item.item_name_hub) ? '#f0fdf4' : '#fef2f2' }} />
                                      </td>
                                      <td style={{ padding:'4px 8px', textAlign:'center' }}>
                                        {items.some(it => it.name === item.item_name_hub)
                                          ? <span title="Matched to Hub item" style={{ color:'#16a34a', fontSize:14 }}>✓</span>
                                          : <span title="No Hub item match — check Hub Name" style={{ color:'#dc2626', fontSize:14 }}>✗</span>}
                                      </td>
                                      <td style={{ padding:'4px 8px', textAlign:'center' }}>{item.invoice_qty}</td>
                                      <td style={{ padding:'4px 8px', textAlign:'center' }}>
                                        <input type="number" value={item.units_per_pack} min={1}
                                          onChange={e => setPhExtracted(prev => ({ ...prev, invoices: prev.invoices.map((inv2,ii) => ii!==invIdx ? inv2 : { ...inv2, items: inv2.items.map((it,j) => j===i ? {...it, units_per_pack: Number(e.target.value)||1} : it) }) }))}
                                          style={{ width:50, padding:'2px 4px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:11, textAlign:'center' }} />
                                      </td>
                                      <td style={{ padding:'4px 8px', textAlign:'right' }}>${item.invoice_unit_price.toFixed(2)}</td>
                                      <td style={{ padding:'4px 8px', textAlign:'right', fontWeight:700, color:'#1e3a5f' }}>${unitPrice.toFixed(3)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>
                    ))}
                    <div style={{ padding:14, display:'flex', justifyContent:'flex-end', gap:8, borderTop:'1px solid #e2e8f0', alignItems:'center' }}>
                      {phSaveResult && (
                        <span style={{ fontSize:12, fontWeight:600, flex:1,
                          color: phSaveResult.type==='ok' ? '#16a34a' : phSaveResult.type==='warn' ? '#d97706' : '#dc2626' }}>
                          {phSaveResult.msg}
                        </span>
                      )}
                      <button onClick={async () => {
                        try {
                          setPhSaving(true)
                          setPhSaveResult(null)
                          const results = []
                          if (!phExtracted?.invoices?.length) {
                            setPhSaveResult({ type:'error', msg:'No invoices to save — please extract first.' })
                            setPhSaving(false)
                            return
                          }
                          for (const inv of phExtracted.invoices) {
                            if (inv.error || !inv.items?.length) {
                              results.push({ ref: inv.invoice_ref || inv.source_file, status: 'skipped', count: 0 })
                              continue
                            }
                            try {
                              const r = await fetch('/api/invoices/save', {
                                method:'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify({ invoice_ref: inv.invoice_ref, supplier: inv.supplier,
                                  invoice_date: inv.invoice_date, gst_included: inv.gst_included, items: inv.items })
                              })
                              const d = await r.json()
                              if (!r.ok) throw new Error(d.error)
                              results.push({ ref: inv.invoice_ref, status: 'ok', count: d.saved })
                            } catch (e) {
                              results.push({ ref: inv.invoice_ref || inv.source_file, status: 'error', error: e.message })
                            }
                          }
                          const ok = results.filter(r => r.status === 'ok')
                          const failed = results.filter(r => r.status === 'error')
                          const skipped = results.filter(r => r.status === 'skipped')
                          const total = ok.reduce((s, r) => s + r.count, 0)
                          let msg = `✓ Saved ${total} items across ${ok.length} invoice(s).`
                          if (skipped.length) msg += ` Skipped ${skipped.length} (no items).`
                          if (failed.length) msg += ` ⚠️ ${failed.length} failed: ` + failed.map(r => `${r.ref}: ${r.error}`).join(', ')
                          setPhSaveResult({ type: total > 0 ? 'ok' : 'warn', msg })
                          if (total > 0) { setPhExtracted(null); setPhPdf(null) }
                        } catch (e) {
                          setPhSaveResult({ type:'error', msg:'Unexpected error: ' + e.message })
                          console.error('[save]', e)
                        } finally {
                          setPhSaving(false)
                        }
                      }} disabled={phSaving} style={{ padding:'7px 20px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                        {phSaving ? '⏳ Saving…' : `💾 Save All to History`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MANAGE TAB ─────────────────────────────────────── */}
            {phSubTab === 'manage' && (
              <div>
                <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
                  <button onClick={async () => {
                    setPhManageLoading(true)
                    // Load Hub item names if not yet fetched
                    if (phHubNames.length === 0) {
                      if (items.length > 0) { setPhHubNames(items.map(i => i.name).filter(Boolean).sort()) }
                      else { fetch('/api/items').then(r=>r.json()).then(d => { setPhHubNames((d.items||[]).map(i=>i.name).filter(Boolean).sort()) }).catch(()=>{}) }
                    }
                    try {
                      const r = await fetch('/api/invoices/manage')
                      const d = await r.json()
                      if (!r.ok) throw new Error(d.error)
                      setPhManageData(d.items.map(i => ({ ...i, _hub: i.item_name_hub || i.item_name_raw, _units: i.units_per_pack, _dirty: false })))
                    } catch (e) { alert('Load failed: ' + e.message) }
                    setPhManageLoading(false)
                  }} style={{ padding:'6px 16px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {phManageLoading ? '⏳ Loading…' : '🔄 Load Items'}
                  </button>
                  {phManageData && (
                    <button onClick={async () => {
                      const unmatched = phManageData.filter(r => !r._hub || r._hub === r.item_name_raw)
                      if (!unmatched.length) { alert('All items already have Hub name mappings.'); return }
                      const hubNames = items.length > 0 ? items.map(i => i.name) : phHubNames
                      if (!hubNames.length) { alert('Hub items not loaded yet — try again in a moment.'); return }
                      setPhMatching(true)
                      try {
                        const r = await fetch('/api/invoices/match-names', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ raw_names: unmatched.map(r => r.item_name_raw), hub_names: hubNames })
                        })
                        const d = await r.json()
                        if (!r.ok) throw new Error(d.error)
                        const matchMap = {}
                        for (const m of d.matches || []) matchMap[m.raw] = m
                        setPhManageData(prev => prev.map(row => {
                          const m = matchMap[row.item_name_raw]
                          if (!m || !m.hub) return row
                          return { ...row, _hub: m.hub, _confidence: m.confidence, _dirty: true }
                        }))
                      } catch(e) { alert('Auto-match failed: ' + e.message) }
                      setPhMatching(false)
                    }} style={{ padding:'5px 12px', background: phMatching ? '#94a3b8' : '#7c3aed', color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, cursor: phMatching ? 'default' : 'pointer' }}
                    disabled={phMatching}>
                      {phMatching ? '⏳ Matching…' : '🤖 Auto-match'}
                    </button>
                  )}
                  {phManageData && (
                    <button onClick={() => {
                      const activeNames = new Set(items.map(i => i.name))
                      const hubGroups = {}
                      for (const row of phManageData) {
                        const hub = row.item_name_hub; if (!hub || hub === row.item_name_raw) continue
                        if (!hubGroups[hub]) hubGroups[hub] = []; hubGroups[hub].push(row)
                      }
                      const audit = []
                      for (const [hub, rows] of Object.entries(hubGroups)) {
                        if (rows.length > 1) rows.forEach((r,idx) => audit.push({ raw:r.item_name_raw, hub, reason:`Duplicate — ${rows.length} invoice names map to "${hub}"`, flag:'duplicate', keepFirst:idx===0 }))
                      }
                      for (const row of phManageData) {
                        const hub = row.item_name_hub; if (!hub || hub === row.item_name_raw) continue
                        if (!activeNames.has(hub) && !audit.find(a=>a.raw===row.item_name_raw)) audit.push({ raw:row.item_name_raw, hub, reason:`"${hub}" not in current item list`, flag:'stale' })
                        if (rundownItems[hub] && !audit.find(a=>a.raw===row.item_name_raw)) audit.push({ raw:row.item_name_raw, hub, reason:`"${hub}" is a rundown item`, flag:'rundown' })
                      }
                      setPhAuditItems(audit)
                      setPhAuditSelected(new Set(audit.filter(a=>a.flag!=='duplicate'||!a.keepFirst).map(a=>a.raw)))
                    }} style={{ padding:'6px 14px', background:'#0e7490', color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:12, cursor:'pointer' }}>🔍 Audit</button>
                  )}
                  {phManageData && (() => {
                    const activeNames = new Set(items.map(i => i.name))
                    const hiddenCount = phManageData.filter(row => {
                      const hub = row._hub || row.item_name_hub || ''; if (!hub) return false
                      if (rundownItems[hub]) return true
                      if (activeNames.size > 0 && !activeNames.has(hub)) return true
                      return false
                    }).length
                    return <span style={{ fontSize:12, color:'#64748b' }}>
                      {phManageData.length - hiddenCount} active items
                      {hiddenCount > 0 && <span style={{ color:'#d97706' }}> · {hiddenCount} rundown/deleted hidden</span>}
                      {' '}— edit Hub Name and Units/Pack then click Save on each row
                    </span>
                  })()}
                </div>

                {phAuditItems !== null && (
                  <div style={{ marginBottom:16, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'#92400e' }}>
                        {phAuditItems.length===0?'✓ No issues found':`🔍 Audit — ${phAuditItems.length} issue${phAuditItems.length!==1?'s':''} found`}
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        {phAuditSelected.size > 0 && (
                          <button disabled={phAuditDeleting} onClick={async () => {
                            if (!confirm(`Delete ${phAuditSelected.size} record${phAuditSelected.size!==1?'s':''}? Cannot be undone.`)) return
                            setPhAuditDeleting(true)
                            try {
                              const r = await fetch('/api/invoices/delete-items',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw_names:[...phAuditSelected]})})
                              const d = await r.json()
                              if (!d.ok) throw new Error(d.error)
                              setPhManageData(prev=>prev.filter(row=>!phAuditSelected.has(row.item_name_raw)))
                              setPhAuditItems(null); setPhAuditSelected(new Set())
                              alert(`Deleted ${d.deleted} record${d.deleted!==1?'s':''}.`)
                            } catch(e) { alert('Delete failed: '+e.message) }
                            setPhAuditDeleting(false)
                          }} style={{ padding:'5px 14px', background:phAuditDeleting?'#94a3b8':'#dc2626', color:'#fff', border:'none', borderRadius:5, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                            {phAuditDeleting?'⏳ Deleting…':`🗑 Delete ${phAuditSelected.size} selected`}
                          </button>
                        )}
                        <button onClick={() => { setPhAuditItems(null); setPhAuditSelected(new Set()) }}
                          style={{ padding:'5px 12px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:5, fontSize:12, cursor:'pointer' }}>✕ Close</button>
                      </div>
                    </div>
                    {phAuditItems.length > 0 && (
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead><tr style={{ background:'#fef3c7', borderBottom:'1px solid #fde68a' }}>
                          <th style={{ padding:'5px 8px', width:28 }}><input type="checkbox" checked={phAuditSelected.size===phAuditItems.length} onChange={e=>setPhAuditSelected(e.target.checked?new Set(phAuditItems.map(a=>a.raw)):new Set())} /></th>
                          {['Invoice Name','Matched Hub Item','Issue'].map(h=><th key={h} style={{ padding:'5px 8px', textAlign:'left', fontWeight:700, color:'#92400e' }}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {phAuditItems.map((a,idx)=>(
                            <tr key={a.raw} style={{ borderBottom:'1px solid #fde68a', background:idx%2===0?'#fffbeb':'#fefce8' }}>
                              <td style={{ padding:'5px 8px', textAlign:'center' }}><input type="checkbox" checked={phAuditSelected.has(a.raw)} onChange={e=>{const s=new Set(phAuditSelected);e.target.checked?s.add(a.raw):s.delete(a.raw);setPhAuditSelected(s)}} /></td>
                              <td style={{ padding:'5px 8px', fontFamily:'monospace' }}>{a.raw}</td>
                              <td style={{ padding:'5px 8px', color:'#64748b' }}>{a.hub||'—'}</td>
                              <td style={{ padding:'5px 8px', fontWeight:600, color:a.flag==='duplicate'?'#0369a1':a.flag==='rundown'?'#d97706':'#dc2626' }}>{a.flag==='duplicate'?'🔵 ':a.flag==='rundown'?'🟡 ':'🔴 '}{a.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                {phManageData && (
                  <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>
                      Fix Item Names &amp; Units Per Pack
                    </div>
                    <div style={{ padding:'8px 12px', fontSize:12, color:'#64748b', background:'#f8fafc' }}>
                      Edit <strong>Hub Name</strong> to match your Hub item exactly. Change <strong>Units/Pack</strong> if needed — saving recalculates all historical per-unit prices automatically.
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'#f1f5f9', borderBottom:'2px solid #e2e8f0' }}>
                            {['Invoice Description','Hub Name','Sup','Inv. Unit Price','Units/Pack','Per Unit ex GST','Lines','Action'].map(h => (
                              <th key={h} style={{ padding:'7px 8px', textAlign:'left', fontWeight:700, color:'#374151', fontSize:11, whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const activeNames = new Set(items.map(i => i.name))
                            return phManageData.filter(row => {
                              const hub = row._hub || row.item_name_hub || ''; if (!hub) return true
                              if (rundownItems[hub]) return false
                              if (activeNames.size > 0 && !activeNames.has(hub)) return false
                              return true
                            })
                          })().map((row, i) => {
                            const calcUnit = row.invoice_unit_price / (row._units || 1) / (row.gst_included ? 1.10 : 1.0)
                            const saved = phManageSaving[row.item_name_raw]
                            return (
                              <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: row._dirty ? '#fffbeb' : (i%2===0?'#fff':'#f8fafc') }}>
                                <td style={{ padding:'5px 8px', color:'#64748b', fontSize:11, maxWidth:200 }}>{row.item_name_raw}</td>
                                <td style={{ padding:'5px 8px', minWidth:180 }}>
                                  {row._confidence && (
                                    <span style={{ display:'inline-block', marginBottom:3, padding:'1px 6px', borderRadius:3, fontSize:10, fontWeight:700,
                                      background: row._confidence==='high'?'#dcfce7':row._confidence==='medium'?'#fef9c3':'#fee2e2',
                                      color: row._confidence==='high'?'#166534':row._confidence==='medium'?'#92400e':'#991b1b' }}>
                                      {row._confidence==='high'?'✓ high':row._confidence==='medium'?'~ medium':'? low'}
                                    </span>
                                  )}
                                  <select value={row._hub}
                                    onChange={e => setPhManageData(prev => prev.map(r => r.item_name_raw === row.item_name_raw ? {...r, _hub: e.target.value, _dirty: true} : r))}
                                    style={{ width:'100%', padding:'3px 5px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:11 }}>
                                    <option value="">-- select Hub item --</option>
                                    {(() => {
                                      const activeNames = (items.length > 0 ? items : phHubNames.map(n=>({name:n}))).filter(it=>it.name&&!rundownItems[it.name]).map(it=>it.name).sort()
                                      const currentVal = row._hub && row._hub !== row.item_name_raw ? row._hub : null
                                      const isStale = currentVal && !activeNames.includes(currentVal)
                                      return <>{isStale && <option value={currentVal}>⚠ {currentVal} (not in current list)</option>}{activeNames.map(n=><option key={n} value={n}>{n}</option>)}</>
                                    })()}
                                  </select>
                                </td>
                                <td style={{ padding:'5px 8px', color:'#64748b', fontSize:11, whiteSpace:'nowrap' }}>{row.supplier}</td>
                                <td style={{ padding:'5px 8px', textAlign:'right' }}>${Number(row.invoice_unit_price).toFixed(2)}</td>
                                <td style={{ padding:'5px 8px', textAlign:'center' }}>
                                  <input type="number" value={row._units} min={1}
                                    onChange={e => setPhManageData(prev => prev.map(r => r.item_name_raw === row.item_name_raw ? {...r, _units: Number(e.target.value)||1, _dirty: true} : r))}
                                    style={{ width:50, padding:'2px 4px', border:'1px solid #cbd5e1', borderRadius:4, fontSize:11, textAlign:'center' }} />
                                </td>
                                <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:700, color: row._dirty ? '#d97706' : '#1e3a5f' }}>
                                  ${calcUnit.toFixed(4)}
                                </td>
                                <td style={{ padding:'5px 8px', textAlign:'center', color:'#64748b' }}>{row.count}</td>
                                <td style={{ padding:'5px 8px' }}>
                                  {row._dirty && (
                                    <button onClick={async () => {
                                      setPhManageSaving(prev => ({ ...prev, [row.item_name_raw]: true }))
                                      try {
                                        const r = await fetch('/api/invoices/manage', {
                                          method:'PATCH', headers:{'Content-Type':'application/json'},
                                          body: JSON.stringify({ item_name_raw: row.item_name_raw, item_name_hub: row._hub, units_per_pack: row._units })
                                        })
                                        const d = await r.json()
                                        if (!r.ok) throw new Error(d.error)
                                        setPhManageData(prev => prev.map(r2 => r2.item_name_raw === row.item_name_raw ? {...r2, item_name_hub: r2._hub, units_per_pack: r2._units, _dirty: false} : r2))
                                      } catch (e) { alert('Save failed: ' + e.message) }
                                      setPhManageSaving(prev => ({ ...prev, [row.item_name_raw]: false }))
                                    }} style={{ padding:'3px 10px', background:'#16a34a', color:'#fff', border:'none', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                      {saved ? '⏳' : '💾 Save'}
                                    </button>
                                  )}
                                  {!row._dirty && <span style={{ fontSize:11, color:'#94a3b8' }}>✓</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRICE REVIEW MODAL ──────────────────────────────────────── */}
            {priceReviewModal && (() => {
              const TARGET  = 40
              const WINE_C  = ['White Wine','Red Wine','Rose','Sparkling']
              const mceil   = (v, m) => Math.ceil(v / m) * m
              const supColour = { "Dan Murphy's": '#1e3a5f', 'Coles Woolies': '#166534', 'ACW': '#92400e' }

              const rows = (phAvgData?.items || [])
                .filter(row => row.matched_hub_key && row.supplier === priceReviewModal)
                .flatMap(row => {
                  const hubItem = items.find(i => i.name === row.matched_hub_key)
                  if (!hubItem || rundownItems[hubItem.name]) return []

                  const isWine     = WINE_C.includes(hubItem.category)
                  const bottleOnly = hubItem.bottleOnly === true || hubItem.bottleOnly === 'yes' || hubItem.category === 'Sparkling'
                  const glassWine  = isWine && !bottleOnly
                  const serves     = glassWine ? 5 : 1
                  const vars       = hubItem.variations || []
                  const glassVar   = vars.find(v => v.name?.toLowerCase().includes('glass'))
                  const bottleVar  = vars.find(v => v.name?.toLowerCase().includes('bottle') || v.name?.toLowerCase() === 'regular')
                  const nipVar     = vars.find(v => v.name?.toLowerCase().includes('nip') || v.name?.toLowerCase().includes('30ml'))

                  const sellGlass = hubItem.isSpirit
                    ? (nipVar||bottleVar||glassVar)?.price != null ? Number((nipVar||bottleVar||glassVar).price) : (hubItem.squareSellPrice != null ? Number(hubItem.squareSellPrice) : (hubItem.sellPrice != null ? Number(hubItem.sellPrice) : null))
                    : glassVar?.price != null ? Number(glassVar.price)
                    : bottleVar?.price != null ? Number(bottleVar.price)
                    : hubItem.squareSellPrice != null ? Number(hubItem.squareSellPrice)
                    : hubItem.sellPrice != null ? Number(hubItem.sellPrice) : null
                  const sellBottle = bottleVar?.price != null ? Number(bottleVar.price)
                    : hubItem.squareSellPriceBottle != null ? Number(hubItem.squareSellPriceBottle)
                    : hubItem.squareSellPrice != null ? Number(hubItem.squareSellPrice) : null

                  const nipMLDetected = row.item_name.match(/(\d+)\s*ml\s*nip/i)
                  const effNipML   = nipMLDetected ? Number(nipMLDetected[1]) : (hubItem.nipML || 30)
                  const effBotML   = hubItem.bottleML || 700
                  const nipsPerBtl = hubItem.isSpirit ? effBotML / effNipML : null
                  const avgBuyPerUnit   = row.buy_price_inc_gst ?? null
                  const avgBuyPerBottle = row.avg_unit_price_ex_gst != null
                    ? Math.round(row.avg_unit_price_ex_gst * 1.10 * 1000) / 1000
                    : null

                  const out = []

                  if (!bottleOnly && avgBuyPerUnit != null && sellGlass != null && sellGlass > 0) {
                    // Anomaly detection: spread > 20% of avg → use min instead
                    const spread = (row.min_price_inc_gst != null && row.max_price_inc_gst != null && avgBuyPerUnit > 0)
                      ? (row.max_price_inc_gst - row.min_price_inc_gst) / avgBuyPerUnit : 0
                    const hasAnomaly = spread > 0.20
                    const effBuyPerUnit = hasAnomaly ? (row.min_price_inc_gst ?? avgBuyPerUnit) : avgBuyPerUnit
                    const rev    = sellGlass * serves
                    const markup = effBuyPerUnit > 0 ? (rev - effBuyPerUnit) / effBuyPerUnit * 100 : 0
                    const diff   = markup - TARGET
                    if (markup < TARGET) out.push({
                      name: row.matched_hub_key, cat: hubItem.category,
                      unit: hubItem.isSpirit ? `nip (${effNipML}ml)` : 'glass',
                      sell: sellGlass, avgBuy: effBuyPerUnit / serves, avgBuyBottle: glassWine ? effBuyPerUnit : null,
                      markup, diff, hasAnomaly, spread,
                      suggSell: mceil(effBuyPerUnit * (1 + TARGET/100) / serves, 0.25)
                    })
                  }

                  if (isWine && avgBuyPerBottle != null && sellBottle != null && sellBottle > 0) {
                    const markup = avgBuyPerBottle > 0 ? (sellBottle - avgBuyPerBottle) / avgBuyPerBottle * 100 : 0
                    const diff   = markup - TARGET
                    if (markup < TARGET) out.push({
                      name: row.matched_hub_key, cat: hubItem.category,
                      unit: 'bottle', sell: sellBottle, avgBuy: avgBuyPerBottle, markup, diff,
                      suggSell: mceil(avgBuyPerBottle * (1 + TARGET/100), 0.25)
                    })
                  }

                  return out
                })
                .sort((a,b) => {
                  if (a.name !== b.name) return a.name.localeCompare(b.name)
                  const uOrder = { glass: 0, bottle: 1 }
                  return (uOrder[a.unit] ?? 2) - (uOrder[b.unit] ?? 2)
                })
              const tooLow  = rows.length

              const tableId = 'price-review-table'

              return (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
                  onClick={() => setPriceReviewModal(false)}>
                  <div style={{ background:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:860, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}
                    onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                      <div>
                        <div style={{ fontSize:16, fontWeight:800, color: supColour[priceReviewModal] || '#0f172a' }}>
                          📊 {priceReviewModal} — Price Review
                        </div>
                        <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                          {tooLow} item{tooLow !== 1 ? 's' : ''} below {TARGET}% target · 90-day avg buy (inc GST) · sugg sell rounds up to nearest $0.25
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                        {/* Switch supplier */}
                        {["Dan Murphy's",'Coles Woolies','ACW'].filter(s => s !== priceReviewModal).map(s => (
                          <button key={s} onClick={() => setPriceReviewModal(s)}
                            style={{ padding:'3px 10px', background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', borderRadius:5, fontSize:11, cursor:'pointer', fontWeight:600 }}>
                            {s}
                          </button>
                        ))}
                        {/* Print */}
                        <button onClick={() => {
                          const tbl = document.getElementById(tableId)
                          if (!tbl) return
                          const w = window.open('', '_blank')
                          w.document.write(`<html><head><title>${priceReviewModal} Price Review</title>
                            <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
                            h2{color:#1e3a5f;margin-bottom:4px}p{color:#64748b;margin:0 0 12px}
                            table{border-collapse:collapse;width:100%}th{background:#1e3a5f;color:#fff;padding:7px 10px;text-align:left}
                            td{padding:6px 10px;border-bottom:1px solid #e2e8f0}
                            tr:nth-child(even){background:#f8fafc}
                            .red{color:#dc2626;font-weight:700}.blue{color:#0369a1;font-weight:700}
                            .pill{display:inline-block;padding:1px 6px;border-radius:8px;font-size:11px}
                            .r{text-align:right}</style></head><body>
                            <h2>📊 ${priceReviewModal} — Price Review</h2>
                            <p>${tooLow} item${tooLow !== 1 ? 's' : ''} below ${TARGET}% markup target · sugg sell rounded up to nearest $0.25</p>
                            ${tbl.outerHTML}</body></html>`)
                          w.document.close(); w.print()
                        }} style={{ padding:'3px 10px', background:'#f8fafc', color:'#374151', border:'1px solid #e2e8f0', borderRadius:5, fontSize:11, cursor:'pointer', fontWeight:600 }}>
                          🖨 Print
                        </button>
                        {/* Export CSV */}
                        <button onClick={() => {
                          const csv = ['Item,Category,Unit,Avg Buy (inc GST),Current Sell,Markup %,vs Target %,Sugg Sell']
                            .concat(rows.map(r => `"${r.name}","${r.cat}","${r.unit}",${r.avgBuy.toFixed(3)},${r.sell.toFixed(2)},${r.markup.toFixed(1)},${r.diff.toFixed(1)},${r.suggSell.toFixed(2)}`))
                            .join('\n')
                          const blob = new Blob([csv], { type:'text/csv' })
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(blob)
                          a.download = `PriceReview-${priceReviewModal.replace(/[^a-z]/gi,'')}-${TARGET}pct.csv`
                          a.click()
                        }} style={{ padding:'3px 10px', background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0', borderRadius:5, fontSize:11, cursor:'pointer', fontWeight:600 }}>
                          📥 CSV
                        </button>
                        <button onClick={() => setPriceReviewModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>×</button>
                      </div>
                    </div>

                    {phLoading ? (
                      <div style={{ padding:48, textAlign:'center', color:'#64748b' }}>⏳ Loading price data…</div>
                    ) : rows.length === 0 ? (
                      <div style={{ padding:32, textAlign:'center', color:'#64748b' }}>
                        {phAvgData
                          ? <span>✓ All {priceReviewModal} items are at or above the {TARGET}% markup target.</span>
                          : <span>⏳ Loading price data…</span>}
                      </div>
                    ) : (
                      <table id={tableId} style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background: supColour[priceReviewModal] || '#1e3a5f', color:'#fff' }}>
                            {['Item','Category','Unit','Avg Buy (inc GST)','Current Sell','Markup','vs Target','Sugg Sell','Change'].map(h => (
                              <th key={h} style={{ padding:'8px 10px', textAlign:['Avg Buy (inc GST)','Current Sell','Markup','vs Target','Sugg Sell','Change'].includes(h)?'right':'left', fontWeight:700, fontSize:11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const isNewItem = i === 0 || rows[i-1].name !== r.name
                            const hasPair   = rows.some((r2, j) => j !== i && r2.name === r.name)
                            return (
                            <tr key={i} style={{
                              background: isNewItem && hasPair ? '#f0f9ff' : i%2===0?'#fff':'#f8fafc',
                              borderBottom: hasPair && !isNewItem ? '2px solid #bae6fd' : '1px solid #f1f5f9',
                              borderTop: isNewItem && hasPair ? '2px solid #bae6fd' : undefined
                            }}>
                              <td style={{ padding:'7px 10px', fontWeight:600, color:'#0f172a', maxWidth:200 }}>{r.name}</td>
                              <td style={{ padding:'7px 10px', color:'#64748b', fontSize:11 }}>{r.cat}</td>
                              <td style={{ padding:'7px 10px' }}>
                                <span style={{ padding:'1px 7px', borderRadius:10, fontSize:10, fontWeight:700, background:'#e0f2fe', color:'#0369a1' }}>{r.unit}</span>
                              </td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:'monospace' }}>${r.avgBuy.toFixed(3)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:'monospace' }}>${r.sell.toFixed(2)}</td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color: r.markup < TARGET ? '#dc2626' : '#16a34a' }}>
                                {r.markup.toFixed(1)}%
                              </td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, color: r.diff < 0 ? '#dc2626' : '#0369a1' }}>
                                {r.diff > 0 ? '+' : ''}{r.diff.toFixed(1)}%
                              </td>
                              <td style={{ padding:'7px 10px', textAlign:'right' }}>
                                <span style={{ fontWeight:800, fontSize:13,
                                  color: r.diff < 0 ? '#b91c1c' : '#0c4a6e',
                                  background: r.diff < 0 ? '#fee2e2' : '#e0f2fe',
                                  padding:'2px 8px', borderRadius:4 }}>
                                  ${r.suggSell.toFixed(2)}
                                </span>
                              </td>
                              <td style={{ padding:'7px 10px', textAlign:'right', fontSize:12, fontWeight:700, color: r.diff < 0 ? '#dc2626' : '#0369a1' }}>
                                {r.suggSell > r.sell ? '↑' : r.suggSell < r.sell ? '↓' : '—'}
                                {r.suggSell !== r.sell ? ` $${Math.abs(r.suggSell - r.sell).toFixed(2)}` : ''}
                              </td>
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    <div style={{ marginTop:10, fontSize:11, color:'#94a3b8' }}>
                      Sugg sell = min price for {TARGET}% markup, rounded UP to nearest $0.25 · Glass wine = sell × 5/btl
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {mainTab === 'pricing' && (
          <div style={{ padding: '16px 0' }}>
            {/* Sub-tab strip */}
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {[['avgprices','📊 Average Prices'],['markup','$ Markup / Sell Prices']].map(([t,label]) => (
                <button key={t} onClick={() => { setPricingSubTab(t); if (t === 'avgprices' && !phAvgData && !phLoading) loadPhReport(90, phSupFilter) }}
                  style={{ padding:'7px 18px', borderRadius:6, border:'1px solid #e2e8f0', fontWeight:700, fontSize:13, cursor:'pointer',
                    background: pricingSubTab===t ? '#1e3a5f' : '#f8fafc', color: pricingSubTab===t ? '#fff' : '#374151' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── AVERAGE PRICES ─────────────────────────────────── */}
            {pricingSubTab === 'avgprices' && (
              <div>
                {!phAvgData && !phLoading && (() => { loadPhReport(90, phSupFilter); return null })()} {/* auto-load on first open */}
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>Last 90 days</span>
                  <select value={phSupFilter} onChange={e => { const v = e.target.value; setPhSupFilter(v); if (phAvgData) loadPhReport(90, v) }}
                    style={{ padding:'5px 10px', border:'1px solid #e2e8f0', borderRadius:5, fontSize:12 }}>
                    <option value="all">All Suppliers</option>
                    {(phDbSuppliers.length > 0 ? phDbSuppliers : suppliers).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b', cursor:'pointer', userSelect:'none' }}>
                    <input type="checkbox" checked={phActiveOnly} onChange={e => setPhActiveOnly(e.target.checked)} />
                    Active items only
                  </label>
                  {["Dan Murphy's",'Coles Woolies','ACW'].map(sup => (
                    <button key={sup} onClick={() => { setPriceReviewModal(sup); if (!phAvgData && !phLoading) loadPhReport(90, 'all') }}
                      style={{ padding:'6px 12px', background: sup==="Dan Murphy's"?'#1e3a5f':sup==='Coles Woolies'?'#166534':'#92400e',
                        color:'#fff', border:'none', borderRadius:6, fontWeight:700, fontSize:11, cursor:'pointer' }}>
                      📊 {sup}
                    </button>
                  ))}
                  <button onClick={() => loadPhReport(90, phSupFilter)}
                    style={{ padding:'5px 14px', background:'#1e3a5f', color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {phLoading ? '⏳ Loading…' : '📊 Load Report'}
                  </button>
                  <button onClick={() => setShowPriceDetail(v => !v)}
                    style={{ padding:'5px 12px', borderRadius:5, border:'1px solid #e2e8f0', fontSize:11, fontWeight:600, cursor:'pointer',
                      background: showPriceDetail ? '#eff6ff' : '#f8fafc', color: showPriceDetail ? '#1d4ed8' : '#64748b' }}>
                    {showPriceDetail ? '▾ Hide detail' : '▸ Show min/max/variance'}
                  </button>
                  <button onClick={() => exportAvgPriceReport()}
                    style={{ padding:'5px 14px', background:'#065f46', color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    📥 Avg Price Report
                  </button>
                  <button onClick={() => exportBelow40Report()}
                    style={{ padding:'5px 14px', background:'#dc2626', color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    🚨 Below 40% Report
                  </button>
                  {!readOnly && (
                    <button onClick={async () => {
                      // Fetch fresh data so this always works, even if report wasn't loaded
                      let data = phAvgData
                      if (!data) {
                        try {
                          const r = await fetch(`/api/invoices/avg-prices?days=90&supplier=${encodeURIComponent(phSupFilter)}`)
                          data = await r.json()
                          if (r.ok) setPhAvgData(data)
                        } catch(e) { alert('Failed to load avg prices: ' + e.message); return }
                      }
                      const updatable = (data?.items || []).filter(row => row.buy_price_inc_gst != null && row.matched_hub_key)
                      if (!updatable.length) { alert('No items with avg buy prices to update. Import and match some invoices first.'); return }
                      if (!confirm(`Update Hub buy prices for ALL ${updatable.length} items to their 90-day average (inc GST)?\n\nThis will overwrite existing buy prices.`)) return
                      let updated = 0, failed = 0
                      for (const row of updatable) {
                        try {
                          const r = await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ itemName: row.matched_hub_key, field:'buyPrice', value: row.buy_price_inc_gst }) })
                          if (r.ok) updated++; else failed++
                        } catch { failed++ }
                      }
                      if (updated > 0) {
                        setItems(prev => {
                          const byHub = Object.fromEntries(updatable.map(r => [r.matched_hub_key, r.buy_price_inc_gst]))
                          return prev.map(it => byHub[it.name] != null ? { ...it, buyPrice: byHub[it.name] } : it)
                        })
                      }
                      alert(`✓ Updated ${updated} buy prices.${failed ? ` ${failed} failed.` : ''}`)
                    }} style={{ padding:'5px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:5, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      ↑ Update All Buy Prices
                    </button>
                  )}
                </div>
                {phAvgData && (
                  phAvgData.items?.length === 0 ? (
                    <div style={{ textAlign:'center', padding:40, color:'#64748b' }}>No price history found for this period. Import some invoices first.</div>
                  ) : (
                    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                      <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 16px', fontWeight:700, fontSize:13 }}>
                        Average Buy Prices — last {phAvgData.period_days} days (inc GST) · {phAvgData.items?.length} items
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                          <thead>
                            <tr style={{ background:'#f1f5f9', borderBottom:'2px solid #e2e8f0' }}>
                              {['Item','Supplier','Avg Buy Price (inc GST)','# Invoices',...(showPriceDetail?['Min (inc GST)','Max (inc GST)','Variance']:[]),'Current Hub Price','Action'].map(h => (
                                <th key={h} style={{ padding:'8px 10px', textAlign: h.includes('Price')||h.includes('Min')||h.includes('Max')||h.includes('Var') ? 'right' : 'left', fontWeight:700, color:'#374151', fontSize:11, whiteSpace:'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {phAvgData.items?.filter(row => {
                              if (!phActiveOnly) return true
                              if (!row.matched_hub_key) return false
                              return items.length === 0 || items.some(it => it.name === row.matched_hub_key)
                            }).map((row, i) => {
                              // buy_price_inc_gst / min / max are now computed server-side
                              const avgIncGst  = row.buy_price_inc_gst ?? null
                              const minIncGst  = row.min_price_inc_gst ?? null
                              const maxIncGst  = row.max_price_inc_gst ?? null
                              const currentBuy = row.current_buy_price
                              const diff = currentBuy != null && avgIncGst != null ? avgIncGst - currentBuy : null
                              const variance = maxIncGst != null && minIncGst != null ? maxIncGst - minIncGst : 0
                              return (
                                <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0?'#fff':'#f8fafc' }}>
                                  <td style={{ padding:'7px 10px', fontWeight:600 }}>{row.item_name}</td>
                                  <td style={{ padding:'7px 10px', color:'#64748b' }}>{row.supplier}</td>
                                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:700, color:'#1e3a5f' }}>
                                    {avgIncGst != null ? `$${avgIncGst.toFixed(3)}` : '—'}
                                    {row.is_spirit && <div style={{ fontSize:9, color:'#94a3b8', fontWeight:400 }}>{row.unit_label}</div>}
                                  </td>
                                  <td style={{ padding:'7px 10px', textAlign:'center', color:'#64748b' }}>{row.invoice_count}</td>
                                  {showPriceDetail && <td style={{ padding:'7px 10px', textAlign:'right', color:'#64748b' }}>{minIncGst != null ? `$${minIncGst.toFixed(3)}` : '—'}</td>}
                                  {showPriceDetail && <td style={{ padding:'7px 10px', textAlign:'right', color:'#64748b' }}>{maxIncGst != null ? `$${maxIncGst.toFixed(3)}` : '—'}</td>}
                                  {showPriceDetail && <td style={{ padding:'7px 10px', textAlign:'right', color: variance > 0.5 ? '#d97706' : '#64748b' }}>${variance.toFixed(3)}</td>}
                                  <td style={{ padding:'7px 10px', textAlign:'right' }}>
                                    {currentBuy != null ? (
                                      <span style={{ color: diff > 0.02 ? '#dc2626' : diff < -0.02 ? '#16a34a' : '#64748b' }}>
                                        ${Number(currentBuy).toFixed(3)}
                                        {diff != null && <span style={{ fontSize:10, marginLeft:4 }}>({diff > 0 ? '+' : ''}{diff.toFixed(3)})</span>}
                                      </span>
                                    ) : <span style={{ color:'#94a3b8' }}>—</span>}
                                  </td>
                                  <td style={{ padding:'7px 10px' }}>
                                    {avgIncGst != null && (
                                      <button onClick={async () => {
                                        const hubKey = row.matched_hub_key || row.item_name
                                        if (!confirm(`Update buy price for "${hubKey}" to $${avgIncGst.toFixed(3)} (inc GST)?`)) return
                                        const r2 = await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'},
                                          body: JSON.stringify({ itemName: hubKey, field:'buyPrice', value: avgIncGst }) })
                                        if (r2.ok) {
                                          // Update items state directly — no Square refresh needed
                                          setItems(prev => prev.map(it => it.name === hubKey ? { ...it, buyPrice: avgIncGst } : it))
                                          alert('✓ Buy price updated.')
                                        } else alert('Failed to update buy price.')
                                      }} style={{ padding:'2px 8px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                        ↑ Update
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* ── MARKUP / SELL PRICES ───────────────────────────── */}
            {pricingSubTab === 'markup' && (
              <div>
                <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:24, marginBottom:16 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'#0f172a', marginBottom:6 }}>$ Markup & Sell Price Analysis</div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:20 }}>
                    Full pricing analysis with buy prices, markup %, sell prices and margin. Opens in the Stock Items pricing view.
                  </div>
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <button onClick={() => { setMainTab('reorder'); setViewMode('pricing') }}
                      style={{ padding:'10px 22px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                      $ Open Pricing View
                    </button>
                    <button onClick={printPricingSheet}
                      style={{ padding:'10px 18px', background:'#f0fdf4', color:'#047857', border:'1px solid #86efac', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                      🖨️ Print
                    </button>
                    <button onClick={() => exportPricingExcel(40)}
                      style={{ padding:'10px 18px', background:'#f0fdf4', color:'#047857', border:'1px solid #86efac', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                      📥 Excel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mainTab === 'documents' && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>📁 Purchase Documents</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>All PO records with receive reports and invoices</div>
              </div>
              <button onClick={loadDocuments} style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                🔄 Refresh
              </button>
            </div>
            {/* Filter bar */}
            {!docsLoading && documents.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={docSearch} onChange={e => setDocSearch(e.target.value)}
                  placeholder="Search PO ref…"
                  style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, width: 160 }} />
                <select value={docSupFilter} onChange={e => setDocSupFilter(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
                  <option value="all">All Suppliers</option>
                  {[...new Set(documents.map(d => d.supplier).filter(Boolean))].sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select value={docStatusFilter} onChange={e => setDocStatusFilter(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
                  <option value="all">All Status</option>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                </select>
                {(docSearch || docSupFilter !== 'all' || docStatusFilter !== 'all') && (
                  <button onClick={() => { setDocSearch(''); setDocSupFilter('all'); setDocStatusFilter('all') }}
                    style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#64748b' }}>
                    ✕ Clear
                  </button>
                )}
              </div>
            )}
            {docsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading documents…</div>
            ) : documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No documents yet. Documents are created automatically when orders are placed and received.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {documents
                  .filter(doc => {
                    if (docSupFilter !== 'all' && doc.supplier !== docSupFilter) return false
                    if (docStatusFilter !== 'all' && doc.status !== docStatusFilter) return false
                    if (docSearch && !doc.po_ref?.toLowerCase().includes(docSearch.toLowerCase())) return false
                    return true
                  })
                  .map((doc, i) => {
                  const stColor = doc.status === 'received' ? '#16a34a' : doc.status === 'partial' ? '#d97706' : '#1d4ed8'
                  const stBg    = doc.status === 'received' ? '#f0fdf4'  : doc.status === 'partial' ? '#fffbeb'  : '#eff6ff'
                  const stBdr   = doc.status === 'received' ? '#86efac'  : doc.status === 'partial' ? '#fde68a'  : '#bfdbfe'
                  const stLabel = doc.status === 'received' ? '✓ Received' : doc.status === 'partial' ? '⚡ Partial' : '🛒 Ordered'
                  const supColor = doc.supplier === "Dan Murphy's" ? '#1e3a5f' : doc.supplier === 'Coles Woolies' ? '#166534' : doc.supplier === 'ACW' ? '#92400e' : '#334155'
                  const sentAt   = docEmailSent[doc.id]
                  const sending  = docEmailSending[doc.id]
                  const sentDate = sentAt && sentAt !== 'error'
                    ? new Date(sentAt).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : null
                  const fmtD = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : null

                  async function doSend() {
                    setDocEmailSending(prev => ({ ...prev, [doc.id]: true }))
                    try {
                      const r = await fetch('/api/send-treasurer-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc }) })
                      const d = await r.json().catch(() => ({}))
                      if (d.ok) {
                        setDocEmailSent(prev => ({ ...prev, [doc.id]: d.treasurer_emailed_at || new Date().toISOString() }))
                      } else {
                        setDocEmailSent(prev => ({ ...prev, [doc.id]: 'error' }))
                        alert(`Email failed: ${d.error || 'Unknown error'}`)
                      }
                    } catch {
                      setDocEmailSent(prev => ({ ...prev, [doc.id]: 'error' }))
                    } finally {
                      setDocEmailSending(prev => ({ ...prev, [doc.id]: false }))
                    }
                  }

                  const DocLink = ({ href, icon, label, color = '#0ea5e9' }) => !href ? null : (
                    <a href={href} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color, fontWeight: 600, textDecoration: 'none',
                        padding: '2px 7px', borderRadius: 4, background: color + '18', border: `1px solid ${color}40` }}>
                      {icon} {label}
                    </a>
                  )

                  return (
                    <div key={doc.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', gap: 0 }}>
                        {/* Supplier colour strip */}
                        <div style={{ width: 6, background: supColor, flexShrink: 0 }} />
                        {/* Main card content */}
                        <div style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', minWidth: 0 }}>
                          {/* PO ref + supplier + status */}
                          <div style={{ minWidth: 200, flex: '2 1 200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{doc.po_ref}</span>
                              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: stBg, color: stColor, border: `1px solid ${stBdr}` }}>{stLabel}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: supColor, color: '#fff' }}>{doc.supplier}</span>
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>{doc.item_count || '—'} items</span>
                            </div>
                          </div>
                          {/* Dates */}
                          <div style={{ display: 'flex', gap: 20, flex: '1 1 180px' }}>
                            <div>
                              <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Ordered</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{fmtD(doc.order_date) || '—'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Received</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: doc.receive_date ? '#374151' : '#cbd5e1' }}>{fmtD(doc.receive_date) || '—'}</div>
                            </div>
                          </div>
                          {/* OneDrive warning — invoice saved to Supabase but not OneDrive */}
                          {doc.invoice_url && !doc.invoice_onedrive_url && (
                            <div style={{ fontSize:10, color:'#d97706', fontWeight:600, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:4, padding:'3px 8px', marginBottom:6 }}>
                              ⚠️ Invoice not on OneDrive — email attachment may fail
                            </div>
                          )}
                          {/* Document links — show all available links */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 200px' }}>
                            {/* PO */}
                            {(doc.po_onedrive_url) && (
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#94a3b8', width: 48, flexShrink: 0 }}>PO</span>
                                {DocLink({ href: doc.po_onedrive_url, icon: '☁️', label: 'OneDrive', color: '#0ea5e9' })}
                              </div>
                            )}
                            {/* Receipt */}
                            {(doc.receipt_onedrive_url || doc.receive_url) && (
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#94a3b8', width: 48, flexShrink: 0 }}>Receipt</span>
                                {DocLink({ href: doc.receipt_onedrive_url, icon: '☁️', label: 'OneDrive', color: '#0ea5e9' })}
                                {DocLink({ href: doc.receive_url,          icon: '🗄️', label: 'Supabase', color: '#16a34a' })}
                              </div>
                            )}
                            {/* Invoice */}
                            {(doc.invoice_onedrive_url || doc.invoice_url) && (
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: '#94a3b8', width: 48, flexShrink: 0 }}>Invoice</span>
                                {DocLink({ href: doc.invoice_onedrive_url, icon: '☁️', label: 'OneDrive', color: '#0ea5e9' })}
                                {DocLink({ href: doc.invoice_url,          icon: '🗄️', label: 'Supabase', color: '#7c3aed' })}
                                {!readOnly && (
                                  <button onClick={async () => {
                                    if (!confirm(`Remove invoice from ${doc.po_ref}?\n\nThis only removes the link — the file on OneDrive is not deleted.`)) return
                                    const r = await fetch('/api/documents/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'clear_invoice', po_ref: doc.po_ref }) })
                                    const res2 = await r.json()
                                    if (res2.ok) {
                                      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, invoice_url: null, invoice_onedrive_url: null, invoice_path: null } : d))
                                    } else {
                                      alert('Failed to remove invoice: ' + (res2.error || 'Unknown error'))
                                    }
                                  }} style={{ padding: '1px 6px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                    ✕ Remove
                                  </button>
                                )}
                              </div>
                            )}
                            {!doc.invoice_onedrive_url && !doc.invoice_url && (() => {
                              if (docInvoiceUploading[doc.id]) return <span style={{ fontSize: 11, color: '#d97706' }}>⏳ Uploading…</span>
                              return (
                                <label style={{ cursor: 'pointer' }}>
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={async e => {
                                      const file = e.target.files?.[0]; if (!file) return
                                      setDocInvoiceUploading(prev => ({ ...prev, [doc.id]: true }))
                                      try {
                                        const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(file) })
                                        const poRef = doc.po_ref; const ext = file.name.split('.').pop()
                                        const invName = `${poRef.replace(/\s/g,'_')}-Invoice.${ext}`
                                        await fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'invoice', po_ref:poRef, supplier:doc.supplier, file_base64:base64, file_name:invName, file_mime:file.type }) }).catch(()=>null)
                                        const odRes = await fetch('/api/onedrive/save-invoice', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filename:invName, base64, mimeType:file.type, supplier:doc.supplier }) }).catch(()=>null)
                                        const odData = odRes ? await odRes.json().catch(()=>({})) : {}
                                        if (odData.webUrl) {
                                          await fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'update_urls', po_ref:poRef, invoice_onedrive_url:odData.webUrl }) }).catch(()=>null)
                                        }
                                        if (file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')) {
                                          const dateStr = new Date().toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',year:'numeric'})
                                          fetch('/api/invoices/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pdf_base64:base64})})
                                            .then(r=>r.ok?r.json():null).then(d=>{if(!d?.items?.length)return;fetch('/api/invoices/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplier:doc.supplier,invoice_ref:d.invoice_ref||poRef,invoice_date:d.invoice_date||dateStr,gst_included:defaultGstIncluded(doc.supplier,d.gst_included),items:d.items.map(i=>({...i,include:true,item_name_hub:i.item_name_raw}))})}).catch(()=>null)}).catch(()=>null)
                                        }
                                        // loadDocuments AFTER all saves complete so OneDrive URL is reflected
                                        await loadDocuments()
                                      } finally { setDocInvoiceUploading(prev => ({ ...prev, [doc.id]: false })) }
                                    }} />
                                  <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>📎 Upload Invoice</span>
                                </label>
                              )
                            })()}
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                            {doc.status === 'received' && (
                              sentAt === 'error' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>❌ Email failed</span>
                                  <button onClick={doSend} disabled={sending}
                                    style={{ padding: '4px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                    🔁 Retry
                                  </button>
                                </div>
                              ) : sentDate ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✅ Treasurer notified</span>
                                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{sentDate}</span>
                                  <button onClick={doSend} disabled={sending}
                                    style={{ padding: '2px 8px', background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                    {sending ? '⏳ Sending…' : '🔁 Resend'}
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                                  {!doc.invoice_onedrive_url && !doc.invoice_url && (
                                    <span style={{ fontSize:10, color:'#d97706', fontWeight:600 }}>⚠️ No invoice attached</span>
                                  )}
                                  <button onClick={() => {
                                    if (!doc.invoice_onedrive_url && !doc.invoice_url) {
                                      if (!confirm('No invoice is attached to this delivery.\n\nThe treasurer email will be sent without an invoice attachment.\n\nSend anyway?')) return
                                    }
                                    doSend()
                                  }} disabled={sending}
                                    style={{ padding:'5px 12px', background: sending?'#e2e8f0':'#eff6ff', color: sending?'#94a3b8':'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:6, fontSize:12, fontWeight:700, cursor:sending?'default':'pointer', whiteSpace:'nowrap' }}>
                                    {sending ? '⏳ Sending…' : '📧 Email Treasurer'}
                                  </button>
                                </div>
                              )
                            )}
                            {!readOnly && (
                              <button onClick={async () => {
                                const warn = sentDate ? `\n\n⚠️ This record was already emailed to the Treasurer on ${sentDate}.` : ''
                                if (!confirm(`Delete PO document for ${doc.po_ref}?${warn}\n\nThis cannot be undone.`)) return
                                setDocuments(prev => prev.filter(d => d.id !== doc.id))
                                try {
                                  const r = await fetch('/api/documents/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: doc.id, receive_report_path: doc.receive_path, invoice_path: doc.invoice_path }) })
                                  const d = await r.json()
                                  if (!d.ok) { loadDocuments(); alert('Delete failed: ' + (d.error || 'Unknown error')) }
                                } catch { loadDocuments() }
                              }} style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                🗑 Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {mainTab === 'barcodesheet' && <BarcodeSheetView items={items} settings={priceListSettings} />}
        {mainTab === 'notes' && !readOnly && <NotesView items={items} notes={notesLog} readOnly={readOnly} onRefresh={loadNotes} />}
        {mainTab === 'notes' && readOnly && <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>📝 Notes are only visible to BMT members.</div>}
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
          {mainTab === 'sohhistory' && <SohHistoryView readOnly={readOnly} onExportPdf={() => generateStockReport(false)} onExportXlsx={() => generateStockReport(true)} />}
          {mainTab === 'monthlyreport' && <MonthlyReportView />}
          {mainTab === 'specials' && !readOnly && <SpecialsView items={items} />}
        {mainTab === 'help' && <HelpTab />}

        <footer style={styles.footer}>
          Paynter Bar Hub — GemLife Palmwoods | Data from Square POS | {items.length} items tracked
        </footer>
      </div>{/* end main column */}
    </div>{/* end styles.page */}

      {/* ── VIEW ORDER MODAL — global, works from any tab ── */}
      {viewOrderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setViewOrderModal(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 580, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>🛒 {viewOrderModal.supplier} — Current Order</div>
              <button onClick={() => setViewOrderModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#1e3a5f', color: '#fff' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty Ordered</th>
                {!readOnly && <th style={{ padding: '8px 12px', textAlign: 'center', width: 100 }}>Actions</th>}
              </tr></thead>
              <tbody>
                {viewOrderModal.items.map((item, i) => (
                  <tr key={item.name} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                    <td style={{ padding: '7px 12px', color: '#0f172a' }}>{item.name}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      {!readOnly ? (
                        <input type="number" inputMode="numeric" defaultValue={item.orderQty} min={1}
                          style={{ width: 70, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'right', fontWeight: 600, fontFamily: 'IBM Plex Mono, monospace' }}
                          onBlur={async e => {
                            const newQty = Number(e.target.value)
                            if (!newQty || newQty === item.orderQty) return
                            const r = await fetch('/api/purchase-order', { method:'POST', headers:{'Content-Type':'application/json'},
                              body: JSON.stringify({ action:'updateItem', itemName: item.name, orderQty: newQty, ref: viewOrderModal.ref }) })
                            const d = await r.json()
                            if (d.ok) { setOrderedItems(d.ordered); setViewOrderModal(prev => ({ ...prev, items: prev.items.map(it => it.name === item.name ? { ...it, orderQty: newQty } : it) })); resavePO(viewOrderModal.supplier, d.ordered, viewOrderModal.ref) }
                          }} />
                      ) : (
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{item.orderQty}</span>
                      )}
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>{item.isSpirit ? 'nips' : 'units'}</span>
                    </td>
                    {!readOnly && (
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button onClick={async () => {
                          if (!confirm(`Remove ${item.name} from this order?`)) return
                          const r = await fetch('/api/purchase-order', { method:'POST', headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ action:'deleteItem', itemName: item.name, ref: viewOrderModal.ref }) })
                          const d = await r.json()
                          if (d.ok) {
                            setOrderedItems(d.ordered)
                            const remaining = viewOrderModal.items.filter(it => it.name !== item.name)
                            if (!remaining.length) setViewOrderModal(null)
                            else { setViewOrderModal(prev => ({ ...prev, items: remaining })); resavePO(viewOrderModal.supplier, d.ordered, viewOrderModal.ref) }
                          }
                        }} style={{ padding: '2px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          🗑 Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
              {/* Add item to existing order */}
              {!readOnly && (() => {
                const existingNames = new Set(viewOrderModal.items.map(i => i.name))
                const addable = items.filter(i =>
                  i.supplier === viewOrderModal.supplier &&
                  !existingNames.has(i.name) &&
                  !rundownItems[i.name]
                )
                if (!addable.length) return null
                return (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>+ Add item to this order</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select id="vom-add-item" style={{ flex: 1, minWidth: 180, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}
                        onChange={e => {
                          const name = e.target.value
                          const item = addable.find(i => i.name === name)
                          const qtyEl = document.getElementById('vom-add-qty')
                          const unitEl = document.getElementById('vom-add-unit')
                          if (item?.isSpirit) { if (qtyEl) qtyEl.value = '1'; if (unitEl) unitEl.textContent = 'btl' }
                          else { if (qtyEl) qtyEl.value = '1'; if (unitEl) unitEl.textContent = 'units' }
                        }}>
                        <option value="">Select item…</option>
                        {addable.map(i => (
                          <option key={i.name} value={i.name}>{i.name}{i.isSpirit ? ' 🥃' : ''} (on hand: {i.onHand ?? 0})</option>
                        ))}
                      </select>
                      <input type="number" inputMode="numeric" id="vom-add-qty" min={1} defaultValue={1}
                        style={{ width: 64, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, textAlign: 'center' }} />
                      <span id="vom-add-unit" style={{ fontSize: 11, color: '#94a3b8', minWidth: 28 }}>units</span>
                      <button onClick={async () => {
                        const sel = document.getElementById('vom-add-item')
                        const qtyEl = document.getElementById('vom-add-qty')
                        const name = sel?.value
                        const qty = Number(qtyEl?.value) || 1
                        if (!name) return
                        const item = addable.find(i => i.name === name)
                        if (!item) return
                        const nipsPerBottle = item.isSpirit ? Math.round((item.bottleML || 700) / (item.nipML || 30)) : null
                        const finalQty = item.isSpirit ? qty * nipsPerBottle : qty
                        const r = await fetch('/api/purchase-order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'addItem', itemName: name, supplier: viewOrderModal.supplier,
                            ref: viewOrderModal.ref, orderQty: finalQty, isSpirit: item.isSpirit || false,
                            bottlesToOrder: item.isSpirit ? qty : null }) })
                        const d = await r.json()
                        if (d.ok) {
                          setOrderedItems(d.ordered)
                          setViewOrderModal(prev => ({ ...prev, items: [...prev.items, { name, orderQty: finalQty, isSpirit: item.isSpirit || false, bottleML: item.bottleML, nipML: item.nipML }] }))
                          resavePO(viewOrderModal.supplier, d.ordered, viewOrderModal.ref)
                          if (sel) sel.value = ''
                          if (qtyEl) qtyEl.value = '1'
                          const unitEl = document.getElementById('vom-add-unit')
                          if (unitEl) unitEl.textContent = 'units'
                        } else { alert('Failed to add item: ' + (d.error || 'Unknown error')) }
                      }} style={{ padding: '6px 14px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Add
                      </button>
                    </div>
                  </div>
                )
              })()}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between', alignItems: 'center' }}>
              {!readOnly && (
                <button onClick={async () => {
                  if (!confirm(`Delete the entire ${viewOrderModal.supplier} order? This cannot be undone.`)) return
                  const r = await fetch('/api/purchase-order', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ action:'deleteOrder', supplier: viewOrderModal.supplier, ref: viewOrderModal.ref }) })
                  const d = await r.json()
                  if (d.ok) {
                    setOrderedItems(d.ordered)
                    setViewOrderModal(null)
                    // Also remove the matching bar_documents record so it doesn't appear in PO Documents
                    if (viewOrderModal.ref) {
                      const docs = await fetch('/api/documents/list').then(r => r.json()).catch(() => ({ documents: [] }))
                      const match = (docs.documents || []).find(doc => doc.po_ref === viewOrderModal.ref && doc.status === 'ordered')
                      if (match) {
                        await fetch('/api/documents/delete', { method:'DELETE', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ id: match.id }) }).catch(() => null)
                        setDocuments(prev => prev.filter(d => d.id !== match.id))
                      }
                    }
                  }
                }} style={{ padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  🗑 Delete Whole Order
                </button>
              )}
              {/* Invoice attachment for existing order */}
              {!readOnly && (() => {
                const existingInv = documents.find(d => d.po_ref === viewOrderModal.ref && (d.invoice_url || d.invoice_onedrive_url || d.invoice_path))
                return (
                  <div style={{ marginTop:14, padding:'10px 14px', background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:6 }}>📎 Invoice</div>
                    {existingInv ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>✓ Invoice already attached</span>
                        {existingInv.invoice_onedrive_url && (
                          <a href={existingInv.invoice_onedrive_url} target="_blank" rel="noreferrer"
                            style={{ fontSize:11, color:'#0ea5e9' }}>☁️ View</a>
                        )}
                      </div>
                    ) : (
                      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const base64 = await new Promise(resolve => {
                              const reader = new FileReader()
                              reader.onload = () => resolve(reader.result.split(',')[1])
                              reader.readAsDataURL(file)
                            })
                            const ext = file.name.split('.').pop()
                            const invName = `${(viewOrderModal.ref||viewOrderModal.supplier).replace(/\s/g,'_')}-Invoice.${ext}`
                            const odRes = await fetch('/api/onedrive/save-invoice', { method:'POST', headers:{'Content-Type':'application/json'},
                              body: JSON.stringify({ filename:invName, base64, mimeType:file.type, supplier:viewOrderModal.supplier }) }).catch(()=>null)
                            const odData = odRes ? await odRes.json().catch(()=>({})) : {}
                            if (odData.webUrl) {
                              fetch('/api/documents/save', { method:'POST', headers:{'Content-Type':'application/json'},
                                body: JSON.stringify({ action:'update_urls', po_ref:viewOrderModal.ref, invoice_onedrive_url:odData.webUrl }) }).catch(()=>null)
                              setDocuments(prev => prev.map(d => d.po_ref === viewOrderModal.ref ? { ...d, invoice_onedrive_url: odData.webUrl, invoice_path: 'saved' } : d))
                            }
                          }} />
                        <span style={{ fontSize:12, color:'#3b82f6', textDecoration:'underline' }}>📎 Attach invoice…</span>
                        <span style={{ fontSize:11, color:'#94a3b8' }}>optional</span>
                      </label>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={() => setViewOrderModal(null)}
                  style={{ padding: '8px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                {!readOnly && (
                  <button onClick={() => { openReceiveModal(viewOrderModal.supplier, viewOrderModal.items, viewOrderModal.ref); setViewOrderModal(null) }}
                    style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>Receive This Order</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── WASTAGE LOG VIEW ─────────────────────────────────────────────────────────






// === BARCODE SHEET VIEW =====================================================

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────

// ─── BEST & WORST SELLERS VIEW ───────────────────────────────────────────────


// ─── PRICE LIST VIEW ──────────────────────────────────────────────────────────


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




// ─── NOTES VIEW ────────────────────────────────────────────────────────────────



// ─── HELP TAB ─────────────────────────────────────────────────────────────────


// ─── SALES REPORT VIEW ────────────────────────────────────────────────────────

// ─── EDIT COMPONENTS ──────────────────────────────────────────────────────────



// ─── STYLES ───────────────────────────────────────────────────────────────────


// ─── STOCKTAKE VIEW ────────────────────────────────────────────────────────────


// === SPECIALS VIEW ============================================================


// === SOH HISTORY VIEW =========================================================