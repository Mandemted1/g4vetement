-- Step 3: stock per size.  Safe to re-run.
--
-- products.size_stock = {"S": 8, "M": 12, "L": 0, "XL": 3}.  products.stock stays as the total
-- (kept in sync by a trigger), so the dashboard, low-stock alerts and analytics keep working.

alter table products add column if not exists size_stock jsonb not null default '{}';

-- Keeps size_stock and stock consistent on every insert/update:
--  * no per-size numbers yet -> split the total evenly across the sizes
--  * otherwise -> keep exactly one entry per size in `sizes` (new sizes start at 0, removed sizes are dropped)
--  * stock = the sum of the sizes
create or replace function sync_size_stock() returns trigger language plpgsql as $$
declare
  s text;
  n integer;
  k integer;
  i integer := 0;
  v jsonb := '{}'::jsonb;
  tot integer := 0;
begin
  k := coalesce(jsonb_array_length(new.sizes), 0);
  if k = 0 then return new; end if;

  if new.size_stock is null or new.size_stock = '{}'::jsonb then
    for s in select jsonb_array_elements_text(new.sizes) loop
      n := new.stock / k + case when i < new.stock % k then 1 else 0 end;
      i := i + 1;
      v := v || jsonb_build_object(s, n);
    end loop;
  else
    for s in select jsonb_array_elements_text(new.sizes) loop
      n := greatest(0, coalesce((new.size_stock ->> s)::integer, 0));
      v := v || jsonb_build_object(s, n);
    end loop;
  end if;

  select coalesce(sum(value::integer), 0) into tot from jsonb_each_text(v);
  new.size_stock := v;
  new.stock := tot;
  return new;
end $$;

drop trigger if exists products_size_stock on products;
create trigger products_size_stock before insert or update on products for each row execute function sync_size_stock();

-- Existing products: split their current stock across their sizes.
update products set stock = stock where size_stock = '{}'::jsonb;

-- Add (or subtract, with a negative number) stock for one size, atomically. Never goes below 0.
-- Used when an order is cancelled and its items go back on the shelf.
create or replace function adjust_stock(p_product text, p_size text, p_delta integer) returns void
language sql security definer set search_path = public as $$
  update products
  set size_stock = jsonb_set(size_stock, array[p_size], to_jsonb(greatest(0, coalesce((size_stock ->> p_size)::integer, 0) + p_delta)))
  where id = p_product and sizes ? p_size;
$$;
revoke all on function adjust_stock(text, text, integer) from public, anon;
grant execute on function adjust_stock(text, text, integer) to authenticated, service_role;

-- ---------- The pricing engine, now checking stock per size ----------
create or replace function price_order(p_items jsonb, p_email text, p_code text, p_lock boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  it jsonb;
  p products%rowtype;
  dc discount_codes%rowtype;
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
    'shipping', shipping_cost(v_sub, v_free),
    'total', v_sub - v_disc + shipping_cost(v_sub, v_free)
  );
end $$;

revoke all on function price_order(jsonb, text, text, boolean) from public, anon, authenticated;

-- ---------- Checkout: takes the stock from the chosen size ----------
create or replace function place_order(
  p_name text, p_email text, p_city text, p_state text, p_items jsonb, p_code text default null
) returns table (order_id text, order_total integer, applied_discount integer, sale_discount integer, shipping integer, subtotal integer)
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_customer text;
  v_num integer;
  v_oid text;
  l jsonb;
begin
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then raise exception 'Name and a valid email are required'; end if;

  v := price_order(p_items, p_email, p_code, true);   -- prices, locks stock rows and the code, raises on any problem

  select id into v_customer from customers where lower(email) = lower(p_email);
  if v_customer is null then
    v_customer := 'C-' || lpad(nextval('customer_seq')::text, 4, '0');
    insert into customers (id, name, email, city, state) values (v_customer, trim(p_name), trim(p_email), p_city, p_state);
  end if;

  v_num := nextval('order_number_seq');
  v_oid := 'G4-' || v_num;
  insert into orders (id, number, customer_id, subtotal, discount, discount_code, shipping, total, sale_discount)
  values (v_oid, v_num, v_customer, (v ->> 'subtotal')::int, (v ->> 'discount')::int, v ->> 'code', (v ->> 'shipping')::int, (v ->> 'total')::int, (v ->> 'sale_discount')::int);

  for l in select * from jsonb_array_elements(v -> 'lines') loop
    insert into order_items (order_id, product_id, name, size, color, color_hex, qty, price, list_price)
    values (v_oid, l ->> 'product_id', l ->> 'name', l ->> 'size', l ->> 'color', l ->> 'color_hex', (l ->> 'qty')::int, (l ->> 'price')::int, (l ->> 'list_price')::int);
    -- the trigger keeps products.stock equal to the sum of the sizes
    update products
    set size_stock = jsonb_set(size_stock, array[l ->> 'size'], to_jsonb(greatest(0, coalesce((size_stock ->> (l ->> 'size'))::integer, 0) - (l ->> 'qty')::int)))
    where id = l ->> 'product_id';
  end loop;

  return query select v_oid, (v ->> 'total')::int, (v ->> 'discount')::int, (v ->> 'sale_discount')::int, (v ->> 'shipping')::int, (v ->> 'subtotal')::int;
end $$;

revoke all on function place_order(text, text, text, text, jsonb, text) from public;
grant execute on function place_order(text, text, text, text, jsonb, text) to anon, authenticated;
