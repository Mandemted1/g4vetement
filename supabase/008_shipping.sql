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
create policy "admin manage shipping zones" on shipping_zones for all to authenticated using (can_do('settings.manage')) with check (can_do('settings.manage'));

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

-- (The checkout functions that use these zones live in 012_gift_cards.sql, their single definition.)
