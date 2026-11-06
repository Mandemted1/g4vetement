-- Step 6: abandoned-cart reminders.  Safe to re-run.
--
-- When the admin turns reminders on and a shopper types their email at checkout but doesn't order, we keep their bag
-- (one row per email) so a single reminder can be sent. Nothing here is readable by shoppers: rows are written and read
-- only by the server (service role); admins can read them for the Abandoned carts page.

create table if not exists abandoned_carts (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (email = lower(email)),
  user_id          uuid references auth.users (id) on delete set null,
  items            jsonb not null,                                  -- [{ "productId": "p02", "size": "M", "color": "Black", "qty": 1 }]
  subtotal         integer not null default 0,
  country          text,
  token            uuid not null unique default gen_random_uuid(),  -- the secret in the "return to your bag" and "stop reminders" links
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  reminder_sent_at timestamptz,
  recovered_at     timestamptz                                      -- they ordered after all
);
create index if not exists abandoned_carts_due_idx on abandoned_carts (updated_at) where recovered_at is null;

-- People who asked never to be reminded (lowercase). Checked before anything is stored or sent.
create table if not exists cart_reminder_optouts (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table abandoned_carts enable row level security;
alter table cart_reminder_optouts enable row level security;
drop policy if exists "admin read abandoned carts" on abandoned_carts;
create policy "admin read abandoned carts" on abandoned_carts for select to authenticated using (can_do('marketing.manage'));
drop policy if exists "admin read reminder optouts" on cart_reminder_optouts;
create policy "admin read reminder optouts" on cart_reminder_optouts for select to authenticated using (can_do('marketing.manage'));
-- (no other policies: shoppers can't read or write these tables)
