-- Step 4: shipping zones, shipping addresses, tracking numbers.  Safe to re-run.
--
-- The rules here mirror src/lib/shipping.ts exactly: a zone that names the country wins, otherwise the
-- "everywhere else" zone ('*'); shipping is free when the bag (after sales) reaches the zone's free-over amount
-- or a free-shipping code is applied.

create table if not exists shipping_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  countries  text[] not null,              -- ISO codes, or {'*'} = every country no other zone names
  rate       integer not null default 0 check (rate >= 0),
  free_over  integer check (free_over is null or free_over > 0),
  estimate   text not null default '',
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  constraint zone_has_countries check (coalesce(array_length(countries, 1), 0) > 0)
);
alter table shipping_zones enable row level security;
drop policy if exists "admin manage shipping zones" on shipping_zones;
create policy "admin manage shipping zones" on shipping_zones for all to authenticated using (is_admin()) with check (is_admin());

-- A store that has never set up shipping keeps the original rule for everyone: $9, free over $100.
insert into shipping_zones (name, countries, rate, free_over, estimate)
select 'Everywhere', array['*'], 9, 100, '3–7 business days'
where not exists (select 1 from shipping_zones);

alter table orders
  add column if not exists ship_country  text,
  add column if not exists ship_address  text,
  add column if not exists ship_city     text,
  add column if not exists ship_state    text,
  add column if not exists ship_postcode text,
  add column if not exists ship_method   text,      -- the zone that priced it
  add column if not exists ship_estimate text,
  add column if not exists tracking_carrier text,
  add column if not exists tracking_number  text,
  add column if not exists tracking_url     text,
  add column if not exists shipped_at       timestamptz;

-- What the storefront may see: the active zones.
create or replace function public_shipping()
returns table (id uuid, name text, countries text[], rate integer, free_over integer, estimate text, sort integer)
language sql stable security definer set search_path = public as $$
  select z.id, z.name, z.countries, z.rate, z.free_over, z.estimate, z.sort from shipping_zones z where z.active order by z.sort, z.created_at;
$$;
grant execute on function public_shipping() to anon, authenticated;

-- The zone that serves a country. No country given = the first active zone.
create or replace function shipping_zone_for(p_country text) returns shipping_zones
language sql stable security definer set search_path = public as $$
  select z.* from shipping_zones z
  where z.active
    and (coalesce(trim(p_country), '') = ''
         or upper(trim(p_country)) = any (z.countries)
         or '*' = any (z.countries))
  order by (case when coalesce(trim(p_country), '') = '' then 0 when upper(trim(p_country)) = any (z.countries) then 0 else 1 end), z.sort, z.created_at
  limit 1;
$$;
revoke all on function shipping_zone_for(text) from public, anon, authenticated;

-- ---------- The pricing engine: shipping now comes from the shopper's zone ----------
drop function if exists price_order(jsonb, text, text, boolean);
drop function if exists place_order(text, text, text, text, jsonb);   -- the original (fresh installs)

create or replace function price_order(p_items jsonb, p_email text, p_code text, p_lock boolean, p_country text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  it jsonb;
  p products%rowtype;
  dc discount_codes%rowtype;
  z shipping_zones%rowtype;
  v_qty integer;
  v_pct integer;
  v_unit integer;
  v_have integer;
  v_color jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_list integer := 0;
  v_sub integer := 0;
  v_code text := upper(nullif(trim(coalesce(p_code, '')), ''));
  v_applied text;
  v_disc integer := 0;
  v_free boolean := false;
  v_elig integer;
  v_n integer;
  v_code_error text;
  v_pending text;
  v_ship integer := 0;
  v_ship_error text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Your bag is empty'; end if;

  -- stock is checked per product AND size, across all lines of that size (ordered, so concurrent checkouts lock in the same order)
  for r in
    select it2 ->> 'product_id' as pid, it2 ->> 'size' as sz, sum((it2 ->> 'qty')::int) as q
    from jsonb_array_elements(p_items) it2
    group by 1, 2 order by 1, 2
  loop
    if p_lock then select * into p from products where id = r.pid for update; else select * into p from products where id = r.pid; end if;
    if not found or not p.active then raise exception 'A product in your bag is no longer available'; end if;
    if r.sz is null or not (p.sizes ? r.sz) then raise exception 'Invalid size for %', p.name; end if;
    v_have := coalesce((p.size_stock ->> r.sz)::integer, 0);
    if v_have <= 0 then raise exception '% is sold out in size %', p.name, r.sz; end if;
    if v_have < r.q then raise exception 'Only % left of % in size %', v_have, p.name, r.sz; end if;
  end loop;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 10 then raise exception 'Invalid quantity'; end if;
    select * into p from products where id = it ->> 'product_id';
    select c into v_color from jsonb_array_elements(p.colors) c where c ->> 'name' = it ->> 'color' limit 1;
    if v_color is null then raise exception 'Invalid colour for %', p.name; end if;
    v_pct := sale_percent(p.id, p.category);
    v_unit := p.price - round(p.price * v_pct / 100.0)::integer;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'category', p.category, 'size', it ->> 'size', 'color', v_color ->> 'name',
      'color_hex', coalesce(v_color ->> 'hex', '#000000'), 'qty', v_qty, 'list_price', p.price, 'price', v_unit, 'sale_percent', v_pct));
    v_list := v_list + p.price * v_qty;
    v_sub := v_sub + v_unit * v_qty;
  end loop;

  -- discount code
  if v_code is not null then
    begin
      if p_lock then select * into dc from discount_codes where upper(code) = v_code for update; else select * into dc from discount_codes where upper(code) = v_code; end if;
      if not found or not dc.active then raise exception 'That code is not valid'; end if;
      if dc.starts_at is not null and dc.starts_at > now() then raise exception 'That code is not active yet'; end if;
      if dc.ends_at is not null and dc.ends_at <= now() then raise exception 'That code has expired'; end if;
      if v_sub < dc.min_spend then raise exception 'This code needs a bag of at least $% (yours is $%)', dc.min_spend, v_sub; end if;

      if dc.usage_limit is not null then
        select count(*) into v_n from orders o where upper(o.discount_code) = v_code and o.status <> 'cancelled' and not o.sim;
        if v_n >= dc.usage_limit then raise exception 'That code has been fully used'; end if;
      end if;

      if (dc.once_per_customer or dc.first_order_only) then
        if coalesce(trim(p_email), '') = '' then
          if p_lock then raise exception 'Enter your email to use this code'; end if;
          v_pending := 'Checked against your email at checkout';
        else
          if dc.first_order_only then
            select count(*) into v_n from orders o join customers c on c.id = o.customer_id where lower(c.email) = lower(p_email) and o.status <> 'cancelled';
            if v_n > 0 then raise exception 'That code is for first orders only'; end if;
          end if;
          if dc.once_per_customer then
            select count(*) into v_n from orders o join customers c on c.id = o.customer_id where lower(c.email) = lower(p_email) and upper(o.discount_code) = v_code and o.status <> 'cancelled';
            if v_n > 0 then raise exception 'You have already used that code'; end if;
          end if;
        end if;
      end if;

      if dc.categories is null then
        v_elig := v_sub;
      else
        select coalesce(sum((l ->> 'price')::int * (l ->> 'qty')::int), 0) into v_elig from jsonb_array_elements(v_lines) l where l ->> 'category' = any (dc.categories);
        if v_elig = 0 then raise exception 'That code only applies to %', array_to_string(dc.categories, ', '); end if;
      end if;

      if dc.kind = 'percent' then v_disc := round(v_elig * dc.value / 100.0)::integer;
      elsif dc.kind = 'fixed' then v_disc := least(dc.value, v_elig);
      else v_free := true;
      end if;
      v_applied := dc.code;
    exception when others then
      if p_lock then raise; end if;
      v_code_error := sqlerrm;
      v_disc := 0; v_free := false; v_applied := null; v_pending := null;
    end;
  end if;

  -- shipping: the zone that serves the shopper's country
  select * into z from shipping_zone_for(p_country);
  if z.id is null then
    v_ship_error := format('We don''t ship to %s yet.', coalesce(nullif(upper(trim(p_country)), ''), 'that country'));
    if p_lock then raise exception '%', v_ship_error; end if;
  else
    v_ship := case when v_free or (z.free_over is not null and v_sub >= z.free_over) then 0 else z.rate end;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'list_subtotal', v_list,
    'subtotal', v_sub,
    'sale_discount', v_list - v_sub,
    'discount', v_disc,
    'code', v_applied,
    'code_error', v_code_error,
    'code_note', v_pending,
    'free_shipping', v_free,
    'shipping', v_ship,
    'ship_zone', z.name,
    'ship_estimate', coalesce(z.estimate, ''),
    'free_over', z.free_over,
    'ship_error', v_ship_error,
    'total', v_sub - v_disc + v_ship
  );
end $$;
revoke all on function price_order(jsonb, text, text, boolean, text) from public, anon, authenticated;

-- The read-only quote the storefront shows in the bag.
drop function if exists quote_order(text, jsonb, text);
create or replace function quote_order(p_email text, p_items jsonb, p_code text default null, p_country text default null) returns jsonb
language sql security definer set search_path = public as $$
  select price_order(p_items, p_email, p_code, false, p_country);
$$;
revoke all on function quote_order(text, jsonb, text, text) from public;
grant execute on function quote_order(text, jsonb, text, text) to anon, authenticated;

-- ---------- Checkout: keeps the shipping address and how it was priced ----------
drop function if exists place_order(text, text, text, text, jsonb, text);

create or replace function place_order(
  p_name text, p_email text, p_city text, p_state text, p_items jsonb, p_code text default null,
  p_country text default null, p_address text default null, p_postcode text default null
) returns table (order_id text, order_total integer, applied_discount integer, sale_discount integer, shipping integer, subtotal integer, ship_estimate text)
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_customer text;
  v_num integer;
  v_oid text;
  l jsonb;
  v_country text := nullif(upper(trim(coalesce(p_country, ''))), '');
begin
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then raise exception 'Name and a valid email are required'; end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then raise exception 'Choose a valid country'; end if;

  v := price_order(p_items, p_email, p_code, true, v_country);   -- prices, locks stock rows and the code, raises on any problem

  select id into v_customer from customers where lower(email) = lower(p_email);
  if v_customer is null then
    v_customer := 'C-' || lpad(nextval('customer_seq')::text, 4, '0');
    insert into customers (id, name, email, city, state) values (v_customer, trim(p_name), trim(p_email), left(trim(coalesce(p_city, '')), 80), left(trim(coalesce(p_state, '')), 80));
  end if;

  v_num := nextval('order_number_seq');
  v_oid := 'G4-' || v_num;
  insert into orders (id, number, customer_id, subtotal, discount, discount_code, shipping, total, sale_discount,
                      ship_country, ship_address, ship_city, ship_state, ship_postcode, ship_method, ship_estimate)
  values (v_oid, v_num, v_customer, (v ->> 'subtotal')::int, (v ->> 'discount')::int, v ->> 'code', (v ->> 'shipping')::int, (v ->> 'total')::int, (v ->> 'sale_discount')::int,
          v_country, left(trim(coalesce(p_address, '')), 200), left(trim(coalesce(p_city, '')), 80), left(trim(coalesce(p_state, '')), 80), left(trim(coalesce(p_postcode, '')), 20),
          v ->> 'ship_zone', v ->> 'ship_estimate');

  for l in select * from jsonb_array_elements(v -> 'lines') loop
    insert into order_items (order_id, product_id, name, size, color, color_hex, qty, price, list_price)
    values (v_oid, l ->> 'product_id', l ->> 'name', l ->> 'size', l ->> 'color', l ->> 'color_hex', (l ->> 'qty')::int, (l ->> 'price')::int, (l ->> 'list_price')::int);
    update products
    set size_stock = jsonb_set(size_stock, array[l ->> 'size'], to_jsonb(greatest(0, coalesce((size_stock ->> (l ->> 'size'))::integer, 0) - (l ->> 'qty')::int)))
    where id = l ->> 'product_id';
  end loop;

  return query select v_oid, (v ->> 'total')::int, (v ->> 'discount')::int, (v ->> 'sale_discount')::int, (v ->> 'shipping')::int, (v ->> 'subtotal')::int, coalesce(v ->> 'ship_estimate', '');
end $$;

revoke all on function place_order(text, text, text, text, jsonb, text, text, text, text) from public;
grant execute on function place_order(text, text, text, text, jsonb, text, text, text, text) to anon, authenticated;
