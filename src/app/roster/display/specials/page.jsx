'use client'
import { useEffect, useState } from 'react'

export default function SpecialsDisplay() {
  const [specials, setSpecials] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/specials')
        const data = await res.json()
        setSpecials(data.specials || [])
      } catch {}
      setLoading(false)
    }
    load()
    const refresh = setInterval(load, 5 * 60 * 1000) // refresh every 5 mins
    return () => clearInterval(refresh)
  }, [])

  useEffect(() => {
    if (specials.length <= 1) return
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % specials.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [specials.length])

  if (loading) return (
    <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 18 }}>Loading specials...</div>
    </div>
  )

  if (!specials.length) return (
    <div style={{ background: '#0f172a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 48 }}>🍺</div>
      <div style={{ color: '#64748b', fontSize: 20 }}>No specials today</div>
    </div>
  )

  const s = specials[current]

  return (
    <div style={{ background: '#0f172a', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1e3a5f', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🍺</span>
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Paynter Bar</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>GemLife Palmwoods</div>
          </div>
        </div>
        <div style={{ color: '#c8a84b', fontSize: 22, fontWeight: 800, letterSpacing: '0.05em' }}>TODAY&apos;S SPECIALS</div>
        <div style={{ color: '#475569', fontSize: 13 }}>{current + 1} of {specials.length}</div>
      </div>

      {/* Main special display */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '60px' }}>
        {/* Product image */}
        <div style={{ flexShrink: 0, width: 340, height: 340, borderRadius: 20, overflow: 'hidden', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          {s.image_url
            ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 80 }}>🍾</span>
          }
        </div>

        {/* Product details */}
        <div style={{ maxWidth: 480 }}>
          <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>
            Special Tonight
          </div>
          <div style={{ color: '#fff', fontSize: 52, fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
            {s.name}
          </div>
          {s.description && (
            <div style={{ color: '#94a3b8', fontSize: 20, marginBottom: 24, lineHeight: 1.5 }}>
              {s.description}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ color: '#c8a84b', fontSize: 72, fontWeight: 900, lineHeight: 1 }}>
              {s.price_override ? '$' + parseFloat(s.price_override.replace('$','')).toFixed(2) : s.price ? '$' + parseFloat(s.price).toFixed(2) : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px', flexShrink: 0 }}>
        {specials.map((_, i) => (
          <div key={i} onClick={() => setCurrent(i)} style={{
            width: i === current ? 24 : 8, height: 8, borderRadius: 4,
            background: i === current ? '#c8a84b' : '#334155',
            cursor: 'pointer', transition: 'all 0.3s'
          }} />
        ))}
      </div>
    </div>
  )
}