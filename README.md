# Paynter Bar Hub

Bar management system for the GemLife Palmwoods Paynter Bar. Built with Next.js, deployed on Vercel, using Square POS, Supabase, Redis, and OneDrive.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.1 (Pages Router) |
| Deployment | Vercel |
| POS / Payments | Square API |
| Database | Supabase (PostgreSQL) — project `mfyklhamvarxmylgrakk` |
| Cache / Session | Redis (Vercel KV / ioredis) |
| Document Storage | Microsoft OneDrive (OAuth2) |
| Excel Export | ExcelJS 4.4.0 |
| Email | Nodemailer |
| AI Features | Anthropic Claude API (Haiku) |

---

## Environment Variables

Set these in the Vercel dashboard under Project → Settings → Environment Variables.

```
# Square
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=LNM7JRJ0VKQ7W

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis
REDIS_URL=

# OneDrive
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
ONEDRIVE_TENANT_ID=
ONEDRIVE_REDIRECT_URI=

# Anthropic (AI features)
ANTHROPIC_API_KEY=

# App auth
PIN_HASH=
BMT_PIN_HASH=
```

---

## Local Development

```bash
git clone https://github.com/curlym55/paynter-bar-hub
cd paynter-bar-hub
npm install
# create .env.local with the variables above
npm run dev
```

App runs at `http://localhost:3000`.

---

## Deployment

Push to `main` branch — Vercel auto-deploys.

```bash
# via GitHub Desktop: commit → push to origin
```

---

## Repository Structure

```
paynter-bar-hub/
├── pages/
│   ├── index.js              # Main app (single-page, all views)
│   ├── _app.js
│   └── api/                  # Serverless API routes
│       ├── auth.js
│       ├── items.js
│       ├── sales.js
│       ├── settings.js
│       ├── stocktake.js / stocktake-api.js / stocktake-history.js / stocktake-sync.js
│       ├── soh-audit.js / soh-history.js
│       ├── wastage.js / wastage-sync.js
│       ├── rundown.js
│       ├── notes.js
│       ├── purchase-order.js / purchase-orders.js
│       ├── send-receipt.js
│       ├── fy-chart.js
│       ├── specials.js
│       ├── catalog-images.js
│       ├── invoices/
│       │   ├── extract.js      # AI PDF invoice extraction (Claude Haiku)
│       │   ├── save.js         # Save extracted invoice to buy_price_history
│       │   ├── avg-prices.js   # Weighted average buy prices
│       │   ├── manage.js       # Invoice history management
│       │   └── match-names.js  # AI invoice→Hub name matching (Claude Haiku)
│       ├── documents/
│       │   ├── list.js / save.js / delete.js
│       ├── onedrive/
│       │   ├── auth.js / callback.js
│       │   ├── save-invoice.js / save-po.js / save-report.js / setup-folders.js
│       ├── square/
│       │   └── receive-inventory.js
│       ├── admin/
│       │   └── sync-to-supabase.js
│       ├── cron/
│       │   └── soh-snapshot.js  # Nightly SOH snapshot (Vercel cron)
│       └── debug/
│           └── catalog.js
├── src/
│   └── app/
│       └── roster/             # Volunteer roster (merged from paynter-bar-roster)
│           ├── page.js
│           ├── PaynterBarRoster.jsx
│           └── display/        # Fullscreen roster display + specials display
├── lib/
│   ├── square.js               # Square API client
│   ├── supabase-config.js      # Supabase client
│   ├── redis.js                # Redis client
│   ├── onedrive.js             # OneDrive client
│   ├── calculations.js         # Shared calculations
│   └── timezone.js             # Brisbane timezone helpers
├── public/
│   ├── paynter_header.png
│   └── PaynterHubProcedures.pdf
├── styles/globals.css
└── vercel.json
```

---

## Cron Jobs

| Schedule | Route | Function |
|---|---|---|
| 4am AEST on last day of month | `/api/cron/soh-snapshot` | Monthly SOH snapshot to Supabase |

---

## Related Projects

| Project | Repo | Purpose |
|---|---|---|
| Palmwoods Trivia App | curlym55/palmwoods-quiz | Monthly trivia quiz presentation |
| GemLife Ticket Manager | curlym55/gemlife-ticket-manager | Square event ticket sales |
| Supabase Backups | curlym55/supabase-backups | Nightly SQL dumps (GitHub Actions, 4am AEST) |
| Mobility Aids Register | mobility-aids-register | Community mobility aids tracking (shares Supabase project) |

---

## Documentation

| Document | Contents |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | All app features and views |
| [docs/API.md](docs/API.md) | API endpoint reference |
| [docs/PRICING.md](docs/PRICING.md) | Pricing policy and calculations |
| [docs/INVOICE-IMPORT.md](docs/INVOICE-IMPORT.md) | Invoice import workflow |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Database schema |
| [docs/ONEDRIVE.md](docs/ONEDRIVE.md) | OneDrive integration and folder structure |
