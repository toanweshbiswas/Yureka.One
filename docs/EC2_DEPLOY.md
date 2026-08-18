# EC2 all-in-one deploy (frontend + API)

**Instance:** `i-0fc71adcbbce91e3e`  
**Public IP:** `13.57.223.228` (use an **Elastic IP** so it doesn’t change on stop/start)  
**Temporary host:** `https://13-57-223-228.sslip.io`

Express serves the Vite build (`dist/`) and `/api/*` on one process — no Netlify required.

---

## 1. Fix SSH (if `Permission denied (publickey)`)

Port 22 is reachable; the key must match the instance **Key pair name** in EC2.

1. EC2 → Instances → `i-0fc71adcbbce91e3e` → **Details** → note **Key pair name**.
2. That name must be the pair for `yureka.pem`. If you lost the key, you cannot SSH with a new `.pem` unless you:
   - Use **EC2 Instance Connect** (browser) → connect as `ec2-user`, then paste your **public** key into `~/.ssh/authorized_keys`, or
   - Stop instance → **Actions → Instance settings → Edit user data** / replace root volume (last resort).

Local test:

```bash
chmod 400 yureka.pem
ssh -i yureka.pem ec2-user@13.57.223.228
```

Amazon Linux AMI uses `ec2-user` instead of `ubuntu`:

```bash
ssh -i yureka.pem ec2-user@13.57.223.228
```

**Never commit** `yureka.pem` (already in `.gitignore`).

---

## 2. Security group (inbound)

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP | SSH |
| 80 | 0.0.0.0/0 | HTTP |
| 443 | 0.0.0.0/0 | HTTPS (after certbot) |

Without 80/443 open, the site will **timeout** from the browser.

---

## 3. Bootstrap (first time on the server)

**Option A — SSH**

```bash
git clone https://github.com/Sakshikhade/Yureka.One.git /opt/yureka-one
cd /opt/yureka-one
cp .env.example .env   # fill from local .env — never commit
nano .env
bash scripts/ec2/bootstrap.sh
```

**Option B — EC2 Instance Connect** (no local SSH): paste the same commands in the browser terminal.

Set in `.env` before `pnpm build`:

- `NODE_ENV=production`
- `PORT=3000`
- `APP_ORIGIN=https://13-57-223-228.sslip.io` (temporary) or `https://yureka.one` later
- `FRONTEND_URL=https://13-57-223-228.sslip.io`
- `PUBLIC_APP_URL=https://13-57-223-228.sslip.io`
- `VITE_ADMIN_PORTAL_URL=https://13-57-223-228.sslip.io`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` / publishable key
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `HUBBLE_*`, `GMAIL_*`, `ADMIN_*`, `GOOGLE_*`

---

## 4. Deploy updates from laptop

```bash
cd Yureka.One
# copy .env to server once:
scp -i yureka.pem .env ec2-user@13.57.223.228:/opt/yureka-one/.env

EC2_HOST=13.57.223.228 EC2_KEY=./yureka.pem ./scripts/ec2/deploy-from-local.sh
```

---

## 5. HTTPS + domain (Cloudflare)

Full Cloudflare DNS table + OAuth checklist: [`CLOUDFLARE_DNS.md`](./CLOUDFLARE_DNS.md)

Host map:

| Host | App surface |
|------|-------------|
| `yureka.one` / `www` | Landing |
| `app.yureka.one` | Login / waitlist / dashboard |
| `admin.yureka.one` | Admin panel |

1. Add the A records in Cloudflare (DNS only while certs issue).
2. On Amazon Linux:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d yureka.one -d www.yureka.one -d app.yureka.one -d admin.yureka.one \
  --non-interactive --agree-tos -m admin@yureka.one --redirect
```

3. Set production env:

```bash
VITE_LANDING_URL=https://yureka.one
VITE_APP_URL=https://app.yureka.one
VITE_ADMIN_PORTAL_URL=https://admin.yureka.one
APP_ORIGIN=https://app.yureka.one
FRONTEND_URL=https://app.yureka.one
PUBLIC_APP_URL=https://app.yureka.one
```

4. Update Google OAuth origins + Supabase Auth redirect URLs (see Cloudflare doc).
5. Redeploy: `./deploy-ec2.sh`

---

## 6. Smoke tests

```bash
curl -s https://13-57-223-228.sslip.io/api/health
curl -s "https://13-57-223-228.sslip.io/api/v1/auth/status?email=you@gmail.com"
```

Browser: `/`, `/login`, `/join-waitlist`, `/dashboard` (approved user).

---

## 7. Retire Netlify / Render

After EC2 is stable:

- Point production DNS to EC2 only.
- Update GitHub Actions (remove Netlify job; optional SSH deploy).
- Hubble webhooks → `https://your-domain/api/...` on this host.
