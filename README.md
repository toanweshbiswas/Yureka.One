# Yureka One

Monorepo-style layout (single Vite entry + Express API):

| Folder | What lives here |
|---|---|
| `landing/` | Marketing UI (`/`, blogs, brands, legal…) |
| `app/` | Product UI (dashboard, waitlist, admin) |
| `backend/` | Express server, API libs, migrations, scripts |
| `shared/` | Shared React (auth, SEO, footer) |

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

### EC2 deploy (production server)

1. Put your AWS key at `yureka.pem` in the repo root (`chmod 400`). Never commit it.
2. Fill `.env` with production values (same file is uploaded to the server).
3. Deploy:

```bash
pnpm deploy:ec2
# or: EC2_HOST=13.57.223.228 ./deploy-ec2.sh
```

Verify SSH first: `ssh -i ./yureka.pem ec2-user@13.57.223.228`

Ops playbooks: `docs/sops/`.
