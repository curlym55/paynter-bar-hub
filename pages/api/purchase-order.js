import { kvGet, kvSet } from '../../lib/redis'
import { sbConfigGet, sbConfigSet } from '../../lib/supabase-config'
import { requireAuth } from '../../lib/session'
import { deleteFile } from '../../lib/onedrive'

const SUPPLIER_ABBR = {
  'dan murphy':   'DAN',
  'coles woolies': 'COLE',
  'coles/woolies': 'COLE',
  'acw':           'ACW',
}

function supplierAbbr(supplier) {
  const key = (supplier || '').toLowerCase().trim()
  return SUPPLIER_ABBR[key] || (supplier || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase()
}

async function getNextPoNumber(peek = false) {
  const current = (await get('poNextNumber', 99))
  const next = current + 1
  if (!peek) await set('poNextNumber', next)
  return next
}

async function get(key, fallback = null) {
  let val = await kvGet(key).catch(() => null)
  if (val === null || val === undefined) {
    val = await sbConfigGet(key)
    if (val !== null && val !== undefined) await kvSet(key, val).catch(() => {})
  }
  return val ?? fallback
}
async function set(key, value) {
  await kvSet(key, value)
  sbConfigSet(key, value).catch(() => {})
}

// ─────────────────────────────────────────────────────────────────────────
// DATA MODEL
//
//   orderedItems[itemName] = [
//     { ref, supplier, date, poNumber, orderQty, bottlesToOrder, isSpirit, sku },
//     ...
//   ]
//
// An item can appear on more than one order (different `ref`s) at the same
// time — e.g. it's on the current weekly order AND on a separate
// management-paid event order. Each array entry represents one order's
// worth of that item.
//
// Some data was written before this array format existed, and is stored as
// a single plain object rather than an array. normalizeEntries() coerces
// either shape into an array. getOrderedNormalized() fetches the WHOLE
// orderedItems structure and normalises every entry — not just the ones a
// particular request happens to touch — so a response never mixes old and
// new shapes together (which previously crashed client-side code that
// expects to iterate an array for every item).
// ─────────────────────────────────────────────────────────────────────────

function normalizeEntries(val) {
  if (Array.isArray(val)) return val
  if (val && typeof val === 'object') return [val]
  return []
}

async function getOrderedNormalized() {
  const raw = await get('orderedItems', {})
  const ordered = {}
  for (const [name, val] of Object.entries(raw)) {
    ordered[name] = normalizeEntries(val)
  }
  return ordered
}

export default async function handler(req, res) {
  try {
  if (req.method === 'GET') {
    const { action } = req.query
    // Preview next PO number without incrementing
    if (action === 'previewNumber') {
      const num = await getNextPoNumber(true)
      return res.json({ num })
    }
    const ordered = await getOrderedNormalized()
    return res.json({ ordered })
  }

  if (req.method === 'POST') {
    if (!requireAuth(req, res, { allowReadOnly: false })) return
    const { action, supplier, items } = req.body

    if (action === 'place') {
      // items: [{ name, sku, orderQty, bottlesToOrder, isSpirit }]
      const ordered = await getOrderedNormalized()
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
      const abbr = supplierAbbr(supplier)
      const poNum = await getNextPoNumber()
      const brisDate = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane', day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(new Date()).replace(/\//g, ' ')
      const autoRef = `${abbr}-PO-${poNum}-${brisDate}`
      const ref = req.body.ref || autoRef
      for (const item of items) {
        // Keep any entries for this item on OTHER orders untouched;
        // replace/add the entry for THIS ref only.
        const entries = (ordered[item.name] || []).filter(e => e.ref !== ref)
        entries.push({
          ref, supplier, date, poNumber: poNum,
          orderQty:       item.orderQty,
          bottlesToOrder: item.bottlesToOrder || null,
          isSpirit:       item.isSpirit || false,
          sku:            item.sku || '',
        })
        ordered[item.name] = entries
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered, ref, poNumber: poNum })
    }

    if (action === 'receiveByRef') {
      // Clear only the entries belonging to a specific PO ref
      const { ref, receivedItems } = req.body
      const ordered = await getOrderedNormalized()
      for (const [name, entries] of Object.entries(ordered)) {
        const keep = entries.filter(e => !(e.ref === ref && (!receivedItems || receivedItems.includes(name))))
        if (keep.length) ordered[name] = keep
        else delete ordered[name]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'receive') {
      // Legacy fallback for orders with no ref — clears every entry for
      // this supplier regardless of which order it belongs to. Only hit
      // when a ref genuinely doesn't exist (very old orders).
      const ordered = await getOrderedNormalized()
      for (const [name, entries] of Object.entries(ordered)) {
        const keep = entries.filter(e => (e.supplier || 'Unknown') !== supplier)
        if (keep.length) ordered[name] = keep
        else delete ordered[name]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'partialReceive') {
      // Legacy fallback (no ref) — clears the named items entirely.
      // If a ref is supplied, scopes to that order only.
      const { receivedItems, ref } = req.body
      const ordered = await getOrderedNormalized()
      for (const name of (receivedItems || [])) {
        const entries = ordered[name]
        if (!entries) continue
        const keep = ref ? entries.filter(e => e.ref !== ref) : []
        if (keep.length) ordered[name] = keep
        else delete ordered[name]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'deleteItem') {
      // ref scopes the removal to one specific order; without it, all
      // entries for that item name are removed (legacy behaviour).
      const { itemName, ref } = req.body
      const ordered = await getOrderedNormalized()
      if (ordered[itemName]) {
        const keep = ref ? ordered[itemName].filter(e => e.ref !== ref) : []
        if (keep.length) ordered[itemName] = keep
        else delete ordered[itemName]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'deleteOrder') {
      // ref scopes deletion to one specific order for this supplier;
      // without it, every order for that supplier is removed (legacy).
      const { supplier, ref } = req.body
      const ordered = await getOrderedNormalized()
      for (const name of Object.keys(ordered)) {
        const keep = ordered[name].filter(e => !(e.supplier === supplier && (!ref || e.ref === ref)))
        if (keep.length) ordered[name] = keep
        else delete ordered[name]
      }
      await set('orderedItems', ordered)

      // Best-effort: also remove the matching OneDrive PO file, if one was
      // ever saved (save-po.js uses this exact folder/filename pattern).
      // A missing/already-deleted file, or OneDrive being unavailable, must
      // never block the actual order-record deletion above.
      if (ref) {
        try {
          const safeSupplier = (supplier || 'Unknown').replace(/[^a-zA-Z0-9 ]/g, '').trim()
          const filename = ref.replace(/\s/g, '_') + '-PO.xlsx'
          const folder = 'POs Invoices and Receive Reports/Purchase Orders/' + safeSupplier
          await deleteFile(folder, filename)
        } catch (e) {
          console.warn('[purchase-order] deleteOrder: could not remove OneDrive file:', e.message)
        }
      }

      return res.json({ ok: true, ordered })
    }

    if (action === 'addItem') {
      const { itemName, supplier, ref, orderQty, isSpirit, bottlesToOrder } = req.body
      if (!itemName) return res.json({ ok: false, error: 'itemName required' })
      const ordered = await getOrderedNormalized()
      const entries = (ordered[itemName] || []).filter(e => e.ref !== ref)
      entries.push({
        supplier, ref: ref || '',
        date: new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' }),
        orderQty: Number(orderQty), isSpirit: !!isSpirit, bottlesToOrder: bottlesToOrder || null,
      })
      ordered[itemName] = entries
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'updateItem') {
      // ref identifies which order's entry to update when an item is on
      // more than one order at once. Falls back to the first entry if
      // no ref given (legacy).
      const { itemName, orderQty, ref } = req.body
      const ordered = await getOrderedNormalized()
      const entries = ordered[itemName]
      if (entries && entries.length) {
        const idx = ref ? entries.findIndex(e => e.ref === ref) : 0
        if (idx !== -1) entries[idx] = { ...entries[idx], orderQty: Number(orderQty) }
        ordered[itemName] = entries
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[purchase-order]', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
