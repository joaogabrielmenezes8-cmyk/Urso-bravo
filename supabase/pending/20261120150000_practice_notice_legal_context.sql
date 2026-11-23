begin;
-- Temporal legal context for free practice and legacy past-exam practice.
-- Apply after 20261109150000_free_daily_practice.sql and
-- 20261117140000_question_notice_legal_context.sql. Additive and idempotent.

-- 1) Free sessions remember the active edition revision released at creation,
--    like mock attempts. Sessions without a reliable binding stay pending.
alter table public.free_practice_sessions add column if not exists notice_legal_revision_id uuid
  references public.notice_legal_releases(revision_id);

create or replace function private.bind_free_practice_notice_legal_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  notice uuid;
begin
  if tg_op = 'UPDATE' then
    if new.notice_legal_revision_id is distinct from old.notice_legal_revision_id
       or new.contest_id is distinct from old.contest_id
       or new.created_at is distinct from old.created_at then
      raise exception 'A revisão legislativa do treino é imutável' using errcode = '55000';
    end if;
    return new;
  end if;
  select (array_agg(n.id))[1] into notice
    from public.notices n where n.contest_id = new.contest_id and n.active
    having count(*) = 1;
  select r.id into new.notice_legal_revision_id
    from public.notice_legal_revisions r
    join public.notice_legal_releases l on l.revision_id = r.id
    where r.notice_id = notice and l.released_at <= new.created_at
    order by r.revision desc limit 1;
  return new;
end;
$$;
revoke all on function private.bind_free_practice_notice_legal_revision() from public, anon, authenticated;
drop trigger if exists bind_free_practice_notice_legal_revision on public.free_practice_sessions;
create trigger bind_free_practice_notice_legal_revision
  before insert or update of notice_legal_revision_id, contest_id, created_at on public.free_practice_sessions
  for each row execute function private.bind_free_practice_notice_legal_revision();

-- 2) Resolves only a question of the caller's own submitted session, and only
--    for premium/admin callers (legal texts are premium, like the reader), with the
--    session's pinned revision for original questions and the exam edition for
--    official ones (still premium-gated by released_historical_notice).
--    It never falls back to the current wording.
create or replace function public.resolve_free_practice_notice_legal_context(p_session uuid, p_question_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  pinned uuid;
  origin text;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  select s.notice_legal_revision_id into pinned
    from public.free_practice_sessions s
    where s.id = p_session and s.user_id = auth.uid() and s.status = 'submitted'
      and p_question_id = any(s.question_ids);
  if not found then
    return jsonb_build_object('status', 'pending_attempt');
  end if;
  -- Same gate as the legal-text reader: this definer function must not lend the
  -- owner's privileges to a free account. Answers/comments stay in submit_free_practice.
  if not coalesce(public.my_premium_access() or (select private.is_admin()), false) then
    return jsonb_build_object('status', 'pending_access');
  end if;
  select q.origin::text into origin from public.questions q where q.id = p_question_id;
  if origin = 'official' then
    return public.resolve_question_notice_legal_context(p_question_id, null, null);
  end if;
  if pinned is null then
    return jsonb_build_object('status', 'pending_notice');
  end if;
  return public.resolve_question_notice_legal_context(p_question_id, null, pinned);
end;
$$;
revoke all on function public.resolve_free_practice_notice_legal_context(uuid, uuid) from public, anon;
grant execute on function public.resolve_free_practice_notice_legal_context(uuid, uuid) to authenticated;

-- 3) Legacy past-exam rows: edition of the exam year, caller's policies.
--    Rows have no certified provision links yet, so references stay pending.
create or replace function public.resolve_historical_exam_notice_legal_context(p_historical_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  exam_code text;
  exam_year integer;
  contest uuid;
  edition uuid;
  revision uuid;
  cutoff date;
begin
  select h.contest_code, h.exam_year into exam_code, exam_year
    from public.historical_exam_practice h
    where h.id = p_historical_id and h.practice_visibility = 'available';
  if not found then
    return jsonb_build_object('status', 'pending_question');
  end if;
  select (array_agg(c.id))[1] into contest from public.contests c
    where c.code = case exam_code when 'CFO' then 'PMMG_CFO' when 'CFSD' then 'PMMG_SOLDADO' end
    having count(*) = 1;
  edition := public.released_historical_notice(contest, exam_year);
  if edition is null then
    return jsonb_build_object('status', 'pending_notice');
  end if;
  select r.id, r.cutoff_on into revision, cutoff
    from public.notice_legal_revisions r
    join public.notice_legal_releases l on l.revision_id = r.id
    where r.notice_id = edition order by r.revision desc limit 1;
  return jsonb_build_object('status', 'pending_references', 'notice_id', edition,
    'revision_id', revision, 'cutoff_on', cutoff, 'references', '[]'::jsonb);
end;
$$;
revoke all on function public.resolve_historical_exam_notice_legal_context(uuid) from public, anon;
grant execute on function public.resolve_historical_exam_notice_legal_context(uuid) to authenticated;
commit;
