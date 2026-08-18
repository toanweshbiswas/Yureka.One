# Gmail spending sync (consent + scan)

## What each Google flow grants

| Flow | Where | Scopes | Purpose |
|------|--------|--------|---------|
| Login | Supabase OAuth on `app.yureka.one/login` | `openid email profile` | Sign-in only |
| Waitlist join | GIS on `/join-waitlist` | login scopes, then `gmail.readonly` | Prefill + Yureka Score |
| Dashboard resync | GIS from Expenses / Bills | `gmail.readonly` | Pull purchase/bill emails |

`gmail.readonly` is a **restricted** Google scope. Until Google verifies the app:

- Only emails listed under OAuth consent screen → **Test users** can grant inbox access.
- Waitlist **does not** auto-request Gmail anymore (avoids Error 403 for the public).
- Users can optionally tap **Compute Yureka Score** on step 2, or skip and finish the form.

## Google Cloud checklist

1. OAuth client (Web) authorized JavaScript origins:
   - `https://app.yureka.one`
   - `https://yureka.one`
   - `https://www.yureka.one`
   - temporary: `https://13-57-223-228.sslip.io`
2. Enable APIs: **Gmail API** (required), People API (optional profile enrichment).
3. Consent screen: External + Testing, add your Gmail as a test user until verification.

## App behavior

- Dashboard **Resync Inbox** opens Google consent for read-only Gmail, then calls `POST /api/v1/ledger/scan`.
- Waitlist scoring calls same-origin `POST /api/scan-email` (no longer defaults to Render).
- Ledger cache is stored per email under `data/financial_cache/`.

## Scanner quality (expenses / bills)

The Python scanner (`backend/scripts/scanner.py`) now:

- Excludes Gmail **Promotions / Social / Forums** categories and newsletter/sale subjects
- Pulls bank + UPI senders (HDFC, ICICI, SBI, Kotak, PhonePe, Paytm, GPay, CRED, …) plus merchant receipts
- Prefers **debited / spent / order total** amount patterns; ignores “Save ₹X / Flat OFF” promo figures
- Drops marketing mail unless a strong debit/statement signal is present
- Tightens bill scoring (no bare `has:attachment` catch-all)

## Health check

```bash
curl -s https://app.yureka.one/api/score/health
# {"status":"ok","scoring":true,...}
```
