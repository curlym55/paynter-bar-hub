// NotesView.jsx — extracted from pages/index.js
import React, { useState } from 'react'

export default function NotesView({ items, notes, readOnly, onRefresh }) {
  const [form, setForm]         = useState({ noteDate: '', itemName: '', comment: '', author: '' })
  const [saving, setSaving]     = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId]   = useState(null)
  const [editForm, setEditForm]     = useState({})

  // Default date to today Brisbane time
  const todayBrisbane = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' })
  const ef  = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const eef = (f, v) => setEditForm(p => ({ ...p, [f]: v }))

  function startEdit(n) {
    setEditingId(n.id)
    setEditForm({ noteDate: n.noteDate, itemName: n.itemName || '', comment: n.comment, author: n.author || '' })
  }

  function cancelEdit() { setEditingId(null); setEditForm({}) }

  function printNotes() {
    const rows = filtered.map(n => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;white-space:nowrap">
          ${new Date(n.noteDate + 'T12:00:00').toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#0e7490">
          ${n.itemName || '—'}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px">
          ${n.comment.replace(/</g,'&lt;').replace(/>/g,'&gt;')}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;white-space:nowrap">
          ${n.author || '—'}
        </td>
      </tr>`).join('')

    const filterDesc = (filterFrom || filterTo)
      ? `${filterFrom || '…'} to ${filterTo || '…'}`
      : 'All dates'

    const html = `<!DOCTYPE html><html><head>
      <title>Notes Report — Paynter Bar</title>
      <style>
        @page { size: A4 portrait; margin: 15mm }
        body { font-family: Arial, sans-serif; color: #0f172a; }
        h1 { font-size: 18px; margin: 0 0 4px }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 16px }
        table { width: 100%; border-collapse: collapse }
        th { background: #5b21b6; color: #fff; padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; text-align: left }
        tr:nth-child(even) td { background: #f8fafc }
        .footer { margin-top: 16px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px }
      </style>
    </head><body>
      <h1>📝 Notes Report</h1>
      <div class="meta">
        Paynter Bar · GemLife Palmwoods<br>
        Generated: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}<br>
        Period: ${filterDesc} · ${filtered.length} note${filtered.length !== 1 ? 's' : ''}
      </div>
      <table>
        <thead><tr>
          <th style="width:90px">Date</th>
          <th style="width:140px">Item</th>
          <th>Comment</th>
          <th style="width:100px">Author</th>
        setForm({ noteDate: '', itemName: '', comment: '', author: '' })
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Paynter Bar Hub · GemLife Palmwoods</div>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 400)
  }

  async function saveNote() {
    if (!form.comment.trim()) return
    setSaving(true)
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, noteDate: form.noteDate || todayBrisbane })
      })
        setForm({ noteDate: '', itemName: '', comment: '', author: '' })
      setShowForm(false)
      onRefresh()
    } catch(e) { alert('Save failed') }
    setSaving(false)
  }

  async function updateNote() {
    if (!editForm.comment.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/notes?id=${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      setEditingId(null)
      setEditForm({})
      onRefresh()
    } catch(e) { alert('Update failed') }
    setSaving(false)
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    await fetch(`/api/notes?id=${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const filtered = notes.filter(n => {
    if (filterFrom && n.noteDate < filterFrom) return false
    if (filterTo   && n.noteDate > filterTo)   return false
    return true
  })

  const itemNames = [...new Set((items || []).map(i => i.name))].sort()

  return (
    <div className="view-wrap" style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>📝 Notes</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Bar observations, stock notes and general comments</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={printNotes} disabled={filtered.length === 0}
            style={{ background: filtered.length === 0 ? '#94a3b8' : '#0e7490', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer' }}>
            🖨️ Print
          </button>
          {!readOnly && (
            <button onClick={() => setShowForm(s => !s)}
              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {showForm ? '✕ Cancel' : '+ Add Note'}
            </button>
          )}
        </div>
      </div>

      {/* Add note form */}
      {showForm && !readOnly && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>New Note</div>
          <div className="form-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</label>
              <input type="date" value={form.noteDate || todayBrisbane} onChange={e => ef('noteDate', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item (optional)</label>
              <select value={form.itemName} onChange={e => ef('itemName', e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                <option value="">— General note —</option>
                {itemNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment *</label>
            <textarea value={form.comment} onChange={e => ef('comment', e.target.value)} rows={3}
              placeholder="Enter your note or observation..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author</label>
              <input type='text' value={form.author} onChange={e => ef('author', e.target.value)} placeholder='Your name'
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <button onClick={saveNote} disabled={saving || !form.comment.trim()}
              style={{ background: saving || !form.comment.trim() ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: saving || !form.comment.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Filter:</span>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>to</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo('') }}
            style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{filtered.length} note{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14 }}>{notes.length === 0 ? 'No notes yet. Add the first one above.' : 'No notes match the selected date range.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(n => (
            <div key={n.id} style={{ background: '#fff', border: `1px solid ${editingId === n.id ? '#7c3aed' : '#e2e8f0'}`, borderRadius: 10, padding: '16px 20px' }}>
              {editingId === n.id ? (
                /* ── Inline edit form ── */
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 14 }}>Edit Note</div>
                  <div className="form-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</label>
                      <input type="date" value={editForm.noteDate} onChange={e => eef('noteDate', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item</label>
                      <select value={editForm.itemName} onChange={e => eef('itemName', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                        <option value="">— General note —</option>
                        {[...new Set((items || []).map(i => i.name))].sort().map(nm => <option key={nm} value={nm}>{nm}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment *</label>
                    <textarea value={editForm.comment} onChange={e => eef('comment', e.target.value)} rows={3}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author</label>
                      <input type="text" value={editForm.author} onChange={e => eef('author', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={cancelEdit}
                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={updateNote} disabled={saving || !editForm.comment.trim()}
                        style={{ background: saving || !editForm.comment.trim() ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: saving || !editForm.comment.trim() ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Saving...' : '✓ Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Read view ── */
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '3px 10px', borderRadius: 99 }}>
                        {new Date(n.noteDate + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {n.itemName && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#0e7490', background: '#ecfeff', padding: '3px 10px', borderRadius: 99 }}>
                          {n.itemName}
                        </span>
                      )}
                      {n.author && <span style={{ fontSize: 11, color: '#94a3b8' }}>- {n.author}</span>}
                    </div>
                    <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>{n.comment}</div>
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEdit(n)}
                        style={{ background: '#f5f3ff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}
                        title="Edit note">✏️ Edit</button>
                      <button onClick={() => deleteNote(n.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 16, padding: '0 4px' }}
                        title="Delete note">✕</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
