begin;
-- Minimal notice list for the legal reader: active notices for any signed-in
-- student, plus historical notices with a released (sealed) revision only for
-- premium/admin. Returns id/title/year only; notices RLS is unchanged.
create or replace function public.list_reader_notices()
returns table (id uuid, title text, year integer)
language sql stable security definer set search_path = ''
as $$
  select n.id, n.title, n.year
  from public.notices n
  where auth.uid() is not null
    and (
      n.active
      or ((public.my_premium_access() or (select private.is_admin()))
          and exists (
            select from public.notice_legal_revisions r
            join public.notice_legal_releases l on l.revision_id = r.id
            where r.notice_id = n.id))
    )
  order by n.year desc nulls last, n.title;
$$;
revoke all on function public.list_reader_notices() from public, anon;
grant execute on function public.list_reader_notices() to authenticated;
commit;
