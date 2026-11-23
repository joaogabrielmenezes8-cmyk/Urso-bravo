begin;
-- Exercised after the snapshots migration and question context fixture.
insert into public.notice_legal_revisions (id,notice_id,revision,cutoff_on,cutoff_clause,source_url,source_sha256) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'2024-05-09','Fixture','https://example.test/edition1',repeat('a',64)),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1,'2026-09-03','Fixture','https://example.test/edition2',repeat('b',64));
insert into public.legal_provision_versions (id,provision_id,valid_from,valid_until,body,source_url,source_sha256,review_evidence) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2024-01-01','2026-01-01','Texto anterior','https://example.test/old',repeat('a',64),'Fixture'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2026-01-01',null,'Texto posterior','https://example.test/new',repeat('b',64),'Fixture');
insert into public.notice_legal_scope values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','A','40000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','A','40000000-0000-0000-0000-000000000002');
insert into public.notice_legal_releases values
 ('30000000-0000-0000-0000-000000000001','2026-01-01'),
 ('30000000-0000-0000-0000-000000000002','2026-10-01');

insert into public.mock_exam_attempts
  (id,user_id,contest_id,question_ids,submitted_at,created_at,notice_legal_revision_id)
values ('90000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',array['80000000-0000-0000-0000-000000000002']::uuid[],
  '2026-11-02','2026-11-01','30000000-0000-0000-0000-000000000001');
do $$
begin
  begin
    update public.mock_exam_attempts
      set notice_legal_revision_id='30000000-0000-0000-0000-000000000001'
      where id='90000000-0000-0000-0000-000000000003';
    raise exception 'a mock attempt revision was rewritten';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.mock_exam_attempts set contest_id='50000000-0000-0000-0000-000000000002'
      where id='90000000-0000-0000-0000-000000000003';
    raise exception 'a mock attempt contest was rewritten';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.mock_exam_attempts set created_at='2026-12-01'
      where id='90000000-0000-0000-0000-000000000003';
    raise exception 'a mock attempt temporal anchor was rewritten';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;
set local role authenticated;
set local test.premium = 'yes';
set local test.uid = '70000000-0000-0000-0000-000000000001';
do $$
declare
  official uuid := '80000000-0000-0000-0000-000000000001';
  original uuid := '80000000-0000-0000-0000-000000000002';
  mock uuid := '90000000-0000-0000-0000-000000000001';
  other_mock uuid := '90000000-0000-0000-0000-000000000002';
  result jsonb;
begin
  result := public.resolve_question_notice_legal_context(official);
  if result#>>'{references,0,body}' is distinct from 'Texto anterior' then
    raise exception 'official question changed edition: %',result;
  end if;
  result := public.resolve_question_notice_legal_context(original);
  if result#>>'{references,0,body}' is distinct from 'Texto posterior' then
    raise exception 'original question has wrong edition: %',result;
  end if;
  result := public.resolve_question_notice_legal_context(official,mock);
  if result#>>'{references,0,body}' is distinct from 'Texto anterior' then
    raise exception 'mock replaced an official edition: %',result;
  end if;
  result := public.resolve_question_notice_legal_context(original,mock);
  if result->>'status' is distinct from 'pending_notice' then
    raise exception 'mock loaded a revision released after its creation: %',result;
  end if;
  result := public.resolve_question_notice_legal_context(original,'90000000-0000-0000-0000-000000000003');
  if result#>>'{references,0,body}' is distinct from 'Texto posterior' then
    raise exception 'mock did not preserve its assigned contest revision: %',result;
  end if;
  result := public.resolve_question_notice_legal_context(official,null,'30000000-0000-0000-0000-000000000002');
  if result->>'status' is distinct from 'pending_notice' then
    raise exception 'a caller-supplied revision changed the official edition: %',result;
  end if;
  result := public.resolve_question_notice_legal_context(official,other_mock);
  if result->>'status' is distinct from 'pending_attempt' then
    raise exception 'a foreign attempt was resolved: %',result;
  end if;
  result := public.resolve_question_notice_legal_context('80000000-0000-0000-0000-000000000003');
  if result->>'status' is distinct from 'pending_references' then
    raise exception 'missing references were treated as certified: %',result;
  end if;
  perform set_config('test.premium','no',true);
  result := public.resolve_question_notice_legal_context(official);
  if result#>>'{references,0,body}' is not null then
    raise exception 'RLS allowed historical text to a free account: %',result;
  end if;
end;
$$;
rollback;
