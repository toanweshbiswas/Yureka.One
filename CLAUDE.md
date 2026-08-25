# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (Express + Vite middleware on port 3000)
pnpm build      # Generate sitemap + Vite production build
pnpm lint       # TypeScript type-check only (tsc --noEmit) — no ESLint configured
pnpm preview    # Preview production build locally
```

There are no tests. `pnpm lint` is the only automated quality check.

For the Python email scanner:
```bash
# Create and activate venv, then install deps
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt
```

## Architecture

### Dual-Mode Server (`server.ts`)

The app runs as a single Express server:
- **Dev**: Express serves API routes; Vite runs as middleware (`middlewareMode: true`)
- **Prod**: Express serves the pre-built `dist/` folder as static files + SPA fallback

In production the built `dist/` is deployed as **static files on Hostinger (Apache) behind Cloudflare** (DNS/CDN) — the site lives at `https://yureka.one`. `public/.htaccess` (copied to `dist/.htaccess` at build) handles React-Router SPA fallback and proxies `/api/*` to the backend, which still runs `server.ts` on Render (`https://yureka-api.onrender.com`). The old `netlify.toml` is retired to `archive/`.

### Java Backend Migration (in progress)

The app is mid-migration from "Supabase as the entire backend" to a separate API layer. The API owns the same Postgres (Supabase-managed) DB and is reachable via `lib/api/client.ts`.

- `lib/api/client.ts` — thin fetch wrapper (`api.get/post/put/patch/delete`). Base URL from `VITE_API_BASE_URL` (empty = relative `/api/*`). Auto-attaches the Supabase session JWT as `Authorization: Bearer <token>` unless `skipAuth: true`. All responses are a `YurekaResponse<T>` envelope (`{ data, status, error?, details? }`) — check with `isApiError(res)` / `isValidationError(res)`.
- `lib/api/types.ts` — camelCase entity types matching the Java/JPA schema (`Card`, `Blog`, `Review`, `Waitlist`, `UserOwnedCard`, `PlatformNotification`, etc.), plus JSON-string fields (e.g. `benefitItems`, `gridBenefits`) that need `JSON.parse()`.
- `lib/api/mappers.ts` — `fromApiXxx()` functions convert the Java camelCase shapes (with JSON-string fields parsed via `safeJsonParse`) back to the legacy snake_case types in `types.ts`, so existing components don't need to change.

**Current state**: most read paths (public CMS data, admin CMS data, ledger, dashboard, waitlist) go through `/api/v1/...` via `lib/api/client.ts`. `services/supabaseService.ts` (the old `withRetry()`-wrapped direct-Supabase layer) is legacy — only `cleanData` from it is still used (in `AdminDashboard.tsx`). The two Supabase clients in `supabase.ts` (`supabase` anon, `supabaseAdmin` service-role) are now used primarily for **auth** (session/JWT) rather than data access. When adding new data fetches, prefer `api.get/post/...` + the mapper functions over `supabaseService`.

### Global State via `SupabaseProvider`

`components/SupabaseProvider.tsx` is the single React context that holds:
- Auth state: `user`, `session`, `currentUserStatus` (`none | pending | accepted | admin | loading | rejected | on-hold`)
- CMS data: `cards`, `blogs`, `reviews`, `waitlist`, `team`, `cardContributions`
- Financial ledger: `ledgerTransactions`, `ledgerLoading`, `syncLedger()`

It now fetches via the Java API (`api.get('/api/v1/cms/cards', { skipAuth: true })` etc. for public routes, `/api/v1/admin/...` for admin routes via `loadAdminData()`), mapping responses through `fromApiCard`/`fromApiBlog`/etc. `currentUserStatus` is resolved via `resolveUserStatus()` — checks `/api/v1/auth/role` first (admin/editor/writer → `'admin'`), then `/api/v1/waitlist/entry` for the waitlist status.

`currentUserStatus` drives routing in `App.tsx` via `ProtectedRoute`. The `/dashboard/*` routes are gated — `pending`/`on-hold`/`rejected` users get redirected to `/waiting`, unauthenticated users to `/login`.

### Route Architecture (`App.tsx`)

All pages are lazy-loaded with `lazyWithRetry()` — a wrapper that auto-refreshes the page once on chunk-load failure (handles hash mismatches after new deploys).

Layout rules in `AppContent`:
- Admin (`/admin`) and Dashboard (`/dashboard/*`) routes: no Navbar, no Footer, no TopBanner
- Home (`/`) route: no Footer
- All other routes: full layout with Navbar + Footer

### Homepage Layout (`components/MainPage.tsx`)

The homepage uses an "editorial 5-column" grid (`grid-cols-1 lg:grid-cols-5`): empty margin columns 1 and 5 (`border-white/5 bg-white/[0.02]`), with all content in the col-span-3 core. Sections render in this order:

1. `Hero` — full-viewport rounded video/image card with headline, "Join us" CTA, and a brand-name marquee overlay
2. `YurekaInfoSection` — "Meet Yureka" heading + 2x4 card grid (video/image + copy cards)
3. `YurekaBackedBySection` — "500+ Credit Cards analysed" blurb + scrolling bank-logo marquee (`bankLogos` array)
4. `YurekaUseCasesSection` — "Use modes" copy + looping use-case video
5. `YurekaPortfolio` (renamed from `JackPortfolio`) — composite section: `MarqueeSection` (card image marquee from `cards`), `AboutSection`, `ServicesSection` ("What you get?"), `ProjectsSection` (scroll-stacked project cards)
6. `PartnerLogos`, `TextReveal`, `HowItWorksStepper`, `RentalProtection` (repurposed for "Portfolio Optimization"), `CalculatorCTA`, `Stats`, `Marquee`, `FAQ`, `Footer`

All sections except `HowItWorksStepper` are lazy-loaded via `React.lazy` + `Suspense` with skeleton fallbacks.

`components/ScrollytellingVideo.tsx` is a reusable scroll-scrubbed video component: it draws decoded video frames to a `<canvas>` based on scroll position (lerp-smoothed), using an `IntersectionObserver` for proximity-gated preload (`rootMargin: 800px`) — not currently wired into `MainPage` but available for scroll-driven video sections.

### Admin Dashboard (`components/AdminDashboard.tsx`)

The admin panel is accessible at `/admin` (no auth guard — it relies on hardcoded email checks in the component and `/api/auth/admin-check`). It is decomposed into sub-components under `components/admin/`:
- `AdminBlogsTab`, `AdminCardsTab`, `AdminReviewsTab` — CMS content management with full CRUD and draft/scheduled publish support
- `AdminWaitlistTab` — user approval workflow (pending → accepted/rejected/on-hold); admin team invites use `/api/admin/team` + invite email (not the open mailer)
- `AdminNotificationsTab` — push notifications to users
- `AdminTrashTab` — soft-delete recovery ("Trash Engine")
- `AdminUpdatesTab` — platform updates/changelog

### Financial Ledger / Email Scanner

`/api/scan-email` spawns `scripts/scanner.py` as a child process. The Python script uses the Gmail API + Google People API to extract transactions from emails, then:
1. Persists profile to `waitlist` table and transactions to `financial_ledger` table in Supabase
2. Caches results to `data/financial_cache.json` as a local fallback

The server schedules a daily sync at 12:00 PM local time via `setInterval`.

In the frontend, `syncLedger()` in `SupabaseProvider` first checks `localStorage` cache (`yureka_financial_ledger_<email>`), then hits `/api/financial-ledger`, using `https://yureka-api.onrender.com` as the API base in production.

### Supabase Tables

| Table | Purpose |
|---|---|
| `cards` | Credit card catalogue (published/draft) |
| `blogs` | Journal posts with scheduled publish support |
| `reviews` | Card user reviews |
| `waitlist` | User onboarding queue with status workflow |
| `users` | Admin/team members with roles |
| `newsletters` | Email subscribers |
| `financial_ledger` | Parsed Gmail transactions per user |
| `platform_notifications` | Admin-pushed notifications |
| `audit_logs` | Admin action history |

### Theming

Tailwind is configured with a dark-mode-first design system (despite the class names suggesting otherwise):
- `cream` = `#0a0a0a` (near-black background)
- `clay` = `#34d399` (emerald green — primary accent/CTA color)
- `surface` = `#111111`, `surface-hi` = `#1a1a1a`
- `ink` = `rgba(255, 255, 255, 0.9)` (body text)

Fonts (`fontFamily` in `tailwind.config.js`):
- `font-cirka` — display/heading font (falls back to Instrument Serif/Georgia), used for new homepage section headings (`Hero`, `YurekaInfoSection`, `YurekaUseCasesSection`)
- `font-overpass-mono` — monospace body copy on the new homepage sections
- `font-kanit` — used in `YurekaPortfolio`
- `font-sans` / `font-heading` = Almarai, `font-serif` / `font-blackletter` = Instrument Serif (pre-existing)

### Path Alias

`@/` maps to the repo root (configured in both `vite.config.ts` and `tsconfig.json`).

### Static Card Data

`data.ts` contains `featuredCards: Card[]` — a hardcoded fallback set used when Supabase is unavailable or for initial render before fetch completes.

### Sitemap Generation

`scripts/generate-sitemap.ts` runs at build time (`npm run build`) to generate `public/sitemap.xml`. It fetches live card and blog slugs from Supabase to build dynamic routes.

## Environment Variables

Required in `.env` (Vite prefix for client-side access):

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_SERVICE_ROLE_KEY   # Admin-only operations; optional (falls back to anon)
VITE_API_BASE_URL                # API origin (empty = same-origin /api/*)
VITE_GOOGLE_CLIENT_ID            # Gmail OAuth
VITE_GEMINI_API_KEY              # YurekaAI page
GOOGLE_CLIENT_ID                 # Server-side OAuth
GOOGLE_CLIENT_SECRET
GMAIL_USER                       # Nodemailer sender
GMAIL_APP_PASSWORD
```
