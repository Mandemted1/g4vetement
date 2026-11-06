-- Step 5c: gift cards.  Safe to re-run.
--
-- An admin issues a card (a secret code worth some dollars). A shopper enters the code at checkout; it pays part or all of the
-- order and the balance goes down. Cancelling or refunding an order puts the money back on the card. Every change is in a ledger.
-- Codes are secrets, so only admins can read these tables; shoppers only ever see what their own checkout returns.

create table if not exists gift_cards (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code = upper(code) and code !~ '\s'),
  initial_amount   integer not null check (initial_amount > 0),
  balance          integer not null check (balance >= 0),
  note             text not null default '' check (length(note) <= 200),
  recipient_email  text not null default '',
  active           boolean not null default true,
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);
create table if not exists gift_card_ledger (
  id         bigserial primary key,
  card_id    uuid not null references gift_cards (id) on delete cascade,
  delta      integer not null,
  kind       text not null check (kind in ('issue', 'redeem', 'refund', 'adjust')),
  order_id   text,
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists gift_ledger_card_idx on gift_card_ledger (card_id, created_at desc);
create index if not exists gift_ledger_order_idx on gift_card_ledger (order_id) where order_id is not null;

alter table gift_cards enable row level security;
alter table gift_card_ledger enable row level security;
drop policy if exists "admin manage gift cards" on gift_cards;
create policy "admin manage gift cards" on gift_cards for all to authenticated using (can_do('giftcards.manage')) with check (can_do('giftcards.manage'));
drop policy if exists "admin read gift ledger" on gift_card_ledger;
create policy "admin read gift ledger" on gift_card_ledger for select to authenticated using (can_do('giftcards.manage'));

alter table orders add column if not exists gift_code text;
alter table orders add column if not exists gift_amount integer not null default 0;

-- ---------- Admin: issue, adjust, put back ----------
create or replace function issue_gift_card(p_code text, p_amount integer, p_note text default '', p_recipient text default '', p_expires timestamptz default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if auth.uid() is not null and not can_do('giftcards.manage') then raise exception 'Not allowed'; end if;
  if length(v_code) < 8 or length(v_code) > 32 then raise exception 'A gift card code must be 8 to 32 characters'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 10000 then raise exception 'The amount must be between $1 and $10,000'; end if;
  if p_expires is not null and p_expires <= now() then raise exception 'The expiry date must be in the future'; end if;
  insert into gift_cards (code, initial_amount, balance, note, recipient_email, expires_at)
  values (v_code, p_amount, p_amount, left(coalesce(p_note, ''), 200), left(trim(coalesce(p_recipient, '')), 200), p_expires) returning id into v_id;
  insert into gift_card_ledger (card_id, delta, kind, note) values (v_id, p_amount, 'issue', left(coalesce(p_note, ''), 200));
  return v_id;
end $$;
revoke all on function issue_gift_card(text, integer, text, text, timestamptz) from public, anon;
grant execute on function issue_gift_card(text, integer, text, text, timestamptz) to authenticated, service_role;

create or replace function adjust_gift_card(p_card uuid, p_delta integer, p_note text default '') returns integer
language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if auth.uid() is not null and not can_do('giftcards.manage') then raise exception 'Not allowed'; end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then raise exception 'Enter an amount to add or take off (up to $10,000)'; end if;
  select balance into v_balance from gift_cards where id = p_card for update;
  if not found then raise exception 'Gift card not found'; end if;
  if v_balance + p_delta < 0 then raise exception 'That would take the balance below $0 (it is $%)', v_balance; end if;
  update gift_cards set balance = balance + p_delta where id = p_card returning balance into v_balance;
  insert into gift_card_ledger (card_id, delta, kind, note) values (p_card, p_delta, 'adjust', left(coalesce(p_note, ''), 200));
  return v_balance;
end $$;
revoke all on function adjust_gift_card(uuid, integer, text) from public, anon;
grant execute on function adjust_gift_card(uuid, integer, text) to authenticated, service_role;

-- Cancelled or refunded order: the gift-card money goes back on the card (once).
create or replace function restore_gift_card(p_order text) returns integer
language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; c gift_cards%rowtype;
begin
  if auth.uid() is not null and not (can_do('orders.manage') or can_do('giftcards.manage')) then raise exception 'Not allowed'; end if;
  select * into o from orders where id = p_order;
  if not found or coalesce(o.gift_amount, 0) <= 0 or o.gift_code is null then return 0; end if;
  if exists (select 1 from gift_card_ledger where order_id = p_order and kind = 'refund') then return 0; end if;
  select * into c from gift_cards where code = o.gift_code for update;
  if not found then return 0; end if;
  update gift_cards set balance = balance + o.gift_amount where id = c.id;
  insert into gift_card_ledger (card_id, delta, kind, order_id, note) values (c.id, o.gift_amount, 'refund', p_order, 'Order cancelled or refunded');
  return o.gift_amount;
end $$;
revoke all on function restore_gift_card(text) from public, anon;
grant execute on function restore_gift_card(text) to authenticated, service_role;

-- ---------- The pricing engine: shipping now comes from the shopper's zone ----------
drop function if exists price_order(jsonb, text, text, boolean);
drop function if exists price_order(jsonb, text, text, boolean, text);
drop function if exists place_order(text, text, text, text, jsonb);   -- the original (fresh installs)

create or replace function price_order(p_items jsonb, p_email text, p_code text, p_lock boolean, p_country text default null, p_gift text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  it jsonb;
  p products%rowtype;
  dc discount_codes%rowtype;
  z shipping_zones%rowtype;
  gc gift_cards%rowtype;
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
  v_total integer;
  v_gift_code text := nullif(upper(regexp_replace(coalesce(p_gift, ''), '\s', '', 'g')), '');
  v_gift integer := 0;
  v_gift_after integer;
  v_gift_error text;
  v_applied_gift text;
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

  v_total := v_sub - v_disc + v_ship;

  -- gift card: pays part or all of the total (shipping included). One message for every reason it can't be used, so codes can't be probed.
  if v_gift_code is not null then
    begin
      if p_lock then select * into gc from gift_cards where code = v_gift_code for update; else select * into gc from gift_cards where code = v_gift_code; end if;
      if not found or not gc.active or (gc.expires_at is not null and gc.expires_at <= now()) or gc.balance <= 0 then
        raise exception 'That gift card is not valid or has no balance';
      end if;
      v_gift := least(gc.balance, v_total);
      v_gift_after := gc.balance - v_gift;
      v_applied_gift := gc.code;
    exception when others then
      if p_lock then raise; end if;
      v_gift_error := sqlerrm; v_gift := 0; v_gift_after := null; v_applied_gift := null;
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
    'shipping', v_ship,
    'ship_zone', z.name,
    'ship_estimate', coalesce(z.estimate, ''),
    'free_over', z.free_over,
    'ship_error', v_ship_error,
    'total', v_total,
    'gift_code', v_applied_gift,
    'gift_amount', v_gift,
    'gift_balance_after', v_gift_after,
    'gift_error', v_gift_error,
    'amount_due', v_total - v_gift
  );
end $$;
revoke all on function price_order(jsonb, text, text, boolean, text, text) from public, anon, authenticated;

-- The read-only quote the storefront shows in the bag.
drop function if exists quote_order(text, jsonb, text);
drop function if exists quote_order(text, jsonb, text, text);
create or replace function quote_order(p_email text, p_items jsonb, p_code text default null, p_country text default null, p_gift text default null) returns jsonb
language sql security definer set search_path = public as $$
  select price_order(p_items, p_email, p_code, false, p_country, p_gift);
$$;
revoke all on function quote_order(text, jsonb, text, text, text) from public;
grant execute on function quote_order(text, jsonb, text, text, text) to anon, authenticated;

-- ---------- Checkout: keeps the shipping address and how it was priced ----------
drop function if exists place_order(text, text, text, text, jsonb, text);
drop function if exists place_order(text, text, text, text, jsonb, text, text, text, text);

create or replace function place_order(
  p_name text, p_email text, p_city text, p_state text, p_items jsonb, p_code text default null,
  p_country text default null, p_address text default null, p_postcode text default null, p_gift text default null
) returns table (order_id text, order_total integer, applied_discount integer, sale_discount integer, shipping integer, subtotal integer, ship_estimate text, gift_amount integer, amount_due integer)
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_customer text;
  v_num integer;
  v_oid text;
  l jsonb;
  v_country text := nullif(upper(trim(coalesce(p_country, ''))), '');
  v_gift integer;
begin
  if coalesce(trim(p_name), '') = '' or position('@' in coalesce(p_email, '')) = 0 then raise exception 'Name and a valid email are required'; end if;
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then raise exception 'Choose a valid country'; end if;

  v := price_order(p_items, p_email, p_code, true, v_country, p_gift);   -- prices, locks stock rows and the code, raises on any problem

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

  -- pay (part of) it with the gift card: the row was locked by price_order, so two checkouts can't both spend the same balance
  v_gift := coalesce((v ->> 'gift_amount')::int, 0);
  if v_gift > 0 then
    update gift_cards set balance = balance - v_gift where code = v ->> 'gift_code';
    insert into gift_card_ledger (card_id, delta, kind, order_id) select gc2.id, -v_gift, 'redeem', v_oid from gift_cards gc2 where gc2.code = v ->> 'gift_code';
    update orders set gift_code = v ->> 'gift_code', gift_amount = v_gift, payment = case when (v ->> 'amount_due')::int = 0 then 'Gift card' else payment end where id = v_oid;
  end if;

  return query select v_oid, (v ->> 'total')::int, (v ->> 'discount')::int, (v ->> 'sale_discount')::int, (v ->> 'shipping')::int, (v ->> 'subtotal')::int, coalesce(v ->> 'ship_estimate', ''), v_gift, (v ->> 'amount_due')::int;
end $$;

revoke all on function place_order(text, text, text, text, jsonb, text, text, text, text, text) from public;
grant execute on function place_order(text, text, text, text, jsonb, text, text, text, text, text) to anon, authenticated;
