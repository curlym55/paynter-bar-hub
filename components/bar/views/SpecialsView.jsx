// SpecialsView.jsx — extracted from pages/index.js
import React, { useState, useEffect } from 'react'

function getSpecialPrice(s, items) {
  const item = items?.find(i => i.name?.toLowerCase() === s.name?.toLowerCase())
  if (item?.squareSellPrice != null) return '$' + Number(item.squareSellPrice).toFixed(2)
  return s.price_override || ''
}

export default function SpecialsView({ items }) {
  const [specials, setSpecials] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', price_override: '', description: '', square_item_id: '', square_image_id: '', _imageUrl: '', active: true, display_order: 0 })
  const [itemSearch, setItemSearch] = useState('')
  const [catalogImages, setCatalogImages] = useState([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [imageSearch, setImageSearch] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => { loadSpecials() }, [])

  async function loadSpecials() {
    setLoading(true)
    try {
      const r = await fetch('/api/specials')
      const d = await r.json()
      setSpecials(d.specials || [])
    } finally { setLoading(false) }
  }

  async function loadCatalogImages() {
    if (catalogImages.length > 0) { setShowImagePicker(true); return }
    setLoadingImages(true)
    try {
      const r = await fetch('/api/catalog-images')
      const d = await r.json()
      setCatalogImages(d.items || [])
      setShowImagePicker(true)
    } finally { setLoadingImages(false) }
  }

  async function saveSpecial() {
    setSaving(true)
    try {
      const { _imageUrl, image_url, ...toSave } = form
      await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', special: { ...toSave, display_order: toSave.display_order ?? specials.length } }) })
      setForm({ name: '', price_override: '', description: '', square_item_id: '', square_image_id: '', _imageUrl: '', active: true, display_order: 0 })
      setShowAdd(false)
      setEditingId(null)
      setItemSearch('')
      setShowImagePicker(false)
      await loadSpecials()
    } finally { setSaving(false) }
  }

  async function deleteSpecial(id) {
    if (!confirm('Remove this special?')) return
    await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', special: { id } }) })
    await loadSpecials()
  }

  async function toggleActive(special) {
    await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert', special: { ...special, active: !special.active } }) })
    await loadSpecials()
  }

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 8)
  const filteredImages = catalogImages.filter(i => i.name.toLowerCase().includes(imageSearch.toLowerCase()))

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>⭐ Specials Display</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Manage what shows on the bar display at{' '}
            <a href="/roster/display/specials" target="_blank" style={{ color: '#0e7490' }}>/roster/display/specials</a>
          </div>
        </div>
          <button onClick={() => {
            const active = specials.filter(s => s.active)
            if (!active.length) { alert('No active specials to print'); return }
            const cols = active.length === 1 ? '1fr' : active.length <= 2 ? '1fr 1fr' : '1fr 1fr 1fr'
            const nameSz = active.length <= 2 ? 16 : active.length <= 4 ? 12 : 10
            const priceSz = active.length <= 2 ? 28 : active.length <= 4 ? 22 : 18
            const dateStr = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const rows = active.map(s => {
              const img = s.image_url ? '<img src="' + s.image_url + '" style="width:100%;height:100%;object-fit:contain;padding:4mm;background:#fff" />' : '<div style="font-size:48pt;text-align:center">🍺</div>'
              const sqPrice = getSpecialPrice(s, items); const price = sqPrice || ''
              const desc = s.description ? '<div style="font-size:9pt;color:#94a3b8;margin-bottom:2mm">' + s.description + '</div>' : ''
              return '<div style="background:#fff;border-radius:4mm;overflow:hidden;border:1px solid #e2e8f0;display:flex;flex-direction:column"><div style="width:100%;aspect-ratio:1;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center">' + img + '</div><div style="padding:4mm;display:flex;flex-direction:column"><div style="font-size:' + nameSz + 'pt;font-weight:800;color:#1e3a5f;line-height:1.2;margin-bottom:2mm;min-height:' + (nameSz * 2.8).toFixed(0) + 'pt">' + s.name + '</div>' + desc + '<div style="font-size:' + priceSz + 'pt;font-weight:900;color:#c8a84b">' + price + '</div></div></div>'
            }).join("")
            const css = '@page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;width:210mm;height:297mm;overflow:hidden;background:#fff}.page{width:210mm;height:297mm;display:flex;flex-direction:column}.hdr{background:#1e3a5f;padding:12mm 14mm 8mm;text-align:center;border-bottom:3px solid #c8a84b}.grid{flex:1;display:grid;grid-template-columns:' + cols + ';gap:6mm;padding:8mm;align-content:center}.ftr{background:#1e3a5f;padding:5mm 14mm;text-align:center;border-top:2px solid #c8a84b}'
            const hdrHtml = '<div class="hdr"><div style="font-size:11pt;color:#94a3b8;letter-spacing:.15em;text-transform:uppercase;margin-bottom:3mm">GemLife Palmwoods</div><div style="font-size:28pt;font-weight:900;color:#c8a84b;text-transform:uppercase">Tonight&#39;s Specials</div><div style="font-size:10pt;color:#94a3b8;margin-top:3mm">' + dateStr + '</div></div>'
            const ftrHtml = '<div class="ftr"><div style="font-size:11pt;color:#c8a84b;font-weight:700;letter-spacing:.1em">Paynter Bar</div><div style="font-size:9pt;color:#64748b">See bar staff for details</div></div>'
            const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Specials</title><style>' + css + '</style></head><body><div class="page">' + hdrHtml + '<div class="grid">' + rows + '</div>' + ftrHtml + '</div><div style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px"><button onclick="window.print()" style="background:#1e3a5f;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer">Print</button><button onclick="this.parentElement.style.display=&quot;none&quot;" style="background:#e2e8f0;color:#374151;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer">Hide</button></div></body></html>'
            const w = window.open('', '_blank')
            w.document.write(html)
            w.document.close()
          }} style={{ background: '#c8a84b', color: '#0f172a', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Print Sheet
          </button>
        <button onClick={() => { setShowAdd(s => !s); setImageSearch('') }}
          style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          + Add Special
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>New Special</div>

          {/* Item search */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search Square Items</label>
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Type to search..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            {itemSearch && filteredItems.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', marginTop: 4 }}>
                {filteredItems.map(item => (
                  <div key={item.name} onClick={() => {
                    const price = item.squareSellPrice != null ? Number(item.squareSellPrice) : null
                    const priceStr = price != null ? '$' + price.toFixed(2) : ''
                    setForm(f => ({ ...f, name: item.name, price_override: priceStr, square_item_id: item.sku || '' }))
                    setItemSearch('')
                  }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name}</span>
                    <span style={{ color: '#c8a84b', fontWeight: 700 }}>{item.sellPrice ? '$' + Number(item.sellPrice).toFixed(2) : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Display Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bombay Sapphire Gin"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
            </div>

          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Description (optional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. 30ml nip with mixer"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          {/* Image picker */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Product Image</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form._imageUrl
                ? <img src={form._imageUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid #c8a84b' }} />
                : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🍾</div>
              }
              <button onClick={loadCatalogImages} disabled={loadingImages}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {loadingImages ? 'Loading...' : form._imageUrl ? '🔄 Change Image' : '📷 Pick from Square'}
              </button>
              {form._imageUrl && <button onClick={() => setForm(f => ({ ...f, square_image_id: '', _imageUrl: '' }))}
                style={{ padding: '8px 12px', background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>✕</button>}
            </div>

            {/* Image grid picker */}
            {showImagePicker && (
              <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input value={imageSearch} onChange={e => setImageSearch(e.target.value)} placeholder="Search images..."
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, marginRight: 8 }} />
                  <button onClick={() => setShowImagePicker(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {filteredImages.map(img => (
                    <div key={img.imageId} onClick={() => { setForm(f => ({ ...f, square_image_id: img.imageId, _imageUrl: img.url })); setShowImagePicker(false) }}
                      style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: form.square_image_id === img.imageId ? '2px solid #c8a84b' : '2px solid transparent' }}>
                      <img src={img.url} alt={img.name} title={img.name} style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
                      <div style={{ fontSize: 9, color: '#64748b', padding: '2px 3px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{img.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowAdd(false); setItemSearch(''); setShowImagePicker(false) }}
              style={{ flex: 1, padding: '9px 0', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveSpecial} disabled={saving || !form.name}
              style={{ flex: 2, padding: '9px 0', background: saving || !form.name ? '#94a3b8' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Save Special'}
            </button>
          </div>
        </div>
      )}

      {/* Specials list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>
      ) : specials.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
          <div style={{ fontSize: 15 }}>No specials yet — click Add Special to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {specials.map((s, idx) => (
            <div key={s.id} style={{ background: s.active ? '#fff' : '#f8fafc', border: `1px solid ${s.active ? '#e2e8f0' : '#f1f5f9'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.image_url ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🍾</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.active ? '#0f172a' : '#94a3b8' }}>{s.name}</div>
                {s.description && <div style={{ fontSize: 12, color: '#64748b' }}>{s.description}</div>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c8a84b', minWidth: 60, textAlign: 'right' }}>{getSpecialPrice(s, items)}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => {
                    setForm({ ...s, _imageUrl: s.image_url || '' })
                    setEditingId(s.id)
                    setShowAdd(true)
                    setItemSearch('')
                  }}
                  style={{ padding: '4px 10px', fontSize: 11, background: 'none', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                <button onClick={() => toggleActive(s)}
                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, background: s.active ? '#f0fdf4' : '#fef9c3', color: s.active ? '#16a34a' : '#92400e', border: `1px solid ${s.active ? '#86efac' : '#fde047'}`, borderRadius: 6, cursor: 'pointer' }}>
                  {s.active ? 'Live' : 'Off'}
                </button>
                <button onClick={() => deleteSpecial(s.id)}
                  style={{ padding: '4px 10px', fontSize: 11, background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {specials.length > 0 && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
          💡 Display rotates every 6 seconds — <a href="/roster/display/specials" target="_blank" style={{ color: '#0369a1', fontWeight: 700 }}>Open display page ↗</a>
        </div>
      )}
    </div>
  )
}
