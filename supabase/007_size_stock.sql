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
-- Admins and the service role (scripts) only: a signed-in customer has a user id but isn't an admin.
create or replace function adjust_stock(p_product text, p_size text, p_delta integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not (can_do('orders.manage') or can_do('products.manage')) then raise exception 'Not allowed'; end if;
  update products
  set size_stock = jsonb_set(size_stock, array[p_size], to_jsonb(greatest(0, coalesce((size_stock ->> p_size)::integer, 0) + p_delta)))
  where id = p_product and sizes ? p_size;
end $$;
revoke all on function adjust_stock(text, text, integer) from public, anon;
grant execute on function adjust_stock(text, text, integer) to authenticated, service_role;

-- (The checkout functions price_order / quote_order / place_order are defined once, in 008_shipping.sql, so re-running migrations never swaps in an older version.)
