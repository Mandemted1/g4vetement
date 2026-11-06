-- Step 5a: customers can have accounts without becoming admins.  Safe to re-run.
--
-- The admin list (`admins`), is_admin(), and the is_admin() checks on every admin policy and function live in the
-- original files (schema.sql and 002-008), so re-running migrations never re-opens anything.

-- One time only: everyone who has an account today is an admin (sign-ups were closed, so that's just you).
-- A flag stops this ever running again, so a customer who signs up later can never be promoted by a re-run.
-- To add another admin later:  npm run make-admin -- someone@example.com
do $$
begin
  if not exists (select 1 from site_settings where key = 'admins_seeded') then
    insert into admins (user_id) select id from auth.users on conflict do nothing;
    insert into site_settings (key, value) values ('admins_seeded', 'true'::jsonb) on conflict do nothing;
  end if;
end $$;

-- ---------- Customers see their own orders (and only theirs) ----------
alter table orders add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists orders_user_idx on orders (user_id) where user_id is not null;

-- An order placed while signed in belongs to that account. (place_order runs as the caller, so auth.uid() is the shopper.)
create or replace function orders_set_user() returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists orders_set_user on orders;
create trigger orders_set_user before insert on orders for each row execute function orders_set_user();

drop policy if exists "customers read own orders" on orders;
create policy "customers read own orders" on orders for select to authenticated using (user_id = auth.uid());
drop policy if exists "customers read own order items" on order_items;
create policy "customers read own order items" on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
