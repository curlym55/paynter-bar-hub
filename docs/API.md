# API Reference

All routes are Next.js serverless functions under `pages/api/`.

---

## Authentication

### `POST /api/auth`
Validate PIN. Returns session token stored in Redis.

---

## Items

### `GET /api/items`
Fetch all inventory items from Square catalog, merged with Hub settings from Redis/Supabase.

Returns: `{ items: [...] }` — each item includes Square catalog data plus Hub overrides (buy price, nip size, rundown flag, serves, sell unit).

### `GET /api/catalog-images`
Fetch Square catalog item images.

---

## Sales

### `GET /api/sales?from=YYYY-MM-DD&to=YYYY-MM-DD`
Sales data from Square for the given date range.

Returns: `{ sales: [...], total, transactions }`

### `GET /api/fy-chart?refresh=true`
Full-year monthly revenue chart data. Cached in Redis. Pass `refresh=true` to bust cache.

---

## Stocktake

### `GET /api/stocktake`
Current stocktake session (if active).

### `POST /api/stocktake`
Save stocktake counts.

### `POST /api/stocktake-sync`
Sync accepted stocktake variances to Square inventory.

### `GET /api/stocktake-history`
List past stocktake sessions from Supabase.

### `GET /api/stocktake-api?action=...`
Various stocktake actions (start session, complete, get history detail).

---

## SOH

### `GET /api/soh-audit`
Generate SOH audit report comparing Square on-hand vs last stocktake.

### `GET /api/soh-history`
List monthly SOH snapshots from Supabase.

### `POST /api/cron/soh-snapshot`
Triggered by Vercel cron (last day of month, 4am AEST). Saves current SOH to Supabase `soh_reports` table.

---

## Wastage

### `GET /api/wastage`
List wastage records.

### `POST /api/wastage`
Record new wastage entry.

### `POST /api/wastage-sync`
Sync wastage quantity adjustment to Square.

---

## Purchase Orders

### `GET /api/purchase-orders`
List all purchase orders.

### `GET /api/purchase-order?id=...`
Single purchase order detail.

### `POST /api/purchase-order`
Create or update a purchase order.

---

## Receiving / Square Inventory

### `POST /api/square/receive-inventory`
Adjust Square inventory quantities on delivery confirmation.

Body: `{ items: [{ catalogObjectId, quantity }] }`

---

## Invoices

### `POST /api/invoices/extract`
Extract line items from a supplier invoice PDF using Claude Haiku.

Body: `{ pdf_base64: "..." }`

Returns:
```json
{
  "ok": true,
  "invoice_ref": "INV-12345",
  "supplier": "Dan Murphy's",
  "invoice_date": "2026-05-15",
  "gst_included": false,
  "items": [
    {
      "item_name_raw": "Stoneleigh's Sauv Blanc 750ml Case 6",
      "invoice_qty": 2,
      "pack_type": "Case",
      "units_per_pack": 6,
      "invoice_unit_price": 61.56
    }
  ]
}
```

Pack size rules applied by the AI:
- Wine 750ml case: always 6
- Piccolo 200ml (e.g. Henkell): always 24
- Beer/cider 375ml cans: 24
- Beer/cider 330ml bottles: 24
- Beer/cider 440ml cans (Guinness, Kilkenny): 24
- Beer/cider 470–500ml cans: 24
- Beer 30-block: 30
- Spirit/wine single bottle: 1

### `POST /api/invoices/save`
Save extracted invoice items to `buy_price_history`.

Calculates `unit_price_ex_gst` = `invoice_unit_price ÷ units_per_pack ÷ 1.10` (if GST included) or `÷ units_per_pack` (if ex-GST).

Body:
```json
{
  "invoice_ref": "INV-12345",
  "supplier": "Dan Murphy's",
  "invoice_date": "2026-05-15",
  "gst_included": false,
  "items": [
    {
      "item_name_hub": "Stoneleigh's Sauv Blanc",
      "invoice_unit_price": 61.56,
      "units_per_pack": 6,
      "invoice_qty": 2,
      "include": true
    }
  ]
}
```

### `GET /api/invoices/avg-prices?days=730&supplier=Dan+Murphy%27s`
Weighted average buy prices per item.

- `days`: lookback window (default 180, max 730). Pass 730 for all-time.
- `supplier`: filter by supplier name (optional, pass `all` for all suppliers)

Returns:
```json
{
  "items": [
    {
      "item_name": "Stoneleigh's Sauv Blanc",
      "supplier": "Dan Murphy's",
      "avg_unit_price_ex_gst": 10.228,
      "min_price": 9.917,
      "max_price": 13.818,
      "invoice_count": 17
    }
  ]
}
```

Average is weighted by `qty_units` (total bottles/units per invoice line).

### `GET /api/invoices/manage?days=730`
All distinct invoice item names with row counts and latest unit price.

### `POST /api/invoices/match-names`
AI name matching — matches raw invoice descriptions to Hub item names using Claude Haiku.

Body:
```json
{
  "raw_names": ["Stoneleigh's Sauv Blanc 750ml Case 12"],
  "hub_names": ["Stoneleigh's Sauv Blanc", "Pepperjack Shiraz", "..."]
}
```

Returns:
```json
{
  "ok": true,
  "matches": [
    { "raw": "Stoneleigh's Sauv Blanc 750ml Case 12", "hub": "Stoneleigh's Sauv Blanc", "confidence": "high" }
  ]
}
```

Confidence levels: `high` (clear match), `medium` (probable), `low` (uncertain), `null` hub (no match).

---

## Documents (OneDrive-linked)

### `GET /api/documents/list?supplier=...&type=...`
List documents saved to Supabase `documents` table (linked to OneDrive files).

### `POST /api/documents/save`
Save a document record (invoice, PO, report) to Supabase.

### `DELETE /api/documents/delete?id=...`
Delete a document record.

---

## OneDrive

### `GET /api/onedrive/auth`
Initiate OneDrive OAuth2 flow.

### `GET /api/onedrive/callback`
OAuth2 callback — stores refresh token in Redis.

### `POST /api/onedrive/save-invoice`
Save invoice PDF to OneDrive under `Invoices/{Supplier}/{filename}`.

Body: `{ filename, base64, mimeType, supplier }`

### `POST /api/onedrive/save-po`
Save purchase order PDF to OneDrive under `Purchase Orders/{filename}`.

### `POST /api/onedrive/save-report`
Save report file to OneDrive under `Reports/{filename}`.

### `POST /api/onedrive/setup-folders`
Create the standard OneDrive folder structure if it doesn't exist.

---

## Specials

### `GET /api/specials`
List all specials from Supabase.

### `POST /api/specials`
Create or update a special.

---

## Rundown

### `GET /api/rundown`
List rundown items.

### `POST /api/rundown`
Toggle rundown flag for an item.

---

## Notes

### `GET /api/notes`
List bar notes.

### `POST /api/notes`
Add a note.

### `DELETE /api/notes?id=...`
Delete a note.

---

## Settings

### `GET /api/settings`
Load app settings from Redis.

### `POST /api/settings`
Save a setting. Records old and new values to audit log in Supabase.

Body: `{ key, value, changedBy }`

---

## Send Receipt

### `POST /api/send-receipt`
Email a delivery receipt to the bar manager.

---

## Admin

### `POST /api/admin/sync-to-supabase`
Sync Square catalog data to Supabase (used for cross-app sharing).

---

## Debug

### `GET /api/debug/catalog`
Raw Square catalog data dump (restricted to BMT).
