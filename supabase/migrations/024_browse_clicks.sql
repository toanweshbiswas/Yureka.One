-- Super Browse / store launcher click analytics
create table if not exists public.browse_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  store_id text,
  store_name text,
  dest_url text not null,
  opened_url text not null,
  host text not null,
  affiliate boolean not null default false,
  goldback_offer_id uuid references public.offers(id) on delete set null,
  source text not null default 'super_browse',
  created_at timestamptz not null default now()
);

create index if not exists browse_clicks_created_idx
  on public.browse_clicks (created_at desc);

create index if not exists browse_clicks_user_created_idx
  on public.browse_clicks (user_id, created_at desc);

create index if not exists browse_clicks_store_created_idx
  on public.browse_clicks (store_id, created_at desc)
  where store_id is not null;

alter table public.browse_clicks enable row level security;
