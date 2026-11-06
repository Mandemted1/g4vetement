-- Men / Women sections above the categories.  Safe to re-run.
--
-- Every product belongs to a department: 'men', 'women', or 'unisex' (shown in both). Categories (Tees, Hoodies…) stay
-- shared and sit under each department. Existing products were all men's, so they start as 'men'.

alter table products add column if not exists department text not null default 'men';
alter table products drop constraint if exists products_department_check;
alter table products add constraint products_department_check check (department in ('men', 'women', 'unisex'));
create index if not exists products_department_idx on products (department);
