// HelpTab.jsx
import React, { useState } from 'react'

const STEP = ({ n, title, children }) => (
  <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e3a5f', color: '#fff', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.7 }}>{children}</div>
    </div>
  </div>
)

const Note = ({ children, type = 'info' }) => {
  const colors = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: '💡' },
    warn:    { bg: '#fffbeb', border: '#fde68a', color: '#d97706', icon: '⚠️' },
    success: { bg: '#f0fdf4', border: '#86efac', color: '#166534', icon: '✅' },
  }
  const c = colors[type]
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: '8px 12px', marginTop: 8, fontSize: 12, color: c.color, lineHeight: 1.6 }}>
      {c.icon} {children}
    </div>
  )
}

export default function HelpTab() {
  const [open, setOpen] = useState(null)

  const sections = [
    {
      icon: '🛒',
      title: 'Weekly Ordering — Full Workflow',
      highlight: true,
      content: (
        <div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 18, lineHeight: 1.7 }}>
            The ordering workflow runs entirely through the Order Wizard. Follow these steps each week when stock needs replenishing.
          </p>

          <STEP n="1" title="Check what needs ordering — Dashboard">
            The Dashboard shows <strong>To Order</strong> (items below target) and <strong>Critical</strong> (≤2 weeks stock). The <strong>📋 Start Weekly Order</strong> button appears when items need ordering.
          </STEP>

          <STEP n="2" title="Launch the Order Wizard">
            Click <strong>📋 Start Weekly Order</strong> on the Dashboard. The wizard opens full-screen.
            <Note>You can also launch the wizard from Stock Items — select a supplier tab and any items already on order will be automatically excluded.</Note>
          </STEP>

          <STEP n="3" title="Step 1 — Select supplier and review quantities">
            Choose the supplier from the dropdown. The wizard shows all items for that supplier that need ordering with suggested quantities pre-filled.<br /><br />
            <strong>Adjust quantities</strong> if needed — set to 0 to remove an item. For spirits, quantities are in <strong>nips</strong> (the bottle count shown alongside is for reference).<br /><br />
            Use <strong>+ Add item not flagged for ordering</strong> at the bottom to include any item not at its threshold. For spirits, enter bottles — the wizard converts to nips automatically.
          </STEP>

          <STEP n="4" title="Step 2 — Place the order with the supplier then confirm quantities">
            Open the supplier website (Dan Murphy's, Coles, etc.) and place the order using the quantities shown.<br /><br />
            <strong>Update the quantities in Step 2</strong> to match what you actually ordered — some items may be out of stock or available in different quantities. Set any unavailable item to 0 to remove it.<br /><br />
            Items showing in <strong>amber</strong> differ from the suggestion. Items set to <strong>0 show with strikethrough</strong> — they will be excluded from the PO.
            <Note type="warn">Always update Step 2 to match exactly what was ordered before proceeding — this is what gets recorded on the PO document.</Note>
          </STEP>

          <STEP n="5" title="Step 3 — Record the PO reference number">
            Enter the order or confirmation number from the supplier (e.g. DAN-PO-001-06Jun). This links the order to the receive report and invoice.<br /><br />
            Click <strong>✓ Mark as Ordered & Save PO</strong>. The Hub:
            <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 2 }}>
              <li>Records the order in the on-order list</li>
              <li>Creates a formatted Excel PO document</li>
              <li>Saves the PO to OneDrive automatically</li>
              <li>Creates a record in PO Documents</li>
            </ul>
          </STEP>

          <STEP n="6" title="Managing an existing order">
            Once placed, open the <strong>View Order</strong> modal from the Dashboard on-order banner, the On Order stat card on the Dashboard, or the On Order count in the Stock Items toolbar. From here you can:
            <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 2 }}>
              <li>Edit individual item quantities</li>
              <li><strong>Add forgotten items</strong> using the + Add item to this order section at the bottom (spirits enter quantity in bottles, converts to nips automatically)</li>
              <li>Remove items with 🗑 Remove</li>
              <li>Delete the whole order with 🗑 Delete Whole Order</li>
              <li>Click <strong>📋 Delivery List</strong> to print a checklist showing ordered quantities in nips and bottles</li>
            </ul>
            <Note>The delivery checklist has a ✕ Close button to return to the app — useful on iPad where closing a new tab isn't obvious.</Note>
          </STEP>

          <Note type="success">
            The Dashboard on-order banner shows all pending orders. Tap <strong>View</strong> to manage, <strong>📋 Delivery List</strong> to print a checklist, or <strong>✓ Receive</strong> when the delivery arrives.
          </Note>
        </div>
      )
    },
    {
      icon: '📦',
      title: 'Receiving a Delivery',
      highlight: true,
      content: (
        <div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 18, lineHeight: 1.7 }}>
            When stock arrives, receive it through the Hub so Square inventory updates automatically and all documents are filed.
          </p>

          <STEP n="1" title="Open the Receive modal">
            On the Dashboard, click <strong>✓ Receive</strong> on the on-order banner for the relevant supplier. You can also click <strong>View</strong> → <strong>Receive This Order</strong> from the View Order modal.
          </STEP>

          <STEP n="2" title="Check items and enter quantities received">
            All ordered items appear with their ordered quantities pre-filled.<br /><br />
            Use <strong>✓ All Full</strong> if everything arrived as ordered, or <strong>½ All Partial</strong> as a starting point for a partial delivery.<br /><br />
            <strong>Uncheck any items</strong> that did not arrive — they stay on order and you can receive them later. Adjust quantities for items that arrived short.
          </STEP>

          <STEP n="3" title="Attach the supplier invoice">
            Click <strong>📎 Attach Supplier Invoice</strong> and select the PDF from your device. This is needed to:
            <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 2 }}>
              <li>Include as an attachment in the treasurer email</li>
              <li>Automatically extract line item prices into Price History</li>
            </ul>
            <Note type="warn">Without an invoice attached, the treasurer email will be sent without an attachment and buy prices won't update from this delivery.</Note>
            <Note>The invoice uploads to OneDrive <strong>as soon as you select the file</strong> — you'll see ✓ saved to OneDrive appear. You don't need to wait until you click Confirm Delivery.</Note>
          </STEP>

          <STEP n="4" title="Confirm the delivery">
            Click <strong>✓ Confirm Delivery</strong>. The Hub automatically:
            <ul style={{ marginTop: 6, paddingLeft: 18, lineHeight: 2 }}>
              <li>Updates Square inventory for all received items</li>
              <li>Saves a receive report (CSV) to OneDrive</li>
              <li>Saves the invoice to OneDrive (if attached)</li>
              <li>Extracts invoice line item prices to Price History</li>
              <li>Updates the PO Documents record to Received</li>
              <li>Removes items from the on-order list</li>
            </ul>
            <Note type="success">If Square inventory update fails, it can be retried — the receive report and invoice are already saved.</Note>
          </STEP>

          <STEP n="5" title="Download the receipt (if needed)">
            The receipt modal shows what was received. If OneDrive is connected, the report is already saved automatically. Use <strong>📥 Download locally</strong> only if OneDrive was unavailable.
          </STEP>
        </div>
      )
    },
    {
      icon: '📧',
      title: 'Emailing the Treasurer',
      highlight: true,
      content: (
        <div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 18, lineHeight: 1.7 }}>
            After each delivery is received and the invoice is attached, email the Treasurer from PO Documents.
          </p>

          <STEP n="1" title="Go to PO Documents">
            Click <strong>📁 PO Documents</strong> under Records in the sidebar. Find the received delivery — it will show ✓ Received status.
          </STEP>

          <STEP n="2" title="Check the invoice is attached">
            Confirm the ☁️ OneDrive and/or 🗄️ Supabase invoice links are showing on the card. If the ⚠️ "Invoice not on OneDrive" warning appears, the attachment may be missing — upload it first using 📎 Upload Invoice.
            <Note type="warn">If no invoice is attached, the email sends without an attachment. You'll be warned before sending.</Note>
          </STEP>

          <STEP n="3" title="Click 📧 Email Treasurer">
            Click the button on the received delivery card. The Hub sends an email from <strong>paynterbar@gemwoods.com.au</strong> to <strong>treasurer@gemwoods.com.au</strong> with the receive report and invoice attached.<br /><br />
            On success the button changes to <strong>✅ Treasurer notified</strong> with the date and time. A <strong>🔁 Resend</strong> option is available if needed.
          </STEP>

          <Note>The receive report is saved as a CSV (Excel-compatible). The invoice is the original PDF you attached during receive. Both are sourced from OneDrive — make sure OneDrive is connected in Settings → App Access.</Note>
        </div>
      )
    },
    {
      icon: '📁',
      title: 'PO Documents',
      content: (
        <div>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.7 }}>
            Every order placed through the Hub creates a record in PO Documents. Use the search and filter bar to find specific orders by PO ref, supplier or status.
          </p>
          {[
            ['PO link ☁️', 'Opens the formatted Excel PO document on OneDrive. Created automatically when the order is placed.'],
            ['Receipt link 📄', 'Opens the receive report CSV on OneDrive. Created automatically when the delivery is confirmed.'],
            ['Invoice link 📎', 'Opens the invoice PDF. Attach in the receive modal or via 📎 Upload Invoice on the card.'],
            ['✕ Remove invoice', 'Removes the invoice link from this record (file on OneDrive is not deleted). Use if the wrong invoice was attached — then upload the correct one using 📎 Upload Invoice.'],
            ['Filter bar', 'Search by PO ref, filter by supplier or filter by status (Ordered / Received). A ✕ Clear button appears when any filter is active.'],
            ['🗑 Delete', 'Deletes the PO record. Only possible for Ordered status records — received records are permanent for audit purposes.'],
          ].map(([q, a]) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '🔐',
      title: 'Getting Started',
      content: (
        <div>
          {[
            ['Logging in', 'Enter your PIN on the login screen. The BMT PIN gives full access. The read-only PIN gives view-only access (stock levels and sales visible, no editing). Your session stays active until you close the browser tab.'],
            ['Navigation', 'The sidebar organises features into groups — Stock, Analytics, Manage and Records. Use the hamburger menu on tablets. Tap the sidebar icon to collapse it on desktop.'],
            ['Sales period', 'The 30d / 60d / 90d buttons set how many days of Square sales history are used to calculate weekly averages and order quantities. 60 days is the default — a good balance between stability and responsiveness.'],
            ['Refreshing data', 'Click Refresh from Square in the top-right header to pull the latest stock levels, prices and sales from Square POS.'],
            ['OneDrive connection', 'Go to ⚙️ Settings → App Access → Check Status to verify OneDrive is connected. Must be authenticated as paynterbar@gemwoods.com.au. Click Reconnect OneDrive if it shows ❌ Not connected.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '📦',
      title: 'Stock Items',
      content: (
        <div>
          {[
            ['Reading the table', 'Each row shows current stock (On Hand), weekly average sales, target stock level and how much to order. Red = CRITICAL (≤2 weeks stock), yellow = LOW, green = OK.'],
            ['Show Details', 'Click ▸ Show Details to reveal Category, Wkly Avg, Target, Min Stock, Pack, Bottle Size, Nip Size, Order Qty and Bottles columns. Hidden by default to keep the view clean.'],
            ['Supplier tabs', 'Click a supplier name to filter the table to just that supplier.'],
            ['Pricing view', 'Click 💲 Pricing to switch to pricing mode — shows Buy Price, Sell Price and Markup % for all items. Export to Excel from here.'],
            ['Editing inline', 'Click any value in the Category, Supplier, Pack, Bottle Size or Nip Size columns to edit inline. Changes save automatically and order quantities recalculate immediately.'],
            ['Min Stock', 'Type a value in the Min Stock column (visible under Show Details) to set a minimum stock floor. The order quantity will always be enough to reach this level, even if the calculated target is lower. Leave blank to use the calculated target only.'],
            ['Rundown items', 'Tick the Rundown checkbox on any item to flag it for running down — excluded from order calculations and pricing exports.'],
            ['Order Again', 'Items that are on order are hidden from the main list. Click + Order Again on any on-order item to bring it back into view if you need to order more.'],
            ['On Order stat', 'Click the On Order number in the toolbar to open the View Order modal directly — no need to go back to the Dashboard.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '🥃',
      title: 'Spirits & Fortified Wines',
      content: (
        <div>
          {[
            ['How spirits are tracked', 'Square tracks spirits in nips. All calculations — weekly average, target stock, order quantities — stay in nips throughout. Buy prices are stored per nip inc GST.'],
            ['Bottle Size', 'Set to 700ml, 750ml or 1000ml per item. Determines nips per bottle (e.g. 1000ml ÷ 30ml = 33 nips). Affects order quantities and buy price calculations.'],
            ['Nip Size', 'Most spirits are 30ml. Baileys, Galway Pipe Port and Penfolds Club Port are served as 60ml nips. Must be set correctly for accurate ordering.'],
            ['Order quantities', 'Order Qty shows nips needed. Bottles shows full bottles to buy. Smart rounding: if the calculated bottles is within 5% of a whole number, it rounds down (e.g. 2.01 → 2 bottles).'],
            ['Buy prices', 'Spirit buy prices are stored per nip inc GST. When Update Buy Prices runs, it converts the per-bottle invoice price to per-nip automatically using the Bottle Size and Nip Size settings.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '💲',
      title: 'Pricing',
      content: (
        <div>
          {[
            ['Average Prices tab', 'Shows the 90-day weighted average buy price per item from actual invoices. Compare against current Hub buy price — use ↑ Update All Buy Prices to sync them.'],
            ['Markup calculation', 'Markup % = (Sell − Buy) ÷ Buy × 100. Green = 40%+, amber = 25–40%, red = below 25%. For wines, glass markup uses 5 glasses per bottle.'],
            ['Sell prices', 'All sell prices come directly from Square. Changes must be made in Square — the Hub reflects current Square prices on every Refresh.'],
            ['Below 40% Report', 'Click 🚨 Below 40% Report to export an Excel list of all items below the 40% markup target, with suggested sell prices. Wines show both glass and bottle markup separately.'],
            ['Avg Price Report', 'Click 📥 Avg Price Report for a full Excel export of all items with average buy prices, current Hub prices, markup % and suggested sell prices.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '📄',
      title: 'Price History',
      content: (
        <div>
          {[
            ['What is Price History?', 'Records actual buy prices from supplier invoices over time. Lives under Records → Price History. Two sub-tabs: Import Invoice and Manage History.'],
            ['Automatic import', 'When you attach a PDF invoice in the receive modal and confirm a delivery, price history is updated automatically in the background — no manual import needed.'],
            ['Manual import', 'Go to Price History → Import Invoice. Select one or more supplier PDFs. Claude AI extracts line items — review, check Hub Name matches (green ✓ = matched, red ✗ = fix the name), then Save to History.'],
            ['Manage History tab', 'Fix item name mappings and Units/Pack values. Saving recalculates all historical per-unit prices.'],
            ['GST handling', 'Dan Murphy\'s and Coles/Woolies invoice prices include GST — the Hub divides by 1.10 automatically when saving. ACW invoices are typically ex GST.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '📊',
      title: 'Sales Report',
      content: (
        <div>
          {[
            ['Opening', 'Click 📊 Sales Report under Analytics. Data is fetched live from Square — allow a few seconds.'],
            ['Period selector', 'This Month, Last Month, Last 3 Months, Financial Year (May–Apr), Single Day or Custom Range.'],
            ['Category filter', 'Click any category pill to filter the item table to that category. Click again to clear.'],
            ['Comparison columns', 'Prior Period, Change % and Prior Revenue are hidden by default. Click ▸ Show comparison to reveal them.'],
            ['Export', 'Click 📊 Excel for a formatted spreadsheet with category breakdown and revenue columns.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '⚙️',
      title: 'Settings & Administration',
      content: (
        <div>
          {[
            ['Suppliers tab', 'Add or remove suppliers. Assign items to suppliers by clicking the Supplier column inline in Stock Items.'],
            ['Square Mappings tab', 'Map each Hub supplier name to its Square vendor name — used to match invoices in Price History.'],
            ['Reorder Defaults tab', 'Set the default target weeks and manually sync data from Redis to Supabase backup.'],
            ['App Access tab', 'Check OneDrive connection status, reconnect OneDrive (must be paynterbar@gemwoods.com.au), change BMT PIN and Read-Only PIN, view recent settings changes audit log.'],
            ['Shared settings', 'All settings are saved to the cloud and shared instantly across all management sessions.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
    {
      icon: '👁',
      title: 'Access Levels',
      content: (
        <div>
          {[
            ['BMT PIN (management)', 'Full access — edit item settings, categories, suppliers, buy prices, notes, price list visibility, wastage, all exports and Settings.'],
            ['Read-only PIN (homeowners)', 'View-only. All data visible — stock levels, order quantities, sales reports, price list, SOH — but nothing can be edited. Buy prices and Pricing tab are hidden. READ ONLY badge appears in header.'],
          ].map(([q, a], i, arr) => (
            <div key={q} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: 160, minWidth: 160, fontSize: 12, fontWeight: 600, color: '#374151' }}>{q}</div>
              <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65 }}>{a}</div>
            </div>
          ))}
        </div>
      )
    },
  ]

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, background: '#0f172a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🍺</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Paynter Bar Hub</h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>GemLife Palmwoods — Bar Management System</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
          Manages bar operations for the Paynter Bar Management Team. Connects to Square POS for live stock, reorder calculations, sales analytics, pricing tools and management reports. Changes made by any BMT member are shared across all devices instantly.
        </p>
      </div>

      {/* Procedures doc */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0e7490 100%)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>📄 Stock Ordering & Inventory Procedures</div>
          <div style={{ fontSize: 12, color: '#bfdbfe' }}>Complete procedures — ordering, PO creation, invoice filing, goods receipt and wastage recording.</div>
        </div>
        <button onClick={() => window.open('/PaynterHubProcedures.pdf', '_blank')}
          style={{ background: '#fff', color: '#1e3a5f', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          📄 View & Print Procedures
        </button>
      </div>

      {/* Sections */}
      {sections.map(section => (
        <div key={section.title} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${section.highlight ? '#bfdbfe' : '#e2e8f0'}`, marginBottom: 12, overflow: 'hidden' }}>
          <button onClick={() => setOpen(open === section.title ? null : section.title)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: open === section.title ? '1px solid #e2e8f0' : 'none', background: section.highlight ? '#eff6ff' : '#f8fafc', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 18 }}>{section.icon}</span>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: section.highlight ? '#1d4ed8' : '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{section.title}</h3>
            {section.highlight && <span style={{ fontSize: 10, fontWeight: 700, background: '#1d4ed8', color: '#fff', padding: '2px 7px', borderRadius: 3 }}>KEY WORKFLOW</span>}
            <span style={{ fontSize: 16, color: '#94a3b8' }}>{open === section.title ? '▾' : '▸'}</span>
          </button>
          {open === section.title && (
            <div style={{ padding: '20px 24px' }}>
              {section.content}
            </div>
          )}
        </div>
      ))}

      <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 20px', textAlign: 'center', marginTop: 8 }}>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.8 }}>
          Paynter Bar Hub — Built for Paynter Bar Management Team, GemLife Palmwoods<br />
          Square POS · Supabase · OneDrive · Vercel
        </p>
      </div>
    </div>
  )
}