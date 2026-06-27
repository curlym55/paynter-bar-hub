// EditSelect.jsx -- extracted from pages/index.js
import React, { useState } from 'react'
import { styles } from '../../lib/barStyles'

export default function EditSelect({ value, options, onChange, saving, colorMap, readOnly }) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(null) // tracks optimistic value after selection

  const displayValue = localValue !== null ? localValue : value

  if (readOnly) {
    const color = colorMap ? colorMap[displayValue] : null
    return <span style={{ fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}>{displayValue}</span>
  }
  if (saving) return <span style={{ color: '#94a3b8', fontSize: 12 }}>Saving...</span>
  if (editing) return (
    <select defaultValue={displayValue} autoFocus style={styles.inlineSelect}
      onChange={e => {
        const v = e.target.value
        setLocalValue(v)   // optimistic update immediately
        onChange(v)
        setEditing(false)
      }}
      onBlur={() => setEditing(false)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  const color = colorMap ? colorMap[displayValue] : null
  return (
    <span style={{ cursor: 'pointer', fontSize: 12, color: color || '#374151', fontWeight: color ? 600 : 400 }}
      onClick={() => setEditing(true)} title="Click to edit">
      {displayValue}
    </span>
  )
}
