-- Isolated brand partner portal. Does not touch waitlist, ledger, or Goldback earn.

create extension if not exists "pgcrypto";

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  website text,
  category text not null default 'general',
  contact_email text,
  status text not null default 'active' check (status in ('active', 'paused')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_members (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null,
  user_id text,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (brand_id, email)
);

create table if not exists public.brand_offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  description text not null default '',
  url text not null,
  coupon_code text,
  category text not null default 'general',
  image_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.brand_offers(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id text not null,
  type text not null check (type in ('impression', 'click', 'copy')),
  created_at timestamptz not null default now()
);

create index if not exists brands_status_idx on public.brands (status);
create index if not exists brand_members_email_idx on public.brand_members (email);
create index if not exists brand_members_user_idx on public.brand_members (user_id);
create index if not exists brand_offers_brand_idx on public.brand_offers (brand_id, created_at desc);
create index if not exists brand_offers_live_idx on public.brand_offers (active, ends_at);
create index if not exists brand_offer_events_brand_created_idx
  on public.brand_offer_events (brand_id, created_at desc);
create index if not exists brand_offer_events_offer_type_idx
  on public.brand_offer_events (offer_id, type, created_at desc);

alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.brand_offers enable row level security;
alter table public.brand_offer_events enable row level security;
