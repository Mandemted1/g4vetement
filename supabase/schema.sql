-- G4 store: run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to re-run: everything is "if not exists" / "or replace".

-- Who can manage the store. Customers (shoppers with an account) are NOT in this list.
-- No policies on purpose: nobody can read or edit it through the API; it's changed in the SQL editor or by the service role.
create table if not exists admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated, service_role;

create sequence if not exists order_number_seq start 2001;
create sequence if not exists customer_seq start 1000;

create table if not exists products (
  id            text primary key,
  sku           text not null,
  name          text not null,
  category      text not null,
  type          text not null default 'tee',          -- drives the drawn placeholder garment
  price         integer not null check (price >= 0),  -- whole dollars
  colors        jsonb not null default '[]',          -- [{ "name": "Black", "hex": "#141414" }]
  sizes         jsonb not null default '[]',          -- ["S","M","L"]
  stock         integer not null default 0 check (stock >= 0),
  reorder_level integer not null default 10,
  description   text not null default '',
  fabric        text not null default '',
  fit           text not null default '',
  images        jsonb not null default '[]',          -- ["https://.../p05.jpg"] first = main
  active        boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists customers (
  id         text primary key,
  name       text not null,
  email      text not null,
  city       text,
  state      text,
  created_at timestamptz not null default now()
);
create unique index if not exists customers_email_key on customers (lower(email));

create table if not exists orders (
  id            text primary key,
  number        integer not null unique,
  customer_id   text not null references customers(id),
  status        text not null default 'pending'
                check (status in ('pending','processing','shipped','delivered','cancelled','refunded')),
  subtotal      integer not null default 0,
  discount      integer not null default 0,
  discount_code text,
  shipping      integer not null default 0,
  total         integer not null default 0,
  channel       text not null default 'Direct',
  payment       text not null default 'Card',
  created_at    timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);

create table if not exists order_items (
  id        bigserial primary key,
  order_id  text not null references orders(id) on delete cascade,
  product_id text not null references products(id),
  name      text not null,
  size      text not null,
  color     text not null,
  color_hex text not null default '#000000',
  qty       integer not null check (qty > 0),
  price     integer not null
);
create index if not exists order_items_order_idx on order_items (order_id);

-- ---------- Row level security ----------
-- Public (the storefront) can only READ active products. Orders are created through place_order() below.
-- Admins (see the admins table) can read and edit everything.
alter table products    enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select to anon, authenticated using (active or is_admin());

drop policy if exists "admin all products" on products;
create policy "admin all products" on products for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin all customers" on customers;
create policy "admin all customers" on customers for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin all orders" on orders;
create policy "admin all orders" on orders for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin all order_items" on order_items;
create policy "admin all order_items" on order_items for all to authenticated using (is_admin()) with check (is_admin());

-- (The checkout functions price_order / quote_order / place_order are defined once, in 008_shipping.sql, so re-running migrations never swaps in an older version.)

-- Used by the seed script after importing explicit order numbers / customer ids.
create or replace function sync_sequences() returns void language plpgsql security definer set search_path = public as $$
begin
  perform setval('order_number_seq', greatest((select coalesce(max(number), 0) from orders) + 1, 2001), false);
  perform setval('customer_seq', greatest((select coalesce(max(substring(id from 3)::int), 0) from customers where id ~ '^C-[0-9]+$') + 1, 1000), false);
end $$;
revoke all on function sync_sequences() from public, anon, authenticated;

-- Product photos: public-read bucket, admin-only writes.
insert into storage.buckets (id, name, public) values ('products', 'products', true) on conflict (id) do nothing;
drop policy if exists "public read product photos" on storage.objects;
create policy "public read product photos" on storage.objects for select using (bucket_id = 'products');
drop policy if exists "admin write product photos" on storage.objects;
create policy "admin write product photos" on storage.objects for all to authenticated using (bucket_id = 'products' and is_admin()) with check (bucket_id = 'products' and is_admin());
