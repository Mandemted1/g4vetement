-- Run AFTER 005. Safe to re-run.
-- Discount codes, automatic sales, and one server-side pricing function used by both the bag quote and checkout.

-- ---------- Codes ----------
create table if not exists discount_codes (
  id                uuid primary key default gen_random_uuid(),
  code              text not null check (code ~ '^[A-Z0-9_-]{3,24}$'),
  kind              text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value             integer not null default 0 check (value >= 0),   -- percent (1-100) or whole dollars
  min_spend         integer not null default 0 check (min_spend >= 0),
  categories        text[],                                          -- null = the whole order
  starts_at         timestamptz,
  ends_at           timestamptz,
  usage_limit       integer check (usage_limit is null or usage_limit > 0),
  once_per_customer boolean not null default false,
  first_order_only  boolean not null default false,
  active            boolean not null default true,
  note              text not null default '',
  created_at        timestamptz not null default now(),
  constraint discount_value_ok check (
    (kind = 'percent' and value between 1 and 100) or (kind = 'fixed' and value >= 1) or (kind = 'free_shipping')
  ),
  constraint discount_dates_ok check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create unique index if not exists discount_codes_code_key on discount_codes (upper(code));

-- ---------- Automatic sales ----------
create table if not exists sales (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  percent     integer not null check (percent between 1 and 90),
  scope       text not null default 'all' check (scope in ('all', 'categories', 'products')),
  categories  text[],
  product_ids text[],
  starts_at   timestamptz,
  ends_at     timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint sale_scope_ok check (
    scope = 'all'
    or (scope = 'categories' and coalesce(array_length(categories, 1), 0) > 0)
    or (scope = 'products' and coalesce(array_length(product_ids, 1), 0) > 0)
  ),
  constraint sale_dates_ok check (starts_at is null or ends_at is null or ends_at > starts_at)
);

alter table orders      add column if not exists sale_discount integer not null default 0;
alter table order_items add column if not exists list_price integer;

alter table discount_codes enable row level security;
alter table sales          enable row level security;
drop policy if exists "admin manage discount codes" on discount_codes;
create policy "admin manage discount codes" on discount_codes for all to authenticated using (true) with check (true);
drop policy if exists "admin manage sales" on sales;
create policy "admin manage sales" on sales for all to authenticated using (true) with check (true);

-- The welcome popup's code, now a normal editable code.
insert into discount_codes (code, kind, value, min_spend, first_order_only, note)
values ('WELCOME10', 'fixed', 10, 50, true, 'Offered by the welcome popup and welcome email')
on conflict do nothing;

-- ---------- Helpers ----------
-- Sales that are running right now (safe to show the public).
create or replace function public_sales()
returns table (id uuid, name text, percent integer, scope text, categories text[], product_ids text[], ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.percent, s.scope, s.categories, s.product_ids, s.ends_at
  from sales s
  where s.active and (s.starts_at is null or s.starts_at <= now()) and (s.ends_at is null or s.ends_at > now());
$$;

-- Best running sale for one product (0 = none).
create or replace function sale_percent(p_product_id text, p_category text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(max(s.percent), 0)::integer
  from sales s
  where s.active and (s.starts_at is null or s.starts_at <= now()) and (s.ends_at is null or s.ends_at > now())
    and (s.scope = 'all' or (s.scope = 'categories' and p_category = any (s.categories)) or (s.scope = 'products' and p_product_id = any (s.product_ids)));
$$;

-- The one shipping rule (the next step makes this configurable).
create or replace function shipping_cost(p_subtotal integer, p_free boolean) returns integer
language sql immutable as $$ select case when p_free or p_subtotal >= 100 then 0 else 9 end; $$;

-- ---------- The pricing engine ----------
-- Prices a bag completely: sales, code, shipping, total. p_lock = true is used by checkout (locks rows and raises on any problem);
-- false is the read-only quote, which reports a bad code as a message instead of failing.
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

  -- stock is checked per product across all of its lines
  for r in select it2->>'product_id' as pid, sum((it2->>'qty')::int) as q from jsonb_array_elements(p_items) it2 group by 1 loop
    if p_lock then select * into p from products where id = r.pid for update; else select * into p from products where id = r.pid; end if;
    if not found or not p.active then raise exception 'A product in your bag is no longer available'; end if;
    if p.stock < r.q then raise exception 'Only % left of %', p.stock, p.name; end if;
  end loop;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 10 then raise exception 'Invalid quantity'; end if;
    select * into p from products where id = it->>'product_id';
    select c into v_color from jsonb_array_elements(p.colors) c where c->>'name' = it->>'color' limit 1;
    if v_color is null then raise exception 'Invalid colour for %', p.name; end if;
    if not (p.sizes ? (it->>'size')) then raise exception 'Invalid size for %', p.name; end if;
    v_pct := sale_percent(p.id, p.category);
    v_unit := p.price - round(p.price * v_pct / 100.0)::integer;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'category', p.category, 'size', it->>'size', 'color', v_color->>'name',
      'color_hex', coalesce(v_color->>'hex', '#000000'), 'qty', v_qty, 'list_price', p.price, 'price', v_unit, 'sale_percent', v_pct));
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
        select coalesce(sum((l->>'price')::int * (l->>'qty')::int), 0) into v_elig from jsonb_array_elements(v_lines) l where l->>'category' = any (dc.categories);
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
revoke all on function sale_percent(text, text) from public, anon, authenticated;

-- The read-only quote the storefront shows in the bag.
create or replace function quote_order(p_email text, p_items jsonb, p_code text default null) returns jsonb
language sql security definer set search_path = public as $$
  select price_order(p_items, p_email, p_code, false);
$$;
revoke all on function quote_order(text, jsonb, text) from public;
grant execute on function quote_order(text, jsonb, text) to anon, authenticated;
grant execute on function public_sales() to anon, authenticated;

-- ---------- Checkout (replaces the previous version) ----------
drop function if exists place_order(text, text, text, text, jsonb, text);

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
  values (v_oid, v_num, v_customer, (v->>'subtotal')::int, (v->>'discount')::int, v->>'code', (v->>'shipping')::int, (v->>'total')::int, (v->>'sale_discount')::int);

  for l in select * from jsonb_array_elements(v->'lines') loop
    insert into order_items (order_id, product_id, name, size, color, color_hex, qty, price, list_price)
    values (v_oid, l->>'product_id', l->>'name', l->>'size', l->>'color', l->>'color_hex', (l->>'qty')::int, (l->>'price')::int, (l->>'list_price')::int);
    update products set stock = stock - (l->>'qty')::int where id = l->>'product_id';
  end loop;

  return query select v_oid, (v->>'total')::int, (v->>'discount')::int, (v->>'sale_discount')::int, (v->>'shipping')::int, (v->>'subtotal')::int;
end $$;

revoke all on function place_order(text, text, text, text, jsonb, text) from public;
grant execute on function place_order(text, text, text, text, jsonb, text) to anon, authenticated;
