begin;

-- A retificação creates a new revision. Existing links keep their revision ID.
create table public.notice_legal_revisions (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id),
  revision integer not null check (revision > 0),
  cutoff_on date not null,
  cutoff_clause text not null check (btrim(cutoff_clause) <> ''),
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  unique (notice_id, revision)
);

-- An explicitly sourced revocation is evidence. A missing row means unknown.
create table public.legal_provision_versions (
  id uuid primary key default gen_random_uuid(),
  provision_id uuid not null references public.legal_provisions(id),
  valid_from date not null,
  valid_until date,
  heading text,
  body text,
  revoked boolean not null default false,
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  review_evidence text not null check (btrim(review_evidence) <> ''),
  check (valid_until is null or valid_from < valid_until),
  check ((revoked and body is null) or
         (not revoked and body is not null and btrim(body) <> '')),
  unique nulls not distinct
    (provision_id, valid_from, valid_until, source_sha256, revoked),
  unique (provision_id, id)
);

-- One row per provision explicitly included in the notice. NULL means
-- the scope is known and the historical text is pending certification.
create table public.notice_legal_scope (
  revision_id uuid not null references public.notice_legal_revisions(id),
  provision_id uuid not null references public.legal_provisions(id),
  syllabus_locator text not null check (btrim(syllabus_locator) <> ''),
  version_id uuid,
  primary key (revision_id, provision_id),
  foreign key (provision_id, version_id)
    references public.legal_provision_versions(provision_id, id)
);

create index notice_legal_scope_version_idx
  on public.notice_legal_scope (version_id);

create table public.notice_legal_releases (
  revision_id uuid primary key references public.notice_legal_revisions(id),
  released_at timestamptz not null default now()
);

create function private.reject_notice_legal_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Histórico legislativo imutável' using errcode = '55000';
end;
$$;

create function private.validate_notice_legal_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  cutoff date;
begin
  -- Serialize sealing and scope insertion for the same revision. Require
  -- READ COMMITTED so checks after a lock wait see the preceding transaction.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Use READ COMMITTED para montar ou selar uma revisão'
      using errcode = '25000';
  end if;

  select r.cutoff_on into strict cutoff
  from public.notice_legal_revisions r
  where r.id = new.revision_id
  for update;

  if tg_table_name = 'notice_legal_releases' then
    if not exists (
      select from public.notice_legal_scope s where s.revision_id = new.revision_id
    ) then
      raise exception 'A revisão deve conter dispositivos no escopo'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if exists (
    select from public.notice_legal_releases r where r.revision_id = new.revision_id
  ) then
    -- Allow exact ingestion retries against a sealed revision. The primary
    -- key still requires INSERT ... ON CONFLICT DO NOTHING for that retry.
    if exists (
      select from public.notice_legal_scope s
      where s.revision_id = new.revision_id and s.provision_id = new.provision_id
        and s.syllabus_locator = new.syllabus_locator
        and s.version_id is not distinct from new.version_id
    ) then
      return new;
    end if;
    raise exception 'Revisão já selada' using errcode = '55000';
  end if;

  if new.version_id is not null and not exists (
    select from public.legal_provision_versions v
    where v.id = new.version_id and v.provision_id = new.provision_id
      and v.valid_from <= cutoff and (v.valid_until is null or cutoff < v.valid_until)
  ) then
    raise exception 'Redação fora da vigência no edital ou de outro dispositivo'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_notice_legal_mutation() from public;
revoke all on function private.validate_notice_legal_insert() from public;

do $$
declare
  relation text;
begin
  foreach relation in array array[
    'notice_legal_revisions', 'legal_provision_versions',
    'notice_legal_scope', 'notice_legal_releases'
  ] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', relation);
    execute format('grant select on public.%I to authenticated', relation);
    execute format('grant select, insert on public.%I to service_role', relation);
    execute format(
      'create trigger immutable_history before update or delete on public.%I
       for each row execute function private.reject_notice_legal_mutation()', relation);
    execute format(
      'create trigger immutable_history_truncate before truncate on public.%I
       for each statement execute function private.reject_notice_legal_mutation()', relation);
  end loop;
end;
$$;

create trigger validate_notice_legal_scope before insert on public.notice_legal_scope
for each row execute function private.validate_notice_legal_insert();
create trigger validate_notice_legal_release before insert on public.notice_legal_releases
for each row execute function private.validate_notice_legal_insert();

-- Mirror the canonical legal_provisions SELECT policy.
create policy see_released_notices on public.notice_legal_releases
for select to authenticated using (public.my_premium_access() or (select private.is_admin()));
create policy see_released_revisions on public.notice_legal_revisions
for select to authenticated using (
  exists (select from public.notice_legal_releases r where r.revision_id = notice_legal_revisions.id)
);
create policy see_released_scope on public.notice_legal_scope
for select to authenticated using (
  exists (select from public.notice_legal_releases r
          where r.revision_id = notice_legal_scope.revision_id)
);
create policy see_released_versions on public.legal_provision_versions
for select to authenticated using (
  exists (select from public.notice_legal_scope s where s.version_id = legal_provision_versions.id)
  and exists (select from public.legal_provisions p where p.id = legal_provision_versions.provision_id)
);

-- Shared API contract for reader, questions and AI. An optional explicit revision
-- pins past attempts. A mismatched revision never resolves against another notice.
create function public.resolve_notice_legal_provision(
  p_notice_id uuid, p_provision_id uuid, p_revision_id uuid default null
)
returns table (
  status text, revision_id uuid, cutoff_on date, version_id uuid, heading text,
  body text, source_url text, source_sha256 text, edition_source_url text
)
language sql stable security invoker set search_path = ''
as $$
  select
    case when r.id is null then 'pending_notice'
         when s.provision_id is null then 'outside_recorded_scope'
         when v.id is null then 'pending_version'
         when v.revoked then 'revoked'
         else 'available' end,
    r.id, r.cutoff_on, v.id, v.heading, v.body, v.source_url, v.source_sha256,
    r.source_url
  from (values (1)) as request(dummy)
  left join lateral (
    select n.* from public.notice_legal_revisions n
    where n.notice_id = p_notice_id and (p_revision_id is null or n.id = p_revision_id)
      and exists (select from public.notice_legal_releases l where l.revision_id = n.id)
    order by n.revision desc limit 1
  ) r on true
  left join public.notice_legal_scope s
    on s.revision_id = r.id and s.provision_id = p_provision_id
  left join public.legal_provision_versions v
    on v.id = s.version_id and v.provision_id = s.provision_id;
$$;

revoke all on function public.resolve_notice_legal_provision(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.resolve_notice_legal_provision(uuid, uuid, uuid)
  to authenticated, service_role;

-- Import one complete, explicitly reviewed revision. Replays must match the
-- persisted payload. IDs are stable across retries.
create function public.ingest_notice_legal_revision(
  p_revision jsonb, p_versions jsonb, p_scope jsonb
)
returns uuid
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  incoming_revision public.notice_legal_revisions;
  version public.legal_provision_versions;
  scope public.notice_legal_scope;
begin
  if jsonb_typeof(p_revision) is distinct from 'object'
     or jsonb_typeof(p_versions) is distinct from 'array'
     or jsonb_typeof(p_scope) is distinct from 'array' then
    raise exception 'Informe uma revisão e listas de redações e escopo'
      using errcode = '22023';
  end if;

  incoming_revision := jsonb_populate_record(null::public.notice_legal_revisions, p_revision);
  insert into public.notice_legal_revisions select (incoming_revision).*
    on conflict do nothing;
  if not exists (select from public.notice_legal_revisions r where r is not distinct from incoming_revision) then
    raise exception 'Revisão divergente da revisão armazenada' using errcode = '23505';
  end if;

  for version in
    select * from jsonb_populate_recordset(null::public.legal_provision_versions, p_versions)
  loop
    -- jsonb_populate_record does not apply column DEFAULT expressions.
    -- Normalize the optional boolean before INSERT and replay comparison.
    version.revoked := coalesce(version.revoked, false);
    if version.id is null then
      raise exception 'Informe um ID estável para cada redação'
        using errcode = '22023';
    end if;
    insert into public.legal_provision_versions select (version).*
      on conflict do nothing;
    if not exists (select from public.legal_provision_versions v where v is not distinct from version) then
      raise exception 'Redação divergente da versão armazenada' using errcode = '23505';
    end if;
  end loop;

  for scope in
    select * from jsonb_populate_recordset(null::public.notice_legal_scope, p_scope)
  loop
    if scope.revision_id is distinct from incoming_revision.id then
      raise exception 'Dispositivo associado a outra revisão' using errcode = '23514';
    end if;
    insert into public.notice_legal_scope select (scope).*
      on conflict do nothing;
    if not exists (select from public.notice_legal_scope s where s is not distinct from scope) then
      raise exception 'Escopo divergente do escopo armazenado' using errcode = '23505';
    end if;
  end loop;

  -- Take the revision lock in the seal trigger before comparing the complete
  -- stored scope to the supplied scope. Any mismatch rolls back the seal.
  insert into public.notice_legal_releases (revision_id)
    values (incoming_revision.id) on conflict do nothing;
  if exists (
    select s.* from public.notice_legal_scope s where s.revision_id = incoming_revision.id
    except
    select * from jsonb_populate_recordset(null::public.notice_legal_scope, p_scope)
  ) then
    raise exception 'O lote deve incluir o escopo completo da revisão'
      using errcode = '23514';
  end if;
  return incoming_revision.id;
end;
$$;

revoke all on function public.ingest_notice_legal_revision(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_notice_legal_revision(jsonb, jsonb, jsonb)
  to service_role;

commit;
