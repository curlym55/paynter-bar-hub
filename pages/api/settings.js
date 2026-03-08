import { kvGet, kvSet } from '../../lib/redis'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      if (req.query.action === 'getAudit') {
        const audit = (await kvGet('settingsAudit')) || {}
        return res.status(200).json({ audit })
      }

      if (req.query.action === 'getPriceList') {
        const priceList = (await kvGet('priceListSettings')) || {}
        return res.status(200).json({ priceList })
      }

      if (req.query.action === 'getOrdered') {
        const ordered = (await kvGet('orderedItems')) || {}
        return res.status(200).json({ ordered })
      }

      const settings     = (await kvGet('itemSettings')) || {}
      const targetWeeks  = (await kvGet('targetWeeks'))  || 6
      const suppliers          = (await kvGet('suppliers'))          || ['Dan Murphys', 'Coles Woolies', 'ACW']
      const supplierVendorNames = (await kvGet('supplierVendorNames')) || {}
      res.status(200).json({ settings, targetWeeks, suppliers, supplierVendorNames })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else if (req.method === 'POST') {
    try {
      const { action, itemName, name, field, value } = req.body

      // Price list item setting
      if (action === 'setItem' && name && name.startsWith('__pl_')) {
        const realName = name.replace('__pl_', '')
        const allPl = (await kvGet('priceListSettings')) || {}
        if (!allPl[realName]) allPl[realName] = {}
        if (value === null || value === '') {
          delete allPl[realName][field]
        } else {
          allPl[realName][field] = value
        }
        await kvSet('priceListSettings', allPl)
        return res.status(200).json({ ok: true })
      }

      if (action === 'setOrdered') {
        const ordered = (await kvGet('orderedItems')) || {}
        if (value === null) {
          delete ordered[itemName]
        } else {
          ordered[itemName] = { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }), supplier: value || '' }
        }
        await kvSet('orderedItems', ordered)
        return res.status(200).json({ ok: true })
      }

      if (!itemName && !name) return res.status(400).json({ error: 'itemName and field required' })
      const resolvedName = itemName || name

      if (field === 'targetWeeks') {
        await kvSet('targetWeeks', Number(value))
        return res.status(200).json({ ok: true })
      }

      if (field === 'suppliers') {
        await kvSet('suppliers', value)
      } else if (field === 'supplierVendorNames') {
        await kvSet('supplierVendorNames', value)
        return res.status(200).json({ ok: true })
      }

      const allSettings = (await kvGet('itemSettings')) || {}
      if (!allSettings[resolvedName]) allSettings[resolvedName] = {}

      const numFields  = ['pack', 'bottleML', 'nipML', 'stockOverride', 'buyPrice', 'sellPrice', 'sellPriceBottle']
      const boolFields = ['bottleOnly']
      if (value === null || value === '' || value === false) {
        delete allSettings[resolvedName][field]
      } else if (boolFields.includes(field)) {
        allSettings[resolvedName][field] = true
      } else {
        allSettings[resolvedName][field] = numFields.includes(field) ? Number(value) : value
      }

      // Audit log — record when and (coarsely) who changed each field
      const audit = (await kvGet('settingsAudit')) || {}
      const auditKey = `${resolvedName}__${field}`
      if (value === null || value === '' || value === false) {
        delete audit[auditKey]
      } else {
        audit[auditKey] = { ts: new Date().toISOString(), who: req.body.who || 'committee' }
      }
      await kvSet('settingsAudit', audit)

      await kvSet('itemSettings', allSettings)
      res.status(200).json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
