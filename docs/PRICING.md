# Pricing

Pricing policy and calculation reference for the Paynter Bar.

*Rewritten October 2026. The earlier version described buy prices averaged from supplier invoices, which the app no longer does.*

---

## Policy

- Suggested sell prices target either a **40% markup** or a **30% margin**. The toggle in the Pricing view switches between them (see *Suggested sell price*). Both percentages are fixed.
- Prices are reviewed **twice yearly**: January 1 and July 1
- Price changes are submitted to the **Licensee (HOC)** for approval via the HOC representative
- **No price reductions** — only increases are ever proposed, regardless of cost movements
- Sell prices are changed in **Square**, not in the Hub. The Hub reads them live on every Refresh.

---

## Buy price

Buy Price is **entered by hand** in Stock Items → Pricing. It is the single source of truth for markup, suggested sell price, stock value, wastage valuation, and the cost and profit figures in the Sales Report. Nothing updates it automatically.

- All buy prices are **inc GST**.
- The basis differs by item type:
  - **per unit** — beer, cider, soft drink, snacks
  - **per nip** — spirits, fortified wines and liqueurs
  - **per bottle** — wine
- Items with no buy price are flagged (⚠️ banner and a "$ missing" tag). They are left out of the Compare Both report and out of the Sales Report profit totals.
- Buy prices display to 2 decimal places. The stored value keeps its full precision (for example 2.619), and all calculations use the stored value.

The Hub used to work out buy prices from supplier invoices using AI extraction. That was retired in October 2026 — see `INVOICE-IMPORT.md`.

---

## Glass size

All wine glass maths uses one figure: **165ml**, which is **4.545 glasses per 750ml bottle** (0.22 of a bottle per glass). This is the true pour including overpour. It is deliberately a little larger than the 150ml pour advertised on the customer price list.

The figure lives in one place — `GLASS_SERVE_ML` in `lib/constants.js` — and is used by:

- the Pricing view and its exports
- the Sales Report profit calculation
- the stock conversion in `lib/square.js` (glasses sold → bottles used)
- the wastage sync (wasted glasses → bottles deducted in Square)

Change it there and everything follows. Before October 2026 some of these used 150ml / 5 glasses, so the same wine showed different markups on different screens.

---

## Markup and margin

| | Formula |
|---|---|
| **Markup %** | (Sell − Buy) ÷ Buy × 100 — profit as a percentage of what you paid |
| **Margin %** | (Sell − Buy) ÷ Sell × 100 — profit as a percentage of what you charge |

They are different numbers for the same profit. For example, **40% markup is a 28.6% margin**, and a **30% margin** needs a sell price of Buy ÷ 0.70, which is about a **42.9% markup**.

### Actual markup %

```
Markup % = (Sell − Buy) ÷ Buy × 100
```

For wine sold by the glass (buy price is per bottle, sell price is per glass):

```
Markup % = (Sell × 4.545 − Buy) ÷ Buy × 100
```

The actual Markup column sits under **▸ Show Details** in the Pricing view.

### Colour coding

| Range | Colour | Meaning |
|---|---|---|
| ≥ 40% | Green | At or above target |
| 25–40% | Amber | Below target |
| < 25% | Red | Significantly below target |

---

## Suggested sell price

```
Markup basis:   Suggested = Buy × 1.40
Margin basis:   Suggested = Buy ÷ 0.70
```

- The result is rounded **up** to the next **$0.25**.
- Wine sold by the glass: the bottle figure above is divided by 4.545, then rounded up. Wines sold both by the glass and the bottle also show the bottle suggestion, under the glass price.
- The **Suggested price: Markup 40% | Margin 30%** toggle sits beside Print and Excel in the Pricing view. It applies to every item and is stored as the global setting `pricingBasis`, so it is the same for everyone.
- Suggested prices are a guide. Sell prices are still changed in Square.

Notes:

- The Pricing Analysis Excel export uses a fixed 40% markup for its suggested columns and does not follow the toggle. The printed pricing sheet shows no suggested prices.
- Item settings may contain `pricingMode` and `targetPct` fields from a short per-item trial in October 2026. Nothing reads them.

---

## Unit types

| Category | Unit | Buy price basis | Sell price basis |
|---|---|---|---|
| Beer / Cider | each | per can/bottle | per can/bottle |
| Spirits | nip | per nip | per nip |
| Wine (glass) | glass | per bottle | per glass |
| Wine (bottle) | bottle | per bottle | per bottle |
| Sparkling | bottle | per bottle | per bottle |
| Snacks | each | per unit | per unit |

### Working out a spirit's buy price per nip

The Hub stores spirits per nip, so work the figure out before entering it:

```
Buy per Nip (inc GST) = Bottle price (inc GST) ÷ (Bottle ML ÷ Nip ML)
```

Default nip size is 30ml. Items with "60ml nip" in their name (for example Baileys, Galway Pipe) use 60ml.

---

## Pricing view and exports

The Pricing view (💲 Pricing in Stock Items) offers three downloads or prints:

**🖨️ Print** — a pricing sheet: Item, Category, Unit, Buy, Sell, Bottle Sell, Markup, Bottle Markup, Stock.

**📥 Excel (Pricing Analysis)** — one row per active item. Columns: Item, Category, Supplier, Buy, Sell (glass/unit), Sell (bottle), Markup % (glass/unit), Markup % (bottle), Sugg Sell (glass), Sugg Sell (bottle), On Hand, Notes. A summary block at the bottom shows the number of active items tracked, items with price data, and items below the 40% target. Items ticked **Rundown** are excluded.

**📊 Compare Both (Excel)** — for deciding between markup and margin pricing. One row per item with a buy price: Buy, Current Sell, Suggested at Markup 40%, Suggested at Margin 30%, the dollar difference, and which is higher. Wines sold both ways also get bottle suggestions for each. Items with no buy price, or ticked Rundown, are left out.

---

## Profit in the Sales Report

The Sales Report shows **gross profit** per item and in total: revenue less the buy price of what was sold.

- Cost uses the buy-price basis above: per unit, per nip, or per bottle. Wine sold by the glass is costed at 4.545 glasses per bottle.
- **Margin %** is profit ÷ revenue. It is green at 30% or more, amber at 20–30%, red below 20%.
- Items with no buy price cannot be costed. They show a dash, are left out of the profit total and margin, and an amber note above the table says how many were left out.
- Wastage and stock losses are not included.
- Profit appears on screen only. The Print/PDF and Excel exports do not include it yet.
