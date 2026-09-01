# Ledger / Gmail Email Sync — Audit & Stability Plan

> **Status:** Implemented (Phases 0–4, Aug 2026)  
> **Goal:** Store credit-card bills and spend data reliably, Cred-style, without corrupting user data on repeated saves.

---

## How Cred does it (reference)

CRED Protect ([privacy policy](https://cred.club/legal/privacy)) uses:

1. **OAuth 2.0 + Gmail API** — read-only access via Google’s token flow (not password/IMAP).
2. **Domain/sender filtering** — only financial mail (card statements, dues, bank alerts); not arbitrary inbox reading in product UX.
3. **Metadata-first bill parsing** — due amount and due date are often taken from **email subject/snippet**, not PDF attachments (PDFs may use bank-specific password logic separately).
4. **Persistent server storage** — refresh tokens stored server-side; scans re-run on schedule or on demand.
5. **CRED Protect toggle** — user can revoke Gmail access anytime.

**What Yureka already matches:** OAuth readonly token, bill scanner with financial scoring, metadata-only bill pass (`execute_bill_scanner`), promo filtering.

**What Yureka is missing vs Cred:** single source of truth in DB, stable user key, incremental sync, no cross-user cache bleed, refresh-token storage for background re-scan.

---

## Current architecture (Yureka)

```
Gmail OAuth (sessionStorage: yureka_gmail_readonly_token)
        │
        ▼
POST /api/v1/ledger/scan  (dashboard)   OR   POST /api/scan-email  (waitlist)
        │
        ▼
backend/scripts/scanner.py
  • execute_expense_scanner   → Transaction
  • execute_investment_scanner → Transaction
  • execute_bill_scanner      → Credit Card Bill / Invoice / Bill
  • merge dedupe: brand|date|amount (weak)
        │
        ▼
writeLedgerCache(email) → data/financial_cache/<email>.json
                        → data/financial_cache.json  ⚠️ LAST WRITER WINS (all users)
        │
        ▼
persistScoreToWaitlist → waitlist row (score only)
        │
        ▼
GET /api/v1/ledger → readLedgerCache
        │
        ▼
Browser localStorage yureka_financial_ledger_<email>
  • shouldPreferServer(): count/spend/6h heuristic — can keep bad local data
```

**Note:** `financial_ledger` Supabase table is documented in `CLAUDE.md` but **never written to**. Planning extra-inboxes already use the better pattern: `planning_inbox_cache` (Supabase) + file mirror (`backend/lib/planning/cache.ts`).

---

## Root causes of “messed up” data

| # | Issue | Impact |
|---|--------|--------|
| 1 | **Global `financial_cache.json`** | Every scan overwrites one shared file; fallback reads can serve wrong user’s transactions. |
| 2 | **Full overwrite on rescan** | Partial/failed scan replaces entire prior ledger; no merge by message ID. |
| 3 | **Email key split** | Waitlist caches by **Gmail profile email**; dashboard caches by **Supabase auth email** → two files for one person. |
| 4 | **Ephemeral EC2/Render disk** | `data/financial_cache/` lost on redeploy; users rely on stale localStorage. |
| 5 | **localStorage wins heuristically** | More rows ≠ correct rows; duplicates inflate “prefer local”. |
| 6 | **Weak Python dedupe** | Expense dates ISO, bill dates RFC → same txn twice; key ignores `sender`/`messageId`. |
| 7 | **Daily cron (`server.ts`)** | Single `GOOGLE_REFRESH_TOKEN` writes global cache only — wrong for multi-user. |
| 8 | **No bill-specific store** | Bills mixed with expenses; Bills tab filters client-side only. |

---

## Target architecture (Cred-stable)

### 1. Canonical identity: `user_id` (Supabase UUID)

Never key ledger storage on email alone.

```
Primary key: (user_id, inbox_gmail)
```

- Primary inbox: `(user_id, primary_gmail)` where `primary_gmail` is the connected Gmail.
- Map `auth.email` → `user_id` at API boundary; resolve Gmail profile email once and store in `ledger_connections`.

### 2. Supabase table (mirror `planning_inbox_cache`)

```sql
-- supabase/migrations/0xx_financial_ledger_cache.sql
create table if not exists public.financial_ledger_cache (
  user_id text not null,
  gmail text not null,
  scanned_at timestamptz not null default now(),
  profile jsonb not null default '{}'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  score jsonb,
  scan_version int not null default 1,
  primary key (user_id, gmail)
);

create index if not exists financial_ledger_cache_user_idx
  on public.financial_ledger_cache (user_id);

alter table public.financial_ledger_cache enable row level security;
```

Optional normalized table later:

```sql
financial_ledger_transactions (
  id uuid primary key,
  user_id text not null,
  gmail_message_id text,          -- Gmail API id → idempotent upsert
  brand_name text,
  amount_inr numeric,
  tx_date timestamptz,
  tx_type text,                   -- Transaction | Credit Card Bill | ...
  raw jsonb,
  unique (user_id, gmail_message_id)
);
```

### 3. Write path: merge, don’t clobber

On scan complete:

1. Load existing transactions for `(user_id, gmail)`.
2. Assign stable `id` per row: `gmailMessageId` or hash(`sender|subject|date|amount`).
3. **Upsert** new rows; keep rows not seen in scan if within retention window (e.g. 24 months).
4. Store `scanned_at`, `scan_version`.
5. Write Supabase first, then optional file mirror (dev fallback only).

Remove: global `financial_cache.json`, full-file overwrite without merge.

### 4. Bill scanner improvements (Cred-like)

Current: metadata-only, `maxResults=300`, snippet amount extraction — good start.

Improvements:

| Area | Change |
|------|--------|
| Senders | Allowlist HDFC, ICICI, Axis, SBI, Amex, etc. (like Cred domain focus) |
| Fields | Explicit `dueDate`, `minimumDue`, `totalDue` on bill rows |
| Query | Gmail `newer_than:90d` incremental on resync (not full inbox every time) |
| PDF | Phase 2: password-from-DOB pattern per bank (Cred-style); keep off by default |
| Dedupe | Normalize all dates to ISO; key = `messageId` or `sender\|date\|amount\|type` |

### 5. OAuth refresh tokens (background sync)

Cred re-scans without user present. Yureka today only has ephemeral `sessionStorage` access tokens.

- Store encrypted refresh token per `(user_id, gmail)` in Supabase (`ledger_connections`).
- Background job: per-user refresh → incremental Gmail query since `last_scanned_at`.
- **Remove** single-account `GOOGLE_REFRESH_TOKEN` daily cron.

### 6. Client cache rules

localStorage = **UI cache only**, never source of truth:

- Always trust server if `server.scanned_at > local.cached_at`.
- Drop `shouldPreferServer` count/spend heuristic.
- On scan success: replace local entirely from server response.
- TTL: 1h soft refresh from GET `/api/v1/ledger` (no Gmail quota).

### 7. Unify API routes

| Route | Action |
|-------|--------|
| `POST /api/v1/ledger/scan` | Keep; add merge + Supabase write |
| `POST /api/scan-email` | Delegate to same `ledgerService.scan()`; key by `user_id` when JWT present |
| `GET /api/financial-ledger` | Deprecate → redirect to `/api/v1/ledger` |
| Daily cron | Replace with per-user queue (Render cron or Supabase pg_cron) |

---

## Implementation phases

### Phase 0 — Stop the bleeding ✅

- [x] Stop writing/reading shared `data/financial_cache.json`
- [x] Disable dangerous daily global cron
- [x] Document that `data/financial_cache/` is runtime-only, never commit

### Phase 1 — Supabase cache ✅

- [x] Add migration `019_financial_ledger_cache.sql`
- [x] New `backend/lib/ledger/cache.ts` modeled on `planning/cache.ts`
- [x] `readLedgerCache` / `writeLedgerCache` → Supabase + file mirror + merge
- [x] Key by `user_id` from JWT; store `gmail` from scan profile
- [x] Mirror waitlist id ↔ Supabase auth id on read/write
- [x] Client trusts server `scannedAt` over local heuristics

### Phase 2 — Merge & message IDs ✅

- [x] Gmail `messageId` on all scanner passes
- [x] `mergeLedgerTransactions()` with 24-month retention
- [x] Normalize dates in Python before dedupe
- [x] Waitlist ↔ auth id mirroring on read/write

### Phase 3 — Bills product parity ✅

- [x] Structured bill fields (`dueDate`, `minimumDue`, `totalDue`)
- [x] Expanded bank sender allowlist in bill query
- [x] Incremental scan via `sinceDays` / `newer_than`
- [x] `GET /api/v1/ledger/bills` + Bills tab uses server filter

### Phase 4 — Refresh tokens & scheduled sync ✅

- [x] `ledger_connections` migration + encrypted storage
- [x] OAuth code exchange (`POST /api/v1/ledger/connect`)
- [x] Offline Gmail consent on first sync (GIS code client)
- [x] Weekly background resync (`scheduleWeeklyLedgerSync`)
- [x] Backfill script: `pnpm ledger:backfill`

---

## Files to change (by phase)

| File | Phase |
|------|-------|
| `backend/lib/ledger/scannerRunner.ts` | 0, 1 |
| `backend/lib/ledger/cache.ts` | 1 (new) |
| `backend/lib/ledger/merge.ts` | 2 (new) |
| `backend/lib/publicApi/routes.ts` | 1, 2 |
| `backend/server.ts` | 0, 1 |
| `backend/scripts/scanner.py` | 2, 3 |
| `shared/SupabaseProvider.tsx` | 1, 6 |
| `supabase/migrations/0xx_*.sql` | 1, 4 |
| `CLAUDE.md`, `ScannerProgress.tsx` | 1 (fix stale financial_ledger docs) |

---

## EC2 / ops notes

- Pulled `data/financial_cache/*.json` from EC2 contains **real user PII** — treat as secrets, gitignored.
- After Phase 1, backfill: one-time script to upload existing JSON files into `financial_ledger_cache` keyed by waitlist `user_id`.
- Persistent volume or Supabase-only storage required before scaling to multiple EC2 instances.

---

## Decision summary

**Recommendation:** Adopt the **same dual-write pattern as Planning** (`planning_inbox_cache` + optional file mirror), keyed by **`user_id`**, with **merge-by-message-id** instead of full overwrite. Align bill extraction with Cred’s metadata-first, sender-filtered approach; add refresh tokens later for passive due-date reminders.

This gives stability without a big-bang rewrite of the Python scanner.
