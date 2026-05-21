# Pricing

Pricing policy and calculation reference for the Paynter Bar.

---

## Policy

- Sell prices are calculated at a **40% markup** on the average buy price (inc. GST)
- Prices are reviewed **twice yearly**: January 1 and July 1
- Price changes are submitted to the **Licensee (HOC)** for approval via the HOC representative
- **No price reductions** — only increases are ever proposed, regardless of cost movements
- Average buy price is based on the **last 3 months** (90 days) of supplier invoices

---

## Markup Calculation

```
Suggested Sell = Buy Price (inc GST) × 1.40
```

For glass-sold wines (buy price is per bottle, sell price is per glass):
```
Suggested Sell per Glass = Buy Price (inc GST) × 1.40 ÷ Serves per Bottle
```

Suggested sells are rounded to the nearest **$0.25**.

### Actual Markup %
```
Markup % = (Sell − Buy) ÷ Buy × 100
```

For glass-sold wines:
```
Markup % = (Sell × Serves − Buy) ÷ Buy × 100
```

### Colour coding

| Range | Colour | Meaning |
|---|---|---|
| ≥ 40% | Green | At or above target |
| 25–40% | Amber | Below target |
| < 25% | Red | Significantly below target |

---

## Unit Types

| Category | Unit | Buy price basis | Sell price basis |
|---|---|---|---|
| Beer / Cider | each | per can/bottle | per can/bottle |
| Spirits | nip | per nip (bottle cost ÷ nips per bottle) | per nip |
| Wine (glass) | glass | per bottle | per glass |
| Wine (bottle) | bottle | per bottle | per bottle |
| Sparkling | bottle | per bottle | per bottle |
| Snacks | each | per unit | per unit |

### Spirit nip conversion
```
Buy per Nip (ex GST) = Invoice Bottle Price (ex GST) ÷ (Bottle ML ÷ Nip ML)
Buy per Nip (inc GST) = Buy per Nip (ex GST) × 1.10
```

Default nip size: 30ml. Items with "60ml nip" in their name (e.g. Baileys, Galway Pipe) use 60ml automatically.

---

## Buy Price Source

Buy prices are sourced in priority order:

1. **90-day weighted average** from imported supplier invoices (`buy_price_history` table)
2. **Manual Hub buy price** — entered directly in the inventory view (fallback if no invoice data)

In the pricing export:
- Blue cell = price from invoice average
- Amber cell = fallback to manual Hub buy price
- Yellow cell = no buy price at all

---

## Average Price Calculation

The weighted average accounts for order size:

```
Average = Sum(unit_price_ex_gst × qty_units) ÷ Sum(qty_units)
```

Since each item is ordered once per invoice, `qty_units = units_per_pack` (e.g. 6 for a wine case, 24 for a beer carton). This means larger orders are weighted proportionally.

The result is converted to inc-GST for display:
```
Avg Buy (inc GST) = Avg Unit Price (ex GST) × 1.10
```

---

## Pricing Export (Excel)

The pricing export (`📥 Excel` button in Pricing view) generates a spreadsheet with:

**Columns:**
| Column | Description |
|---|---|
| Item | Hub item name |
| Category | Item category |
| Supplier | Primary supplier |
| Unit | glass / bottle / nip / each |
| Buy inc GST | Average buy price (inc GST) — editable |
| Serves/Btl | Serves per bottle (for glass wines) |
| Sell | Current sell price |
| Markup % | Actual current markup (formula) |
| Sugg Sell (40%) | Suggested sell at 40% target (formula) |
| On Hand | Current Square on-hand qty |
| Invoice Count | Total invoices in history |
| Min Buy | Lowest buy price ever recorded |
| Max Buy | Highest buy price ever recorded |
| Notes | Anomaly flags |

**Wine glass+bottle split:** Wines sold by both glass and bottle appear as two rows (paired with purple left-border accent).

**Anomaly flags (Notes column):**
- `⚠ Markup gap: glass X% vs bottle Y%` — glass and bottle markups differ by >20%
- `⚠ Bottle ($X) costs more than 5 glasses ($Y)` — bottle dearer than per-glass

**Min/Max highlighting:** Red cells if price spread exceeds 20% of average (possible extraction error).

**Summary row:** Overall average markup across all items.

---

## Price Review Modal

The `💰 Price Review` button opens a modal showing items where the current price deviates from the target markup by more than BAND%.

- Items needing a **price increase** shown in red
- Items **above target** shown in blue
- Suggested sell pre-calculated
- CSV export for record-keeping
- Print option
