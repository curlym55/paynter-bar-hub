// pages/api/sales-trend.js
// Six-month sales trends: overall + every item. Open /api/sales-trend in a
// browser tab while logged in to the Hub. Add ?format=csv for a spreadsheet
// download or ?format=json for the raw data. ?months=N changes the window (2-12).
import { fetchSalesReport } from '../../lib/square'
import { kvGet } from '../../lib/redis'
import { defaultCategory } from '../../lib/calculations'
import { requireAuth } from '../../lib/session'
import { GLASS_SERVE_ML } from '../../lib/constants'

export const config = { maxDuration: 60 }

const WINE_CATS = ['White Wine', 'Red Wine', 'Rose', 'Sparkling']
const CAT_ORDER = ['Beer','Cider','PreMix','White Wine','Red Wine','Rose','Sparkling','Fortified & Liqueurs','Spirits','Soft Drinks','Snacks']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const BRIS_OFFSET_MS = 10 * 3600 * 1000 // Brisbane is UTC+10 all year (no daylight saving)

// Same cost rules as /api/sales (Buy Price meaning depends on category)
function costOf(settings, category, units, bottles) {
  const raw = settings.buyPrice
  const buy = raw != null && raw !== '' ? Number(raw) : null
  if (buy == null || Number.isNaN(buy) || buy <= 0) return null
  if (category === 'Spirits' || category === 'Fortified & Liqueurs') {
    const nips = (Number(settings.bottleML) || 700) / (Number(settings.nipML) || 30)
    return units * buy + bottles * buy * nips
  }
  if (WINE_CATS.includes(category)) return bottles * buy + units * (buy / (750 / GLASS_SERVE_ML))
  return (units + bottles) * buy
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = n => n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const num = n => Math.round(n).toLocaleString('en-AU')

function pctChange(recent, prior) {
  if (!prior || prior <= 0) return recent > 0 ? null : 0
  return ((recent - prior) / prior) * 100
}

function trendLabel(vals, pct) {
  const total = vals.reduce((a, b) => a + b, 0)
  if (total === 0) return 'No sales'
  const half = Math.floor(vals.length / 2)
  const first = vals.slice(0, half).reduce((a, b) => a + b, 0)
  const last = vals.slice(-half).reduce((a, b) => a + b, 0)
  if (first === 0 && last > 0) return 'New'
  if (last === 0 && first > 0) return 'Stopped'
  if (pct == null) return 'New'
  if (pct >= 15) return 'Growing'
  if (pct <= -15) return 'Declining'
  return 'Steady'
}

function spark(vals, w = 90, h = 24) {
  const max = Math.max(...vals, 1)
  const step = vals.length > 1 ? w / (vals.length - 1) : w
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="#1e3a5f" stroke-width="1.6"/></svg>`
}

function barChart(labels, vals, w = 640, h = 190) {
  const pad = { l: 56, r: 10, t: 14, b: 26 }
  const max = Math.max(...vals, 1)
  const bw = (w - pad.l - pad.r) / vals.length
  let out = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px">`
  for (let g = 0; g <= 4; g++) {
    const y = pad.t + (h - pad.t - pad.b) * (1 - g / 4)
    out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e2e8f0"/><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${money(max * g / 4)}</text>`
  }
  vals.forEach((v, i) => {
    const bh = (h - pad.t - pad.b) * (v / max)
    const x = pad.l + i * bw + bw * 0.15
    out += `<rect x="${x}" y="${h - pad.b - bh}" width="${bw * 0.7}" height="${bh}" fill="#1e3a5f" rx="3"/>`
    out += `<text x="${x + bw * 0.35}" y="${h - pad.b - bh - 4}" text-anchor="middle" font-size="10" fill="#0f172a">${money(v)}</text>`
    out += `<text x="${x + bw * 0.35}" y="${h - 8}" text-anchor="middle" font-size="11" fill="#475569">${esc(labels[i])}</text>`
  })
  return out + '</svg>'
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  const token = process.env.SQUARE_ACCESS_TOKEN
  if (!token) return res.status(500).json({ error: 'SQUARE_ACCESS_TOKEN not configured' })

  try {
    const N = Math.min(12, Math.max(2, parseInt(req.query.months) || 6))
    const format = req.query.format || 'html'

    // Month windows in Brisbane time, oldest first; the last one is the current month so far.
    const nowBris = new Date(Date.now() + BRIS_OFFSET_MS)
    const months = []
    for (let k = N - 1; k >= 0; k--) {
      const y = nowBris.getUTCFullYear(), m = nowBris.getUTCMonth() - k
      const startUtc = new Date(Date.UTC(y, m, 1) - BRIS_OFFSET_MS)
      const endUtc = k === 0 ? new Date() : new Date(Date.UTC(y, m + 1, 1) - BRIS_OFFSET_MS - 1)
      const d = new Date(Date.UTC(y, m, 1))
      months.push({ label: `${MONTH_NAMES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, start: startUtc.toISOString(), end: endUtc.toISOString(), partial: k === 0 })
    }

    const allSettings = (await kvGet('itemSettings').catch(() => null)) || {}

    // Two at a time so Square isn't hit with every month at once
    const results = []
    for (let i = 0; i < months.length; i += 2) {
      const batch = await Promise.all(months.slice(i, i + 2).map(m => fetchSalesReport(token, m.start, m.end)))
      results.push(...batch)
    }

    const names = new Set(results.flatMap(r => Object.keys(r)))
    const items = []
    for (const name of names) {
      const st = allSettings[name] || {}
      const category = st.category || defaultCategory(name)
      const units = results.map(r => (r[name]?.units || 0) + (r[name]?.bottles || 0))
      const revenue = results.map(r => r[name]?.revenue || 0)
      const cost = results.map(r => costOf(st, category, r[name]?.units || 0, r[name]?.bottles || 0))
      const half = Math.floor(N / 2)
      const sum = (a, from, to) => a.slice(from, to).reduce((x, y) => x + y, 0)
      const uRecent = sum(units, N - half, N), uPrior = sum(units, N - 2 * half, N - half)
      const rRecent = sum(revenue, N - half, N), rPrior = sum(revenue, N - 2 * half, N - half)
      const uPct = pctChange(uRecent, uPrior), rPct = pctChange(rRecent, rPrior)
      const costed = cost.every(c => c != null)
      const totalRev = sum(revenue, 0, N)
      const totalCost = costed ? cost.reduce((a, b) => a + (b || 0), 0) : null
      if (units.every(u => u === 0) && totalRev === 0) continue
      items.push({
        name, category, units, revenue, totalUnits: sum(units, 0, N), totalRev,
        profit: totalCost != null ? totalRev - totalCost : null,
        uPct, rPct, trend: trendLabel(units, uPct),
      })
    }
    items.sort((a, b) => (CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)) || b.totalRev - a.totalRev)

    // Overall + per category by month
    const monthTotals = months.map((m, i) => ({
      label: m.label, partial: m.partial,
      units: items.reduce((s, it) => s + it.units[i], 0),
      revenue: items.reduce((s, it) => s + it.revenue[i], 0),
    }))
    const cats = {}
    for (const it of items) {
      const c = (cats[it.category] ||= { units: months.map(() => 0), revenue: months.map(() => 0) })
      it.units.forEach((u, i) => { c.units[i] += u })
      it.revenue.forEach((r, i) => { c.revenue[i] += r })
    }
    const half = Math.floor(N / 2)
    const sumA = (a, f, t) => a.slice(f, t).reduce((x, y) => x + y, 0)
    const overall = {
      totalRev: items.reduce((s, i) => s + i.totalRev, 0),
      totalUnits: items.reduce((s, i) => s + i.totalUnits, 0),
      recentRev: sumA(monthTotals.map(m => m.revenue), N - half, N),
      priorRev: sumA(monthTotals.map(m => m.revenue), N - 2 * half, N - half),
      recentUnits: sumA(monthTotals.map(m => m.units), N - half, N),
      priorUnits: sumA(monthTotals.map(m => m.units), N - 2 * half, N - half),
    }
    const costedItems = items.filter(i => i.profit != null)
    overall.profit = costedItems.reduce((s, i) => s + i.profit, 0)
    overall.costedRev = costedItems.reduce((s, i) => s + i.totalRev, 0)
    overall.uncostedRev = overall.totalRev - overall.costedRev
    overall.uncostedN = items.length - costedItems.length

    if (format === 'json') return res.status(200).json({ months, items, monthTotals, cats, overall })

    if (format === 'csv') {
      const head = ['Item', 'Category', ...months.map(m => `${m.label} units`), ...months.map(m => `${m.label} revenue`), 'Total units', 'Total revenue', 'Est. profit', 'Units trend %', 'Revenue trend %', 'Trend']
      const rows = items.map(i => [i.name, i.category, ...i.units, ...i.revenue.map(r => r.toFixed(2)), i.totalUnits, i.totalRev.toFixed(2), i.profit == null ? '' : i.profit.toFixed(2), i.uPct == null ? '' : i.uPct.toFixed(1), i.rPct == null ? '' : i.rPct.toFixed(1), i.trend])
      const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="sales-trends-${N}-months.csv"`)
      return res.status(200).send('﻿' + csv)
    }

    const chg = p => p == null ? '<span class="new">new</span>' : `<span class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span>`
    const revPct = pctChange(overall.recentRev, overall.priorRev)
    const unitPct = pctChange(overall.recentUnits, overall.priorUnits)
    const margin = overall.costedRev > 0 ? (overall.profit / overall.costedRev) * 100 : null
    const winWord = `last ${half} months vs the ${half} before`
    const movers = items.filter(i => i.totalUnits >= 12)
    const growing = [...movers].filter(i => i.uPct != null && i.uPct > 0).sort((a, b) => b.uPct - a.uPct).slice(0, 8)
    const declining = [...movers].filter(i => i.uPct != null && i.uPct < 0).sort((a, b) => a.uPct - b.uPct).slice(0, 8)
    const stopped = items.filter(i => i.trend === 'Stopped')
    const slow = items.filter(i => i.totalUnits > 0 && i.totalUnits <= N * 2 && i.trend !== 'Stopped')
    const topRev = [...items].sort((a, b) => b.totalRev - a.totalRev).slice(0, 10)

    const moverList = (arr) => arr.length ? `<table>${arr.map(i => `<tr><td>${esc(i.name)}</td><td class="r">${num(i.totalUnits)} sold</td><td class="r">${chg(i.uPct)}</td></tr>`).join('')}</table>` : '<p class="muted">None</p>'
    const catRows = Object.keys(cats).sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b)).map(c => {
      const v = cats[c]
      return `<tr><td><b>${esc(c)}</b></td>${v.revenue.map(x => `<td class="r">${money(x)}</td>`).join('')}<td class="r"><b>${money(sumA(v.revenue, 0, N))}</b></td><td class="r">${chg(pctChange(sumA(v.revenue, N - half, N), sumA(v.revenue, N - 2 * half, N - half)))}</td><td>${spark(v.revenue, 80)}</td></tr>`
    }).join('')

    let itemRows = '', lastCat = null
    for (const it of items) {
      if (it.category !== lastCat) { itemRows += `<tr class="cat"><td colspan="${N + 7}">${esc(it.category)}</td></tr>`; lastCat = it.category }
      itemRows += `<tr data-trend="${it.trend}"><td>${esc(it.name)}</td>${it.units.map(u => `<td class="r">${u ? num(u) : '·'}</td>`).join('')}<td class="r"><b>${num(it.totalUnits)}</b></td><td class="r">${money(it.totalRev)}</td><td class="r">${chg(it.uPct)}</td><td>${spark(it.units)}</td><td><span class="tag ${it.trend}">${it.trend}</span></td><td class="r">${it.profit == null ? '<span class="muted">no buy price</span>' : money(it.profit)}</td></tr>`
    }

    const gen = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' })
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paynter Bar – ${N}-Month Sales Trends</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;background:#f1f5f9}
.wrap{max-width:1100px;margin:0 auto;padding:18px}
h1{font-size:22px;margin:0 0 2px}h2{font-size:15px;margin:26px 0 8px;color:#1e3a5f;text-transform:uppercase;letter-spacing:.05em}
.muted{color:#94a3b8;font-size:12px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:12px;overflow-x:auto}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.tile{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.tile .v{font-size:22px;font-weight:800}.tile .l{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
table{border-collapse:collapse;width:100%;font-size:12px}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-weight:600;position:sticky;top:0;cursor:pointer}th:first-child{text-align:left}
td{padding:5px 8px;border-bottom:1px solid #f1f5f9}.r{text-align:right;white-space:nowrap}tr.cat td{background:#e2e8f0;font-weight:700;color:#1e3a5f}
.up{color:#16a34a;font-weight:700}.down{color:#dc2626;font-weight:700}.new{color:#2563eb;font-weight:700}
.tag{padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:#e2e8f0}.tag.Growing{background:#dcfce7;color:#166534}.tag.Declining{background:#fee2e2;color:#991b1b}.tag.Stopped{background:#fef3c7;color:#92400e}.tag.New{background:#dbeafe;color:#1e40af}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.two{grid-template-columns:1fr}}
.bar a{margin-right:12px;font-size:13px;color:#1d4ed8}
@media print{body{background:#fff}.bar{display:none}.card,.tile{break-inside:avoid}}
</style></head><body><div class="wrap">
<div class="bar"><a href="javascript:window.print()">🖨 Print / save as PDF</a><a href="?format=csv&months=${N}">📥 Download spreadsheet (CSV)</a></div>
<h1>Paynter Bar – ${N}-Month Sales Trends</h1>
<div class="muted">${esc(months[0].label)} to ${esc(months[N - 1].label)} (latest month is month-to-date) · generated ${esc(gen)}</div>

<h2>Overall</h2>
<div class="tiles">
<div class="tile"><div class="l">Revenue</div><div class="v">${money(overall.totalRev)}</div><div class="muted">${money(overall.totalRev / N)} / month avg</div></div>
<div class="tile"><div class="l">Items sold</div><div class="v">${num(overall.totalUnits)}</div><div class="muted">glasses, nips, cans &amp; bottles</div></div>
<div class="tile"><div class="l">Revenue trend</div><div class="v">${chg(revPct)}</div><div class="muted">${winWord}</div></div>
<div class="tile"><div class="l">Volume trend</div><div class="v">${chg(unitPct)}</div><div class="muted">${winWord}</div></div>
<div class="tile"><div class="l">Est. profit</div><div class="v">${money(overall.profit)}</div><div class="muted">${margin == null ? '' : margin.toFixed(0) + '% margin on '}${overall.costedRev ? money(overall.costedRev) + ' costed sales' : ''}</div></div>
</div>
<div class="card" style="margin-top:12px"><b style="display:block">Revenue by month</b>${barChart(months.map(m => m.label + (m.partial ? '*' : '')), monthTotals.map(m => m.revenue))}<div class="muted">* month to date</div></div>

<h2>By category (revenue)</h2>
<div class="card"><table><tr><th>Category</th>${months.map(m => `<th>${esc(m.label)}${m.partial ? '*' : ''}</th>`).join('')}<th>Total</th><th>Trend</th><th></th></tr>${catRows}</table></div>

<h2>Highlights</h2>
<div class="two"><div class="card"><b>Biggest earners</b><table>${topRev.map(i => `<tr><td>${esc(i.name)}</td><td class="r">${money(i.totalRev)}</td><td class="r">${chg(i.rPct)}</td></tr>`).join('')}</table></div>
<div class="card"><b>Growing fastest</b> <span class="muted">(volume, ${winWord})</span>${moverList(growing)}</div>
<div class="card"><b>Declining fastest</b> <span class="muted">(volume)</span>${moverList(declining)}</div>
<div class="card"><b>Stopped selling</b> <span class="muted">(sold earlier, nothing recently)</span>${stopped.length ? `<table>${stopped.map(i => `<tr><td>${esc(i.name)}</td><td class="r">${num(i.totalUnits)} sold</td></tr>`).join('')}</table>` : '<p class="muted">None</p>'}
<b style="display:block;margin-top:10px">Very slow sellers</b> <span class="muted">(about 2 a month or less)</span>${slow.length ? `<table>${slow.map(i => `<tr><td>${esc(i.name)}</td><td class="r">${num(i.totalUnits)} sold</td></tr>`).join('')}</table>` : '<p class="muted">None</p>'}</div></div>

<h2>Every item – units sold per month</h2>
<div class="card"><table id="items"><tr><th>Item</th>${months.map(m => `<th>${esc(m.label)}${m.partial ? '*' : ''}</th>`).join('')}<th>Total</th><th>Revenue</th><th>Volume trend</th><th></th><th>Status</th><th>Est. profit</th></tr>${itemRows}</table></div>
<div class="muted">Units include glasses, nips, cans and bottles added together, so a wine's units mix glasses and bottles – use revenue to compare wines fairly. Trend compares ${winWord}. Estimated profit uses each item's current Buy Price from Pricing, over all ${N} months; items without a Buy Price show no profit and are left out of the profit total (${overall.uncostedN} item${overall.uncostedN === 1 ? '' : 's'}, ${money(overall.uncostedRev)} of sales). Revenue trends include any price changes. Seasonal swings (winter vs summer, events) affect the trends.</div>
</div></body></html>`
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (err) {
    console.error('Sales trend error:', err)
    return res.status(500).json({ error: err.message })
  }
}
