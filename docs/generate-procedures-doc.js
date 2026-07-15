const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  Header, Footer, PageNumber, TableOfContents, PageBreak, VerticalAlign,
  convertInchesToTwip
} = require('docx')

// ── Brand colours ────────────────────────────────────────────────────────
const NAVY   = '1E3A5F'
const TEAL   = '0E7490'
const LIGHT  = 'BFDBFE'
const GREY   = '64748B'
const DARK   = '0F172A'
const AMBER_BG = 'FFFBEB'
const AMBER_BD = 'FDE68A'
const AMBER_TX = '92400E'
const BLUE_BG  = 'EFF6FF'
const BLUE_BD  = 'BFDBFE'
const BLUE_TX  = '1D4ED8'
const GREEN_BG = 'F0FDF4'
const GREEN_BD = '86EFAC'
const GREEN_TX = '166534'
const ROW_ALT  = 'F8FAFC'

const PAGE_W = 12240 // US Letter width, twips
const PAGE_H = 15840 // US Letter height, twips
const MARGIN = convertInchesToTwip(0.9)

// ── Small helpers ────────────────────────────────────────────────────────
function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160, line: 276 },
    children: [new TextRun({ text, size: 21, color: '374151', ...opts })],
  })
}

function h1(num, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 60, after: 240 },
    children: [new TextRun({ text: `${num}. ${title}`, bold: true, size: 34, color: NAVY })],
  })
}

function h2(title) {
  return new Paragraph({
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text: title, bold: true, size: 24, color: DARK })],
  })
}

function stepPara(n, title, body) {
  return new Paragraph({
    spacing: { after: 160, line: 276 },
    children: [
      new TextRun({ text: `${n}. `, bold: true, size: 21, color: TEAL }),
      new TextRun({ text: title + '. ', bold: true, size: 21, color: DARK }),
      new TextRun({ text: body, size: 21, color: '374151' }),
    ],
  })
}

function calloutBox(label, text, kind = 'info') {
  const palette = {
    info:    { bg: BLUE_BG,  bd: BLUE_BD,  tx: BLUE_TX },
    warn:    { bg: AMBER_BG, bd: AMBER_BD, tx: AMBER_TX },
    success: { bg: GREEN_BG, bd: GREEN_BD, tx: GREEN_TX },
  }[kind]
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: palette.bd },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: palette.bd },
      left: { style: BorderStyle.SINGLE, size: 4, color: palette.bd },
      right: { style: BorderStyle.SINGLE, size: 4, color: palette.bd },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: palette.bg, color: 'auto' },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                spacing: { after: 0, line: 264 },
                children: [
                  new TextRun({ text: `${label}  `, bold: true, size: 20, color: palette.tx }),
                  new TextRun({ text, size: 20, color: palette.tx }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

function spacer(h = 160) {
  return new Paragraph({ spacing: { after: h }, children: [] })
}

// Two-column reference table: [label, description] rows, with header row
function refTable(headerLeft, headerRight, rows, colWidths = [3200, 6640]) {
  const total = colWidths[0] + colWidths[1]
  const headerRow = new TableRow({
    tableHeader: true,
    children: [headerLeft, headerRight].map((t, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 19, color: 'FFFFFF' })] })],
    })),
  })
  const bodyRows = rows.map(([l, r], i) => new TableRow({
    children: [
      new TableCell({
        width: { size: colWidths[0], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: i % 2 ? ROW_ALT : 'FFFFFF', color: 'auto' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 19, color: DARK })] })],
      }),
      new TableCell({
        width: { size: colWidths[1], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: i % 2 ? ROW_ALT : 'FFFFFF', color: 'auto' },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: r, size: 19, color: '374151' })] })],
      }),
    ],
  }))
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
  })
}

// ── Shared header / footer for interior pages ───────────────────────────
const interiorHeader = new Header({
  children: [
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 6 } },
      children: [new TextRun({ text: 'Paynter Bar Hub — Procedures', size: 16, color: '94A3B8', italics: true })],
    }),
  ],
})
const interiorFooter = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 6 } },
      children: [
        new TextRun({ text: 'Paynter Bar — GemLife Palmwoods | Page ', size: 16, color: '94A3B8' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8' }),
      ],
    }),
  ],
})

// ── COVER PAGE (its own section, navy full-bleed) ───────────────────────
const coverCell = new TableCell({
  width: { size: PAGE_W, type: WidthType.DXA },
  shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  children: [
    new Paragraph({ spacing: { after: 2200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Paynter Bar Hub', bold: true, size: 64, color: 'FFFFFF' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
      children: [new TextRun({ text: 'Bar Management Procedures', size: 30, color: LIGHT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1000 },
      children: [new TextRun({ text: 'GemLife Palmwoods', bold: true, size: 24, color: 'FFFFFF' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 2600 },
      children: [new TextRun({ text: 'Bar Management Team reference guide', size: 20, color: LIGHT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Version 1.1 · Updated 15 July 2026', size: 18, color: LIGHT })],
    }),
  ],
})
const coverTable = new Table({
  width: { size: PAGE_W, type: WidthType.DXA },
  columnWidths: [PAGE_W],
  rows: [new TableRow({ height: { value: PAGE_H, rule: 'exact' }, children: [coverCell] })],
})

// ── TOC PAGE ─────────────────────────────────────────────────────────────
const { PositionalTab, PositionalTabAlignment, PositionalTabLeader, PositionalTabRelativeTo } = require('docx')

function tocLine(title, page) {
  return new Paragraph({
    spacing: { after: 180 },
    tabStops: [{ type: 'right', position: convertInchesToTwip(6.6), leader: 'dot' }],
    children: [
      new TextRun({ text: title, size: 22, color: DARK }),
      new TextRun({ text: `\t${page}`, size: 22, color: GREY }),
    ],
  })
}

const tocSection = [
  new Paragraph({
    spacing: { after: 300 },
    children: [new TextRun({ text: 'Contents', bold: true, size: 34, color: NAVY })],
  }),
  tocLine('1. Getting Started', 3),
  tocLine('2. Ordering Stock', 4),
  tocLine('3. Receiving a Delivery', 5),
  tocLine('4. Stocktake', 6),
  tocLine('5. Wastage Log', 7),
  tocLine('6. Pricing', 8),
  tocLine('7. Reporting', 9),
  tocLine('8. Troubleshooting', 10),
  tocLine('9. Who to Contact', 10),
]

// ── SECTION 1 — Getting Started ─────────────────────────────────────────
const sec1 = [
  h1(1, 'Getting Started'),
  bodyText('The Paynter Bar Hub manages ordering, deliveries, stocktakes, pricing and reporting for the bar. It connects to Square (point of sale and inventory), OneDrive (document storage) and Xero via Amaka (accounting).'),
  h2('Logging in'),
  stepPara(1, 'Open the Hub', 'Go to paynter-bar-hub.vercel.app on any device. It works on phone, tablet and desktop.'),
  stepPara(2, 'Enter your PIN', 'Bar Management Team members use the management PIN. Residents may be given the read-only PIN, which shows stock and prices but allows no changes.'),
  stepPara(3, 'Stay signed in', 'You remain signed in for 12 hours. After that, enter the PIN again.'),
  calloutBox('Note', 'PINs are held securely and can be changed at any time by the Bar Manager. If a PIN is changed, anyone already signed in stays signed in until their session expires.', 'info'),
  spacer(),
  h2('Access levels'),
  refTable('Access', 'What it allows', [
    ['Management PIN', 'Full access — ordering, receiving, stocktakes, wastage, pricing, settings, all exports.'],
    ['Read-only PIN', 'View only. Stock levels, sales and the price list are visible. Buy prices and the Pricing tab are hidden. Nothing can be changed.'],
    ['Public price list', 'No PIN required. Opens the customer price list only, via the QR poster. Shows no stock or cost information.'],
  ]),
]

// ── SECTION 2 — Ordering Stock ──────────────────────────────────────────
const sec2 = [
  h1(2, 'Ordering Stock'),
  bodyText('All ordering runs through the Order Wizard, started from the Dashboard. There are two ways to start it, and they behave differently.'),
  h2('Weekly Order — the normal restock'),
  bodyText('Use this for the regular weekly order. The Hub calculates what needs ordering from recent sales, target stock levels and any minimum stock you have set.'),
  stepPara(1, 'Click Weekly Order on the Dashboard', 'Only items the Hub calculates as needing stock appear, with suggested quantities already filled in. Items already sitting on another order carry a green ON ORDER badge so you do not double up.'),
  stepPara(2, 'Review the quantities', 'Adjust any figure you disagree with. Set a quantity to 0 to leave that item off the order entirely.'),
  stepPara(3, 'Print the order list (optional)', "Click Print Order List for a paper sheet showing item, on-hand and suggested quantity, plus a blank column to write in what you actually ordered. Useful while working through the supplier's website."),
  stepPara(4, 'Place the order with the supplier', "Order through the supplier's normal channel. Dan Murphy's and Coles/Woolworths are ordered online. ACW is ordered online at acwsunshine.com.au."),
  stepPara(5, 'Record the confirmation', 'Enter the supplier\'s PO or confirmation number. If you already have the invoice, attach it here — it saves to OneDrive immediately.'),
  stepPara(6, 'Mark as ordered', 'The Hub saves a purchase order to OneDrive, records it in PO Documents, and flags every item as on order.'),
  h2('Additional Order — events and one-offs'),
  bodyText('Use this when buying outside the normal cycle — a special event, a function, or anything management is paying for separately.'),
  bodyText('• Every item for the chosen supplier appears, regardless of stock level.\n• All quantities start at zero. Enter a figure only for what you actually need.\n• Anything left at zero is excluded from the order.'.replace(/\n/g, ' ')),
  calloutBox('Good to know', 'An item can sit on a weekly order and an additional order at the same time. Each order tracks its own quantity, and receiving one leaves the other untouched.', 'info'),
]

// ── SECTION 3 — Receiving a Delivery (UPDATED) ──────────────────────────
const sec3 = [
  h1(3, 'Receiving a Delivery'),
  bodyText('Always receive stock through the Hub. This updates Square inventory and files the paperwork.'),
  stepPara(1, 'Open the Receive modal', 'From the Dashboard, click Receive on the on-order banner for that supplier.'),
  stepPara(2, 'Check what arrived', 'Ordered quantities are pre-filled. Use All Full if everything arrived. Uncheck anything that did not arrive — it stays on order and can be received later. Adjust quantities for short deliveries.'),
  stepPara(3, 'Attach the supplier invoice', 'Select the invoice PDF. It uploads to OneDrive as soon as you choose the file. The Hub reads the line items and adds them to invoice history, which feeds the Avg Buy Report.'),
  stepPara(4, 'Confirm the delivery', 'The Hub updates Square inventory, saves a receive report and the invoice to OneDrive, updates the PO to Received, and clears the items from the on-order list.'),
  calloutBox('Important', 'Buy prices in Stock Items are set manually — receiving a delivery does not change them, whether or not an invoice is attached. If no invoice is attached, this delivery simply won\u2019t appear in the Avg Buy Report, and the treasurer email will have no attachment.', 'warn'),
  h2('Checking a delivery against the order'),
  bodyText('• Count every carton before signing the driver\u2019s docket.\n• Great Northern cans arrive in cartons of 30, not 24.\n• Wine cases hold 6 bottles.\n• If a delivery is short, receive only what arrived. Do not adjust the quantity to match the invoice.'.replace(/\n/g, ' ')),
]

// ── SECTION 4 — Stocktake ───────────────────────────────────────────────
const sec4 = [
  h1(4, 'Stocktake'),
  bodyText('A stocktake counts physical stock and corrects Square to match. Do one at least monthly, and after any suspected discrepancy.'),
  stepPara(1, 'Print a blank count sheet', 'Stocktake tab, then Print Blank Sheet. It lists every item by category with Square\u2019s current figure alongside a blank column for your count. Sparkling starts on a new page so the sheet can be split between two people.'),
  stepPara(2, 'Count the stock', 'Count spirits in nips, wine in bottles, everything else in units. Include stock in the store cupboard as well as behind the bar.'),
  stepPara(3, 'Enter your counts into the Hub', 'Type each counted figure into the Stocktake table.'),
  stepPara(4, 'Review the sync preview', 'Click Sync to Square. The preview lists every item that will change, showing what Square holds now and what it will be set to.'),
  stepPara(5, 'Sync', 'Confirm. Synced items turn green. Each sync is recorded in history with before and after figures.'),
  stepPara(6, 'Export the record', 'Click History, then Export on that sync, to download an Excel record of exactly what changed. Keep this with the bar records whenever a large correction was made.'),
  calloutBox('Warning', 'Syncing sets Square\u2019s stock to your counted figure — it overwrites rather than adds or subtracts. Always read the preview before confirming.', 'warn'),
  h2('Investigating a discrepancy'),
  bodyText('If Square and your physical count disagree by a meaningful amount, check these before assuming the count is wrong:'),
  bodyText('• Was a delivery entered with the wrong quantity? Compare recent receives against the supplier invoices — a case count entered as 120 instead of 60 will show up as a clean multiple.\n• Was stock received outside the Hub, or collected in person and never entered?\n• Was breakage or spillage thrown out without being logged in the Wastage Log?\n• Was a free or promotional case put straight on the shelf?'.replace(/\n/g, ' ')),
  calloutBox('Remember', 'Wastage that is never logged is the most common cause of Square holding more stock than the shelf actually has.', 'info'),
]

// ── SECTION 5 — Wastage Log ─────────────────────────────────────────────
const sec5 = [
  h1(5, 'Wastage Log'),
  bodyText('Record every breakage, spill and out-of-date item. This keeps Square accurate and gives the committee a true picture of losses.'),
  stepPara(1, 'Add the entry', 'Choose the item, quantity and unit, pick a reason, and add a note if it helps explain what happened.'),
  stepPara(2, 'Sync it to Square', 'Unsynced entries show a Sync button. Syncing moves that quantity out of stock in Square.'),
  calloutBox('Note', "Once synced, an entry is locked — Square's stock has already been reduced. Editing or deleting the entry here would not change Square, and the two would silently disagree. Only the note and recorded-by fields stay editable.", 'info'),
  bodyText('If a synced entry was genuinely a mistake:'),
  bodyText('• Correct the physical stock in Square first, using a Stocktake.\n• Then delete the log entry and confirm the force-remove warning.'.replace(/\n/g, ' ')),
  calloutBox('Good to know', 'Unsynced entries can be edited or deleted freely — nothing has reached Square yet.', 'success'),
]

// ── SECTION 6 — Pricing (REWRITTEN) ─────────────────────────────────────
const sec6 = [
  h1(6, 'Pricing'),
  bodyText('Prices are reviewed each January and July. The target is a 40% markup on the buy price, rounded to the nearest 25 cents.'),
  h2('Buy prices are set manually'),
  bodyText('Buy Price is entered and kept up to date by hand in Stock Items \u2192 Pricing. It is the single source of truth for markup, suggested sell price and stock value calculations — nothing updates it automatically from supplier invoices or deliveries.'),
  h2('How markup is calculated'),
  refTable('Item type', 'Markup', [
    ['Beer, cider, soft drink, snacks', '(sell − buy) ÷ buy, on the unit buy and sell price.'],
    ['Wine sold by the glass', 'Calculated on revenue per bottle: (glass price × glasses per bottle − bottle buy price) ÷ bottle buy price.'],
    ['Wine sold by the bottle', '(bottle sell − bottle buy) ÷ bottle buy. Shown alongside the glass markup when a wine sells both ways.'],
    ['Spirits', '(sell per nip − buy per nip) ÷ buy per nip.'],
  ], [3000, 6840]),
  spacer(),
  h2('Reviewing prices'),
  bodyText('• The Pricing view in Stock Items shows Buy Price, Sell Price (both glass and bottle for wine, side by side) and Markup %, colour-coded green (40%+), amber (25–40%) or red (below 25%).\n• A suggested sell price at 40% markup is shown for every item.\n• Items missing a buy price are flagged with a red \u26a0\ufe0f banner and a "$ missing" tag.\n• Change a sell price in Square, not in the Hub — the Hub reads live prices from Square on every Refresh.'.replace(/\n/g, ' ')),
  spacer(),
  h2('Avg Buy Report'),
  bodyText('Click \ud83d\udcca Avg Buy Report in the Pricing toolbar to download an Excel export of the 365-day average buy price per item, calculated from actual supplier invoices, alongside your current Hub buy price and the difference between them.'),
  calloutBox('Note', 'This report is for reference only at the January/July review — it does not change any Hub prices. Use it to spot items whose buy price may have drifted from what invoices show.', 'info'),
]

// ── SECTION 7 — Reporting (UPDATED) ─────────────────────────────────────
const sec7 = [
  h1(7, 'Reporting'),
  h2('Monthly Report'),
  bodyText('A one-click summary of any month, intended for committee reporting. Choose the month and year, then click Generate.'),
  bodyText('• Revenue, with the change against the previous month\n• Units sold, and how many distinct items sold\n• Wastage cost, broken down by reason\n• Orders placed, per supplier, with received and pending status\n• Average markup across all priced items\n• Sales by category, with month-on-month movement'.replace(/\n/g, ' ')),
  bodyText('Click Excel to download the whole report as a single formatted sheet, ready to attach to committee papers.'),
  calloutBox('How wastage is valued', 'Wastage is valued at each item\u2019s current buy price. Entries do not record the price paid at the time, so the figure means what that wastage would cost to replace today. Items with no buy price set are excluded, and the report says how many.', 'warn'),
  spacer(),
  h2('Sales Report'),
  bodyText('Sales by item and category for any date range, with a comparison period against the prior period.'),
  bodyText('Wine sold both by the glass and by the bottle shows separate Glasses and Bottles columns automatically. The Bottles column only appears when at least one item has bottle sales in the selected period.'),
  spacer(),
  h2('SOH History and stock trend'),
  bodyText('A Stock On Hand snapshot is saved automatically on the last day of every month, capturing every item\u2019s quantity and value.'),
  bodyText('• The trend chart plots total stock over time. Switch between dollar value and units, and filter to a single category.\n• Click any snapshot to see the full item-by-item breakdown for that date.\n• Use Snapshot Now to take an off-cycle record — for example, immediately after a major stocktake correction.'.replace(/\n/g, ' ')),
  calloutBox('Do not delete snapshots', 'They are the basis of the stock figure reported to the committee.', 'warn'),
  spacer(),
  h2('Other reports'),
  refTable('Report', 'Purpose', [
    ['Sales Report', 'Sales by item and category for any date range, with a comparison period.'],
    ['Avg Buy Report', 'Average buy price per item from the last 365 days of invoices, compared to current Hub buy prices. Reference only — Stock Items → Pricing.'],
    ['PO Documents', 'Every purchase order, its invoice, and its receive report.'],
    ['Barcode Sheet', 'Printable barcodes for bar staff to scan drinks at the Square POS.'],
  ]),
]

// ── SECTION 8 — Troubleshooting ─────────────────────────────────────────
const sec8 = [
  h1(8, 'Troubleshooting'),
  refTable('Problem', 'What to do', [
    ['Cannot log in', 'Check the PIN with the Bar Manager. After ten wrong attempts the Hub locks that device out for 15 minutes.'],
    ['OneDrive says not connected', 'Go to Settings and reconnect OneDrive. Documents already saved are unaffected.'],
    ['Square inventory did not update', 'The receive report and invoice are already saved. Retry the Square update from the receipt screen.'],
    ['An item is missing from the order wizard', 'It may be marked Do Not Order in its notes, flagged as rundown, or already on another order. Check Stock Items.'],
    ['Square shows more stock than the shelf', 'Usually unlogged wastage, or a delivery entered with the wrong quantity. See Investigating a discrepancy in section 4.'],
    ['Square shows less stock than the shelf', 'Usually a delivery that never went through the Hub, or a free case put straight on the shelf.'],
    ['A wastage entry was logged in error', 'If it has not been synced, delete it. If it has been synced, correct the stock in Square via a stocktake first, then force-remove the entry.'],
  ], [3400, 6440]),
]

// ── SECTION 9 — Who to Contact ──────────────────────────────────────────
const sec9 = [
  h1(9, 'Who to Contact'),
  refTable('Role', 'Name', [
    ['Bar Management Team', 'Graeme Martin, Russel Green, Bob Taylor, Bruce Campbell'],
    ['HOC Representative', 'Christine Yeldham'],
    ['Suppliers', "Dan Murphy's · Coles/Woolworths · ACW (acwsunshine.com.au)"],
  ]),
  spacer(300),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Paynter Bar Hub · paynter-bar-hub.vercel.app', italics: true, size: 18, color: GREY })],
  }),
]

// ── Assemble document ───────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri' } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: [coverTable],
    },
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          pageNumberStart: 2,
        },
      },
      headers: { default: interiorHeader },
      footers: { default: interiorFooter },
      children: [
        ...tocSection,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec1,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec2,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec3,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec4,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec5,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec6,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec7,
        new Paragraph({ children: [new PageBreak()] }),
        ...sec8,
        ...sec9,
      ],
    },
  ],
})

Packer.toBuffer(doc).then(buf => {
  require('fs').writeFileSync('PaynterHubProcedures.docx', buf)
  console.log('Written PaynterHubProcedures.docx,', buf.length, 'bytes')
})
