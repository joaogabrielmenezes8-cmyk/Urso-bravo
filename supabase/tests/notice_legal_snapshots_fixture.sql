-- Minimal canonical schema contract. Apply only in an empty test database.
create schema private;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.notices (id uuid primary key);
create table public.legal_provisions (id uuid primary key);
alter table public.legal_provisions enable row level security;
create function public.my_premium_access() returns boolean language sql stable
  as $$ select current_setting('test.premium', true) = 'yes' $$;
create function private.is_admin() returns boolean language sql stable
  as $$ select current_setting('test.admin', true) = 'yes' $$;
grant usage on schema private to authenticated, service_role;
grant select on public.legal_provisions to authenticated, service_role;
create policy legal_provisions_read on public.legal_provisions for select to authenticated
  using (public.my_premium_access() or (select private.is_admin()));
insert into public.notices values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
insert into public.legal_provisions values
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003');
