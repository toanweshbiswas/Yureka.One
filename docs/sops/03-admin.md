# Admin SOPs

For operators on **admin.yureka.one**. Roles: `viewer` (read) · `admin` (write) · `superadmin` (team + dangerous ops).

Session header: `X-Admin-Session`. Idle logout ~15 minutes.

---

## 1. Login & access

1. Open [admin.yureka.one](https://admin.yureka.one).
2. Sign in with invited admin email + password (or bootstrap credentials from Core Team. never share in Slack).
3. Confirm role under profile / Admins tab.
4. **viewer:** search and observe only. **admin+:** status changes, pushes, goldback adjust, CMS.

New admins: **Admins** tab (superadmin) → invite → they accept invite link and set password.

---

## 2. Waitlist. approve / reject / hold

1. **Waitlist** tab → filter `pending`.
2. Review score, spend signals, notes, referral.
3. Actions:
   - **Accept** → member can reach dashboard; approval email should send.
   - **Reject** → rejection email path; they stay gated.
   - **On hold** → pause without final reject.
4. Prefer **bulk status** only when intentionally processing a batch. double-check selection.
5. After accept, spot-check: member login with that email reaches `/dashboard`.

**Do not** use unauthenticated public APIs to “preview” full waitlist PII.

---

## 3. Users & activity

1. **Users** → search email.
2. Review activity / score signals before manual Goldback or status edits.
3. **Invite / create user** (admin): use when onboarding outside normal waitlist. still set waitlist status coherently.

---

## 4. Goldback

1. **Goldback** tab → accounts / ledger.
2. **Adjust** (admin+): enter user identity + delta; reason mandatory in your ops log.
3. Client self-serve earn is **disabled**. members get credit via verified conversion or this adjust path.
4. Never “test credit” large amounts on production without Management sign-off.

---

## 5. Club. commission structures & ops

Deep-link: `?tab=club&sub=offers` (or `reward-points`, `cuelinks`, `brands`, `wanderworld`, `push`, `super-browse`).

| Sub-tab | Use |
|---------|-----|
| **Offers** | Goldback **commission structure**. fixed earn per offer (`rewardPaise` / label). Create, edit, Live/Off toggle, delete. |
| **Reward points** | Default earn rates (`pointsPerHundredInr`, max % of order). Per-member **balance override** stays on Users. |
| **CueLinks** | Read-only vendor rates from CueLinks + editable **member Goldback share %** (global + optional per-campaign). Policy store only until conversion wiring. |
| **Brands** | Partner brands (also brand.yureka.one portal) |
| **WanderWorld** | Trip / catalog ops |
| **Push** | In-app notifications. **default one user**; broadcasts require explicit confirm |
| **Super Browse** | PWA store grid links |

**Goldback tab** (top nav) is balances & ledger only. not offer rates.

**Push rules**
1. Prefer single-email send for support follow-ups.
2. Broadcast only with Management approval + confirm dialog.
3. No PII of other users in notification body.

**Brand admin**
- Create/update brand, invites, offers with correct `owner`/`editor` roles.
- Paused brand → offers should not be live.

---

## 6. Blog CMS

1. **Blog** → draft / publish.
2. Upload images via admin upload (session required).
3. **Notify** on publish only when intentionally announcing to members.

---

## 7. Careers CMS

1. **Careers** tab → create / edit open roles.
2. Set **Published** for roles that should appear on [yureka.one/jobs](https://yureka.one/jobs).
3. Use **Ref ID** (e.g. `ENG-001`) for internal tracking; applicants email the apply address with that ref in the subject.
4. **Sort order** controls listing order (lower numbers first).

---

## 8. Gift cards overview

- Monitor orders from overview / gift surfaces.
- Payment disputes → Integrations (Razorpay / Hubble).
- Do not paste full voucher secrets into group chat.

---

## 9. Daily admin checklist

- [ ] Pending waitlist &lt; threshold or explicitly deferred
- [ ] No stuck gift orders &gt; 1h without note
- [ ] No accidental broadcast in last 24h
- [ ] Goldback adjusts have ticket IDs
- [ ] Sign out on shared machines

---

## 10. Forbidden

- Sharing `ADMIN_PASSWORD` / session tokens
- Approving yourself without second pair of eyes (founders: still log it)
- Calling legacy `/api/v1/admin/*` for data (returns 401 by design)
- Disabling auth checks “temporarily” in production
