# Integration SOPs

For engineering / ops owning vendors and webhooks. Production API typically on Render; frontends on Hostinger/Cloudflare.

---

## 1. Map of systems

| System | Purpose | Config (server) | Member-facing |
|--------|---------|-----------------|---------------|
| **Supabase Auth** | Consumer + brand JWT | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Login / session |
| **Gmail API** | Read-only inbox scan | `GOOGLE_CLIENT_ID/SECRET` | Waitlist score, expenses |
| **Scanner** | Python `scanner.py` | venv + deps on API host | Ledger + score |
| **Resend** | Transactional email | `RESEND_API_KEY`, `MAIL_FROM_*` | Approvals, resets |
| **Hubble** | Gift vouchers | Hubble keys | Gift cards |
| **Razorpay** | Checkout | Razorpay keys | Gift payment |
| **CueLinks** | Marketplace offers | CueLinks token | Offers tab |
| **Firebase** | Analytics (public web config) | Client `shared/firebase.ts` | Prod analytics |
| **OpenAI** | Optional score refine | `OPENAI_API_KEY`, `OPENAI_ENABLED`, `SCORE_AI` | Score polish only |

Client Supabase anon key is expected public; **service role must never** be in `VITE_*`.

---

## 2. Gmail / scanner

### Healthy behavior
- `POST /api/v1/ledger/scan`. authenticated; email must match JWT.
- Waitlist `POST /api/scan-email`. score bound to **Gmail profile email**, not spoofed body email.
- Resync quota: 5 / 15 days (`resyncQuota`).

### Incidents

| Symptom | Check |
|---------|--------|
| Mass AUTH_EXPIRED | Google OAuth consent / token revoke; client ID on correct hosts |
| 403 access_denied for new users | OAuth app still in testing. add test users or complete verification |
| Scanner timeouts | API host Python venv; `ensure-python-deps`; memory on Render |
| Wrong merchants / CRED as expense | Scanner filters + marketing filter; redeploy API |

### SOP. rotate Google OAuth
1. Create credentials in Google Cloud; update env on API + Vite build.
2. Update authorized redirect URIs for `app.yureka.one`.
3. Redeploy API + frontend; smoke: waitlist Gmail + dashboard Expenses connect.

---

## 3. Email (Resend)

1. Prefer `RESEND_API_KEY` over Gmail SMTP.
2. From: `support@yureka.one` (verify domain in Resend).
3. Test: approve a staging waitlist user → approval email arrives.
4. If bounce spikes → check DNS (SPF/DKIM) then pause campaigns.

---

## 4. Gift cards (Hubble + Razorpay)

### Paths
- Member: `/api/giftcards/*`
- Webhooks: `/api/hubble/webhooks/*`, `/api/razorpay/webhooks` (HMAC / signature verify)

### SOP. failed voucher after paid
1. Confirm Razorpay payment captured.
2. Check Hubble order id on our order row.
3. Replay/poll only with documented admin/tools. never invent voucher codes.
4. If webhook missed: verify endpoint URL + secrets on vendor dashboards match production.

### SOP. rotate keys
1. Dual-run old/new if vendor allows; else maintenance window.
2. Update env; redeploy API; place ₹1 to min test order on staging if available.

---

## 5. CueLinks marketplace

- Public list OK; **`POST /api/marketplace/refresh`** requires **admin session**.
- Campaigns (brand payouts): **`GET /api/marketplace/campaigns`** (also `/api/cuelinks/campaigns`)
  - `filter=all|cpc|ppc|new_existing`. CPC = pay-per-click; `new_existing` = rows with New/Existing User rates
  - Each item includes `isPayPerClick`, `newUserCommission`, `existingUserCommission`, full `payoutCategories`
- Rate / cost: do not script refresh from untrusted clients.
- Media proxy allowlists CueLinks CDN hosts only.

---

## 6. Brand portal

- Host: `brand.yureka.one`
- Auth: Supabase JWT; membership attach only if invite email matches.
- Events: authenticated + rate limited; catalog of **live** offers is public by design.

---

## 7. OpenAI

- Default: keep `OPENAI_ENABLED` intentional; score refine only when `SCORE_AI` allows.
- Planning overview should not burn tokens on every GET.
- If key leaked: revoke in OpenAI dashboard; rotate env; redeploy.

---

## 8. Firebase Analytics

- Web config in DevTools is **normal** (projectId, measurementId, etc.).
- Harden in Google Cloud: API key **HTTP referrer** restrictions to Yureka hosts.
- Ensure Analytics-only; no open Storage/Firestore rules for PII.

---

## 9. Webhook & CORS checklist (prod)

- [ ] Hubble + Razorpay webhook URLs point at production API
- [ ] CORS allowlist includes app / admin / brand / landing (no `CORS_ALLOW_ANY` in prod)
- [ ] Admin session secret set (`ADMIN_SESSION_SECRET`)
- [ ] Service role key only on server

---

## 10. Escalation

| Failure | Owner |
|---------|--------|
| Payments / vouchers | Integrations + Management (refunds) |
| Auth / JWT / Supabase | Core Team |
| Email deliverability | Integrations |
| Vendor outage | Status page note via Management |
