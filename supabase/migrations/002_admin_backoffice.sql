-- Admin / waitlist tables for unified backoffice (same Supabase project)

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  mobile_number text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'on_hold')),
  yureka_score integer,
  monthly_spend text,
  top_category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_status_idx on public.waitlist (status);
create index if not exists waitlist_email_idx on public.waitlist (email);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null default 'admin'
    check (role in ('viewer', 'admin', 'superadmin')),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
alter table public.admin_users enable row level security;

-- Seed a bootstrap superadmin if empty (change email in dashboard after login)
insert into public.admin_users (email, full_name, role)
select 'admin@localhost', 'Yureka Admin', 'superadmin'
where not exists (select 1 from public.admin_users limit 1);
