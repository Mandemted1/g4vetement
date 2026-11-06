-- G4 store: run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to re-run: everything is "if not exists" / "or replace".

-- Who can manage the store. Customers (shoppers with an account) are NOT in this list.
-- No policies on purpose: nobody can read or edit it through the API; it's changed in the SQL editor or by the service role.
create table if not exists admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;

-- Each team member has a role (see src/lib/permissions.ts). Everyone already on the list is an owner.
alter table admins add column if not exists role text not null default 'owner';
alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check check (role in ('owner', 'manager', 'fulfilment', 'viewer'));

-- What each role may do. MUST match MATRIX in src/lib/permissions.ts (scripts/test-permissions.mts compares them).
create or replace function role_can(p_role text, p_cap text) returns boolean
language sql immutable as $$
  select case p_role
    when 'owner' then true
    when 'manager' then p_cap in ('orders.manage', 'products.manage', 'marketing.manage', 'giftcards.manage', 'reviews.manage', 'analytics.view', 'data.export')
    when 'fulfilment' then p_cap in ('orders.manage')
    when 'viewer' then p_cap in ('analytics.view')
    else false
  end;
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated, service_role;

-- The signed-in person's team role (null if they aren't on the team), and whether they may do something.
create or replace function staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid();
$$;
revoke all on function staff_role() from public;
grant execute on function staff_role() to anon, authenticated, service_role;

create or replace function can_do(p_cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(role_can((select role from public.admins where user_id = auth.uid()), p_cap), false);
$$;
revoke all on function can_do(text) from public;
grant execute on function can_do(text) to anon, authenticated, service_role;

-- The store can never be left without an owner.
create or replace function protect_last_owner() returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (select 1 from public.admins where role = 'owner' and user_id <> old.user_id) then
      raise exception 'There must always be at least one owner';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists admins_keep_owner on admins;
create trigger admins_keep_owner before update or delete on admins for each row execute function protect_last_owner();

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
create policy "admin all products" on products for all to authenticated using (can_do('products.manage')) with check (can_do('products.manage'));

drop policy if exists "admin all customers" on customers;
create policy "admin all customers" on customers for all to authenticated using (can_do('orders.manage')) with check (can_do('orders.manage'));
drop policy if exists "staff read customers" on customers;
create policy "staff read customers" on customers for select to authenticated using (is_admin());

drop policy if exists "admin all orders" on orders;
create policy "admin all orders" on orders for all to authenticated using (can_do('orders.manage')) with check (can_do('orders.manage'));
drop policy if exists "staff read orders" on orders;
create policy "staff read orders" on orders for select to authenticated using (is_admin());

drop policy if exists "admin all order_items" on order_items;
create policy "admin all order_items" on order_items for all to authenticated using (can_do('orders.manage')) with check (can_do('orders.manage'));
drop policy if exists "staff read order_items" on order_items;
create policy "staff read order_items" on order_items for select to authenticated using (is_admin());

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
create policy "admin write product photos" on storage.objects for all to authenticated using (bucket_id = 'products' and can_do('products.manage')) with check (bucket_id = 'products' and can_do('products.manage'));
