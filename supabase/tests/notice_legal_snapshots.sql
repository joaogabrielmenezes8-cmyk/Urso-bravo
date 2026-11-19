begin;

create function pg_temp.assert_equal(actual text, expected text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'expected %, got %', expected, actual;
  end if;
end;
$$;

set local role service_role;
insert into public.notice_legal_revisions
  (id, notice_id, revision, cutoff_on, cutoff_clause, source_url, source_sha256)
values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'2025-01-01','Fixture original','https://example.test/edital',repeat('a',64)),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',2,'2025-02-01','Fixture retificação','https://example.test/retificacao',repeat('b',64)),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',1,'2025-03-01','Fixture outro edital','https://example.test/edital-2',repeat('c',64));

insert into public.legal_provision_versions
  (id,provision_id,valid_from,valid_until,body,revoked,source_url,source_sha256,review_evidence)
values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2024-01-01','2025-02-01','Anterior',false,'https://example.test/original',repeat('a',64),'Fixture'),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2025-02-01','2025-03-01','Alteração',false,'https://example.test/alteracao-publicada-em-dezembro',repeat('b',64),'Fixture'),
  ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','2025-03-01',null,null,true,'https://example.test/revogacao',repeat('c',64),'Fixture');

do $$
begin
  begin
    insert into public.notice_legal_releases(revision_id)
    values ('30000000-0000-0000-0000-000000000001');
    raise exception 'accepted empty release';
  exception when check_violation then null;
  end;
  begin
    insert into public.notice_legal_scope values
      ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','B.1','40000000-0000-0000-0000-000000000002');
    raise exception 'accepted a version in vacatio at cutoff';
  exception when check_violation then null;
  end;
  begin
    insert into public.notice_legal_scope values
      ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','B.1','40000000-0000-0000-0000-000000000001');
    raise exception 'accepted expired version at exclusive end';
  exception when check_violation then null;
  end;
  begin
    insert into public.notice_legal_scope values
      ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','B.2','40000000-0000-0000-0000-000000000001');
    raise exception 'accepted version from a different provision';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.notice_legal_scope values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','B.1','40000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','B.2',null),
  ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','B.1','40000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','B.1','40000000-0000-0000-0000-000000000003');

insert into public.notice_legal_releases(revision_id) values
  ('30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003');

insert into public.notice_legal_scope values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','B.1','40000000-0000-0000-0000-000000000001')
on conflict do nothing;

do $$
begin
  begin
    insert into public.notice_legal_scope values
      ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','B.3',null);
    raise exception 'accepted amendment to sealed scope';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.notice_legal_revisions set cutoff_on = '2026-01-01'
      where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'service role could change sealed cutoff';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    delete from public.legal_provision_versions
      where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'service role could delete historical version';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.legal_provision_versions set body = 'Alteração indevida';
    raise exception 'service role could update historical text';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  begin
    delete from public.notice_legal_releases;
    raise exception 'owner could delete history';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  begin
    perform public.resolve_notice_legal_provision(null, null);
    raise exception 'anon could execute historical reader';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role authenticated;
select pg_temp.assert_equal((select count(*)::text from public.legal_provision_versions), '0');
select pg_temp.assert_equal(status, 'pending_notice')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');

set local test.premium = 'yes';
select pg_temp.assert_equal((select count(*)::text from public.legal_provision_versions), '2');
select pg_temp.assert_equal(body, 'Anterior')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
select pg_temp.assert_equal(status, 'pending_version')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
select pg_temp.assert_equal(status, 'outside_recorded_scope')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003');
select pg_temp.assert_equal(status, 'revoked'), pg_temp.assert_equal(body, null)
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
select pg_temp.assert_equal(status, 'pending_notice')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');

set local role service_role;
insert into public.notice_legal_releases(revision_id)
values ('30000000-0000-0000-0000-000000000002')
on conflict do nothing;
set local role authenticated;
select pg_temp.assert_equal(body, 'Alteração')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
select pg_temp.assert_equal(body, 'Anterior')
from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');

set local role service_role;
do $$
declare
  revision jsonb;
  versions jsonb;
  scope jsonb;
  new_revision jsonb;
  new_scope jsonb;
begin
  select to_jsonb(r) into revision from public.notice_legal_revisions r
    where id = '30000000-0000-0000-0000-000000000001';
  select jsonb_agg(v) into versions from public.legal_provision_versions v
    where id = '40000000-0000-0000-0000-000000000001';
  select jsonb_agg(s) into scope from public.notice_legal_scope s
    where revision_id = '30000000-0000-0000-0000-000000000001';

  new_revision := revision || '{"id":"30000000-0000-0000-0000-000000000004","revision":3}';
  new_scope := jsonb_build_array(
    scope->0 || '{"revision_id":"30000000-0000-0000-0000-000000000004","version_id":null}'
  );
  begin
    perform public.ingest_notice_legal_revision(new_revision, '[]', '[]');
    raise exception 'sealed an empty import';
  exception when check_violation then null;
  end;
  if exists (select from public.notice_legal_revisions where id = (new_revision->>'id')::uuid) then
    raise exception 'failed import left a revision behind';
  end if;
  perform pg_temp.assert_equal(
    public.ingest_notice_legal_revision(new_revision, '[]', new_scope)::text, new_revision->>'id'
  );

  perform public.ingest_notice_legal_revision(revision, versions, scope);
  perform public.ingest_notice_legal_revision(revision, versions, scope);
  -- Regression: exact retries must compare nullable columns using
  -- IS NOT DISTINCT FROM, including valid_until and body of a revocation.
  select to_jsonb(r) into revision from public.notice_legal_revisions r
    where id = '30000000-0000-0000-0000-000000000003';
  select jsonb_agg(v) into versions from public.legal_provision_versions v
    where id = '40000000-0000-0000-0000-000000000003';
  select jsonb_agg(s) into scope from public.notice_legal_scope s
    where revision_id = '30000000-0000-0000-0000-000000000003';
  if versions->0->>'valid_until' is not null
     or versions->0->>'body' is not null then
    raise exception 'nullable regression fixture is invalid';
  end if;
  perform public.ingest_notice_legal_revision(revision, versions, scope);
  perform public.ingest_notice_legal_revision(revision, versions, scope);
  -- Regression: a replay omitting the optional revoked flag must normalize
  -- to false, matching the persisted non-revoked version exactly.
  select to_jsonb(r) into revision from public.notice_legal_revisions r
    where id = '30000000-0000-0000-0000-000000000001';
  select jsonb_agg(to_jsonb(v) - 'revoked') into versions
    from public.legal_provision_versions v
    where id = '40000000-0000-0000-0000-000000000001';
  select jsonb_agg(s) into scope from public.notice_legal_scope s
    where revision_id = '30000000-0000-0000-0000-000000000001';
  if versions->0 ? 'revoked' then
    raise exception 'omitted revoked regression fixture is invalid';
  end if;
  perform public.ingest_notice_legal_revision(revision, versions, scope);
  perform public.ingest_notice_legal_revision(revision, versions, scope);
  -- Regression: a new legislative version without a stable UUID must be rejected.
  -- The existing revision is sealed, so use a distinct version payload and
  -- require invalid_parameter_value before any INSERT can occur.
  begin
    perform public.ingest_notice_legal_revision(
      revision,
      jsonb_build_array((versions->0) - 'id'),
      scope
    );
    raise exception 'accepted a legislative version without stable UUID';
  exception when invalid_parameter_value then null;
  end;
  -- Restore the original fixture for the divergent-payload assertions.
  select to_jsonb(r) into revision from public.notice_legal_revisions r
    where id = '30000000-0000-0000-0000-000000000001';
  select jsonb_agg(v) into versions from public.legal_provision_versions v
    where id = '40000000-0000-0000-0000-000000000001';
  select jsonb_agg(s) into scope from public.notice_legal_scope s
    where revision_id = '30000000-0000-0000-0000-000000000001';
  begin
    perform public.ingest_notice_legal_revision(revision, versions, '[]');
    raise exception 'accepted an incomplete retry';
  exception when check_violation then null;
  end;
  begin
    perform public.ingest_notice_legal_revision(
      revision, jsonb_set(versions, '{0,body}', '"Changed"'), scope
    );
    raise exception 'accepted divergent version';
  exception when unique_violation then null;
  end;
end;
$$;
set local role authenticated;
do $$
begin
  begin
    perform public.ingest_notice_legal_revision('{}', '[]', '[]');
    raise exception 'authenticated user could ingest a revision';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local test.premium = 'no';
set local test.admin = 'yes';
select pg_temp.assert_equal((select count(*)::text from public.legal_provision_versions), '3');
rollback;
