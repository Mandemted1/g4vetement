-- Run AFTER 002_checkout_welcome_realtime.sql. Safe to re-run.
-- Adds: email templates + campaigns + message log (Resend), visitor analytics, and helpers for the daily simulator.

-- ---------- Subscribers: status + unsubscribe token ----------
alter table subscribers add column if not exists status text not null default 'subscribed';
alter table subscribers add column if not exists token uuid not null default gen_random_uuid();
alter table subscribers add column if not exists source text;
alter table subscribers add column if not exists unsubscribed_at timestamptz;
create unique index if not exists subscribers_token_key on subscribers (token);
alter table subscribers drop constraint if exists subscribers_status_chk;
alter table subscribers add constraint subscribers_status_chk check (status in ('subscribed', 'unsubscribed'));

-- ---------- Email templates (order confirmation, shipped, welcome) ----------
create table if not exists email_templates (
  key         text primary key,
  name        text not null,
  description text not null default '',
  subject     text not null,
  preheader   text not null default '',
  doc         jsonb not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ---------- Campaigns (newsletters / promotions) ----------
create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  subject      text not null default '',
  preheader    text not null default '',
  doc          jsonb not null,
  audience     text not null default 'subscribers',   -- subscribers | buyers | non_buyers | vip
  status       text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_at      timestamptz,
  recipients   integer not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- Every email we send, updated by Resend webhooks ----------
create table if not exists email_messages (
  id          bigserial primary key,
  resend_id   text unique,
  campaign_id uuid references campaigns(id) on delete set null,
  kind        text not null,                           -- campaign | order_confirmation | order_shipped | welcome | test
  to_email    text not null,
  status      text not null default 'sent',            -- sent | delivered | bounced | complained | failed
  opened_at   timestamptz,
  clicked_at  timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists email_messages_campaign_idx on email_messages (campaign_id);
create index if not exists email_messages_created_idx on email_messages (created_at desc);

-- ---------- Visitor analytics (cookie-free, written by the server only) ----------
create table if not exists visits (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  visitor_id text not null,
  session_id text not null,
  event      text not null default 'pageview',         -- pageview | product_view | add_to_cart | checkout_start | purchase
  path       text,
  referrer   text,
  source     text,
  country    text,
  device     text,
  browser    text,
  os         text,
  product_id text,
  entry      boolean not null default false,             -- first pageview of a session (the only one that carries a traffic source)
  sim        boolean not null default false              -- true for demo traffic made by the simulator
);
alter table visits add column if not exists entry boolean not null default false;
create index if not exists visits_ts_idx on visits (ts desc);
create index if not exists visits_event_idx on visits (event, ts desc);

-- ---------- Row level security: only a signed-in admin can read; writes go through the server (service role) ----------
alter table email_templates enable row level security;
alter table campaigns       enable row level security;
alter table email_messages  enable row level security;
alter table visits          enable row level security;

drop policy if exists "admin all templates" on email_templates;
create policy "admin all templates" on email_templates for all to authenticated using (true) with check (true);
drop policy if exists "admin all campaigns" on campaigns;
create policy "admin all campaigns" on campaigns for all to authenticated using (true) with check (true);
drop policy if exists "admin read messages" on email_messages;
create policy "admin read messages" on email_messages for select to authenticated using (true);
drop policy if exists "admin read visits" on visits;
create policy "admin read visits" on visits for select to authenticated using (true);

-- ---------- Analytics queries (run as the signed-in admin) ----------
create or replace function analytics_overview(p_days integer default 30)
returns jsonb language sql stable as $$
  with v as (select * from visits where ts >= now() - make_interval(days => p_days)),
  daily as (
    select date_trunc('day', ts)::date as d, count(*) filter (where event = 'pageview') as views, count(distinct visitor_id) as visitors
    from v group by 1
  )
  select jsonb_build_object(
    'visitors',  (select count(distinct visitor_id) from v),
    'pageviews', (select count(*) from v where event = 'pageview'),
    'sessions',  (select count(distinct session_id) from v),
    'daily',     coalesce((select jsonb_agg(jsonb_build_object('d', d, 'views', views, 'visitors', visitors) order by d) from daily), '[]'::jsonb),
    'pages',     coalesce((select jsonb_agg(t) from (select path, count(*) as views, count(distinct visitor_id) as visitors from v where event = 'pageview' group by path order by count(*) desc limit 10) t), '[]'::jsonb),
    'sources',   coalesce((select jsonb_agg(t) from (select coalesce(source, 'Direct') as name, count(distinct visitor_id) as visitors from v where event = 'pageview' and entry group by 1 order by 2 desc limit 8) t), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(t) from (select coalesce(country, 'Unknown') as name, count(distinct visitor_id) as visitors from v where event = 'pageview' group by 1 order by 2 desc limit 10) t), '[]'::jsonb),
    'devices',   coalesce((select jsonb_agg(t) from (select coalesce(device, 'Unknown') as name, count(distinct visitor_id) as visitors from v where event = 'pageview' group by 1 order by 2 desc) t), '[]'::jsonb),
    'browsers',  coalesce((select jsonb_agg(t) from (select coalesce(browser, 'Other') as name, count(distinct visitor_id) as visitors from v where event = 'pageview' group by 1 order by 2 desc limit 6) t), '[]'::jsonb),
    'funnel',    jsonb_build_object(
      'visitors',       (select count(distinct visitor_id) from v),
      'product_view',   (select count(distinct visitor_id) from v where event = 'product_view'),
      'add_to_cart',    (select count(distinct visitor_id) from v where event = 'add_to_cart'),
      'checkout_start', (select count(distinct visitor_id) from v where event = 'checkout_start'),
      'purchase',       (select count(distinct visitor_id) from v where event = 'purchase')
    ),
    'products',  coalesce((select jsonb_agg(t) from (
      select product_id, count(*) filter (where event = 'product_view') as views, count(*) filter (where event = 'add_to_cart') as adds
      from v where product_id is not null group by product_id order by 2 desc limit 8) t), '[]'::jsonb)
  );
$$;

create or replace function analytics_live()
returns jsonb language sql stable as $$
  with live as (select * from visits where ts >= now() - interval '5 minutes')
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from live),
    'pages',    coalesce((select jsonb_agg(t) from (select path, count(distinct visitor_id) as visitors from live where event = 'pageview' group by path order by 2 desc limit 6) t), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(t) from (select coalesce(country, 'Unknown') as name, count(distinct visitor_id) as visitors from live group by 1 order by 2 desc limit 5) t), '[]'::jsonb),
    'carts',    (select count(distinct visitor_id) from live where event = 'add_to_cart')
  );
$$;

-- ---------- Housekeeping + simulator helpers (service role only) ----------
create or replace function prune_visits(p_days integer default 90) returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from visits where ts < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function prune_visits(integer) from public, anon, authenticated;

-- The daily simulator takes its order numbers / customer ids from the same sequences real checkouts use, so they never collide.
create or replace function next_order_numbers(n integer) returns setof integer language sql security definer set search_path = public as $$
  select nextval('order_number_seq')::integer from generate_series(1, n);
$$;
create or replace function next_customer_ids(n integer) returns setof text language sql security definer set search_path = public as $$
  select 'C-' || lpad(nextval('customer_seq')::text, 4, '0') from generate_series(1, n);
$$;
revoke all on function next_order_numbers(integer) from public, anon, authenticated;
revoke all on function next_customer_ids(integer) from public, anon, authenticated;

-- ---------- Mark demo orders so the daily simulator never touches real customer orders ----------
alter table orders add column if not exists sim boolean not null default false;
update orders set sim = true where number < 2001 and not sim;  -- the seeded history; real checkouts start at 2001
