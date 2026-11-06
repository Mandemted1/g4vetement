-- Run AFTER 004. Safe to re-run.
-- Admin-managed categories (shown as filters and in the menu on the storefront).

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 40),
  description text not null default '',
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists categories_name_key on categories (lower(name));
alter table categories enable row level security;

-- Category names aren't secret: the storefront reads all of them and applies the "visible" flag itself
-- (it must know which are hidden so a hidden category never reappears). A signed-in admin can do everything.
drop policy if exists "public read active categories" on categories;
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select to anon, authenticated using (true);
drop policy if exists "admin manage categories" on categories;
create policy "admin manage categories" on categories for all to authenticated using (is_admin()) with check (is_admin());

-- Start from the categories products already use, in the order they first appear.
insert into categories (name, sort)
select category, row_number() over (order by min(sort), category)
from products
where coalesce(trim(category), '') <> ''
group by category
on conflict do nothing;

-- Renaming keeps every product in the category (done in one transaction).
create or replace function rename_category(p_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare old_name text; new_name text := trim(p_name);
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Not allowed'; end if;   -- admins and the service role only
  if new_name = '' or length(new_name) > 40 then raise exception 'Category names must be 1 to 40 characters'; end if;
  select name into old_name from categories where id = p_id;
  if old_name is null then raise exception 'Category not found'; end if;
  if exists (select 1 from categories where lower(name) = lower(new_name) and id <> p_id) then raise exception 'A category called "%" already exists', new_name; end if;
  update categories set name = new_name where id = p_id;
  update products set category = new_name where category = old_name;
end $$;

-- Deleting a category that still has products requires choosing where they go.
create or replace function delete_category(p_id uuid, p_move_to text default null) returns integer
language plpgsql security definer set search_path = public as $$
declare old_name text; moved integer := 0;
begin
  if auth.uid() is not null and not is_admin() then raise exception 'Not allowed'; end if;   -- admins and the service role only
  select name into old_name from categories where id = p_id;
  if old_name is null then raise exception 'Category not found'; end if;
  if exists (select 1 from products where category = old_name) then
    if p_move_to is null or not exists (select 1 from categories where name = p_move_to and id <> p_id) then
      raise exception 'Choose another category to move its products to';
    end if;
    update products set category = p_move_to where category = old_name;
    get diagnostics moved = row_count;
  end if;
  delete from categories where id = p_id;
  return moved;
end $$;

revoke all on function rename_category(uuid, text) from public, anon;
revoke all on function delete_category(uuid, text) from public, anon;
grant execute on function rename_category(uuid, text) to authenticated;
grant execute on function delete_category(uuid, text) to authenticated;
