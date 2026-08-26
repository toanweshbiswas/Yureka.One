# Management SOPs

For founders / leads. Focus: access, risk, escalation, and member trust. not day-to-day ticket macros.

---

## 1. Ownership map

| Area | Day-to-day | Accountable |
|------|------------|-------------|
| Waitlist quality & brand | Admin operators | Management |
| Support SLAs | Support | Management |
| Payments & partners | Integrations | Management |
| Security / prod access | Core Team | Management |
| Press / legal / deletion | Management | Management |

---

## 2. Access governance

1. **Admin portal:** least privilege. Support = `viewer` when possible; status changes = `admin`; invites = `superadmin`.
2. Offboard within **24h**: disable admin row; rotate shared secrets if that person had env access.
3. Production `.env` / Render / Supabase / Google Cloud: named owners only; no shared “team” password DMs.
4. Approve `ALLOW_CLIENT_GOLDBACK_EARN=true` only for short-lived staging experiments. never leave on in prod.

---

## 3. Waitlist policy

1. Define acceptance bar (score, spend, fraud signals) with Admin; write it down.
2. Bulk accepts only with a named batch owner + Support ready for login spikes.
3. Rejections: consistent reason category (risk / capacity / incomplete). Support uses approved scripts.
4. Hold status for KYC-like follow-ups; don’t leave forever without a touch.

---

## 4. Incident command (sev)

| Sev | Examples | Response |
|-----|----------|----------|
| **SEV-1** | PII leak, open waitlist dump, payment double-charge, auth bypass | Core Team + Management on call; public APIs locked; postmortem in 48h |
| **SEV-2** | Gift cards down, email outage, Gmail OAuth broken for all | Integrations lead; status note to Support |
| **SEV-3** | Single-user bugs, quota confusion | Support → Admin → Core Team as needed |

**SEV-1 first hour**
1. Confirm blast radius (who can call what unauthenticated).
2. Patch or feature-flag; redeploy.
3. Rotate exposed secrets.
4. Tell Support what members should hear (one paragraph).
5. Schedule blameless postmortem.

---

## 5. Money & Goldback

1. Manual Goldback adjusts need ticket ID + reason; sample audit weekly.
2. Partner offer economics: Club offers vs CueLinks. no conflicting promises in marketing.
3. Refunds: Razorpay/Hubble process per Integrations SOP; Management approves goodwill credits.

---

## 6. Communications

1. Outages: short note for Support + optional banner; don’t over-promise ETA.
2. Broadcast push: Management approval required (Admin confirms in UI).
3. External: only approved spokespeople; no live API keys in screenshots.

---

## 7. Privacy & compliance requests

1. Access / deletion requests: verify identity → Core Team executes → confirm to requester.
2. Do not export full waitlist for “analysis” without a written purpose and retention limit.
3. Firebase / analytics: keep PII out of event params.

---

## 8. Cadence

| Meeting / ritual | Cadence |
|------------------|---------|
| Waitlist + funnel review | Weekly |
| Goldback / gift exceptions audit | Weekly |
| Vendor health (Hubble, Razorpay, Resend, Google) | Biweekly |
| Security review of new routes | Every release touching auth |
| Access review (admins + cloud) | Monthly |

---

## 9. Decision log (keep in Notion/Drive)

For each material decision: date, decision, owner, revisit date. Examples: OAuth verification timeline, self-serve earn policy, resync quota, open catalog.
