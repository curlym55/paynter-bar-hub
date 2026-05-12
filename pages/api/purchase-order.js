import { kvGet, kvSet } from '../../lib/redis'

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
  const current = (await kvGet('poNextNumber').catch(() => null)) || 99
  const next = current + 1
  if (!peek) await kvSet('poNextNumber', next)
  return next
}

// GET  — return current on-order state
// POST — place order (flag items) or clear supplier (received)
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { action } = req.query
    // Preview next PO number without incrementing
    if (action === 'previewNumber') {
      const num = await getNextPoNumber(true)
      return res.json({ num })
    }
    const ordered = (await kvGet('orderedItems')) || {}
    return res.json({ ordered })
  }

  if (req.method === 'POST') {
    const { action, supplier, items } = req.body

    if (action === 'place') {
      // items: [{ name, sku, orderQty, bottlesToOrder, isSpirit, unitCost }]
      const ordered = (await kvGet('orderedItems')) || {}
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
      await kvSet('orderedItems', ordered)
      return res.json({ ok: true, ordered, ref, poNumber: poNum })
    }

    if (action === 'receiveByRef') {
      // Clear items belonging to a specific PO ref
      const { ref, receivedItems } = req.body
      const ordered = (await kvGet('orderedItems')) || {}
      for (const [name, info] of Object.entries(ordered)) {
        if (info.ref === ref) {
          if (!receivedItems || receivedItems.includes(name)) {
            delete ordered[name]
          }
        }
      }
      await kvSet('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'receive') {
      // Clear all items for this supplier
      const ordered = (await kvGet('orderedItems')) || {}
      for (const [name, info] of Object.entries(ordered)) {
        if ((info.supplier || 'Unknown') === supplier) delete ordered[name]
      }
      await kvSet('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    if (action === 'partialReceive') {
      // Clear only the specified item names
      const { receivedItems } = req.body // array of item names received
      const ordered = (await kvGet('orderedItems')) || {}
      for (const name of (receivedItems || [])) {
        delete ordered[name]
      }
      await kvSet('orderedItems', ordered)
      return res.json({ ok: true, ordered })
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
