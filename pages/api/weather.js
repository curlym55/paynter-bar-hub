// pages/api/weather.js — proxy for Open Meteo (avoids browser CORS)
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-26.70&longitude=152.76&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Australia%2FBrisbane&forecast_days=7'
    const r = await fetch(url)
    if (!r.ok) return res.status(r.status).json({ error: 'Weather API error' })
    const data = await r.json()
    // Cache for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
