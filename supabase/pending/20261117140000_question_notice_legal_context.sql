begin;

-- Older notices may be hidden by the active-only notices policy. Only expose
-- the ID of a unique, released historical edition to a legal-text reader.
create function public.released_historical_notice(p_contest uuid, p_exam_year integer)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select (array_agg(n.id))[1]
  from public.notices n
  where n.contest_id = p_contest and n.year = p_exam_year
    and (public.my_premium_access() or (select private.is_admin()))
    and exists (
      select from public.notice_legal_revisions r
      join public.notice_legal_releases l on l.revision_id = r.id
      where r.notice_id = n.id
    )
  having count(*) = 1;
$$;

revoke all on function public.released_historical_notice(uuid, integer) from public, anon;
grant execute on function public.released_historical_notice(uuid, integer) to authenticated;

-- New mock attempts remember the selected edition even if the active notice
-- changes later. Legacy attempts without a reliable binding remain pending.
alter table public.mock_exam_attempts add column notice_legal_revision_id uuid
  references public.notice_legal_releases(revision_id);

create function private.bind_mock_notice_legal_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  notice uuid;
begin
  if tg_op = 'UPDATE' then
    if new.notice_legal_revision_id is distinct from old.notice_legal_revision_id
       or new.contest_id is distinct from old.contest_id
       or new.created_at is distinct from old.created_at then
      raise exception 'A revisão legislativa da tentativa é imutável' using errcode = '55000';
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

revoke all on function private.bind_mock_notice_legal_revision() from public, anon, authenticated;
create trigger bind_mock_notice_legal_revision
before insert or update of notice_legal_revision_id, contest_id, created_at on public.mock_exam_attempts
for each row execute function private.bind_mock_notice_legal_revision();

-- Use the caller's question, attempt, notice and legal-text policies.
create function public.resolve_question_notice_legal_context(
  p_question_id uuid, p_attempt_id uuid default null, p_revision_id uuid default null
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  question_origin text;
  contest uuid;
  exam_year integer;
  edition uuid;
  cutoff date;
  revision uuid;
  attempt_created timestamptz;
  refs jsonb;
  reference_count integer;
  pending_count integer;
  attempt_revision uuid;
begin
  select q.origin::text, coalesce(e.contest_id, q.contest_id), e.year
    into question_origin, contest, exam_year
  from public.questions q left join public.exams e on e.id = q.exam_id
  where q.id = p_question_id and q.status::text = 'validated';
  if not found then
    return jsonb_build_object('status', 'pending_question');
  end if;

  if p_attempt_id is not null then
    select a.notice_legal_revision_id, a.created_at into attempt_revision, attempt_created
    from public.mock_exam_attempts a
    where a.id = p_attempt_id and a.user_id = auth.uid()
      and a.submitted_at is not null and p_question_id = any(a.question_ids);
    if not found then
      return jsonb_build_object('status', 'pending_attempt');
    end if;
  end if;

  -- Official questions keep their exam edition even when reused for practice.
  -- An ambiguous or absent edition deliberately stays pending.
  if question_origin = 'official' then
    edition := public.released_historical_notice(contest, exam_year);
  elsif question_origin = 'original' and p_attempt_id is not null then
    select r.notice_id into edition from public.notice_legal_revisions r where r.id = attempt_revision;
  elsif question_origin = 'original' then
    select (array_agg(n.id))[1] into edition
    from public.notices n
    where n.contest_id = contest and n.active
    having count(*) = 1;
  end if;
  if edition is null then
    return jsonb_build_object('status', 'pending_notice');
  end if;

  select r.id, r.cutoff_on into revision, cutoff
  from public.notice_legal_revisions r
  join public.notice_legal_releases l on l.revision_id = r.id
  where r.notice_id = edition and (p_revision_id is null or r.id = p_revision_id)
    and (attempt_created is null or l.released_at <= attempt_created)
    and (question_origin <> 'original' or p_attempt_id is null or r.id = attempt_revision)
  order by r.revision desc limit 1;
  if revision is null then
    return jsonb_build_object('status', 'pending_notice', 'notice_id', edition);
  end if;

  select count(*), count(*) filter (
    where v.status is distinct from 'available' or ref.verification_status is distinct from 'verificado'
  ), coalesce(jsonb_agg(
    jsonb_build_object('label', ref.provision_label, 'title', d.title,
      'law_code', d.code, 'article_key', p.provision_key, 'version_id', v.version_id, 'body', v.body, 'source_url', v.source_url)
    order by ref.id
  ) filter (where v.status = 'available' and ref.verification_status = 'verificado'), '[]'::jsonb)
    into reference_count, pending_count, refs
  from public.question_legal_references ref
  left join public.legal_documents d on d.id = ref.document_id
  left join public.legal_provisions p on p.id = ref.provision_id and p.document_id = ref.document_id
  left join lateral public.resolve_notice_legal_provision(edition, p.id, revision) v on p.id is not null
  where ref.question_id = p_question_id;

  return jsonb_build_object(
    'status', case when reference_count > 0 and pending_count = 0 then 'available' else 'pending_references' end,
    'notice_id', edition, 'revision_id', revision, 'cutoff_on', cutoff, 'references', refs
  );
end;
$$;

revoke all on function public.resolve_question_notice_legal_context(uuid, uuid, uuid) from public, anon;
grant execute on function public.resolve_question_notice_legal_context(uuid, uuid, uuid) to authenticated;
commit;
