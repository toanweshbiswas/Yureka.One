# Core Team SOPs

For engineers shipping and operating Yureka.One (`Yureka.One/` monorepo: Vite SPA + Express + Python scanner).

---

## 1. Environments & hosts

| Env | App | API | Notes |
|-----|-----|-----|-------|
| Local | `pnpm dev` :5173 / :3000 | Express same process | All hosts map locally |
| Prod web | Hostinger / Cloudflare | Render (or current API host) | Split hosts via `shared/hosts.ts` |

Hosts: `yureka.one` · `app.yureka.one` · `admin.yureka.one` · `brand.yureka.one`.

---

## 2. Ship checklist

1. Branch off default; PR with test plan (auth paths if touched).
2. Migrations: apply Supabase SQL before relying on new columns (`backend/supabase/migrations/`).
3. Env: update Render + build-time `VITE_*` separately; never commit `.env`.
4. Deploy API first if contract changes; then frontend.
5. Smoke:
   - [ ] `GET /api/v1/health`
   - [ ] Login + `/api/v1/auth/status` with Bearer
   - [ ] Admin login + `GET /api/admin/waitlist` with session
   - [ ] Unauthenticated `GET /api/v1/admin/waitlist` → **401**
   - [ ] Expenses soft sync (if scanner changed)

---

## 3. Auth & security baselines (do not regress)

| Rule | Implementation |
|------|----------------|
| Member PII routes | `requireAuthEmail` / `resolveVerifiedIdentity` (Supabase `getUser`) |
| No forged JWT `sub` | Never authorize from decoded-only payload in production |
| No spoof `x-user-id` in prod | `ALLOW_HEADER_USER_ID` off unless explicit |
| Admin data | `/api/admin/*` + `X-Admin-Session` only |
| Legacy `/api/v1/admin/*` | Stay 401 stubs |
| Ledger / scan-email | Bind to verified or Gmail-derived email |
| Goldback earn | Deny client self-serve unless `ALLOW_CLIENT_GOLDBACK_EARN` |
| CORS | Allowlist; no `CORS_ALLOW_ANY` in prod |
| Waitlist public lookup | `{ exists }` only. no status |
| Marketplace refresh | Admin session required |

Before merging auth-related PRs: run through `/review-security` mindset on new routes.

---

## 4. Secrets

| Secret | Where |
|--------|--------|
| Supabase service role | Server only |
| `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD` | Server |
| Google client secret | Server (+ public client id in Vite) |
| Resend, Hubble, Razorpay, CueLinks, OpenAI | Server |
| Firebase web config | Public OK; restrict API key referrers |

**Leak response:** rotate → redeploy → invalidate sessions if admin secret leaked → notify Management.

---

## 5. Scanner / Python

1. API host must have venv + deps (`scripts/ensure-python-deps.sh`).
2. Change `scanner.py` → redeploy API; ask Support to tell users to soft-refresh / one resync.
3. Keep lifestyle vs investment separation (Expenses ≠ Planning).
4. Cap heavy AI; prefer heuristics for planning GET.

---

## 6. Data model touchpoints

| Concern | Store |
|---------|--------|
| Waitlist | Supabase `waitlist` (+ file fallback in some modes) |
| Admins | Admin tables / file |
| Ledger cache | Per-email cache via scanner runner |
| Goldback | Goldback store (Supabase/file) |
| Notifications | `platform_notifications` |
| Brands | Brand store |

Prefer service-role server writes; client uses anon + RLS where applicable. **Express is the control plane** for sensitive ops.

---

## 7. On-call triage

| Signal | First look |
|--------|------------|
| 401 storm on dashboard | Supabase Auth / clock skew / `getUser` failures |
| 429 RESYNC_LIMIT tickets | Expected; explain quota |
| 5xx on scan | Python process logs on API host |
| Empty admin waitlist | Session header missing; wrong host CORS |
| CORS browser errors | Origin not on allowlist |

---

## 8. Local safety

- `NODE_ENV=development` may allow header user id. never point local `.env` service role at prod without care.
- Don’t run destructive SQL on prod from laptop without a change ticket.
- Dummy waitlist data is fine locally; scrub before screenshots for external shares.

---

## 9. Definition of done (feature)

- [ ] User path documented or Support notified of behavior change
- [ ] Admin path updated if operators need a new control
- [ ] No new unauthenticated PII route
- [ ] Errors are actionable (codes Support can cite)
- [ ] Rollback plan (previous Render deploy / prior frontend build)

---

## 10. Related docs

- Index: [README.md](./README.md)
- Product notes: `CLAUDE.md` (treat as partially stale on paths; prefer this SOP + code)
- Env template: `.env.example`
