// EditNumber.jsx -- extracted from pages/index.js
import React, { useState, useEffect } from 'react'
import { styles } from '../../lib/barStyles'

export default function EditNumber({ value, onChange, saving, min, placeholder, decimals, prefix, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  useEffect(() => setVal(value), [value])
  if (readOnly) { const display = decimals && (value !== '' && value != null) ? `${prefix || ''}${Number(value).toFixed(decimals)}` : (value !== '' && value != null ? `${prefix || ''}${value}` : '—'); return <span style={{ fontSize: 12, color: '#374151', fontFamily: 'IBM Plex Mono, monospace' }}>{display}</span> }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>...</span>
  if (editing) return (
    <input type="number" value={val} min={min || 0} step={decimals ? 0.01 : 1} style={styles.inlineInput}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== '') onChange(val); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') { onChange(val); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      autoFocus />
  )
  if (value === '' || value === null || value === undefined) return (
    <span style={{ cursor: 'pointer', color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' }}
      onClick={() => setEditing(true)}>{placeholder || 'Set'}</span>
  )
  const display = decimals ? `${prefix || ''}${Number(value).toFixed(decimals)}` : value
  return <span style={{ cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}
    onClick={() => setEditing(true)} title="Click to edit">{display}</span>
}
