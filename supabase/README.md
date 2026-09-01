# Supabase (CLI)

Single source of truth for Postgres schema migrations.

| Path | Purpose |
|------|---------|
| `migrations/` | Ordered SQL migrations (`001`–`022`) — applied via `pnpm supabase:push` |
| `config.toml` | CLI config (linked project `sfdqxpybtmsfbjppoydh`) |
| `.temp/` | CLI cache (gitignored) |

**Commands** (from repo root):

```bash
pnpm supabase:status   # local vs remote migration list
pnpm supabase:push     # apply pending migrations
pnpm supabase:link     # re-link if needed
```

Do not duplicate migrations under `backend/` — this folder is the only copy.
