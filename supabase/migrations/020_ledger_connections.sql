-- Encrypted Gmail refresh tokens for background ledger resync (CRED Protect-style).
create table if not exists public.ledger_connections (
  user_id text not null,
  gmail text not null,
  refresh_token_enc text not null,
  scopes text[] not null default array['https://www.googleapis.com/auth/gmail.readonly'],
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_error text,
  sync_enabled boolean not null default true,
  primary key (user_id, gmail)
);

create index if not exists ledger_connections_sync_idx
  on public.ledger_connections (sync_enabled, last_sync_at);

alter table public.ledger_connections enable row level security;
