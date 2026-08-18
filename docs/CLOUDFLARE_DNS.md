# Cloudflare DNS → AWS EC2 (`yureka.one`)

**EC2 public IPv4:** `13.57.223.228`  
**Instance:** `i-0fc71adcbbce91e3e`  
Recommend attaching an **Elastic IP** so these records stay stable.

## Host map

| Hostname | Purpose |
|----------|---------|
| `yureka.one` / `www.yureka.one` | Marketing landing |
| `app.yureka.one` | Waitlist, login, waiting room, dashboard |
| `admin.yureka.one` | Admin backoffice |

## Records to add in Cloudflare

Cloudflare → your zone `yureka.one` → **DNS** → **Records**.

| Type | Name | Content | Proxy status | TTL |
|------|------|---------|--------------|-----|
| A | `@` | `13.57.223.228` | **DNS only** (grey cloud) while issuing certs | Auto |
| A | `www` | `13.57.223.228` | DNS only | Auto |
| A | `app` | `13.57.223.228` | DNS only | Auto |
| A | `admin` | `13.57.223.228` | DNS only | Auto |

Notes:

- Use **A** records to the Elastic IP (preferred) or current public IP.
- Keep proxy **DNS only** until Let’s Encrypt succeeds on the EC2 box. After HTTPS works, you can turn **Proxied** (orange cloud) on and set SSL/TLS mode to **Full (strict)**.
- **Error 521** = Cloudflare cannot reach origin TLS. Origin must listen on **443**, and Cloudflare SSL/TLS mode must be:
  - **Full** while using the temporary self-signed origin cert, or
  - **Full (strict)** only after Let’s Encrypt (or a Cloudflare Origin CA cert) is installed.
  - Avoid **Flexible** long-term (mixed HTTP to origin).
- Temporary host `https://13-57-223-228.sslip.io` **301-redirects** to production hosts (path-mapped). Prefer bookmarks to `yureka.one` / `app.yureka.one`.
- **Supabase Auth → URL configuration** Site URL must be `https://app.yureka.one` (not sslip), or Google login will bounce users back to the temporary domain.
- Do **not** create a CNAME for `@` (apex) unless you use Cloudflare CNAME flattening intentionally — A records are simplest here.

Optional mail / verification records are separate from this app cutover.

## After DNS propagates

On the EC2 host:

```bash
sudo certbot --nginx \
  -d yureka.one \
  -d www.yureka.one \
  -d app.yureka.one \
  -d admin.yureka.one \
  --non-interactive --agree-tos -m admin@yureka.one --redirect
```

Security group must allow inbound **80** and **443** from `0.0.0.0/0`.

## OAuth / Supabase (required once DNS is live)

**Google Cloud OAuth client**

- Authorized JavaScript origins:
  - `https://yureka.one`
  - `https://www.yureka.one`
  - `https://app.yureka.one`
  - `https://admin.yureka.one`
- Authorized redirect URI:
  - `https://sfdqxpybtmsfbjppoydh.supabase.co/auth/v1/callback`

**Supabase Auth → URL configuration** (required for Google login on `app.yureka.one`)

- **Site URL:** `https://app.yureka.one` (not sslip, not the marketing apex)
- **Additional redirect URLs** (exact + wildcard):
  - `https://app.yureka.one/**`
  - `https://app.yureka.one/login`
  - `https://app.yureka.one/login?**`
  - `https://app.yureka.one/waiting`
  - `https://app.yureka.one/dashboard`
  - `https://admin.yureka.one/**`
  - `http://localhost:3000/**` (local only)

If Site URL is still the temporary sslip host or `https://yureka.one`, Google returns the OAuth `code` to the wrong origin and login on `app.yureka.one` appears to fail (PKCE / localStorage are origin-scoped). The app now handoffs `?code=` to `app.yureka.one/login`, but Site URL must still be `https://app.yureka.one`.

## App env on EC2 (`.env`)

```bash
VITE_LANDING_URL=https://yureka.one
VITE_APP_URL=https://app.yureka.one
VITE_ADMIN_PORTAL_URL=https://admin.yureka.one
APP_ORIGIN=https://app.yureka.one
FRONTEND_URL=https://app.yureka.one
PUBLIC_APP_URL=https://app.yureka.one
```

Rebuild/redeploy after changing any `VITE_*` values (`./deploy-ec2.sh`).
