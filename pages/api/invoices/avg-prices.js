import { createClient } from '@supabase/supabase-js'
import { kvGet } from '../../../lib/redis'
import { sbConfigGet } from '../../../lib/supabase-config'
import { requireAuth } from '../../../lib/session'
import { defaultCategory } from '../../../lib/calculations'

// Mirrors pages/api/invoices/save.js's own DEFAULT_PACK exactly — keep the
// two in sync if either changes. save.js uses this at save time to catch an
// AI-extraction that missed a case size; this report re-applies the same
// check at read time so it also catches OLDER rows saved before that check
// existed (see the comment below).
const DEFAULT_PACK = { Beer:24, Cider:24, PreMix:24, 'White Wine':6, 'Red Wine':6, Rose:6, Sparkling:6, Spirits:1, 'Fortified & Liqueurs':1, 'Soft Drinks':24, Snacks:18 }

function normalizeSupplier(s) {
  const l = (s || '').toLowerCase()
  if (l.includes('dan murphy')) return "Dan Murphy's"
  if (l.includes('acw') || l.includes('sunshine') || l.includes('confectionery')) return 'ACW'
  if (l.includes('coles') || l.includes('woolies') || l.includes('woolworths')) return 'Coles Woolies'
  return s
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { days = '90', supplier = 'all' } = req.query
  const daysInt = Math.min(parseInt(days) || 90, 730)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysInt)
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: rows, error } = await sb
      .from('buy_price_history')
      .select('item_name_hub, item_name_raw, supplier, invoice_unit_price, units_per_pack, gst_included, qty_units, invoice_ref, invoice_date')
      .gte('invoice_date', cutoffStr)
      .not('item_name_hub', 'is', null)

    if (error) return res.status(500).json({ error: error.message })

    const settings = await kvGet('itemSettings').catch(() => null)
                  || await sbConfigGet('itemSettings').catch(() => null)
                  || {}

    // Group rows by item first — the per-row disambiguation below needs the
    // item's category and current buy price, which come from Hub settings.
    const byItem = {}
    for (const r of rows || []) {
      let hubName = r.item_name_hub
      if (!hubName) continue
      if (hubName === r.item_name_raw && !settings[hubName]) continue
      const normSup = normalizeSupplier(r.supplier)
      if (supplier !== 'all' && normSup !== supplier) continue
      ;(byItem[hubName] ||= []).push({ ...r, normSup })
    }

    const items = Object.entries(byItem).map(([name, itemRows]) => {
      const hubItem  = settings[name] || {}
      const category = hubItem.category || defaultCategory(name)
      const isSpirit = ['Spirits', 'Fortified & Liqueurs'].includes(category)

      const bottleML = hubItem.bottleML ? Number(hubItem.bottleML) : (isSpirit ? 700 : null)
      const nipML    = hubItem.nipML    ? Number(hubItem.nipML)    : (isSpirit ? 30  : null)
      const nipsPerBottle = (isSpirit && bottleML && nipML && nipML > 0)
        ? Math.round(bottleML / nipML * 10) / 10 : null
      const expectedPack = DEFAULT_PACK[category] || 1
      const currentBuy = hubItem.buyPrice != null ? Number(hubItem.buyPrice) : null

      const toFinal = (perUnitExGst) => perUnitExGst != null
        ? Math.round((nipsPerBottle ? perUnitExGst / nipsPerBottle : perUnitExGst) * 1.10 * 1000) / 1000
        : null

      // ── Per-row pack disambiguation ──────────────────────────────────────
      // units_per_pack is set per INVOICE LINE by the AI extraction step, and
      // older rows were saved before invoices/save.js had a sanity check for
      // "this units_per_pack of 1 is implausible for this category" — so some
      // genuinely case-priced invoices are still sitting there recorded as a
      // single bottle, wildly inflating the per-bottle price once divided out.
      // Confirmed directly against real data: Balliamo Pinot Grigio has most
      // rows at units_per_pack:1, price $57 (actually a 6-bottle case — two
      // later rows correctly show units_per_pack:6, same $57, i.e. $9.50/btl,
      // matching the current buy price of $10).
      //
      // For each row where units_per_pack is 1 but the category is normally
      // sold by the case, work out the price under BOTH interpretations (as
      // recorded, and divided by the category's usual case size) and pick
      // whichever lands closer to the Hub's own current buy price — the one
      // figure here that's been verified by a person, not extracted by AI.
      // Falls back to the same "much cheaper per unit = probably a case"
      // check invoices/save.js itself uses when there's no buy price set.
      let tc = 0, tu = 0
      const invSet = new Set()
      const chosenPrices = []
      for (const r of itemRows) {
        const rawPrice = Number(r.invoice_unit_price) || 0
        if (!rawPrice) continue
        const recordedPack = Number(r.units_per_pack) || 1
        const exGstAt = (pack) => (r.gst_included ? rawPrice / 1.10 : rawPrice) / pack

        let effectivePack = recordedPack
        if (recordedPack === 1 && expectedPack > 1) {
          const asRecorded = exGstAt(1)
          const corrected  = exGstAt(expectedPack)
          if (currentBuy != null && currentBuy > 0) {
            const dAsRecorded = Math.abs(Math.log(toFinal(asRecorded) / currentBuy))
            const dCorrected  = Math.abs(Math.log(toFinal(corrected)  / currentBuy))
            effectivePack = dCorrected < dAsRecorded ? expectedPack : 1
          } else {
            effectivePack = corrected < asRecorded * 0.6 ? expectedPack : 1
          }
        }

        const perUnitExGst = exGstAt(effectivePack)
        const qty = Number(r.qty_units) || 1
        tc += perUnitExGst * qty
        tu += qty
        invSet.add(r.invoice_ref)
        chosenPrices.push(perUnitExGst)
      }

      const avgUnitExGst = tu > 0 ? Math.round(tc / tu * 10000) / 10000 : null
      const buyPriceIncGst = toFinal(avgUnitExGst)
      const minInv = chosenPrices.length ? Math.min(...chosenPrices) : null
      const maxInv = chosenPrices.length ? Math.max(...chosenPrices) : null

      return {
        item_name:         name,
        matched_hub_key:   name,
        category,
        supplier:          itemRows[0]?.normSup || '',
        buy_price_inc_gst: buyPriceIncGst,
        min_price_inc_gst: toFinal(minInv),
        max_price_inc_gst: toFinal(maxInv),
        invoice_count:     invSet.size,
        total_units:       tu,
        current_buy_price: currentBuy,
        is_spirit:         isSpirit,
        nips_per_bottle:   nipsPerBottle,
        unit_label:        nipsPerBottle
          ? `per nip (${nipML}ml, ${nipsPerBottle}/btl)`
          : 'per unit',
      }
    }).filter(it => it.buy_price_inc_gst != null).sort((a, b) => a.item_name.localeCompare(b.item_name))

    const dbSuppliers = [...new Set((rows || []).map(r => normalizeSupplier(r.supplier)).filter(Boolean))].sort()
    return res.status(200).json({ items, period_days: daysInt, cutoff: cutoffStr, db_suppliers: dbSuppliers })
  } catch (e) {
    console.error('[avg-prices]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
