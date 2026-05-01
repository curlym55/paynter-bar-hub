# Phase 1 Audit — Paynter Bar Hub + Roster Merge
Generated: 1 May 2026

---

## 1. Repository Structure

### Hub (paynter-bar-hub) — Pages Router
```
pages/
  index.js              ← entire app UI (~6000 lines)
  _app.js
  api/
    auth.js
    fy-chart.js
    items.js            maxDuration: 60
    notes.js
    purchase-order.js
    purchase-orders.js
    sales.js            maxDuration: 60
    send-receipt.js
    settings.js
    stocktake-api.js
    stocktake-history.js
    stocktake-sync.js
    stocktake.js
    wastage-sync.js
    wastage.js
lib/
  calculations.js
  redis.js
  square.js
  timezone.js
```

### Roster (paynter-bar-roster) — App Router
```
src/
  app/
    page.js             ← renders PaynterBarRoster
    layout.js
    globals.css
    PaynterBarRoster.jsx  ← entire roster UI (~82KB)
    display/
      page.jsx          ← BAR TABLET display (fullscreen rotating display)
  lib/
    supabase.js         ← all Supabase queries
```

---

## 2. Architecture Comparison

| | Hub | Roster |
|---|---|---|
| Router | Pages Router (`pages/`) | App Router (`src/app/`) |
| Database | Redis (Upstash) + Square API | Supabase |
| Auth | PIN-based (custom) | None (open) |
| Main file | `pages/index.js` (~6000 lines) | `src/app/PaynterBarRoster.jsx` (~82KB) |
| Styling | Inline styles | Inline styles |

**Key finding:** Next.js 14 supports Pages Router and App Router coexisting. No rewrite needed.

---

## 3. Environment Variables

### Hub (current)
| Variable | Purpose |
|---|---|
| `SQUARE_ACCESS_TOKEN` | All Square API calls |
| `REDIS_URL` | Upstash Redis caching |
| `SQUARE_PIN` | Admin PIN |
| `READONLY_PIN` | Volunteer/read-only PIN |
| `SMTP_USER` | Receipt email (not yet active) |
| `SMTP_PASS` | Receipt email (not yet active) |

### Roster (current)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase calls |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Supabase calls |

### After merge — add to Hub Vercel project:
- `NEXT_PUBLIC_SUPABASE_URL` — copy from Roster Vercel project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — copy from Roster Vercel project

---

## 4. Supabase Tables

| Table | Key Fields | Purpose |
|---|---|---|
| `volunteers` | id, name, villa, phone, email, rsa, duty_manager, active | Volunteer database |
| `sessions` | id, date, day_type, time, needed, volunteers[], duty_manager, event_name | Shift scheduling |
| `announcements` | id, title, content, created_at | Noticeboard |

No conflicts with Hub — Hub uses Redis only.

---

## 5. Routes After Merge

| URL | Content | Access |
|---|---|---|
| `/` | Hub dashboard (reorder, Square tools) | Admin PIN |
| `/roster` | Volunteer roster | Open (public) |
| `/roster/display` | Bar tablet rotating display | Open (public) |
| `/?public=pricelist` | Pinless price list | Open (QR code) |

---

## 6. Key Finding — Display Page

`src/app/display/page.jsx` already fetches prices from the Hub:

```javascript
// Current (cross-domain)
const res = await fetch('https://paynter-bar-hub.vercel.app/api/items')

// After merge (local — faster, no CORS)
const res = await fetch('/api/items')
```

This is the biggest immediate win from the merge.

---

## 7. Naming Conflicts

None found. Pages Router and App Router are isolated namespaces in Next.js 14.

---

## 8. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Build failure from coexisting routers | Low | Next.js 14 supports natively |
| Supabase env vars affecting Hub | None | NEXT_PUBLIC_ vars unused by Hub |
| Display page breaking | None | Becomes local call — improvement |
| Wix iframe breaking | Low | Keep old roster live until tested |

---

## 9. Phase 2 Steps (ready to execute)

1. Get Supabase env var values from Roster Vercel project settings
2. Add them to Hub Vercel project settings
3. Create branch `feature/roster-merge` in Hub repo
4. Copy `src/` folder from roster repo into Hub repo
5. Update display page fetch URL to `/api/items`
6. Test locally, deploy, update Wix iframe

**Estimated effort: one 2-hour session.**

---

## Verdict

**Ready to proceed to Phase 2.** The merge is simpler than expected — file copy + 2 env vars + 1 URL change.
