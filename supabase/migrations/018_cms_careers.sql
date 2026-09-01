-- CMS careers / job postings (admin-managed, public /jobs page)

create table if not exists public.cms_careers (
  id uuid primary key default gen_random_uuid(),
  ref_id text not null,
  title text not null,
  department text not null default 'General',
  location text not null default 'Bengaluru',
  type text not null default 'Full-time',
  description text not null default '',
  apply_email text not null default 'support@yureka.one',
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cms_careers_ref_id_idx on public.cms_careers (ref_id);
create index if not exists cms_careers_status_sort_idx on public.cms_careers (status, sort_order);

alter table public.cms_careers enable row level security;
