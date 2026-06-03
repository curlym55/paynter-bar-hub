import { kvGet, kvSet } from '../../lib/redis'
import { sbConfigGet, sbConfigSet } from '../../lib/supabase-config'

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

// GET  — return current on-order state
// POST — place order (flag items) or clear supplier (received)
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


export default async function handler(req, res) {
  try {
  if (req.method === 'GET') {
    const { action } = req.query
    // Preview next PO number without incrementing
    if (action === 'previewNumber') {
      const num = await getNextPoNumber(true)
      return res.json({ num })
    }
    const ordered = (await get('orderedItems', {}))
    return res.json({ ordered })
  }

  if (req.method === 'POST') {
    const { action, supplier, items } = req.body

    if (action === 'place') {
      // items: [{ name, sku, orderQty, bottlesToOrder, isSpirit, unitCost }]
      const ordered = (await get('orderedItems', {}))
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
      const abbr = supplierAbbr(supplier)
      const poNum = await getNextPoNumber()
      const brisDate = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane', day: '2-digit', month: '2-digit', year: 'numeric'
      }).format(new Date()).replace(/\//g, ' ')
      const autoRef = `${abbr}-PO-${poNum}-${brisDate}`
      const ref = req.body.ref || autoRef
      for (const item of items) {
        // Protect items already in a different pending PO unless explicitly re-ordered (hasOverride)
        if (ordered[item.name] && ordered[item.name].ref && ordered[item.name].ref !== ref && !item.hasOverride) {
          continue
        }
        ordered[item.name] = {
          supplier,
          date,
          ref,
          poNumber: poNum,
          orderQty:       item.orderQty,
          bottlesToOrder: item.bottlesToOrder || null,
          isSpirit:       item.isSpirit || false,
          sku:            item.sku || '',
        }
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered, ref, poNumber: poNum })
    }

    if (action === 'receiveByRef') {
      // Clear items belonging to a specific PO ref
      const { ref, receivedItems } = req.body
      const ordered = (await get('orderedItems', {}))
      for (const [name, info] of Object.entries(ordered)) {
        if (info.ref === ref) {
          if (!receivedItems || receivedItems.includes(name)) {
            delete ordered[name]
          }
        }
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'receive') {
      // Clear all items for this supplier
      const ordered = (await get('orderedItems', {}))
      for (const [name, info] of Object.entries(ordered)) {
        if ((info.supplier || 'Unknown') === supplier) delete ordered[name]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'partialReceive') {
      // Clear only the specified item names
      const { receivedItems } = req.body // array of item names received
      const ordered = (await get('orderedItems', {}))
      for (const name of (receivedItems || [])) {
        delete ordered[name]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'deleteItem') {
      const { itemName } = req.body
      const ordered = (await get('orderedItems', {}))
      delete ordered[itemName]
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'deleteOrder') {
      const { supplier } = req.body
      const ordered = (await get('orderedItems', {}))
      for (const name of Object.keys(ordered)) {
        if (ordered[name].supplier === supplier) delete ordered[name]
      }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'addItem') {
      const { itemName, supplier, ref, orderQty, isSpirit, bottlesToOrder } = req.body
      if (!itemName) return res.json({ ok: false, error: 'itemName required' })
      ordered[itemName] = { supplier, ref: ref || '', date: new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane' }), orderQty: Number(orderQty), isSpirit: !!isSpirit, bottlesToOrder: bottlesToOrder || null }
      await set('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'updateItem') {
      const { itemName, orderQty } = req.body
      const ordered = (await get('orderedItems', {}))
      if (ordered[itemName]) {
        ordered[itemName] = { ...ordered[itemName], orderQty: Number(orderQty) }
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
