import { kvGet, kvSet } from '../../lib/redis'

// GET  — return current on-order state
// POST — place order (flag items) or clear supplier (received)
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const ordered = (await kvGet('orderedItems')) || {}
    return res.json({ ordered })
  }

  if (req.method === 'POST') {
    const { action, supplier, items } = req.body

    if (action === 'place') {
      // items: [{ name, sku, orderQty, bottlesToOrder, isSpirit, unitCost }]
      const ordered = (await kvGet('orderedItems')) || {}
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
      for (const item of items) {
        ordered[item.name] = {
          supplier,
          date,
          orderQty:      item.orderQty,
          bottlesToOrder: item.bottlesToOrder || null,
          isSpirit:      item.isSpirit || false,
          sku:           item.sku || '',
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
