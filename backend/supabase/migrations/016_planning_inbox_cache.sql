-- Persist extra-inbox scan payloads so planning totals survive restarts / multi-instance hosts.
create table if not exists public.planning_inbox_cache (
  user_id text not null,
  gmail text not null,
  scanned_at timestamptz not null default now(),
  transactions jsonb not null default '[]'::jsonb,
  primary key (user_id, gmail)
);

create index if not exists planning_inbox_cache_user_idx
  on public.planning_inbox_cache (user_id);

alter table public.planning_inbox_cache enable row level security;
