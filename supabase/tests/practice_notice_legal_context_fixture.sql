-- Apply after question_notice_legal_context_fixture.sql, before the migrations.
-- Minimal stand-ins for live tables used by free practice and past exams.
create table public.contests (id uuid primary key, code text unique);
create table public.free_practice_sessions (
 id uuid primary key, user_id uuid not null, contest_id uuid not null, question_ids uuid[] not null,
 status text not null default 'open', created_at timestamptz not null default now()
);
create table public.historical_exam_practice (
 id uuid primary key, contest_code text, exam_year integer, practice_visibility text, answer text
);
alter table public.historical_exam_practice enable row level security;
create policy historical_premium on public.historical_exam_practice for select to authenticated
 using (public.my_premium_access());
grant select on public.contests, public.historical_exam_practice to authenticated;
insert into public.contests values ('50000000-0000-0000-0000-000000000001','PMMG_CFO'),
 ('50000000-0000-0000-0000-000000000002','PMMG_SOLDADO');
