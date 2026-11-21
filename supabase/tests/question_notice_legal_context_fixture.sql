-- Apply after notice_legal_snapshots_fixture.sql, before either migration.
create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated;
alter table public.notices add column contest_id uuid, add column year integer, add column active boolean, add column title text;
update public.notices set contest_id='50000000-0000-0000-0000-000000000001',
 year=case when id='10000000-0000-0000-0000-000000000001' then 2025 else 2027 end,
 active=id='10000000-0000-0000-0000-000000000002',
 title=case when id='10000000-0000-0000-0000-000000000001' then 'CFO 2025 (sintético)' else 'CFO 2027 (sintético)' end;
alter table public.notices enable row level security;
create policy active_notices on public.notices for select to authenticated using(active);
create table public.exams (id uuid primary key, contest_id uuid, year integer);
create table public.questions (id uuid primary key, exam_id uuid, contest_id uuid, status text, origin text);
create table public.mock_exam_attempts (
 id uuid primary key, user_id uuid, contest_id uuid, question_ids uuid[],
 submitted_at timestamptz, created_at timestamptz
);
create table public.legal_documents (id uuid primary key, code text, title text);
alter table public.legal_provisions add column document_id uuid, add column provision_key text;
create table public.question_legal_references (
 id bigint generated always as identity primary key, question_id uuid,
 document_id uuid, provision_id uuid, provision_label text, verification_status text
);
grant select on public.notices,public.exams,public.questions,public.mock_exam_attempts,
 public.legal_documents,public.question_legal_references to authenticated;
insert into public.exams values ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',2025);
insert into public.questions values
 ('80000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','validated','official'),
 ('80000000-0000-0000-0000-000000000002',null,'50000000-0000-0000-0000-000000000001','validated','original'),
 ('80000000-0000-0000-0000-000000000003',null,'50000000-0000-0000-0000-000000000001','validated','original');
insert into public.legal_documents values ('a0000000-0000-0000-0000-000000000001','CF88','Constituição');
update public.legal_provisions set document_id='a0000000-0000-0000-0000-000000000001', provision_key='art-00001'
 where id='20000000-0000-0000-0000-000000000001';
insert into public.question_legal_references (question_id,document_id,provision_id,provision_label,verification_status)
 select q.id,'a0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Art. 1','verificado'
 from public.questions q where q.id<>'80000000-0000-0000-0000-000000000003';
insert into public.mock_exam_attempts values
 ('90000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
 array['80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002']::uuid[],'2026-06-02','2026-06-01'),
 ('90000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001',
 array['80000000-0000-0000-0000-000000000001']::uuid[],'2026-06-02','2026-06-01');
