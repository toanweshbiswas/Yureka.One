-- Guest / public gift order status token
alter table public.hubble_orders
  add column if not exists guest_token text;

create unique index if not exists hubble_orders_guest_token_uidx
  on public.hubble_orders (guest_token)
  where guest_token is not null;
