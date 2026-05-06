export default async function handler(req, res) {
  const token = process.env.SQUARE_ACCESS_TOKEN
  const loc = 'LNM7JRJ0VKQ7W'
  if (!token) return res.status(500).json({ error: 'No token' })
  const hdr = { 'Authorization': `Bearer ${token}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' }

  // Just get first page and show sample source names
  const r = await fetch('https://connect.squareup.com/v2/inventory/batch-retrieve-changes', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ location_ids: [loc], updated_after: '2026-02-01T00:00:00.000Z' })
  })
  const d = await r.json()
  const changes = d.changes || []

  // Show unique source names and from/to states
  const sources = {}
  for (const ch of changes) {
    const adj = ch.adjustment
    if (!adj) continue
    const key = `${adj.from_state}->${adj.to_state} | ${adj.source?.name || 'no-src'} | ${adj.source?.type || ''}`
    sources[key] = (sources[key] || 0) + 1
  }

  // Show top 20 by frequency
  const sorted = Object.entries(sources).sort((a,b)=>b[1]-a[1]).slice(0,20)

  return res.json({ total: changes.length, source_patterns: sorted })
}