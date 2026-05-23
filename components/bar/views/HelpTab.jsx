// HelpTab.jsx -- extracted from pages/index.js
import React from 'react'

export default function HelpTab() {
  const sections = [
    {
      icon: '🏠',
      title: 'Dashboard',
      items: [
        { q: 'Home screen', a: 'The Dashboard is the home screen. It shows live stock status at a glance — Critical items, Low Stock, items to order, and when data was last refreshed from Square.' },
        { q: 'Status cards', a: 'The Critical, Low Stock and To Order cards are clickable — tap any of them to jump straight to the Reorder Planner filtered to those items.' },
        { q: 'Feature tiles', a: 'All app features are accessible from the Dashboard via clickable tiles. The Volunteer Roster tile opens in a new tab.' },
        { q: 'Refreshing data', a: 'Click Refresh in the top-right header to pull the latest stock levels, prices and sales data from Square POS. The Dashboard shows how long ago data was last refreshed.' },
      ]
    },
    {
      icon: '🔐',
      title: 'Getting Started',
      items: [
        { q: 'Logging in', a: 'Enter your PIN on the login screen. BMT PIN gives full access. The read-only PIN gives view-only access. Your session stays active until you close the browser tab.' },
        { q: 'Navigation', a: 'The sidebar on the left organises features into groups: Inventory, Analytics, Bar, Administration, Settings and Help. Click any group to expand it. 🏠 Dashboard is always pinned at the top.' },
        { q: 'Sales period', a: 'The 30d / 60d / 90d buttons set how many days of sales history are used to calculate weekly averages. 90 days gives the most stable average; 30 days is more responsive to recent trends.' },
        { q: 'Refreshing data', a: 'Click Refresh in the top-right to pull the latest stock levels and sales from Square POS. Always reflects current Square data.' },
      ]
    },
    {
      icon: '📦',
      title: 'Reorder Planner',
      items: [
        { q: 'Reading the table', a: 'Each row shows current stock (On Hand), weekly average sales, target stock level, and how much to order. Red = CRITICAL (below target), yellow = LOW, green = OK.' },
        { q: 'Order Qty vs Bottles', a: 'For spirits and fortified wines, Order Qty shows nips needed and Bottles shows full bottles to buy (rounded up). For all other items, Order Qty shows units to order.' },
        { q: 'Target Weeks', a: 'The default target weeks is set in ⚙️ Settings. You can also override it per item using the Target Wks column in Show Details mode. Default is 6 weeks.' },
        { q: 'Filtering to order items', a: 'Tick "Order items only" in the controls bar to hide items that don\'t need ordering — useful when preparing orders.' },
        { q: 'Supplier tabs', a: 'Click a supplier name to filter the table to just that supplier. When a supplier is selected, 📋 Order Sheet and ✓ Mark as Ordered buttons appear in the toolbar.' },
        { q: 'Order Sheet', a: 'Select a supplier tab then click 📋 Order Sheet to open a formatted printable order sheet for that supplier. Use the Print this sheet button on the page.' },
        { q: 'Mark as Ordered', a: 'Select a supplier tab then click ✓ Mark as Ordered to record that an order has been placed. Enter a PO reference number — this links the order to its receive report and invoice in Documents.' },
        { q: 'Receiving an order', a: 'When stock arrives, click the banner that appears for the pending order and select Receive. Enter the quantities received and optionally attach the supplier invoice PDF. Square inventory updates automatically on confirm.' },
        { q: 'Editing item settings', a: 'Click any value in the Category, Supplier, Pack, Bottle Size or Nip Size columns to edit inline. Changes save automatically and are shared with all BMT members.' },
        { q: 'Adding notes', a: 'Click the Notes column for any item to add a note (e.g. "Discontinued", "Check price"). Notes are saved and visible to all.' },
        { q: 'Rundown items', a: 'Tick the Rundown checkbox on any item to flag it as being run down — it will be excluded from order calculations and the average markup in the pricing export.' },
        { q: 'Missing buy prices', a: 'A red ⚠️ warning appears in the toolbar if any items are missing a buy price. Click it to jump to Pricing view. Buy prices affect markup calculations and stock value reports.' },
        { q: 'Adding or removing suppliers', a: 'Suppliers are managed in ⚙️ Settings in the sidebar. Add or remove suppliers there, and assign items to suppliers by clicking the Supplier column inline.' },
      ]
    },
    {
      icon: '🥃',
      title: 'Spirits & Fortified Wines',
      items: [
        { q: 'How spirits are tracked', a: 'Square tracks spirits in nips (30ml standard, 60ml for Baileys, Galway Pipe Port and Penfolds Club Port). All calculations — weekly average, target stock, order quantities — stay in nips throughout.' },
        { q: 'Bottle Size column', a: 'Set to 700ml, 750ml or 1000ml per item. Determines how many nips per bottle (e.g. 700ml ÷ 30ml = 23.3 nips). Affects order quantities and stocktake calculations.' },
        { q: 'Nip Size column', a: 'Most spirits are 30ml. Baileys Irish Cream, Galway Pipe Port and Penfolds Club Port are served as 60ml nips. Must be set correctly for accurate order quantities.' },
        { q: 'Order quantities', a: 'Shows nips needed to reach target stock. Bottles column shows full bottles to buy (always rounded up). Example: need 70 nips from 700ml bottle → Order Qty 70, Bottles 3.' },
      ]
    },
    {
      icon: '💲',
      title: 'Pricing Mode',
      items: [
        { q: 'Enabling pricing', a: 'Click $ Pricing in the controls bar to reveal Buy Price, Sell Price and Markup % columns. This view is only available to BMT members.' },
        { q: 'Sell prices from Square', a: 'Sell prices are imported automatically from your Square catalogue. All price changes must be made in Square — this keeps Square as the single source of truth.' },
        { q: 'Markup calculation', a: 'Markup % = (Sell − Buy) ÷ Buy × 100. Green = 40%+, amber = 25–40%, red = below 25%. Requires both buy and sell price to be set.' },
        { q: 'Buy prices', a: 'Click the Buy Price cell for any item and type the cost price. Saved to the cloud and shared across all management team sessions.' },
      ]
    },
    {
      icon: '📄',
      title: 'Price History',
      items: [
        { q: 'What is Price History?', a: 'Price History tracks your actual buy prices from supplier invoices over time. It calculates weighted average buy prices per item so you can compare what you\'re actually paying against what\'s entered in the Hub.' },
        { q: 'Importing invoices', a: 'Go to Administration → 📄 Price History → Import Invoice tab. Select one or more supplier PDF invoices. Claude AI automatically extracts all line items and prices. Review the extracted items, adjust Hub Name and Units/Pack if needed, then click Save to History.' },
        { q: 'Automatic import on receive', a: 'When you attach a supplier invoice PDF in the receive modal and confirm a delivery, the Hub automatically extracts and saves the line items to price history in the background — no manual import needed.' },
        { q: 'Average Prices report', a: 'The Average Prices tab shows a weighted average buy price per item over a selectable period (30/60/90/180 days). The Current Hub Price column compares your entered buy price to the invoice average — red means you\'re entering a higher buy price than you\'re actually paying.' },
        { q: 'Updating buy prices', a: 'Click ↑ Update next to any item to set the Hub buy price to the invoice average. This is the recommended way to keep buy prices accurate over time.' },
        { q: 'Manage History', a: 'Use the Manage History tab to fix item name mappings between invoice descriptions and Hub item names, and to correct Units/Pack values. Saving a row recalculates all historical per-unit prices automatically.' },
        { q: 'Spirits pricing', a: 'Spirit items are automatically converted from per-bottle invoice prices to per-nip prices using the bottle and nip sizes stored in the Hub. This makes the comparison to Hub buy prices (which are per nip) meaningful.' },
      ]
    },
    {
      icon: '📁',
      title: 'Documents',
      items: [
        { q: 'What is Documents?', a: 'The Documents tab tracks all purchase orders, receive reports and supplier invoices in one place. Every order placed through the Hub creates a record here.' },
        { q: 'Purchase Orders', a: 'When you click Mark as Ordered, a formatted Excel PO is saved automatically to OneDrive under POs Invoices and Receive Reports → Purchase Orders → {Supplier}.' },
        { q: 'Receive Reports', a: 'When you confirm a delivery, a receive report is saved to OneDrive under Receive Reports → {Supplier} and linked to the PO record.' },
        { q: 'Supplier Invoices', a: 'Attach a supplier invoice PDF in the receive modal before confirming. It is saved to OneDrive under Invoices → {Supplier} and linked to the PO record. The Hub also extracts the line item prices automatically for Price History.' },
        { q: 'OneDrive links', a: 'Each row in Documents shows direct links to view the PO, receive report and invoice in OneDrive. Click any link to open the document directly.' },
      ]
    },
    {
      icon: '📊',
      title: 'Sales Report',
      items: [
        { q: 'Opening', a: 'Click 📊 Sales Report in the Analytics group in the sidebar. Data is fetched live from Square\'s Orders API — allow a few seconds to load.' },
        { q: 'Period selector', a: 'Five periods available: This Month, Last Month, Last 3 Months, Financial Year (May 1 – Apr 30), and Custom Range. Each period automatically compares against the equivalent prior period.' },
        { q: 'Category breakdown', a: 'The category bar shows units and revenue per category. Click any tile to filter the item table to that category.' },
        { q: 'Excel export', a: 'Click 📊 Excel to download a formatted spreadsheet with category breakdown, % of total, change % and revenue columns.' },
      ]
    },
    {
      icon: '🏆',
      title: 'Best & Worst Sellers',
      items: [
        { q: 'Opening', a: 'Click 🏆 Best & Worst Sellers in the Analytics group. The report fetches 90 days of Orders API data from Square.' },
        { q: 'Top 10 Sellers', a: 'Ranked by weekly average, with a bar chart showing relative performance. Your most reliable, high-volume items.' },
        { q: 'Slow Sellers', a: 'The bottom 25% of items selling very slowly over the last 90 days. Useful for identifying items to reduce ordering on or consider dropping.' },
        { q: 'Not Selling', a: 'Items with stock on hand but zero sales in 90 days. Strong candidates for discontinuing or running down stock.' },
      ]
    },
    {
      icon: '📈',
      title: 'Quarterly Trends',
      items: [
        { q: 'Opening', a: 'Click 📈 Quarterly Trends in the Analytics group. Shows revenue, units and category performance across rolling quarters.' },
        { q: 'Stocktake export', a: 'Click 📊 Stocktake Export to download a formatted Excel spreadsheet of the trend data for the current financial year.' },
      ]
    },
    {
      icon: '📋',
      title: 'Stocktake',
      items: [
        { q: 'Opening', a: 'Click 📋 Stocktake in the Inventory group. Use this for quarterly physical stock counts.' },
        { q: 'Counting', a: 'Enter physical counts in the Cool Room, Store Room and Bar columns for each item. For spirits, enter bottle counts (including decimals for part bottles) — the sheet calculates nips automatically.' },
        { q: 'Excel export', a: 'Click 📊 Excel to download the stocktake sheet with formulas for totals and variance against Square. Freeze pane keeps the header visible while scrolling.' },
      ]
    },
    {
      icon: '📤',
      title: 'Other Exports',
      items: [
        { q: 'SOH Report (PDF)', a: 'In the Inventory group, click 📊 SOH Report → 🖨️ Print / PDF. Opens a formatted A4 Stock on Hand report in a new tab — all items by category with On Hand qty, weekly average, target stock, order status and supplier.' },
        { q: 'SOH Report (Excel)', a: 'Click 📊 Excel in the SOH Report modal. Downloads a formatted Excel spreadsheet with summary block, colour-coded category headers and per-item rows with status highlighted.' },
        { q: 'SOH History', a: 'Click 🗓️ SOH History in the Inventory group to see monthly snapshots. Snapshots are taken automatically at 2am AEST on the 1st of each month. Click 📊 Excel on any snapshot to download it.' },
        { q: 'Stocktake History', a: 'In the Stocktake tab, click 📅 History to view all previous stocktake records with a Summary and filterable Data sheet.' },
        { q: 'Barcode Sheet', a: 'In the Administration group, click 🖨️ Barcode Sheet to download a printable A4 sheet of Square barcodes for all items.' },
        { q: 'Notes & Wastage Print', a: 'In the Notes and Wastage Log tabs, click 🖨️ Print to export a formatted A4 table of the current filtered entries.' },
      ]
    },
    {
      icon: '⭐',
      title: 'Specials',
      items: [
        { q: 'Opening', a: 'Click ⭐ Specials in the Bar group in the sidebar. Manage tonight\'s special offers — add items with a name, price, optional description and a product image from the Square catalogue.' },
        { q: 'Adding a special', a: 'Click + Add Special, enter the name and price, optionally a description, then pick an image from your Square catalogue. Click Save to publish.' },
        { q: 'Display screen', a: 'Active specials rotate automatically on the bar tablet at /roster/display/specials — full-screen cards with product image, name and price on a dark background.' },
        { q: 'Print sheet', a: 'Click 🖨️ Print Sheet to open a formatted A4 printout of active specials.' },
      ]
    },
    {
      icon: '👥',
      title: 'Volunteer Roster',
      items: [
        { q: 'Opening', a: 'Click 👥 Roster in the Administration group. The roster opens at /roster — no separate app or login needed.' },
        { q: 'Bar display screen', a: 'The tablet display at /roster/display shows the current bar session, who is on duty, and sign-in status — updates live. The Specials display at /roster/display/specials rotates tonight\'s specials.' },
        { q: 'Duty manager', a: 'Duty managers can self-assign to a shift directly from the roster. Volunteers sign in via the bar display screen.' },
      ]
    },
    {
      icon: '⚙️',
      title: 'Settings & Administration',
      items: [
        { q: 'Settings panel', a: 'Click ⚙️ Settings in the sidebar (BMT access only). Manage suppliers, Square vendor name mappings, default target weeks, revenue target, and trigger a manual data backup.' },
        { q: 'Suppliers', a: 'Add or remove suppliers in the Settings panel. Assign items to suppliers by clicking the Supplier column inline in the Reorder Planner.' },
        { q: 'Square vendor names', a: 'Map each Hub supplier name to its Square vendor name — used to match invoices in Price History and filter Square reports.' },
        { q: 'Recent Changes audit', a: 'The Settings panel shows the last 30 setting changes — item name, field changed, old value, new value and date. Useful for tracking who changed what.' },
        { q: 'Data backup', a: 'All settings are automatically backed up to Supabase on every change. Use the Sync button in Settings to manually trigger a backup if needed.' },
        { q: 'Shared settings', a: 'All settings (categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks) are saved to the cloud and shared instantly across all management sessions.' },
        { q: 'Square POS connection', a: 'The app connects to Square via API. Stock levels, sales and prices update on every Refresh. Square is always the source of truth for transactions and price changes.' },
      ]
    },
    {
      icon: '👁',
      title: 'Access Levels',
      items: [
        { q: 'BMT PIN (management)', a: 'Full access to all features — editing item settings, categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks, price list visibility, wastage editing, and all exports.' },
        { q: 'Read-only PIN (homeowners)', a: 'View-only access. All data is visible — stock levels, order quantities, sales reports, trends, price list, SOH and sales exports — but nothing can be edited. A READ ONLY badge appears in the header.' },
        { q: 'Pricing visibility', a: 'Buy prices and the $ Pricing view are only visible to BMT members — hidden entirely for read-only users to keep cost prices confidential.' },
        { q: 'Settings', a: 'The ⚙️ Settings panel is only visible to BMT members — hidden in read-only mode.' },
      ]
    },
  ]
  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px 32px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, background: '#0f172a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍺</div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Paynter Bar Hub</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>GemLife Palmwoods — Bar Management System</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          This app manages bar operations for the Paynter Bar Management Team. It connects directly to Square POS to provide
          live stock levels, sales analytics, automated reorder calculations, seller performance reports and management reports — all in one place.
          Settings and changes made by any management team member are shared across all devices instantly.
        </p>
      </div>

      {/* Procedures document download */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0e7490 100%)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>📄 Stock Ordering & Inventory Procedures</div>
          <div style={{ fontSize: 12, color: '#bfdbfe', lineHeight: 1.6 }}>
            Complete procedures document — ordering, PO creation, invoice filing, goods receipt, History Report and wastage recording.
          </div>
        </div>
        <button
          onClick={() => window.open('/PaynterHubProcedures.pdf', '_blank')}
          style={{ background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          📄 View & Print Procedures
        </button>
      </div>

      {sections.map(section => (
        <div key={section.title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontSize: 18 }}>{section.icon}</span>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section.title}</h3>
          </div>
          <div>
            {section.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', borderBottom: idx < section.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ width: 220, minWidth: 220, padding: '11px 20px', borderRight: '1px solid #f1f5f9', background: '#fafafa' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{item.q}</span>
                </div>
                <div style={{ flex: 1, padding: '11px 20px' }}>
                  <span style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{item.a}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.8 }}>
          Paynter Bar Hub — Built for Paynter Bar Management Team, GemLife Palmwoods<br />
          Data source: Square POS · Settings stored in Vercel KV · Deployed on Vercel
        </p>
      </div>
    </div>
  )
}
