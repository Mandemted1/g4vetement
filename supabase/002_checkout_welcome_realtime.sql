-- Run AFTER schema.sql (Supabase SQL editor > New query > paste > Run). Safe to re-run.
-- Adds: welcome-discount support in checkout, newsletter subscribers, and live order alerts in the admin.

-- ---------- Checkout v2 (adds an optional discount code) ----------
drop function if exists place_order(text, text, text, text, jsonb);
drop function if exists place_order(text, text, text, text, jsonb, text);  -- so re-running after later versions changed the return type still works

create or replace function place_order(
  p_name text, p_email text, p_city text, p_state text, p_items jsonb, p_code text default null
) returns table (order_id text, order_total integer, applied_discount integer)
language plpgsql security definer set search_path = public as $$
declare
  v_customer text;
  v_num integer;
  v_oid text;
  v_sub integer := 0;
  v_ship integer;
  v_disc integer := 0;
  v_code text := upper(nullif(trim(coalesce(p_code, '')), ''));
  v_prior integer;
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

  if v_code is not null then
    if v_code = 'WELCOME10' then
      select count(*) into v_prior from orders o join customers c on c.id = o.customer_id
        where lower(c.email) = lower(p_email) and o.id <> v_oid and o.status <> 'cancelled';
      if v_prior > 0 then raise exception 'WELCOME10 is for first orders only'; end if;
      if v_sub < 50 then raise exception 'WELCOME10 needs a $50 bag'; end if;
      v_disc := 10;
    else
      raise exception 'That code is not valid';
    end if;
  end if;

  v_ship := case when v_sub >= 100 then 0 else 9 end;
  update orders set subtotal = v_sub, discount = v_disc, discount_code = case when v_disc > 0 then v_code end,
                    shipping = v_ship, total = v_sub - v_disc + v_ship
   where id = v_oid;
  return query select v_oid, v_sub - v_disc + v_ship, v_disc;
end $$;

revoke all on function place_order(text, text, text, text, jsonb, text) from public;
grant execute on function place_order(text, text, text, text, jsonb, text) to anon, authenticated;

-- ---------- Newsletter / welcome-popup subscribers ----------
create table if not exists subscribers (
  id         bigserial primary key,
  email      text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists subscribers_email_key on subscribers (lower(email));
alter table subscribers enable row level security;

drop policy if exists "anyone can subscribe" on subscribers;
create policy "anyone can subscribe" on subscribers for insert to anon, authenticated with check (position('@' in email) > 1);

drop policy if exists "admin manage subscribers" on subscribers;
create policy "admin manage subscribers" on subscribers for all to authenticated using (true) with check (true);

-- ---------- Live order alerts (the admin listens for new orders) ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table orders;
  end if;
end $$;
