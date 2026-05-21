# Invoice Import

How supplier invoice PDFs are imported, extracted, and used for buy price tracking.

---

## Overview

When a delivery is received, the supplier invoice PDF is attached in the Receive modal. The Hub automatically:

1. Saves the PDF to OneDrive (`Invoices/{Supplier}/{PO-Ref}-Invoice.pdf`)
2. Extracts line items using Claude Haiku AI
3. Saves per-unit prices to the `buy_price_history` Supabase table
4. These prices feed into the average buy price calculations used for markup analysis

---

## Automatic Import (via Receiving)

1. Open a purchase order → **Receive Delivery**
2. In the receive modal, attach the invoice PDF
3. Confirm the delivery
4. Invoice is saved to OneDrive and extracted in the background — no further action needed

The PO Reference field in the receive modal (pre-filled from the PO, editable) is used as the invoice filename prefix. If blank, a ⚠ warning is shown — fill it in before confirming to ensure the invoice is filed correctly.

---

## Manual Import (Price History tab)

1. Go to **Price History → Import Invoice**
2. Upload the invoice PDF
3. Review extracted items:
   - Correct any misread item names
   - Verify unit prices and pack sizes
   - Map each raw name to a Hub item name
4. Click **Save** to commit to price history

---

## AI Extraction

Route: `POST /api/invoices/extract`

Model: **Claude Haiku** (`claude-haiku-4-5-20251001`)

The AI reads the invoice PDF and returns structured JSON with:
- Invoice reference, supplier, date, GST flag
- Per line item: raw name, qty, pack type, units per pack, unit price

### Pack size rules

The AI applies these rules to determine `units_per_pack`:

| Product type | Units per pack |
|---|---|
| Wine 750ml case | **Always 6** |
| Piccolo 200ml (Henkell etc.) | **Always 24** |
| Beer/cider/premix 375ml cans | 24 |
| Beer/cider 330ml bottles | 24 |
| Beer/cider 440ml cans (Guinness, Kilkenny) | 24 |
| Beer/cider 470–500ml cans | 24 |
| Beer 30-block | 30 |
| 10-pack cans | 10 |
| Single spirit/wine bottle | 1 |
| Individual snacks | 1 |
| Uncertain | 1 |

---

## Price Calculation

Route: `POST /api/invoices/save`

For each extracted line item:

```
unit_price_ex_gst = invoice_unit_price ÷ units_per_pack           (if invoice is ex-GST)
unit_price_ex_gst = invoice_unit_price ÷ units_per_pack ÷ 1.10    (if invoice is inc-GST)

qty_units = invoice_qty × units_per_pack
```

Stored in `buy_price_history`:
- `item_name_raw` — original invoice description
- `item_name_hub` — mapped Hub item name
- `supplier`
- `invoice_ref`
- `invoice_date`
- `unit_price_ex_gst` — per unit (bottle/can), ex-GST
- `qty_units` — total units in this line

---

## Name Matching

Invoice descriptions rarely match Hub item names exactly. Mapping is handled two ways:

### Manual (Manage History tab)
Each distinct `item_name_raw` has a dropdown to select the matching Hub item name. Save updates the mapping for all existing and future records with that raw name.

### Auto-match (🤖 button)
Sends all unmatched items to Claude Haiku with the full Hub item list. Returns a suggested Hub name and confidence level:

| Badge | Confidence | Meaning |
|---|---|---|
| ✓ high | green | Clear match — safe to accept |
| ~ medium | amber | Probable match — review before saving |
| ? low | red | Uncertain — verify manually |

Suggestions are applied to the rows but not saved until you click Save on each row.

---

## Average Buy Prices

Route: `GET /api/invoices/avg-prices?days=90`

Calculates weighted average buy price per Hub item:

```
Average = Sum(unit_price_ex_gst × qty_units) ÷ Sum(qty_units)
```

Display value = `average × 1.10` (converts to inc-GST).

**Date range options in UI:** 30 / 60 / 90 / 180 / All days  
**For pricing review:** use 90 days (per policy)  
**For export:** uses all available history (730 days)

Also returns `min_price` and `max_price` per item. A spread >20% of the average triggers a red flag in the pricing export — this often indicates a case-size extraction error on one invoice.

---

## Checking for Errors

If an item's min/max spread is large:

1. Go to **Price History → Manage History**
2. Find the item
3. Check the `unit_price_ex_gst` values — outliers suggest the AI extracted the wrong pack size
4. Delete the bad record
5. Re-import that invoice manually with the corrected pack size

Common cause: wine extracted as a 12-bottle case instead of 6 (doubles the per-bottle price).

---

## OneDrive Folder Structure

Invoices are saved to OneDrive under:

```
Paynter Bar/
└── Invoices/
    ├── Dan Murphys/
    │   └── DM-PO-001-15May-Invoice.pdf
    ├── Coles Woolies/
    │   └── CW-PO-001-20May-Invoice.pdf
    └── ACW/
        └── ACW-PO-001-18May-Invoice.pdf
```

Filename = `{PO-Reference}-Invoice.{ext}`

If no PO reference is set, filename = `{Supplier}-Invoice.{ext}` (less useful — always set a PO ref before receiving).
