-- Step 5b: product reviews.  Safe to re-run.
--
-- Only a signed-in customer whose order for the product has shipped can review it, once per product (they can edit it).
-- Reviews are published straight away; an admin can hide or delete any of them. Everything is written through
-- submit_review(), never directly, so the rules can't be bypassed.

create table if not exists reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id text not null references products (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  author     text not null,                                   -- "Alex M."
  rating     integer not null check (rating between 1 and 5),
  title      text not null default '' check (length(title) <= 80),
  body       text not null default '' check (length(body) <= 1500),
  status     text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on reviews (product_id, created_at desc);
alter table reviews enable row level security;

drop policy if exists "anyone reads published reviews" on reviews;
create policy "anyone reads published reviews" on reviews for select to anon, authenticated using (status = 'published');
drop policy if exists "customers read their own reviews" on reviews;
create policy "customers read their own reviews" on reviews for select to authenticated using (user_id = auth.uid());
drop policy if exists "customers delete their own reviews" on reviews;
create policy "customers delete their own reviews" on reviews for delete to authenticated using (user_id = auth.uid());
drop policy if exists "admin manage reviews" on reviews;
create policy "admin manage reviews" on reviews for all to authenticated using (can_do('reviews.manage')) with check (can_do('reviews.manage'));
-- (no insert/update policy for customers on purpose: they go through submit_review())

-- Nobody but the database needs to see WHO wrote a review (only the display name is shown), so the user id column is not readable
-- through the API. Queries must therefore name their columns (select * is refused).
revoke select on reviews from anon, authenticated;
grant select (id, product_id, author, rating, title, body, status, created_at, updated_at) on reviews to anon, authenticated;

-- The caller's own review of a product (so the form can be pre-filled for editing), including whether an admin hid it.
create or replace function my_review(p_product text)
returns table (rating integer, title text, body text, status text)
language sql stable security definer set search_path = public as $$
  select r.rating, r.title, r.body, r.status from reviews r where r.product_id = p_product and r.user_id = auth.uid();
$$;
revoke all on function my_review(text) from public, anon;
grant execute on function my_review(text) to authenticated;

-- Has this signed-in customer received this product?
create or replace function can_review(p_product text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.product_id = p_product and o.user_id = auth.uid() and o.status in ('shipped', 'delivered')
  );
$$;
revoke all on function can_review(text) from public, anon;
grant execute on function can_review(text) to authenticated;

-- Writes (or edits) the caller's review. A review an admin hid stays hidden when its author edits it.
create or replace function submit_review(p_product text, p_rating integer, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_author text;
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception 'Sign in to write a review'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Choose a rating from 1 to 5'; end if;
  if length(v_title) > 80 then raise exception 'Keep the title under 80 characters'; end if;
  if length(v_body) > 1500 then raise exception 'Keep the review under 1500 characters'; end if;
  if not can_review(p_product) then raise exception 'You can review a product once you have received it'; end if;

  -- shown as "Alex M." (first name and last initial)
  select trim(coalesce(raw_user_meta_data ->> 'full_name', '')) into v_name from auth.users where id = v_uid;
  if coalesce(v_name, '') = '' then v_author := 'Customer';
  elsif position(' ' in v_name) = 0 then v_author := left(v_name, 30);
  else v_author := left(split_part(v_name, ' ', 1), 30) || ' ' || upper(left((regexp_match(v_name, '(\S+)$'))[1], 1)) || '.';
  end if;

  insert into reviews (product_id, user_id, author, rating, title, body)
  values (p_product, v_uid, v_author, p_rating, v_title, v_body)
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, title = excluded.title, body = excluded.body, author = excluded.author, updated_at = now();
end $$;
revoke all on function submit_review(text, integer, text, text) from public, anon;
grant execute on function submit_review(text, integer, text, text) to authenticated;

-- Average rating and count per product (published reviews only), for stars on cards and product pages.
create or replace function review_summary()
returns table (product_id text, average numeric, total integer)
language sql stable security definer set search_path = public as $$
  select r.product_id, round(avg(r.rating)::numeric, 1), count(*)::integer from reviews r where r.status = 'published' group by r.product_id;
$$;
grant execute on function review_summary() to anon, authenticated;
