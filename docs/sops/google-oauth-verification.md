# Google OAuth — “App hasn’t been verified” fix

> **Symptom:** Gmail sync shows *“Google hasn’t verified this app”* and developer `yureka2026@gmail.com`.  
> **Cause:** `gmail.readonly` is a **restricted scope**. Unverified apps in **Production** publishing status always show this warning.

---

## Path A — Immediate (waitlist / beta, up to ~100 users)

Use while full verification is in progress.

### 1. Open Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the project that owns OAuth client `999408043168-…` (same as `GOOGLE_CLIENT_ID` in `.env`)
3. **APIs & Services → OAuth consent screen**

### 2. Keep app in **Testing** (not Production)

| Field | Value |
|-------|--------|
| User type | **External** (unless you have Google Workspace) |
| Publishing status | **Testing** |
| App name | `Yureka.One` |
| User support email | `yureka2026@gmail.com` |
| Developer contact | `yureka2026@gmail.com` |

### 3. Add branding & legal URLs

| Field | URL |
|-------|-----|
| Application home page | `https://app.yureka.one` |
| Privacy policy | `https://yureka.one/privacy-policy` |
| Terms of service | `https://yureka.one/terms-of-service` |

### 4. Scopes (keep minimal)

On the consent screen, only these should be listed for the Gmail flow:

| Scope | Purpose |
|-------|---------|
| `…/auth/userinfo.email` | Sign-in (Supabase Google provider) |
| `…/auth/userinfo.profile` | Sign-in display name |
| `openid` | Sign-in |
| `…/auth/gmail.readonly` | Optional inbox sync (bills & spend) |

**Remove** any unused scopes (People API phone/birthday/gender/address) — they delay verification and are not requested by the app anymore.

### 5. Add **Test users**

Under **OAuth consent screen → Test users**, add every email that needs Gmail sync, e.g.:

- `mainaksaha0807@gmail.com`
- `sakshukhade@gmail.com`
- `work.mainaksaha@gmail.com`
- …all waitlist / dashboard testers

Test users can click **Advanced → Go to Yureka.One (unsafe)** and proceed. Non-test users will be **blocked** while status is Testing.

### 6. OAuth client (Web)

**APIs & Services → Credentials → OAuth 2.0 Client ID (Web)** used by `VITE_GOOGLE_CLIENT_ID`:

**Authorized JavaScript origins**

```
https://app.yureka.one
https://yureka.one
https://admin.yureka.one
http://localhost:3000
```

**Authorized redirect URIs** (GIS offline code flow)

```
https://app.yureka.one
http://localhost:3000
```

(`postmessage` is used for popup code exchange — origins must match the page host.)

### 7. Enable APIs

**APIs & Services → Library** — enable:

- Gmail API
- Google People API (optional; profile falls back to Gmail `users.getProfile` if unavailable)

---

## Path B — Production (remove warning for all users)

Required before public launch of Gmail sync.

### 1. Complete Path A setup first

Consent screen, privacy policy, homepage, and scopes must be final.

### 2. Submit for verification

1. **OAuth consent screen → Publish app** (move Testing → **In production** triggers review)
2. Or use **Submit for verification** when prompted for restricted scopes
3. Provide:
   - **Scope justification** for `gmail.readonly`: read-only parsing of financial emails (statements, bills, payment alerts) for spend tracking and credit-card due dates; no email send/modify; no ads
   - **Demo video** (~2–5 min): sign in → dashboard → Sync Gmail → consent → bills/expenses populated → revoke in Google Account settings
   - **Privacy policy** URL (must mention Gmail limited use — see `landing/PrivacyPolicy.tsx`)
   - **Test credentials** if Google requests them

### 3. Restricted scope security assessment

Google may require a **CASA / third-party security assessment** for `gmail.readonly` at scale. Budget **2–8 weeks** and possible vendor cost. Plan early.

### 4. Google Limited Use Policy

App must comply with [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy) (Limited Use). Privacy policy already states we do not sell Gmail data or use it for ads.

---

## Checklist (copy/paste)

```
[ ] OAuth consent screen = Testing (beta) OR submitted for Production verification
[ ] Test users added for all beta Gmail sync users
[ ] Privacy policy live: https://yureka.one/privacy-policy
[ ] Terms live: https://yureka.one/terms-of-service
[ ] Only gmail.readonly (+ basic profile scopes for login) on consent screen
[ ] Authorized JS origins include app.yureka.one + localhost:3000
[ ] Gmail API enabled in Cloud project
[ ] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET match this Cloud project
[ ] VITE_GOOGLE_CLIENT_ID matches Web client ID (same project)
```

---

## Verify after changes

1. Incognito window → `https://app.yureka.one/login`
2. Dashboard → **Sync Gmail**
3. Test user should see consent screen (may still say unverified in Testing — **Advanced → Continue** works)
4. Non-test user in Testing mode should get `access_denied` / blocked

---

## Cross-Account Protection (RISC)

Google Sign-in users get security event tokens when their Google account is hijacked, sessions are revoked, or OAuth tokens are revoked. Receiver: `POST /api/auth/google-risc`.

### Cloud Console (once)

1. Same OAuth project as `GOOGLE_CLIENT_ID`
2. Enable [RISC API](https://console.cloud.google.com/apis/library/risc.googleapis.com)
3. Create a service account with role **RISC Configuration Admin** (`roles/riscconfigs.admin`)
4. Download the JSON key. Put the path or JSON in `GOOGLE_RISC_SA_JSON` (server only)
5. OAuth consent **Authorized domains** must include the receiver host (`app.yureka.one` if Apache proxies `/api/*`, otherwise the Render API host)

### Env

```
GOOGLE_RISC_SA_JSON=./secrets/risc-sa.json
RISC_RECEIVER_URL=https://app.yureka.one/api/auth/google-risc
RISC_AUTO_REGISTER=true
```

On API boot the stream is registered only if `RISC_AUTO_REGISTER=true`. Otherwise:

```
pnpm risc:register
pnpm tsx backend/scripts/risc-register.ts --verify
```

### What we do on events

| Event | Action |
|-------|--------|
| sessions-revoked / hijacking / tokens-revoked | Sign out all Yureka sessions |
| tokens-revoked / token-revoked / hijacking | Drop stored Gmail refresh tokens |
| verification | Log only |

RISC is not a substitute for OAuth verification / CASA.

---

## References

- [OAuth verification FAQ](https://support.google.com/cloud/answer/9110914)
- [Gmail API policy](https://developers.google.com/gmail/api/policy)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
