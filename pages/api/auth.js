export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { pin } = req.body || {}
  if (!pin) return res.status(400).json({ ok: false })

  const PIN_COMMITTEE = process.env.PIN_COMMITTEE || '3838'
  const PIN_READONLY  = process.env.PIN_READONLY  || '5554'

  if (pin === PIN_COMMITTEE) return res.status(200).json({ ok: true, readonly: false })
  if (pin === PIN_READONLY)  return res.status(200).json({ ok: true, readonly: true  })
  return res.status(401).json({ ok: false })
}
