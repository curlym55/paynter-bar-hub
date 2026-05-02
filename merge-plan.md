# All phases complete
# Paynter Bar Hub — Merge Plan
## Consolidating Paynter Bar Hub + Paynter Bar Roster into a Single App

---

## Project Context

**Paynter Bar Hub** (`paynter-bar-hub.vercel.app`)
- Next.js, Square API, Redis/Upstash, Vercel
- Admin tools: PO CSV export, barcode sheets, specials poster PDF, inventory management
- Currently admin-only access

**Paynter Bar Roster** (`curlym55/paynter-bar-roster` on GitHub)
- Next.js 14, Supabase, Vercel
- Embedded in Wix site (gemwoods.com.au) via iframe
- Features: volunteer shift sign-up, duty manager self-assignment, morning clean scheduling
- Open access for volunteers; elevated access for duty managers and admin

**Goal**: Merge both into the Bar Hub codebase. Volunteers and DMs retain the same open/familiar experience. Hub admin tools remain hidden from general access. One deployment, one codebase.

---

## Access Model

| Role | Access | How identified |
|---|---|---|
| **Volunteer** | Roster only — shift view, sign-up, their schedule | Open/no login required |
| **Duty Manager** | Roster + DM self-assignment | PIN or Supabase role |
| **Admin** | All Hub features — PO, barcodes, inventory, Square tools | Admin PIN or Supabase role |

---

## Proposed Route Structure

```
/                        → Hub dashboard (admin PIN)
/roster                  → Volunteer shift view (public, Wix embeddable)
/roster/display          → Bar tablet rotating display (public)
/?public=pricelist       → Pinless price list (QR code for residents)
```

---

## Phase-by-Phase Plan

### Phase 1 — Preparation ✅ COMPLETE (1 May 2026)
- [x] Audit both repos: list all pages, components, API routes, and env vars
- [x] Identify shared dependencies — both Next.js 14, no conflicts
- [x] Decided on canonical repo: extend Bar Hub repo (absorb roster into it)
- [x] Confirmed Pages Router (Hub) + App Router (Roster) coexist natively in Next.js 14
- [x] No naming conflicts, no database conflicts identified
- [x] See PHASE1_AUDIT.md for full audit details

### Phase 2 — Environment & Config
- [ ] Add Supabase env vars to Hub's Vercel project:
  - `NEXT_PUBLIC_SUPABASE_URL` (copy from roster Vercel project)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (copy from roster Vercel project)
- [ ] Create branch: `feature/roster-merge`
- [ ] Test Hub still builds with new env vars added

### Phase 3 — Roster Migration
- [ ] Copy `src/app/` from roster repo into Hub as `src/app/`
- [ ] Copy `src/lib/supabase.js` into Hub as `src/lib/supabase.js`
- [ ] Update display page fetch: `https://paynter-bar-hub.vercel.app/api/items` → `/api/items`
- [ ] Test roster routes locally on port 3001
- [ ] Confirm iframe embed works pointing to new URL

### Phase 4 — Role Gating
- [ ] Hub pages (`/`) remain PIN-gated as now
- [ ] Roster pages (`/roster`, `/roster/display`) remain open/public
- [ ] No additional auth work needed for initial merge

### Phase 5 — Navigation
- [ ] No shared nav needed — Hub and Roster are separate views
- [ ] Roster display page has no nav (fullscreen tablet mode)
- [ ] Wix iframe embed: update src to `paynter-bar-hub.vercel.app/roster`

### Phase 6 — Testing
- [ ] Test Hub: all existing features working
- [ ] Test Roster: volunteer sign-up, DM assignment, display page
- [ ] Test display page prices loading from local `/api/items`
- [ ] Test Wix iframe embed — volunteer experience unchanged
- [ ] Test `?public=pricelist` QR link still works

### Phase 7 — Deployment
- [ ] Merge `feature/roster-merge` into `main`
- [ ] Deploy to Vercel — confirm all env vars present
- [ ] Update Wix iframe src to `paynter-bar-hub.vercel.app/roster`
- [ ] Smoke test live site
- [ ] Retire old roster Vercel deployment (keep repo archived)

---

## Key Technical Notes

- **Hub uses Pages Router** (`pages/`), **Roster uses App Router** (`src/app/`) — both coexist in Next.js 14
- **Supabase client**: `src/lib/supabase.js` — import in roster components only
- **Square client**: `lib/square.js` — Hub only
- **Redis/Upstash**: Hub only — roster has no caching
- **AEST timezone**: preserve `Australia/Brisbane` in all date/time logic
- **Display page**: already fetches from Hub API — after merge becomes local call (big win)
- **GitHub Desktop workflow**: all changes via VS Code + GitHub Desktop

---

## Files to Reference When Resuming

- Hub repo: `curlym55/paynter-bar-hub`
- Roster repo: `curlym55/paynter-bar-roster`
- Wix site: `gemwoods.com.au` (siteId: `0d429879-b0f0-4f90-a30d-82f60660aa7c`)
- Vercel deployment: `paynter-bar-hub.vercel.app`
- Supabase project: `mfyklhamvarxmylgrakk`

---

## Session Prompt (paste at start of future Claude sessions)

> I'm merging the Paynter Bar Roster app into the Paynter Bar Hub (Next.js, Square API, Supabase, Upstash/Redis, Vercel). Phase 1 audit is complete — see PHASE1_AUDIT.md and merge-plan.md in the Hub repo. Hub is Pages Router, Roster is App Router — both coexist in Next.js 14. Next step is Phase 2: add Supabase env vars to Vercel, create merge branch, then Phase 3: copy src/app/ and src/lib/supabase.js from roster into Hub. The Hub is at paynter-bar-hub.vercel.app, roster at paynter-bar-roster.vercel.app. I manage via GitHub Desktop and VS Code. Provide exact file paths and full updated files where needed.

---

*Phase 1 completed: 1 May 2026*
