-- Super Browse store catalog (admin-managed brands for in-app browse)
create table if not exists public.super_browse_stores (
  id text primary key,
  name text not null,
  domain text not null,
  url text not null,
  logo_url text,
  cashback text,
  bg text not null default '#ffffff',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists super_browse_stores_active_sort_idx
  on public.super_browse_stores (active, sort_order, name);
