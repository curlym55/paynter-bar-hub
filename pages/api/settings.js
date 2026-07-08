import { kvGet, kvSet, kvDelete } from '../../lib/redis'
import { sbConfigGet, sbConfigSet } from '../../lib/supabase-config'
import { requireAuth } from '../../lib/session'

// ── Dual-read/write helpers ───────────────────────────────────────────────
async function get(key, fallback = null) {
  let val = await kvGet(key).catch(() => null)
  if (val === null || val === undefined) {
    val = await sbConfigGet(key)
    if (val !== null && val !== undefined) {
      await kvSet(key, val).catch(() => {}) // restore to Redis
      console.log('[settings] restored', key, 'from Supabase backup')
    } else if (fallback !== null && fallback !== undefined) {
      // Persist default so it gets backed up
      await kvSet(key, fallback).catch(() => {})
      sbConfigSet(key, fallback).catch(() => {})
      return fallback
    }
  }
  return val ?? fallback
}
async function set(key, value) {
  await kvSet(key, value)
  sbConfigSet(key, value).catch(() => {}) // background backup
}


export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      if (req.query.action === 'getAudit') {
        const audit = (await get('settingsAudit', {}))
        return res.status(200).json({ audit })
      }

      if (req.query.action === 'getPriceList') {
        const priceList = (await get('priceListSettings', {}))
        return res.status(200).json({ priceList })
      }

      if (req.query.action === 'getOrdered') {
        const ordered = (await get('orderedItems', {}))
        return res.status(200).json({ ordered })
      }

      const settings     = (await get('itemSettings', {}))
      const targetWeeks     = (await get('targetWeeks', 6))
      const revenueTarget   = (await get('revenueTarget', null))
      const suppliers          = (await get('suppliers', ['Dan Murphy', 'Coles Woolies', 'ACW']))
      const supplierVendorNames = (await get('supplierVendorNames', {}))

      // One-time migration: rename "Dan Murphys" → "Dan Murphy" everywhere
      let migrated = false
      for (const [name, s] of Object.entries(settings)) {
        if (s.supplier === 'Dan Murphys') { s.supplier = 'Dan Murphy'; migrated = true }
      }
      if (migrated) await set('itemSettings', settings)
      const fixedSuppliers = suppliers.map(s => s === 'Dan Murphys' ? 'Dan Murphy' : s)
      if (fixedSuppliers.some((s, i) => s !== suppliers[i])) await set('suppliers', fixedSuppliers)
      res.status(200).json({ settings, targetWeeks, revenueTarget, suppliers: fixedSuppliers, supplierVendorNames })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else if (req.method === 'POST') {
    if (!requireAuth(req, res, { allowReadOnly: false })) return
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
        await set('priceListSettings', allPl)
        return res.status(200).json({ ok: true })
      }

      if (action === 'setOrdered') {
        const ordered = (await kvGet('orderedItems')) || {}
        if (value === null) {
          delete ordered[itemName]
        } else {
          ordered[itemName] = { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }), supplier: value || '' }
        }
        await set('orderedItems', ordered)
        return res.status(200).json({ ok: true })
      }

      if (!itemName && !name) return res.status(400).json({ error: 'itemName and field required' })
      const resolvedName = itemName || name

      if (field === 'targetWeeks') {
        await set('targetWeeks', Number(value))
        return res.status(200).json({ ok: true })
      }
      if (field === 'revenueTarget') {
        await set('revenueTarget', value === null ? null : Number(value))
        return res.status(200).json({ ok: true })
      }

      if (field === 'suppliers') {
        await set('suppliers', value)
      } else if (field === 'supplierVendorNames') {
        await set('supplierVendorNames', value)
        return res.status(200).json({ ok: true })
      }

      const allSettings = (await kvGet('itemSettings')) || {}
      if (!allSettings[resolvedName]) allSettings[resolvedName] = {}

      // Capture old value BEFORE updating
      const oldVal = allSettings[resolvedName]?.[field] ?? null

      const numFields  = ['pack', 'bottleML', 'nipML', 'stockOverride', 'weeklyAvgOverride', 'targetWeeksOverride', 'buyPrice', 'sellPrice', 'sellPriceBottle']
      const boolFields = ['bottleOnly']
      if (value === null || value === '' || value === false) {
        delete allSettings[resolvedName][field]
      } else if (boolFields.includes(field)) {
        allSettings[resolvedName][field] = true
      } else {
        allSettings[resolvedName][field] = numFields.includes(field) ? Number(value) : value
      }

      // Audit log
      const audit = (await get('settingsAudit', {}))
      const auditKey = `${resolvedName}__${field}`
      if (value === null || value === '' || value === false) {
        delete audit[auditKey]
      } else {
        audit[auditKey] = {
          ts: new Date().toISOString(),
          who: req.body.who || 'BMT',
          oldValue: oldVal,
          newValue: value
        }
      }
      // Trim audit log to last 200 entries by timestamp
      const auditEntries = Object.entries(audit)
      if (auditEntries.length > 200) {
        const trimmed = auditEntries.sort((a, b) => new Date(b[1].ts) - new Date(a[1].ts)).slice(0, 200)
        Object.keys(audit).forEach(k => delete audit[k])
        trimmed.forEach(([k, v]) => { audit[k] = v })
      }
      await set('settingsAudit', audit)

      await set('itemSettings', allSettings)
      // Bust the items cache so the next load recalculates with new settings
      // We delete all known daysBack variants (60 and 90 are the common ones)
      await Promise.all([
        kvDelete('itemsCache_60'),
        kvDelete('itemsCache_90'),
        kvDelete('itemsCache_30'),
      ]).catch(() => {})
      res.status(200).json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
