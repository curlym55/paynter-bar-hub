// WastageView.jsx — extracted from pages/index.js
import React, { useState, useEffect } from 'react'
import { styles } from '../../../lib/barStyles'

export default function WastageView({ items, log, readOnly, onRefresh }) {
  useEffect(() => { onRefresh().catch(() => {}) }, [])
  const REASONS = ['Breakage', 'Spoilage', 'Expired', 'Other']
  const SPIRIT_CATS = ['Spirits', 'Fortified & Liqueurs']
  const WINE_CATS   = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']
  const REASON_COLOR = {
    Breakage: { bg: '#fee2e2', text: '#dc2626' },
    Spoilage: { bg: '#fef9c3', text: '#ca8a04' },
    Expired:  { bg: '#ffedd5', text: '#ea580c' },
    Other:    { bg: '#f1f5f9', text: '#475569' },
  }

  // Unit options keyed by category group
  function getUnitOptions(item) {
    if (!item) return ['units']
    if (['Spirits', 'Fortified & Liqueurs'].includes(item.category)) return ['nips', 'bottles']
    if (['White Wine', 'Red Wine', 'Rose', 'Sparkling'].includes(item.category)) return ['glasses', 'bottles']
    return ['units']
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
  const [form, setForm]       = useState({ itemName: '', qty: '', unit: 'units', reason: 'Breakage', note: '', recordedBy: '', date: today })
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})

  const [refreshError, setRefreshError] = useState(null)

  async function refresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await onRefresh()
    } catch(e) {
      setRefreshError(e.message || 'Failed to load')
    }
    setRefreshing(false)
  }
  // Sync state
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncPreview, setSyncPreview]     = useState(null)
  const [syncLoading, setSyncLoading]     = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [syncResult, setSyncResult]       = useState(null)

  const unsyncedCount = log.filter(e => !e.squareSynced).length

  async function loadSyncPreview() {
    setSyncLoading(true)
    setSyncResult(null)
    setSyncPreview(null)
    try {
      const r = await fetch('/api/wastage-sync')
      if (!r.ok) throw new Error((await r.json()).error || 'Failed')
      const d = await r.json()
      setSyncPreview(d)
    } catch(e) { setSyncPreview({ error: e.message }) }
    finally { setSyncLoading(false) }
  }

  async function executeSync(entryIds) {
    setSyncing(true)
    try {
      const r = await fetch('/api/wastage-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds })
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Sync failed')
      const d = await r.json()
      setSyncResult(d)
      await onRefresh()
      // Only reload preview if all succeeded — on failure keep result visible for debugging
      if (d.ok) loadSyncPreview()
    } catch(e) { setSyncResult({ ok: false, error: e.message }) }
    finally { setSyncing(false) }
  }

  const filtered = log.filter(e => {
    if (filter !== 'All' && e.reason !== filter) return false
    if (dateFrom && new Date(e.date) < new Date(dateFrom + 'T00:00:00+10:00')) return false
    if (dateTo   && new Date(e.date) > new Date(dateTo   + 'T23:59:59+10:00')) return false
    return true
  })

  // Summary by reason
  const summary = REASONS.map(r => ({
    reason: r,
    count: log.filter(e => e.reason === r).length,
    ...REASON_COLOR[r]
  }))

  async function submit() {
    if (!form.itemName || !form.qty) return alert('Please select an item and enter a quantity')
    setSaving(true)
    try {
      const selected = items.find(i => i.name === form.itemName)
      const r = await fetch('/api/wastage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, category: selected?.category || '', date: form.date ? new Date(form.date + 'T12:00:00+10:00').getTime() : Date.now() })
      })
      if (!r.ok) throw new Error((await r.json()).error)
      await onRefresh()
      setForm({ itemName: '', qty: '', unit: 'units', reason: 'Breakage', note: '', recordedBy: '', date: today })
      setShowForm(false)
    } catch(e) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  async function deleteEntry(id) {
    const entry = log.find(e => e.id === id)
    if (!entry) return
    if (entry.squareSynced) {
      // This entry already reduced Square's stock. Deleting won't restore it.
      const ok = confirm(
        'This entry was already synced to Square.\n\n' +
        'Deleting it here will NOT add the stock back in Square — the Hub and Square would no longer match.\n\n' +
        'Only continue if you have ALREADY corrected the stock in Square (e.g. via a stocktake). ' +
        'Otherwise, cancel and leave this entry in place.\n\nForce-remove this log entry?'
      )
      if (!ok) return
      const r = await fetch(`/api/wastage?id=${id}&force=true`, { method: 'DELETE' })
      if (!r.ok) { alert('Error: ' + ((await r.json()).message || 'could not delete')) ; return }
      await onRefresh()
      return
    }
    if (!confirm('Delete this wastage entry?')) return
    await fetch(`/api/wastage?id=${id}`, { method: 'DELETE' })
    await onRefresh()
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setEditForm({
      itemName:   entry.itemName,
      qty:        entry.qty,
      unit:       entry.unit || 'units',
      reason:     entry.reason,
      note:       entry.note || '',
      recordedBy: entry.recordedBy || '',
      date:       new Date(entry.date).toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }),
    })
  }

  function cancelEdit() { setEditingId(null); setEditForm({}) }

  async function saveEdit(entry) {
    try {
      const selected = items.find(i => i.name === editForm.itemName)
      const r = await fetch(`/api/wastage?id=${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          category: selected?.category || entry.category || '',
          date: editForm.date ? new Date(editForm.date + 'T12:00:00+10:00').getTime() : entry.date,
        })
      })
      if (!r.ok) throw new Error((await r.json()).error)
      await onRefresh()
      cancelEdit()
    } catch(e) { alert('Error: ' + e.message) }
  }

  function printReport() {
    const rows = filtered.map(e => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${new Date(e.date).toLocaleDateString('en-AU', { timeZone:'Australia/Brisbane', day:'numeric', month:'short', year:'numeric' })}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:600">${e.itemName}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${e.category}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:12px;font-weight:700">${e.qty} ${e.unit}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px">${e.reason}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${e.note || '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b">${e.recordedBy || '—'}</td>
      </tr>`).join('')

    const summaryRows = REASONS.map(r => {
      const entries = log.filter(e => e.reason === r)
      return `<tr><td style="padding:5px 10px;font-size:12px">${r}</td><td style="padding:5px 10px;text-align:center;font-size:12px;font-weight:700">${entries.length}</td></tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head>
      <title>Wastage Report — Paynter Bar</title>
      <style>
        @page { size: A4 portrait; margin: 15mm }
        body { font-family: Arial, sans-serif; color: #0f172a; }
        h1 { font-size: 18px; margin: 0 0 4px }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 16px }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px }
        th { background: #1e3a5f; color: #fff; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left }
        th.c { text-align: center }
        .summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap }
        .sum-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; min-width: 80px; text-align: center }
        .footer { margin-top: 16px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px }
      </style>
    </head><body>
      <h1>🗑️ Wastage Log Report</h1>
      <div class="meta">
        Paynter Bar · GemLife Palmwoods<br>
        Generated: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}<br>
        Filter: ${filter} · ${filtered.length} entries
      </div>
      <div class="summary">
        ${REASONS.map(r => {
          const n = log.filter(e => e.reason === r).length
          return `<div class="sum-card"><div style="font-size:11px;color:#64748b">${r}</div><div style="font-size:20px;font-weight:800">${n}</div></div>`
        }).join('')}
        <div class="sum-card"><div style="font-size:11px;color:#64748b">Total</div><div style="font-size:20px;font-weight:800">${log.length}</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Item</th><th>Category</th><th class="c">Qty</th>
          <th>Reason</th><th>Note</th><th>Recorded By</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Paynter Bar Hub · Wastage Log</div>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  return (
    <div className="view-wrap" style={{ padding: '16px', maxWidth: 960, margin: '0 auto' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {refreshError && <span style={{ fontSize: 11, color: '#dc2626' }}>⚠️ {refreshError}</span>}
        <button onClick={refresh} disabled={refreshing}
          style={{ padding: '6px 14px', background: refreshing ? '#94a3b8' : '#f1f5f9', color: refreshing ? '#fff' : '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer' }}>
          {refreshing ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {[...summary, { reason: 'Total', count: log.length, bg: '#f8fafc', text: '#0f172a' }].map(s => (
          <div key={s.reason}
            onClick={() => setFilter(s.reason === 'Total' ? 'All' : s.reason)}
            style={{ background: s.bg, border: `1px solid ${s.text}33`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', flex: '1 1 80px', minWidth: 70,
              outline: filter === (s.reason === 'Total' ? 'All' : s.reason) ? `2px solid ${s.text}` : 'none' }}>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{s.reason}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.text, fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Log entry form */}
      {!readOnly && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden' }}>
          <div
            style={{ background: '#92400e', color: '#fff', padding: '10px 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setShowForm(f => !f)}>
            🗑️ Record Wastage
            <span style={{ fontSize: 16 }}>{showForm ? '▲' : '▼'}</span>
          </div>
          {showForm && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Item dropdown */}
                <div style={{ flex: 2, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Item *</div>
                  <select value={form.itemName} onChange={e => {
                    const selected = items.find(i => i.name === e.target.value)
                    const units = getUnitOptions(selected)
                    setForm(f => ({ ...f, itemName: e.target.value, unit: units[0] }))
                  }} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                    <option value="">— Select item —</option>
                    {[...new Set(items.map(i => i.category))].filter(Boolean).sort().map(cat => (
                      <optgroup key={cat} label={cat}>
                        {items.filter(i => i.category === cat).sort((a,b) => a.name.localeCompare(b.name)).map(i => (
                          <option key={i.name} value={i.name}>{i.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {/* Qty */}
                <div style={{ width: 80 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Qty *</div>
                  <input type="number" min="0.1" step="0.1" value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, textAlign: 'center', boxSizing: 'border-box' }} />
                </div>
                {/* Unit — options depend on item category */}
                <div style={{ width: 100 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Unit</div>
                  {(() => {
                    const selectedItem = items.find(i => i.name === form.itemName)
                    const unitOpts = getUnitOptions(selectedItem)
                    return (
                      <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                        {unitOpts.map(u => <option key={u}>{u}</option>)}
                      </select>
                    )
                  })()}
                </div>
                {/* Reason */}
                <div style={{ width: 130 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Reason *</div>
                  <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                    {REASONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                {/* Date */}
                <div style={{ width: 150 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Date *</div>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Note */}
                <div style={{ flex: 2, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Note</div>
                  <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="e.g. Dropped on delivery, found in fridge"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                {/* Recorded by */}
                <div style={{ width: 160 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Recorded by</div>
                  <input value={form.recordedBy} onChange={e => setForm(f => ({ ...f, recordedBy: e.target.value }))}
                    placeholder="Your name"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={submit} disabled={saving}
                    style={{ ...styles.btn, background: '#92400e', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving...' : '✓ Record'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <div style={{ background: '#1e3a5f', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {filter === 'All' ? 'All Entries' : filter} — {filtered.length} records
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#93c5fd' }}>From</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, background: '#1e40af', color: '#fff', colorScheme: 'dark' }} />
              <span style={{ fontSize: 11, color: '#93c5fd' }}>To</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 12, background: '#1e40af', color: '#fff', colorScheme: 'dark' }} />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }}
                  style={{ fontSize: 11, background: '#475569', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff' }}>✕ Clear</button>
              )}
            </div>
            <button onClick={printReport}
              style={{ fontSize: 11, background: '#0e7490', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: '#fff', fontWeight: 600 }}>
              🖨️ Print Report
            </button>
            {!readOnly && unsyncedCount > 0 && (
              <button onClick={async () => {
                  if (!confirm(`Mark all ${unsyncedCount} unsynced entr${unsyncedCount === 1 ? 'y' : 'ies'} as already synced to Square?\n\nUse this when entries have been manually re-entered and were previously synced.`)) return
                  await fetch('/api/wastage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markAllSynced' }) })
                  await onRefresh()
                }}
                style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                ✓ Mark All as Synced
              </button>
            )}
            {!readOnly && (
              <button onClick={() => { setShowSyncModal(true); loadSyncPreview() }}
                style={{ fontSize: 11, background: unsyncedCount > 0 ? '#16a34a' : '#475569', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⬆ Sync to Square
                {unsyncedCount > 0 && (
                  <span style={{ background: '#fff', color: '#16a34a', fontWeight: 800, fontSize: 10, borderRadius: 99, padding: '1px 6px', lineHeight: 1.5 }}>{unsyncedCount}</span>
                )}
              </button>
            )}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No wastage entries recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Date','Item','Qty','Reason','Note','By','Sq',''].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Qty' ? 'center' : 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => {
                const rc = REASON_COLOR[entry.reason] || REASON_COLOR.Other
                const isEditing = editingId === entry.id
                const inp = { fontSize: 12, border: '1px solid #93c5fd', borderRadius: 4, padding: '3px 6px', width: '100%', boxSizing: 'border-box' }
                const lockedInp = { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', borderColor: '#e2e8f0' }
                return (
                  <tr key={entry.id} style={{ background: isEditing ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', outline: isEditing ? '2px solid #3b82f6' : 'none' }}>
                    {isEditing ? (
                      <>
                        <td style={{ padding: '6px 8px' }}>
                          <input type="date" value={editForm.date} disabled={entry.squareSynced} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={{ ...inp, ...(entry.squareSynced ? lockedInp : {}) }} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select value={editForm.itemName} disabled={entry.squareSynced} onChange={e => setEditForm(f => ({ ...f, itemName: e.target.value }))} style={{ ...inp, ...(entry.squareSynced ? lockedInp : {}) }}>
                            {items.map(i => <option key={i.name}>{i.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input type="number" value={editForm.qty} min="0" step="0.1" disabled={entry.squareSynced} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))} style={{ ...inp, width: 55, ...(entry.squareSynced ? lockedInp : {}) }} />
                            <select value={editForm.unit} disabled={entry.squareSynced} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} style={{ ...inp, width: 65, ...(entry.squareSynced ? lockedInp : {}) }}>
                              {getUnitOptions(items.find(i => i.name === editForm.itemName)).map(u => <option key={u}>{u}</option>)}
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <select value={editForm.reason} disabled={entry.squareSynced} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} style={{ ...inp, ...(entry.squareSynced ? lockedInp : {}) }}>
                            {REASONS.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Note..." style={inp} />
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <input value={editForm.recordedBy} onChange={e => setEditForm(f => ({ ...f, recordedBy: e.target.value }))} placeholder="Name..." style={inp} />
                        </td>
                        <td style={{ padding: '6px 8px' }} />
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveEdit(entry)} style={{ fontSize: 11, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}>✓</button>
                            <button onClick={cancelEdit} style={{ fontSize: 11, background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(entry.date).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{entry.itemName}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                          {entry.qty} <span style={{ fontSize: 10, color: '#94a3b8' }}>{entry.unit}</span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: rc.bg, color: rc.text, fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>{entry.reason}</span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b', maxWidth: 200 }}>{entry.note || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: '#64748b' }}>{entry.recordedBy || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {entry.squareSynced
                            ? <span title={`Synced ${new Date(entry.squareSyncedAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short' })}${entry.conversionNote ? '\n' + entry.conversionNote : ''}`}
                                style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 700, padding: '2px 6px', borderRadius: 99, whiteSpace: 'nowrap', cursor: 'default' }}>
                                ✓ Sq
                              </span>
                            : <span style={{ fontSize: 10, color: '#cbd5e1' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {!readOnly && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => startEdit(entry)}
                                style={{ fontSize: 11, background: '#eff6ff', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#2563eb' }}>✏️</button>
                              <button onClick={() => deleteEntry(entry.id)}
                                style={{ fontSize: 11, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#dc2626' }}>✕</button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
        Wastage records stored in the cloud · visible to all management team members
      </div>

      {/* ── SYNC MODAL ──────────────────────────────────────────────────────── */}
      {showSyncModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

            {/* Modal header */}
            <div style={{ background: '#0f172a', color: '#fff', borderRadius: '14px 14px 0 0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>⬆ Sync Wastage to Square</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>This will post WASTE adjustments to your Square inventory</div>
              </div>
              <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* Success/fail result banner */}
              {syncResult && (
                <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: syncResult.ok ? '#f0fdf4' : '#fee2e2', border: `1px solid ${syncResult.ok ? '#86efac' : '#fca5a5'}`, color: syncResult.ok ? '#166534' : '#991b1b', fontSize: 13, fontWeight: 600 }}>
                  {syncResult.ok ? '✓ ' : '✕ '}{syncResult.message || syncResult.error}
                  {syncResult.skippedItems?.length > 0 && (
                    <div style={{ marginTop: 8, fontWeight: 400, fontSize: 12 }}>
                      {syncResult.skippedItems.map((s, i) => (
                        <div key={i} style={{ padding: '3px 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none' }}>
                          <strong>{s.itemName}</strong>: {s.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {syncLoading && (
                <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                  <div style={{ ...styles.spinner, margin: '0 auto 12px' }} />
                  Loading preview from Square...
                </div>
              )}

              {syncPreview?.error && (
                <div style={{ color: '#dc2626', padding: 16, background: '#fee2e2', borderRadius: 8, fontSize: 13 }}>
                  Error: {syncPreview.error}
                </div>
              )}

              {syncPreview && !syncPreview.error && (
                <>
                  {syncPreview.preview?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 14 }}>
                      ✓ All wastage entries are already synced to Square
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                        {syncPreview.preview.filter(p => p.canSync).length} entries ready to sync ·{' '}
                        {syncPreview.preview.filter(p => !p.canSync).length > 0 && (
                          <span style={{ color: '#d97706' }}>{syncPreview.preview.filter(p => !p.canSync).length} will be skipped (not in Square catalogue)</span>
                        )}
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              {['Date','Item','Logged','→ Square deduction','Conversion','Sq Stock','Var ID','Status'].map(h => (
                                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {syncPreview.preview.map((p, idx) => (
                              <tr key={p.id} style={{ background: !p.canSync ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', opacity: !p.canSync ? 0.65 : 1 }}>
                                <td style={{ padding: '7px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                  {new Date(p.date).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short' })}
                                </td>
                                <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{p.itemName}</td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                  {p.qty} {p.unit}
                                </td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
                                  {p.canSync ? `−${p.squareQty} ${SPIRIT_CATS.includes(p.category) ? 'nips' : WINE_CATS.includes(p.category) ? 'btl' : 'units'}` : '—'}
                                </td>
                                <td style={{ padding: '7px 10px', fontSize: 11, color: '#64748b' }}>
                                  {p.conversionNote || <span style={{ color: '#cbd5e1' }}>1:1</span>}
                                </td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11, color: p.squareOnHand > 0 ? '#16a34a' : '#dc2626' }}>
                                  {p.squareOnHand !== null ? p.squareOnHand : '—'}
                                </td>
                                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', userSelect: 'all' }}>
                                  {p.variationId ? p.variationId.slice(-8) : '—'}
                                </td>
                                <td style={{ padding: '7px 10px' }}>
                                  {p.canSync
                                    ? <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>Ready</span>
                                    : <span title={p.skipReason} style={{ fontSize: 10, background: '#fef9c3', color: '#92400e', fontWeight: 700, padding: '2px 8px', borderRadius: 99, cursor: 'help' }}>Skip ⓘ</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            {syncPreview && !syncPreview.error && syncPreview.preview?.filter(p => p.canSync).length > 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#f8fafc', borderRadius: '0 0 14px 14px' }}>
                <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                  style={{ padding: '9px 18px', background: '#e2e8f0', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button
                  onClick={() => executeSync(syncPreview.preview.filter(p => p.canSync).map(p => p.id))}
                  disabled={syncing}
                  style={{ padding: '9px 20px', background: syncing ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer' }}>
                  {syncing
                    ? '⏳ Syncing...'
                    : `⬆ Sync ${syncPreview.preview.filter(p => p.canSync).length} entr${syncPreview.preview.filter(p => p.canSync).length === 1 ? 'y' : 'ies'} to Square`}
                </button>
              </div>
            )}
            {syncPreview && !syncPreview.error && syncPreview.preview?.length === 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderRadius: '0 0 14px 14px' }}>
                <button onClick={() => { setShowSyncModal(false); setSyncPreview(null); setSyncResult(null) }}
                  style={{ padding: '9px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
