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
create policy "admin manage discount codes" on discount_codes for all to authenticated using (can_do('marketing.manage')) with check (can_do('marketing.manage'));
drop policy if exists "admin manage sales" on sales;
create policy "admin manage sales" on sales for all to authenticated using (can_do('marketing.manage')) with check (can_do('marketing.manage'));

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

-- (The checkout functions price_order / quote_order / place_order are defined once, in 008_shipping.sql, so re-running migrations never swaps in an older version.)

revoke all on function sale_percent(text, text) from public, anon, authenticated;
grant execute on function public_sales() to anon, authenticated;
