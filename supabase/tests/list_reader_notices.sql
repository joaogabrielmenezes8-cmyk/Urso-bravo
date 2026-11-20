begin;
-- Runs after both fixtures, the three pending migrations and the question-context seed.
insert into public.notice_legal_revisions (id,notice_id,revision,cutoff_on,cutoff_clause,source_url,source_sha256) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'2024-05-09','Fixture','https://example.test/edition1',repeat('a',64));
insert into public.legal_provision_versions (id,provision_id,valid_from,valid_until,body,source_url,source_sha256,review_evidence) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2024-01-01',null,'Texto anterior','https://example.test/old',repeat('a',64),'Fixture');
insert into public.notice_legal_scope values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','A','40000000-0000-0000-0000-000000000001');
insert into public.notice_legal_releases values ('30000000-0000-0000-0000-000000000001','2026-01-01');
set local role authenticated;
do $$
declare n int; ids text;
begin
  perform set_config('test.uid','',true);
  select count(*) into n from public.list_reader_notices();
  if n <> 0 then raise exception 'anonymous session listed notices'; end if;

  perform set_config('test.uid','70000000-0000-0000-0000-000000000001',true);
  perform set_config('test.premium','no',true);
  select string_agg(title, '|' order by year desc) into ids from public.list_reader_notices();
  if ids is distinct from 'CFO 2027 (sintético)' then raise exception 'free account saw historical notices: %', ids; end if;

  perform set_config('test.premium','yes',true);
  select string_agg(title, '|' order by year desc) into ids from public.list_reader_notices();
  if ids is distinct from 'CFO 2027 (sintético)|CFO 2025 (sintético)' then raise exception 'premium list wrong: %', ids; end if;

  select count(*) into n from public.notices;
  if n <> 1 then raise exception 'notices RLS widened: % rows', n; end if;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.list_reader_notices()','execute') then raise exception 'anon can execute'; end if;
end $$;
rollback;
