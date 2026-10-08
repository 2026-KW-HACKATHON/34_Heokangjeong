-- 약속서 = 매칭의 기준.
--   지원 → (사장님 '선정') 매칭 대기: 대화 + 약속서 작성
--        → 약속서 양쪽 확정 = 선정 확정 = 프로젝트 시작        (틀어지면 '선정 취소' → 다른 지원자 선정)
--   · 대화와 약속서는 선정된 뒤부터 (지원자는 지원 메시지만 보낸다)
--   · 개인 공고는 한 번에 한 명만 선정 중, 팀 공고는 역할마다 모집 인원만큼
--   · 결과물 제출은 제출하는 학생의 약속서가 확정됐을 때만
--   · 확정 뒤 변경은 상호 합의: 변경 제안 → 상대 수락(새 내용으로 다시 확정) / 거절·철회(기존 유지)
--   · 이 규칙 전에 만들어진 프로젝트에는 공고 내용으로 확정된 약속서를 만들어 둔다 (terms.legacy = true)

alter table public.applications
  add column if not exists shortlisted_at timestamptz,             -- 사장님이 선정한 시각 (매칭 대기 시작)
  add column if not exists shortlist_cancelled_at timestamptz;     -- 선정 취소된 시각 (다시 선정할 수 있다)

alter table public.chat_agreements
  add column if not exists proposed_terms jsonb,
  add column if not exists proposed_by uuid references public.profiles(id),
  add column if not exists proposed_at timestamptz,
  add column if not exists amended_at timestamptz;

-- ── 약속서 내용 검사 (저장·변경 제안이 같은 규칙, 0028 과 같은 기준) ─────────────────────
create or replace function public.check_agreement_terms(p_terms jsonb) returns void
language plpgsql immutable set search_path = public as $$
declare field text;
begin
  if p_terms is null or jsonb_typeof(p_terms) <> 'object' then raise exception '약속서 내용을 입력해 주세요'; end if;
  foreach field in array array['startDate','endDate','scope','deliverables','acceptance','coupon','handoff'] loop
    if jsonb_typeof(p_terms->field) is distinct from 'string' or length(trim(p_terms->>field)) = 0 or length(p_terms->>field) > 3000 then
      raise exception '필수 항목을 3000자 이내로 입력해 주세요';
    end if;
  end loop;
  if (p_terms->>'startDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_terms->>'endDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_terms->>'endDate')::date < (p_terms->>'startDate')::date then
    raise exception '작업 기간을 확인해 주세요';
  end if;
  if jsonb_typeof(p_terms->'revisions') is distinct from 'number' or (p_terms->>'revisions') !~ '^(0|[1-9]|10)$' then raise exception '수정 횟수는 0~10회로 정해 주세요'; end if;
  if jsonb_typeof(p_terms->'exclusions') is distinct from 'string' or length(p_terms->>'exclusions') > 3000 then raise exception '제외 범위를 3000자 이내로 입력해 주세요'; end if;
end $$;

-- 지원서의 당사자인가 (학생 또는 공고 작성자)
create or replace function public.application_party(p_application uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when a.student_id = auth.uid() then 'student' when p.author_id = auth.uid() then 'owner' end
  from applications a join posts p on p.id = a.post_id where a.id = p_application
$$;

-- ── 선정 확정 본체 (프로젝트를 만들고 지원서를 accepted 로). 0029 select_applicant 본문과 같고 권한 확인은 호출하는 쪽이 한다 ─────
create or replace function public.select_applicant_core(p_application uuid, p_question_snapshot jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare a applications; p posts; pr projects; r post_roles; v_domain text; v_mode text; v_found boolean;
begin
  select * into a from applications where id = p_application for update;
  if not found then raise exception 'NOT_FOUND: 지원서를 찾을 수 없어요'; end if;
  select * into p from posts where id = a.post_id for update;
  if a.status = 'rejected' then raise exception 'INVALID_STATE: 거절된 지원서예요'; end if;
  if p.is_team then
    select * into r from post_roles where id = a.role_id and post_id = p.id for update;
    if not found then raise exception 'INVALID_ROLE: 지원 역할을 찾을 수 없어요'; end if;
    if r.filled_count >= r.capacity then raise exception 'ROLE_FULL: 이 역할의 모집 인원이 이미 찼어요'; end if;
    v_domain := r.domain;
  else
    v_domain := coalesce(p.domain, 'GENERAL');
  end if;
  if p_question_snapshot is null or jsonb_typeof(p_question_snapshot -> 'questions') is distinct from 'array'
     or p_question_snapshot ->> 'domain' is distinct from v_domain then
    raise exception 'INVALID_INPUT: 질문 목록과 지원 역할의 분야가 맞지 않아요';
  end if;
  select * into pr from projects where post_id = p.id for update;
  v_found := found;
  if v_found and exists (select 1 from project_members where project_id = pr.id and student_id = a.student_id) then return pr.id; end if;
  v_mode := case when p.is_team then 'TEAM' else 'INDIVIDUAL' end;
  if not v_found then
    insert into projects (post_id, owner_id, domain, mode, status, question_snapshot)
      values (p.id, p.author_id, coalesce(p.domain, v_domain), v_mode, 'RECRUITING', p_question_snapshot) returning * into pr;
  end if;
  update projects set status = project_next_status(pr.status, 'SELECT', pr.mode) where id = pr.id returning * into pr;
  insert into project_members (project_id, student_id, role_label, role_id, domain, question_snapshot, application_id)
    values (pr.id, a.student_id, coalesce(r.label, domain_label(v_domain)), r.id, v_domain, p_question_snapshot, a.id);
  if p.is_team then
    update post_roles set filled_count = filled_count + 1 where id = r.id;
  else
    update posts set status = 'in_progress' where id = p.id;
  end if;
  update applications set status = 'accepted' where id = a.id;
  if not p.is_team then
    update applications set status = 'rejected' where post_id = p.id and id <> a.id and status = 'pending';
  end if;
  return pr.id;
end $$;
revoke all on function public.select_applicant_core(uuid, jsonb) from public, anon, authenticated;

-- ── 사장님 '선정' = 매칭 대기 시작 (대화·약속서가 열린다). 개인 공고는 한 명씩, 팀은 역할 인원만큼 ─────
create or replace function public.shortlist_applicant(p_application uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a applications; p posts; r post_roles; v_taken int;
begin
  select * into a from applications where id = p_application for update;
  if not found then raise exception 'NOT_FOUND: 지원서를 찾을 수 없어요'; end if;
  select * into p from posts where id = a.post_id for update;
  if p.author_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 공고 작성자만 선정할 수 있어요'; end if;
  if a.status <> 'pending' then raise exception 'INVALID_STATE: 이미 끝난 지원서예요'; end if;
  if a.shortlisted_at is not null then return; end if;
  if p.is_team then
    select * into r from post_roles where id = a.role_id and post_id = p.id;
    select count(*) into v_taken from applications x where x.post_id = p.id and x.role_id = a.role_id and x.status = 'pending' and x.shortlisted_at is not null;
    if r.filled_count + v_taken >= r.capacity then raise exception 'ROLE_FULL: 이 역할은 이미 선정 중이거나 모집 인원이 찼어요. 선정을 취소한 뒤 다시 선정해 주세요'; end if;
  elsif exists (select 1 from applications x where x.post_id = p.id and x.id <> a.id and x.status = 'pending' and x.shortlisted_at is not null) then
    raise exception 'ALREADY_SHORTLISTED: 선정 중인 지원자가 있어요. 선정을 취소한 뒤 다시 선정해 주세요';
  end if;
  update applications set shortlisted_at = now(), shortlist_cancelled_at = null where id = a.id;
end $$;

-- ── 선정 취소 (확정 전에만, 사장님·학생 모두). 쓰던 약속서 초안은 지운다 → 다시 선정하면 새로 쓴다 ─────
create or replace function public.cancel_shortlist(p_application uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a applications;
begin
  select * into a from applications where id = p_application for update;
  if not found or application_party(p_application) is null then raise exception 'FORBIDDEN: 당사자만 선정을 취소할 수 있어요'; end if;
  if a.status <> 'pending' or a.shortlisted_at is null then raise exception 'INVALID_STATE: 선정 중인 지원서가 아니에요 (확정 뒤에는 합의 취소를 써 주세요)'; end if;
  delete from chat_agreements where application_id = p_application and finalized_at is null;
  update applications set shortlisted_at = null, shortlist_cancelled_at = now() where id = a.id;
end $$;

-- 예전 직접 선정 경로: 확정된 약속서가 있을 때만 (보통은 약속서 확정이 곧 선정이라 쓸 일이 없다)
create or replace function public.select_applicant(p_application uuid, p_question_snapshot jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select p.author_id into v_author from applications a join posts p on p.id = a.post_id where a.id = p_application;
  if v_author is null then raise exception 'NOT_FOUND: 지원서를 찾을 수 없어요'; end if;
  if v_author is distinct from auth.uid() then raise exception 'FORBIDDEN: 공고 작성자만 선정할 수 있어요'; end if;
  if not exists (select 1 from chat_agreements where application_id = p_application and finalized_at is not null) then
    raise exception 'AGREEMENT_REQUIRED: 약속서를 양쪽이 확인해 확정하면 선정돼요';
  end if;
  return select_applicant_core(p_application, p_question_snapshot);
end $$;

-- ── 대화: 선정된 뒤부터 (지원자는 지원 메시지만) ─────────────────────────────
create or replace function public.require_shortlist_for_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from applications where id = new.application_id and (status = 'accepted' or (status = 'pending' and shortlisted_at is not null))) then
    raise exception 'NOT_SHORTLISTED: 사장님이 선정하면 대화할 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists messages_require_shortlist on public.messages;
create trigger messages_require_shortlist before insert on public.messages for each row execute function public.require_shortlist_for_chat();

-- ── 약속서 저장: 선정된 지원서만 (0028 save_chat_agreement 에 조건 추가) ─────
create or replace function public.save_chat_agreement(p_application uuid, p_version integer, p_terms jsonb)
returns public.chat_agreements language plpgsql security definer set search_path = public as $$
declare a applications; previous chat_agreements; result chat_agreements;
begin
  select * into a from applications where id = p_application for update;
  if auth.uid() is null or a.id is null or application_party(p_application) is null then raise exception '당사자만 작성할 수 있어요'; end if;
  select * into previous from chat_agreements where application_id = p_application;
  if previous.finalized_at is not null then raise exception '이미 확정된 최종본이에요 (바꾸려면 변경 제안을 보내 주세요)'; end if;
  if a.status <> 'pending' or a.shortlisted_at is null then raise exception '사장님이 선정한 뒤에 약속서를 쓸 수 있어요'; end if;
  if p_version is null or coalesce(previous.version, 0) <> p_version then raise exception '상대방이 수정했어요. 최신 약속서를 다시 열어 주세요'; end if;
  perform check_agreement_terms(p_terms);
  insert into chat_agreements(application_id, version, terms) values (p_application, p_version + 1, p_terms)
    on conflict (application_id) do update set version = p_version + 1, terms = p_terms, student_confirmed_at = null, owner_confirmed_at = null, finalized_at = null, updated_at = now()
    returning * into result;
  return result;
end $$;

-- ── 약속서 확인: 양쪽이 확인하면 확정 = 선정 확정 = 프로젝트 시작 (질문 목록은 확정하는 쪽 앱이 보낸다) ─────
drop function if exists public.confirm_chat_agreement(uuid, integer);
create or replace function public.confirm_chat_agreement(p_application uuid, p_version integer, p_question_snapshot jsonb default null)
returns public.chat_agreements language plpgsql security definer set search_path = public as $$
declare a applications; side text; result chat_agreements;
begin
  select * into a from applications where id = p_application for update;
  side := application_party(p_application);
  if auth.uid() is null or a.id is null or side is null then raise exception '당사자만 확인할 수 있어요'; end if;
  select * into result from chat_agreements where application_id = p_application;
  if result.application_id is null or p_version is null or result.version <> p_version then raise exception '최신 약속서를 다시 열어 주세요'; end if;
  if result.finalized_at is not null then return result; end if;
  if a.status <> 'pending' or a.shortlisted_at is null then raise exception '선정이 취소됐거나 마감된 지원이에요'; end if;
  if side = 'student' then result.student_confirmed_at := now(); else result.owner_confirmed_at := now(); end if;
  if result.student_confirmed_at is not null and result.owner_confirmed_at is not null then
    if p_question_snapshot is null then raise exception '앱을 새로고침한 뒤 다시 확인해 주세요 (질문 목록이 없어요)'; end if;
    result.finalized_at := now();
    perform select_applicant_core(p_application, p_question_snapshot);   -- 확정 = 선정 확정
  end if;
  update chat_agreements set student_confirmed_at = result.student_confirmed_at, owner_confirmed_at = result.owner_confirmed_at,
    finalized_at = result.finalized_at, updated_at = now() where application_id = p_application returning * into result;
  return result;
end $$;

-- ── 확정 뒤 변경: 제안 → 상대 수락 / 거절·철회 ─────────────────────────────
create or replace function public.propose_agreement_change(p_application uuid, p_terms jsonb)
returns public.chat_agreements language plpgsql security definer set search_path = public as $$
declare result chat_agreements;
begin
  perform 1 from applications where id = p_application for update;
  if auth.uid() is null or application_party(p_application) is null then raise exception '당사자만 변경을 제안할 수 있어요'; end if;
  select * into result from chat_agreements where application_id = p_application;
  if result.finalized_at is null then raise exception '확정 전에는 약속서를 바로 고치면 돼요'; end if;
  if result.proposed_by is not null and result.proposed_by <> auth.uid() then raise exception '상대방의 변경 제안에 먼저 답해 주세요'; end if;
  perform check_agreement_terms(p_terms);
  update chat_agreements set proposed_terms = p_terms, proposed_by = auth.uid(), proposed_at = now(), updated_at = now()
    where application_id = p_application returning * into result;
  return result;
end $$;

create or replace function public.respond_agreement_change(p_application uuid, p_accept boolean)
returns public.chat_agreements language plpgsql security definer set search_path = public as $$
declare result chat_agreements;
begin
  perform 1 from applications where id = p_application for update;
  if auth.uid() is null or application_party(p_application) is null then raise exception '당사자만 답할 수 있어요'; end if;
  select * into result from chat_agreements where application_id = p_application;
  if result.proposed_by is null then raise exception '답할 변경 제안이 없어요'; end if;
  if result.proposed_by = auth.uid() and p_accept then raise exception '내 제안은 상대방이 수락해야 해요'; end if;
  if p_accept then
    update chat_agreements set terms = proposed_terms, version = version + 1, amended_at = now(),
      proposed_terms = null, proposed_by = null, proposed_at = null, updated_at = now()
      where application_id = p_application returning * into result;
  else
    update chat_agreements set proposed_terms = null, proposed_by = null, proposed_at = null, updated_at = now()
      where application_id = p_application returning * into result;
  end if;
  return result;
end $$;

-- ── 결과물 제출: 제출하는 학생의 약속서가 확정됐을 때만 ─────────────────────────────
create or replace function public.require_finalized_agreement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from project_members m join chat_agreements c on c.application_id = m.application_id
    where m.project_id = new.project_id and m.student_id = new.submitted_by and c.finalized_at is not null
  ) then
    raise exception 'AGREEMENT_REQUIRED: 약속서를 양쪽이 확정한 뒤에 제출할 수 있어요';
  end if;
  return new;
end $$;
drop trigger if exists submission_requires_agreement on public.submission_versions;
create trigger submission_requires_agreement before insert on public.submission_versions for each row execute function public.require_finalized_agreement();

-- ── 이 규칙 전에 만들어진 프로젝트: 공고 내용으로 확정된 약속서를 만들어 둔다 (legacy 표시) ─────
update applications a set shortlisted_at = coalesce(a.shortlisted_at, a.created_at)
where a.status = 'accepted' and a.shortlisted_at is null;

insert into chat_agreements (application_id, version, terms, student_confirmed_at, owner_confirmed_at, finalized_at, updated_at)
select m.application_id, 1,
  jsonb_build_object(
    'startDate', to_char(coalesce(pr.started_at, pr.created_at), 'YYYY-MM-DD'),
    'endDate', to_char(greatest(coalesce(pr.completed_at, pr.started_at, pr.created_at), coalesce(pr.started_at, pr.created_at) + interval '14 days'), 'YYYY-MM-DD'),
    'scope', left(po.title, 3000),
    'deliverables', coalesce(nullif(array_to_string(po.expected_deliverables, ', '), ''), '공고에 적힌 결과물'),
    'acceptance', coalesce(nullif(trim(po.completion_criteria), ''), '공고에 적힌 완료 기준'),
    'coupon', coalesce(nullif(trim(po.reward), ''), '공고에 적힌 보상'),
    'revisions', coalesce(po.revision_limit, 2),
    'handoff', '결과물 파일 전달',
    'exclusions', '',
    'legacy', true),
  coalesce(pr.started_at, pr.created_at), coalesce(pr.started_at, pr.created_at), coalesce(pr.started_at, pr.created_at), now()
from project_members m
join projects pr on pr.id = m.project_id
join posts po on po.id = pr.post_id
where m.application_id is not null
  and not exists (select 1 from chat_agreements c where c.application_id = m.application_id)
on conflict (application_id) do nothing;

revoke all on function public.shortlist_applicant(uuid) from public, anon;
revoke all on function public.cancel_shortlist(uuid) from public, anon;
revoke all on function public.confirm_chat_agreement(uuid, integer, jsonb) from public, anon;
revoke all on function public.propose_agreement_change(uuid, jsonb) from public, anon;
revoke all on function public.respond_agreement_change(uuid, boolean) from public, anon;
revoke all on function public.select_applicant(uuid, jsonb) from public, anon;
revoke all on function public.save_chat_agreement(uuid, integer, jsonb) from public, anon;
grant execute on function public.shortlist_applicant(uuid) to authenticated;
grant execute on function public.cancel_shortlist(uuid) to authenticated;
grant execute on function public.confirm_chat_agreement(uuid, integer, jsonb) to authenticated;
grant execute on function public.propose_agreement_change(uuid, jsonb) to authenticated;
grant execute on function public.respond_agreement_change(uuid, boolean) to authenticated;
grant execute on function public.select_applicant(uuid, jsonb) to authenticated;
grant execute on function public.save_chat_agreement(uuid, integer, jsonb) to authenticated;
