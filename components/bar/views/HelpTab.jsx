// HelpTab.jsx
import React from 'react'

export default function HelpTab() {
  const sections = [
    {
      icon: '🔐',
      title: 'Getting Started',
      items: [
        { q: 'Logging in', a: 'Enter your PIN on the login screen. The BMT PIN gives full access. The read-only PIN gives view-only access. Your session stays active until you close the browser tab.' },
        { q: 'Navigation', a: 'The sidebar organises features into groups — Stock, Analytics, Manage and Records. Dashboard, Reorder & Orders and Wastage Log are pinned at the top. Click any item to navigate directly.' },
        { q: 'Sales period', a: 'The 30d / 60d / 90d buttons set how many days of Square sales history are used to calculate weekly averages and order quantities. 90 days is the most stable; 30 days is more responsive to recent changes.' },
        { q: 'Refreshing data', a: 'Click Refresh from Square in the top-right header to pull the latest stock levels, prices and sales data from Square POS.' },
      ]
    },
    {
      icon: '🏠',
      title: 'Dashboard',
      items: [
        { q: 'Home screen', a: 'The Dashboard shows live stock status — Critical items, Low Stock count, items to order, items on order, and when Square data was last refreshed.' },
        { q: 'Status cards', a: 'The Critical, Low Stock and To Order cards are clickable — tap any of them to jump straight to the Reorder Planner filtered to those items.' },
        { q: 'Feature tiles', a: 'All major app features are accessible as clickable tiles from the Dashboard.' },
      ]
    },
    {
      icon: '📦',
      title: 'Reorder Planner',
      items: [
        { q: 'Reading the table', a: 'Each row shows current stock (On Hand), weekly average sales, target stock level and how much to order. Red = CRITICAL (≤2 weeks stock), yellow = LOW, green = OK.' },
        { q: 'Order Qty vs Bottles', a: 'For spirits and fortified wines, Order Qty shows nips needed and Bottles shows full bottles to buy (rounded up). For all other items, Order Qty shows units to order.' },
        { q: 'Target Weeks', a: 'The default target weeks is set in ⚙️ Settings. You can override it per item using the Target Wks column in Show Details mode. Default is 6 weeks.' },
        { q: 'Filtering to order items', a: 'Tick "Order items only" in the controls bar to hide items that don\'t need ordering — useful when preparing orders.' },
        { q: 'Supplier tabs', a: 'Click a supplier name to filter the table to just that supplier. When a supplier is selected, 📋 Order Sheet and ✓ Mark as Ordered buttons appear in the toolbar.' },
        { q: 'Order Sheet', a: 'Select a supplier tab then click 📋 Order Sheet to open a formatted printable order list for that supplier. Use the Print this sheet button on the page.' },
        { q: 'Mark as Ordered', a: 'Select a supplier tab then click ✓ Mark as Ordered to record that an order has been placed. Enter a PO reference number — this links the order to its receive report and invoice in Documents.' },
        { q: 'Receiving an order', a: 'When stock arrives, click the Receive banner that appears for the pending order. Enter the quantities received and optionally attach the supplier invoice PDF. Square inventory updates automatically on confirm.' },
        { q: 'Editing item settings', a: 'Click any value in the Category, Supplier, Pack, Bottle Size or Nip Size columns to edit inline. Changes save automatically and are shared with all BMT members.' },
        { q: 'Rundown items', a: 'Tick the Rundown checkbox on any item to flag it as being run down — it will be excluded from order calculations and the average markup in the pricing export.' },
        { q: 'Missing buy prices', a: 'A red ⚠️ warning appears in the toolbar if any items are missing a buy price. Click it to jump to the Pricing tab.' },
        { q: 'Adding or removing suppliers', a: 'Suppliers are managed in ⚙️ Settings. Add or remove suppliers there, and assign items to suppliers by clicking the Supplier column inline.' },
      ]
    },
    {
      icon: '🥃',
      title: 'Spirits & Fortified Wines',
      items: [
        { q: 'How spirits are tracked', a: 'Square tracks spirits in nips (30ml standard; 60ml for Baileys, Galway Pipe Port and Penfolds Club Port). All calculations — weekly average, target stock, order quantities — stay in nips throughout.' },
        { q: 'Bottle Size column', a: 'Set to 700ml, 750ml or 1000ml per item. Determines how many nips per bottle (e.g. 700ml ÷ 30ml = 23.3 nips). Affects order quantities and stocktake calculations.' },
        { q: 'Nip Size column', a: 'Most spirits are 30ml. Baileys Irish Cream, Galway Pipe Port and Penfolds Club Port are served as 60ml nips. Must be set correctly for accurate order quantities.' },
        { q: 'Order quantities', a: 'Shows nips needed to reach target stock. Bottles column shows full bottles to buy (always rounded up). Example: need 70 nips from a 700ml bottle → Order Qty 70 nips, Bottles 3.' },
      ]
    },
    {
      icon: '💲',
      title: 'Pricing',
      items: [
        { q: 'Opening Pricing', a: 'Click 💲 Pricing in the sidebar under Manage. It has two sub-tabs: Average Prices and Markup / Sell Prices.' },
        { q: 'Average Prices tab', a: 'Shows the weighted average buy price per item calculated from your actual supplier invoices over the last 90 days. Compare against the current Hub buy price — red means the Hub price is higher than you\'re actually paying.' },
        { q: 'Loading the report', a: 'Click 📊 Load Report to fetch the data, or click one of the supplier buttons (Dan Murphy\'s, Coles Woolies, ACW) to open a detailed price review modal for that supplier.' },
        { q: 'Updating buy prices', a: 'Click ↑ Update next to any item to set the Hub buy price to the 90-day average. Click ↑ Update All Buy Prices to update all matched items at once. This is the recommended way to keep buy prices accurate.' },
        { q: 'Markup / Sell Prices tab', a: 'Click $ Open Pricing View to open the Reorder Planner in Pricing mode, which reveals Buy Price, Sell Price and Markup % columns for all items. Also has Print and Excel export buttons.' },
        { q: 'Markup calculation', a: 'Markup % = (Sell − Buy) ÷ Buy × 100. Green = 40%+, amber = 25–40%, red = below 25%. Requires both buy and sell price to be set.' },
        { q: 'Sell prices from Square', a: 'Sell prices are pulled directly from your Square catalogue. All price changes must be made in Square — the Hub always reflects current Square prices.' },
        { q: 'Buy prices', a: 'Click the Buy Price cell for any item in Pricing view and type the cost price (inc GST). Saved to the cloud and shared across all management sessions.' },
      ]
    },
    {
      icon: '📄',
      title: 'Price History',
      items: [
        { q: 'What is Price History?', a: 'Price History records the actual buy prices from supplier invoices over time. It lives under Records → Price History and has two sub-tabs: Import Invoice and Manage History.' },
        { q: 'Importing invoices', a: 'Go to Price History → Import Invoice tab. Select one or more supplier PDF invoices. Claude AI automatically extracts all line items and prices. Review the extracted items, adjust Hub Name and Units/Pack if needed, then click Save to History.' },
        { q: 'Automatic import on receive', a: 'When you attach a supplier invoice PDF in the receive modal and confirm a delivery, the Hub automatically extracts and saves the line items to Price History in the background — no manual import needed.' },
        { q: 'Manage History tab', a: 'Use the Manage History tab to fix item name mappings between invoice descriptions and Hub item names, and to correct Units/Pack values. Saving a row recalculates all historical per-unit prices automatically.' },
        { q: 'Spirits pricing', a: 'Spirit items are automatically converted from per-bottle invoice prices to per-nip prices using the bottle and nip sizes stored in the Hub, so the comparison to Hub buy prices (which are per nip) is meaningful.' },
      ]
    },
    {
      icon: '📁',
      title: 'Documents',
      items: [
        { q: 'What is Documents?', a: 'PO Documents (under Records) tracks all purchase orders, receive reports and supplier invoices in one place. Every order placed through the Hub creates a record here.' },
        { q: 'Purchase Orders', a: 'When you click Mark as Ordered, a formatted Excel PO is saved automatically to OneDrive under POs Invoices and Receive Reports → Purchase Orders → {Supplier}.' },
        { q: 'Receive Reports', a: 'When you confirm a delivery, a receive report is saved to OneDrive under Receive Reports → {Supplier} and linked to the PO record.' },
        { q: 'Supplier Invoices', a: 'Attach a supplier invoice PDF in the receive modal before confirming. It is saved to OneDrive under Invoices → {Supplier} and linked to the PO record. The Hub also extracts the line item prices automatically for Price History.' },
        { q: 'Email Treasurer', a: 'After a delivery is received, click 📧 Email Treasurer on any row in Documents. This sends an email to treasurer@gemwoods.com.au from paynterbar@gemwoods.com.au with the receive report and invoice attached (sourced from OneDrive). A ✅ Sent indicator confirms the email was delivered.' },
        { q: 'OneDrive links', a: 'Each row in Documents shows direct links to view the PO, receive report and invoice in OneDrive. Click any link to open the document directly.' },
      ]
    },
    {
      icon: '🗓️',
      title: 'SOH History',
      items: [
        { q: 'What is SOH History?', a: 'SOH History (under Stock) shows monthly stock-on-hand snapshots. Snapshots are taken automatically at 2am AEST on the 1st of each month.' },
        { q: 'Manual snapshot', a: 'Click 📸 Snapshot Now to generate a snapshot immediately — useful before a stocktake or at end of financial year.' },
        { q: 'Exporting a snapshot', a: 'Click 📊 Excel on any row to download a formatted Excel spreadsheet for that snapshot, with category groupings and per-item buy prices and total values.' },
        { q: 'Current SOH export', a: 'Click 🖨️ Print / PDF or 📊 Export Excel in the header to export the current live SOH (not a saved snapshot) — this calls the same report as the old SOH Report button.' },
        { q: 'Deleting a snapshot', a: 'Click 🗑️ on any row to permanently delete that snapshot. A confirmation prompt appears first.' },
      ]
    },
    {
      icon: '📊',
      title: 'Sales Report',
      items: [
        { q: 'Opening', a: 'Click 📊 Sales Report under Analytics in the sidebar. Data is fetched live from Square\'s Orders API — allow a few seconds to load.' },
        { q: 'Period selector', a: 'Five periods available: This Month, Last Month, Last 3 Months, Financial Year (May 1 – Apr 30), and Custom Range. Each period automatically compares against the equivalent prior period.' },
        { q: 'Category breakdown', a: 'The category bar shows units and revenue per category. Click any tile to filter the item table to that category.' },
        { q: 'Excel export', a: 'Click 📊 Excel to download a formatted spreadsheet with category breakdown, % of total, change % and revenue columns.' },
      ]
    },
    {
      icon: '📋',
      title: 'Stocktake',
      items: [
        { q: 'Opening', a: 'Click 📋 Stocktake under Stock in the sidebar. Use this for quarterly physical stock counts.' },
        { q: 'Counting', a: 'Enter physical counts in the Cool Room, Store Room and Bar columns for each item. For spirits, enter bottle counts (including decimals for part bottles) — the sheet calculates nips automatically.' },
        { q: 'Excel export', a: 'Click 📊 Excel to download the stocktake sheet with formulas for totals and variance against Square. Freeze pane keeps the header visible while scrolling.' },
      ]
    },
    {
      icon: '⭐',
      title: 'Specials',
      items: [
        { q: 'Opening', a: 'Click ⭐ Specials under Manage in the sidebar. Manage tonight\'s special offers — add items with a name, price, optional description and a product image from the Square catalogue.' },
        { q: 'Adding a special', a: 'Click + Add Special, enter the name and price, optionally a description, then pick an image from your Square catalogue. Click Save to publish.' },
        { q: 'Display screen', a: 'Active specials rotate automatically on the bar tablet at /roster/display/specials — full-screen cards with product image, name and price on a dark background.' },
        { q: 'Print sheet', a: 'Click 🖨️ Print Sheet to open a formatted A4 printout of active specials.' },
      ]
    },
    {
      icon: '🏷️',
      title: 'Price List',
      items: [
        { q: 'Opening', a: 'Click 🏷️ Price List under Manage. Shows a formatted customer-facing price list drawn from your Square catalogue.' },
        { q: 'Visibility', a: 'Individual items can be hidden from the public price list by toggling visibility in the Price List view. Hidden items still appear in the Reorder Planner.' },
        { q: 'Printing', a: 'Click 🖨️ Print to open a formatted A4 price list suitable for posting at the bar.' },
      ]
    },
    {
      icon: '👥',
      title: 'Volunteer Roster',
      items: [
        { q: 'Opening', a: 'Click 👥 Roster under Records. The roster opens at /roster — no separate app or login needed.' },
        { q: 'Bar display screen', a: 'The tablet display at /roster/display shows the current bar session, who is on duty and sign-in status — updates live. The Specials display at /roster/display/specials rotates tonight\'s specials.' },
        { q: 'Duty manager', a: 'Duty managers can self-assign to a shift directly from the roster. Volunteers sign in via the bar display screen.' },
      ]
    },
    {
      icon: '🖨️',
      title: 'Other Exports',
      items: [
        { q: 'Barcode Sheet', a: 'Click 🖨️ Barcode Sheet under Records to download a printable A4 sheet of Square barcodes for all items.' },
        { q: 'Wastage Print', a: 'In the Wastage Log, click 🖨️ Print to export a formatted A4 table of the current filtered entries.' },
        { q: 'Stocktake History', a: 'In the Stocktake tab, click 📅 History to view all previous stocktake records with a Summary and filterable Data sheet.' },
      ]
    },
    {
      icon: '⚙️',
      title: 'Settings & Administration',
      items: [
        { q: 'Settings panel', a: 'Click ⚙️ Settings in the sidebar (BMT access only). Manage suppliers, Square vendor name mappings, default target weeks, revenue target, and app PIN management.' },
        { q: 'Suppliers', a: 'Add or remove suppliers in the Settings panel. Assign items to suppliers by clicking the Supplier column inline in the Reorder Planner.' },
        { q: 'Square vendor names', a: 'Map each Hub supplier name to its Square vendor name — used to match invoices in Price History and filter Square reports.' },
        { q: 'Recent Changes audit', a: 'The Settings panel shows the last 30 setting changes — item name, field changed, old value, new value and date. Useful for tracking who changed what.' },
        { q: 'Shared settings', a: 'All settings (categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks) are saved to the cloud and shared instantly across all management sessions.' },
        { q: 'Square POS connection', a: 'The app connects to Square via API. Stock levels, sales and prices update on every Refresh. Square is always the source of truth for transactions and price changes.' },
      ]
    },
    {
      icon: '👁',
      title: 'Access Levels',
      items: [
        { q: 'BMT PIN (management)', a: 'Full access to all features — editing item settings, categories, suppliers, pack sizes, bottle/nip sizes, buy prices, notes, target weeks, price list visibility, wastage editing, and all exports.' },
        { q: 'Read-only PIN (homeowners)', a: 'View-only access. All data is visible — stock levels, order quantities, sales reports, price list, SOH and sales exports — but nothing can be edited. A READ ONLY badge appears in the header.' },
        { q: 'Pricing visibility', a: 'Buy prices and the 💲 Pricing tab are only visible to BMT members — hidden entirely in read-only mode to keep cost prices confidential.' },
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
          live stock levels, reorder calculations, sales analytics, pricing tools and management reports — all in one place.
          Settings and changes made by any management team member are shared across all devices instantly.
        </p>
      </div>

      {/* Procedures document */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0e7490 100%)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>📄 Stock Ordering & Inventory Procedures</div>
          <div style={{ fontSize: 12, color: '#bfdbfe', lineHeight: 1.6 }}>
            Complete procedures document — ordering, PO creation, invoice filing, goods receipt and wastage recording.
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
          Data source: Square POS · Settings stored in Supabase · Deployed on Vercel
        </p>
      </div>
    </div>
  )
}
