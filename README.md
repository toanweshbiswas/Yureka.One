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

Ops playbooks: `docs/sops/`.
