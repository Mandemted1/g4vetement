-- G4 store: run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to re-run: everything is "if not exists" / "or replace".

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
-- A signed-in admin (any authenticated user; keep public sign-ups OFF) can read and edit everything.
alter table products    enable row level security;
alter table customers   enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

drop policy if exists "public read active products" on products;
create policy "public read active products" on products for select to anon, authenticated using (active or auth.role() = 'authenticated');

drop policy if exists "admin all products" on products;
create policy "admin all products" on products for all to authenticated using (true) with check (true);

drop policy if exists "admin all customers" on customers;
create policy "admin all customers" on customers for all to authenticated using (true) with check (true);

drop policy if exists "admin all orders" on orders;
create policy "admin all orders" on orders for all to authenticated using (true) with check (true);

drop policy if exists "admin all order_items" on order_items;
create policy "admin all order_items" on order_items for all to authenticated using (true) with check (true);

-- ---------- Checkout ----------
-- Prices, totals and stock are all decided here in the database, never trusted from the browser.
-- Locks each product row, refuses if stock is short, decrements stock, and creates the order atomically.
create or replace function place_order(
  p_name text, p_email text, p_city text, p_state text, p_items jsonb
) returns table (order_id text, order_total integer)
language plpgsql security definer set search_path = public as $$
declare
  v_customer text;
  v_num integer;
  v_oid text;
  v_sub integer := 0;
  v_ship integer;
  it jsonb;
  p products%rowtype;
  v_qty integer;
  v_color jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Your bag is empty'; end if;
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then raise exception 'Name and a valid email are required'; end if;

  select id into v_customer from customers where lower(email) = lower(p_email);
  if v_customer is null then
    v_customer := 'C-' || lpad(nextval('customer_seq')::text, 4, '0');
    insert into customers (id, name, email, city, state) values (v_customer, trim(p_name), trim(p_email), p_city, p_state);
  end if;

  v_num := nextval('order_number_seq');
  v_oid := 'G4-' || v_num;
  insert into orders (id, number, customer_id) values (v_oid, v_num, v_customer);

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 10 then raise exception 'Invalid quantity'; end if;
    select * into p from products where id = it->>'product_id' for update;
    if not found or not p.active then raise exception 'A product in your bag is no longer available'; end if;
    if p.stock < v_qty then raise exception 'Only % left of %', p.stock, p.name; end if;
    select c into v_color from jsonb_array_elements(p.colors) c where c->>'name' = it->>'color' limit 1;
    if v_color is null then raise exception 'Invalid colour for %', p.name; end if;
    if not (p.sizes ? (it->>'size')) then raise exception 'Invalid size for %', p.name; end if;
    insert into order_items (order_id, product_id, name, size, color, color_hex, qty, price)
      values (v_oid, p.id, p.name, it->>'size', v_color->>'name', coalesce(v_color->>'hex', '#000000'), v_qty, p.price);
    update products set stock = stock - v_qty where id = p.id;
    v_sub := v_sub + p.price * v_qty;
  end loop;

  v_ship := case when v_sub >= 100 then 0 else 9 end;
  update orders set subtotal = v_sub, shipping = v_ship, total = v_sub + v_ship where id = v_oid;
  return query select v_oid, v_sub + v_ship;
end $$;

revoke all on function place_order(text, text, text, text, jsonb) from public;
grant execute on function place_order(text, text, text, text, jsonb) to anon, authenticated;

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
create policy "admin write product photos" on storage.objects for all to authenticated using (bucket_id = 'products') with check (bucket_id = 'products');
