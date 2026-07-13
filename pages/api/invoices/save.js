import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../lib/session'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'

const DEFAULT_PACK = { Beer:24, Cider:24, PreMix:24, 'White Wine':6, 'Red Wine':6, Rose:6, Sparkling:6, Spirits:1, 'Fortified & Liqueurs':1, 'Soft Drinks':24, Snacks:18 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res, { allowReadOnly: false })) return

  const { invoice_ref, supplier, invoice_date, gst_included, items } = req.body

  // Diagnostics
  console.log('[save] received:', {
    invoice_ref, supplier, invoice_date, gst_included,
    items_count: items?.length,
    items_include_count: items?.filter(i => i.include !== false).length,
    first_item: items?.[0],
  })

  if (!items?.length) {
    return res.status(400).json({ error: `No items received. invoice_ref=${invoice_ref}` })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Load Hub settings to validate pack sizes — catches Haiku getting units_per_pack wrong
  const hubSettings = await kvGet('itemSettings').catch(() => null) || await sbConfigGet('itemSettings').catch(() => null) || {}

  const rows = items.filter(i => i.include !== false).map(item => {
    const invPrice = Number(item.invoice_unit_price) || 0
    let units = Number(item.units_per_pack) || 1

    // Validate units_per_pack against Hub item category default
    // If units=1 but the Hub item is in a category that normally comes in packs,
    // and the invoice price is much higher than expected, correct it automatically
    const hubKey = item.item_name_hub || item.item_name_raw
    const hubItem = hubSettings[hubKey]
    if (hubItem?.category) {
      const expectedPack = DEFAULT_PACK[hubItem.category] || 1
      if (units === 1 && expectedPack > 1 && invPrice > 0) {
        const pricePerUnit = gst_included ? invPrice / expectedPack / 1.10 : invPrice / expectedPack
        const priceSingle  = gst_included ? invPrice / 1.10 : invPrice
        // If the per-unit price using expectedPack is more plausible (< 60% of single-unit price),
        // the invoice price is likely a pack price — use the expected pack size
        if (pricePerUnit < priceSingle * 0.6) {
          console.log(`[save] pack-size correction: ${hubKey} units_per_pack ${units}→${expectedPack} (invoice $${invPrice})`)
          units = expectedPack
        }
      }
    }

    const unitPrice = gst_included ? invPrice / units / 1.10 : invPrice / units
    return {
      invoice_ref: String(invoice_ref),
      supplier: String(supplier),
      invoice_date: String(invoice_date),
      item_name_raw: String(item.item_name_raw || ''),
      item_name_hub: String(item.item_name_hub || item.item_name_raw || ''),
      invoice_qty: Number(item.invoice_qty) || 1,
      units_per_pack: units,
      qty_units: Math.round((Number(item.invoice_qty) || 1) * units),
      invoice_unit_price: invPrice,
      unit_price_ex_gst: Math.round(unitPrice * 10000) / 10000,
      gst_included: !!gst_included,
    }
  })

  console.log('[save] rows to insert:', rows.length, rows[0])

  if (!rows.length) {
    return res.status(400).json({ error: 'All items were excluded (include=false)' })
  }

  // Duplicate prevention — remove any existing rows for this invoice before inserting.
  // Re-importing the same invoice (e.g. auto-extract on receive + later manual import)
  // replaces the data instead of double-counting it in weighted averages.
  const { error: delError } = await sb.from('buy_price_history')
    .delete()
    .eq('invoice_ref', String(invoice_ref))
    .eq('supplier', String(supplier))

  if (delError) {
    console.error('[save] duplicate-cleanup error:', delError)
    return res.status(500).json({ error: 'Duplicate cleanup failed: ' + delError.message })
  }

  const { data, error } = await sb.from('buy_price_history').insert(rows).select('id')

  if (error) {
    console.error('[save] Supabase error:', error)
    return res.status(500).json({ error: error.message, detail: error.details })
  }

  console.log('[save] inserted:', data?.length)
  return res.json({ ok: true, saved: data?.length ?? rows.length })
}