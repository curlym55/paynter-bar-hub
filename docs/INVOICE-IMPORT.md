# Invoice Import (retired)

**Status: retired October 2026.** The Hub no longer reads supplier invoices for prices. Buy prices are entered by hand — see `PRICING.md`.

---

## What was removed

- AI price extraction that ran after an invoice was attached (when receiving, from View Order, and from the PO Documents upload)
- The **Avg Buy Report** (Stock Items → Pricing) and **Re-match Invoice History** (Settings)
- The Price History import, average and manage screens (these had already gone earlier)

**Why:** invoice lines were read by AI, and the pack size was often misread — a case recorded as single units, or the other way round — so every figure built from them needed checking by hand. A buy price entered manually and reviewed twice a year proved more trustworthy for a twice-yearly check than an automated average that needed constant correcting.

---

## What still works: invoice filing

Attaching a supplier invoice PDF still:

1. saves it to OneDrive under `Invoices/{Supplier}/`
2. keeps a copy in Supabase
3. links it to the PO record in **PO Documents**, where it is attached to the Email Treasurer message

No price data is read from it.

The PO Reference field in the receive modal (pre-filled from the PO, editable) is used as the filename prefix. If it is blank a ⚠ warning is shown — fill it in before confirming so the invoice is filed correctly.

### OneDrive folder structure

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

Filename = `{PO-Reference}-Invoice.{ext}`. If no PO reference is set it falls back to `{Supplier}-Invoice.{ext}`, which is less useful — always set a PO reference before receiving.

---

## Left in place, unused

These were kept rather than deleted so nothing breaks and no data is lost. **Nothing in the app calls them.**

- Table `buy_price_history`, and the rows already in it
- Routes `POST /api/invoices/extract`, `POST /api/invoices/save`, `GET /api/invoices/avg-prices`, `/api/invoices/match-names`, `/api/invoices/manage`, `/api/invoices/delete-items`
- Route `POST /api/admin/rematch-history`

`avg-prices` was last rewritten to return the latest invoice price per active item with a plausibility flag, but it is unused too.

If this is ever revived, the lesson from the extraction work: the AI's pack-size reading was the weak point, and older rows with a recorded pack of 1 were often really case prices.
