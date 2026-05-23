// EditSelect.jsx -- extracted from pages/index.js
import React, { useState } from 'react'
import { styles } from '../../lib/barStyles'

export default function EditSelect({ value, options, onChange, saving, colorMap, readOnly }) {
  const [editing, setEditing] = useState(false)
  if (readOnly) { const color = colorMap ? colorMap[value] : null; return <span style={{ fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}>{value}</span> }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <select defaultValue={value} autoFocus style={styles.inlineSelect}
      onChange={e => { onChange(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  const color = colorMap ? colorMap[value] : null
  return <span style={{ cursor: 'pointer', fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}
    onClick={() => setEditing(true)} title="Click to edit">{value}</span>
}
