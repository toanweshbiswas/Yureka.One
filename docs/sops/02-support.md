# Support SOPs

For customer support / success. Tool: **admin.yureka.one** (viewer or admin role). Escalate to Admin / Core Team when noted.

---

## 1. Shift checklist

1. Sign in at [admin.yureka.one](https://admin.yureka.one).
2. Open **Waitlist** — scan new `pending` rows.
3. Open **Users** / activity for any open tickets.
4. Check **Club → Push** only if asked to send (admin role); prefer one-user sends.
5. Log ticket outcomes in your CS tool (email + action + time).

---

## 2. Find a member

1. Admin → **Waitlist** or **Users**.
2. Search by **exact email** (preferred) or name / phone fragment.
3. Record: `status`, `yurekaScore`, `joinedAt`, mobile, monthly spend (need-to-know only).

**Statuses**

| Status | Meaning | Member sees |
|--------|---------|-------------|
| `pending` | In queue | Waiting room |
| `accepted` | Can use dashboard | `/dashboard` |
| `on_hold` / on-hold | Paused review | Waiting room |
| `rejected` | Declined | Waiting room (rejected UI) |

Do **not** change status unless you have **admin** role and follow Admin SOP “Approve / reject”.

---

## 3. Common tickets

### A. “I applied but can’t get in”

1. Confirm email spelling vs waitlist row.
2. If `pending` / `on_hold` → explain review in progress; no dashboard yet.
3. If `accepted` → ask them to login with **that** email; clear cache / try Incognito.
4. If no row → send join link: `https://app.yureka.one/join-waitlist`.

### B. “I was accepted but still waiting”

1. Confirm status is `accepted`.
2. Ask: Google login vs password — must match waitlist email.
3. If still broken → escalate Core Team (auth / status API).

### C. Gmail / expenses empty or error

1. Ask them to reconnect Gmail from Expenses.
2. Note Google may block unverified OAuth for new accounts — Core Team owns OAuth verification.
3. Resync quota: **5 / 15 days**. Soft refresh is fine; force resync burns quota.
4. Do not ask them to paste Gmail access tokens into chat.

### D. Goldback not credited

1. Explain: opening an offer only **tracks click**; credit after **verified purchase / conversion**.
2. Admin **Goldback → adjust** is for ops correction (admin role) — see Admin SOP; log reason.

### E. Gift card not received

1. Collect: email, phone used at checkout, approximate time, amount.
2. Admin → overview / gift activity if available; else escalate Integrations (Hubble / Razorpay).
3. Never resend voucher codes in public Slack — use email to the buyer only.

### F. Notification / email not received

1. Check spam; from address `support@yureka.one`.
2. Confirm email on waitlist row.
3. If Resend failing → escalate Integrations.

---

## 4. Reply snippets (tone: clear, short)

**Pending**

> Thanks for applying to Yureka. Your application is still under review. We’ll email you at this address when you’re approved. You can check status anytime by signing in at app.yureka.one/login.

**Accepted but can’t access**

> You’re approved on our side for `{email}`. Please sign in with that same email (Google or password). If it still opens Waiting, reply with a screenshot of the page and we’ll escalate.

**Resync limit**

> Inbox force-resync is limited to 5 times every 15 days to protect your quota and our scanners. Soft refresh still updates when possible. The counter resets after the window — we can’t raise it from Support without engineering.

**Goldback**

> Goldback is credited after a verified purchase through the partner flow, not when you only open the offer. If you completed a purchase and it’s been over 48h, reply with the merchant + date and we’ll check.

---

## 5. Escalation matrix

| Issue | Escalate to |
|-------|-------------|
| Status change / bulk approve | Admin operators |
| Goldback manual credit | Admin (log reason) |
| Payment / voucher / webhook | Integrations |
| OAuth / API 5xx / data bug | Core Team |
| Abuse, legal, deletion, press | Management |

---

## 6. Privacy

- Verify requester owns the email (login screenshot or reply-from that address).
- Never dump full waitlist CSV into tickets.
- No password resets via admin guesswork — use product reset email.
