-- Run AFTER schema.sql (Supabase SQL editor > New query > paste > Run). Safe to re-run.
-- Adds: welcome-discount support in checkout, newsletter subscribers, and live order alerts in the admin.

-- (The checkout functions price_order / quote_order / place_order are defined once, in 008_shipping.sql, so re-running migrations never swaps in an older version.)


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
create policy "admin manage subscribers" on subscribers for all to authenticated using (is_admin()) with check (is_admin());

-- ---------- Live order alerts (the admin listens for new orders) ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table orders;
  end if;
end $$;
