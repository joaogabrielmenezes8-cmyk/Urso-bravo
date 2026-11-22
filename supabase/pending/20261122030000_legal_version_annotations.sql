begin;
-- Additive: legacy student_study_annotations is deliberately untouched.
create table if not exists public.student_legal_version_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version_id uuid not null references public.legal_provision_versions(id),
  body text not null default '' check (char_length(body) <= 10000),
  selected_text text,
  highlight_color text check (highlight_color in ('yellow','green','blue','pink')),
  start_offset integer,
  end_offset integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(body) <> '' or coalesce(selected_text,'') <> ''),
  check ((selected_text is null and start_offset is null and end_offset is null)
    or (selected_text is not null and selected_text <> '' and start_offset >= 0 and end_offset > start_offset
        and start_offset is not null and end_offset is not null)),
  check (selected_text is not null or highlight_color is null)
);
create index if not exists version_annotation_owner_idx
  on public.student_legal_version_annotations(user_id,version_id);
alter table public.student_legal_version_annotations enable row level security;
revoke all on public.student_legal_version_annotations from public,anon;
grant select,insert,update,delete on public.student_legal_version_annotations to authenticated;

create or replace function private.validate_legal_version_annotation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare legal_body text;
begin
  if tg_op = 'UPDATE' and (new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.version_id is distinct from old.version_id
      or new.created_at is distinct from old.created_at) then
    raise exception 'O destino de uma anotação histórica é imutável' using errcode='55000';
  end if;
  select v.body into legal_body from public.legal_provision_versions v
    where v.id = new.version_id and not v.revoked;
  if not found then
    raise exception 'Redação histórica indisponível para anotação' using errcode='42501';
  end if;
  -- Offsets are Unicode code points, not JS UTF-16 units.
  if new.selected_text is not null and (new.start_offset is null or new.end_offset is null
      or new.start_offset < 0 or new.end_offset <= new.start_offset
      or new.end_offset > char_length(legal_body)
      or substring(legal_body from new.start_offset+1 for new.end_offset-new.start_offset)
        is distinct from new.selected_text) then
    raise exception 'A seleção não corresponde à redação imutável' using errcode='22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.validate_legal_version_annotation() from public,anon;
drop trigger if exists validate_legal_version_annotation on public.student_legal_version_annotations;
create trigger validate_legal_version_annotation before insert or update
  on public.student_legal_version_annotations for each row
  execute function private.validate_legal_version_annotation();

drop policy if exists own_version_annotations_read on public.student_legal_version_annotations;
create policy own_version_annotations_read on public.student_legal_version_annotations
  for select to authenticated using (user_id=(select auth.uid()) and exists
    (select from public.legal_provision_versions v where v.id=version_id));
drop policy if exists own_version_annotations_insert on public.student_legal_version_annotations;
create policy own_version_annotations_insert on public.student_legal_version_annotations
  for insert to authenticated with check (user_id=(select auth.uid()) and exists
    (select from public.legal_provision_versions v where v.id=version_id and not v.revoked));
drop policy if exists own_version_annotations_update on public.student_legal_version_annotations;
create policy own_version_annotations_update on public.student_legal_version_annotations
  for update to authenticated using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()) and exists
    (select from public.legal_provision_versions v where v.id=version_id and not v.revoked));
drop policy if exists own_version_annotations_delete on public.student_legal_version_annotations;
create policy own_version_annotations_delete on public.student_legal_version_annotations
  for delete to authenticated using (user_id=(select auth.uid()));
commit;
