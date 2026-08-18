-- Razorpay payment columns on Hubble gift-card orders

alter table public.hubble_orders
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists payment_status text not null default 'unpaid';

create unique index if not exists hubble_orders_razorpay_order_idx
  on public.hubble_orders (razorpay_order_id)
  where razorpay_order_id is not null;
