-- Per-user in-app notification inbox

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  email text,
  title text not null,
  body text not null default '',
  type text not null default 'info',
  href text,
  image_url text,
  dedupe_key text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create unique index if not exists user_notifications_user_dedupe_idx
  on public.user_notifications (user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.user_notifications enable row level security;
