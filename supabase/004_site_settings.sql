-- Run AFTER 003. Safe to re-run.
-- Store-wide settings the admin can change (starting with the admin login screen look).

create table if not exists site_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;

-- Only a signed-in admin can read or change settings. The login page itself reads its one setting on the server.
drop policy if exists "admin manage settings" on site_settings;
create policy "admin manage settings" on site_settings for all to authenticated using (true) with check (true);

insert into site_settings (key, value) values (
  'login',
  '{"image":"https://res.cloudinary.com/vodrto8k/image/upload/v1793942153/616641374028308716.jpg","overlay":0.5,"layout":"full","tagline":"Sign in to manage orders, products and customers."}'
) on conflict (key) do nothing;
