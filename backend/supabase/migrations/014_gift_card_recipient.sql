-- Gift-for-someone fields on hubble gift card orders
alter table public.hubble_orders
  add column if not exists is_gift boolean not null default false,
  add column if not exists recipient_name text,
  add column if not exists recipient_email text,
  add column if not exists gift_message text;
