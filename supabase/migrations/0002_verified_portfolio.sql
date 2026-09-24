-- 검증형 포트폴리오 파이프라인: 지원 → 선정 → 프로젝트 → 활동 기록 → 증빙 → 제출(버전) → 검증·평가 → 포트폴리오 → Notion
-- 0001_init.sql 다음에 실행한다 (SQL Editor 에 붙여 넣기 또는 `npx supabase db push`).
-- 규칙(상태 전이·권한·중복 방지)은 security definer 함수가 서버에서 강제한다. 앱의 src/lib/workflow/engine.ts(mock) 와 같은 규칙이다.
-- 에러 메시지는 'CODE: 한국어 설명' 형식이다. 앱은 ': ' 뒤를 사용자에게 보여 준다.

-- ── 공고: 구조화된 정보 ──────────────────────────────────────────────────────
alter table public.posts
  add column problem text not null default '',
  add column domain text check (domain in ('DESIGN', 'MARKETING', 'DEVELOPMENT', 'GENERAL')),
  add column expected_deliverables text[] not null default '{}',
  add column completion_criteria text not null default '',
  add column deadline date,
  add column revision_limit int not null default 2 check (revision_limit between 0 and 10),
  add column compensation_type text not null default 'VOLUNTEER' check (compensation_type in ('VOLUNTEER', 'NON_MONETARY', 'PAID')),
  add column compensation_description text not null default '',
  add column paid_amount int check (paid_amount is null or paid_amount >= 0);

-- ── 프로젝트 ────────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  domain text not null check (domain in ('DESIGN', 'MARKETING', 'DEVELOPMENT', 'GENERAL')),
  mode text not null check (mode in ('INDIVIDUAL', 'TEAM')),
  status text not null check (status in ('RECRUITING', 'IN_PROGRESS', 'REVIEW_PENDING', 'REVISION_REQUESTED', 'COMPLETED')),
  question_snapshot jsonb not null,                   -- ProjectQuestionSnapshot: 선정 시점의 질문 목록
  approved_version_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  role_label text not null default '',
  application_id uuid references public.applications on delete set null,
  joined_at timestamptz not null default now(),
  primary key (project_id, student_id)
);

create table public.project_answers (
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  question_id text not null check (length(question_id) between 1 and 80),
  field text not null,
  stage text not null check (stage in ('START', 'PROGRESS', 'FINISH')),
  status text not null check (status in ('UNANSWERED', 'SKIPPED', 'NOT_APPLICABLE', 'ANSWERED')),
  value text not null default '' check (length(value) <= 4000),
  choices text[] not null default '{}',
  origin text not null default 'SCHEMA' check (origin in ('SCHEMA', 'AI_FOLLOWUP', 'RULE_FOLLOWUP')),
  parent_question_id text,
  prompt text,
  updated_at timestamptz not null default now(),
  primary key (project_id, author_id, question_id),
  -- 건너뜀·해당 없음은 값을 가질 수 없다 (AI 가 추측할 재료를 남기지 않는다)
  check (status in ('ANSWERED', 'UNANSWERED') or (value = '' and choices = '{}')),
  check ((origin = 'SCHEMA') = (parent_question_id is null))
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  stage text not null check (stage in ('START', 'PROGRESS', 'FINISH')),
  note text not null check (length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  type text not null check (type in ('BEFORE_IMAGE', 'AFTER_IMAGE', 'DELIVERABLE_FILE', 'DELIVERABLE_URL', 'PROCESS_IMAGE', 'DOCUMENT', 'VIDEO', 'TEST_RECORD', 'METRIC', 'CLIENT_FEEDBACK', 'USAGE_PROOF')),
  description text not null default '' check (length(description) <= 1000),
  url text check (url is null or url ~ '^https?://'),   -- 로컬 경로·blob·data URL 금지 (Notion 에서 열 수 있어야 한다)
  file_name text,
  mime_type text,
  linked_field text,
  linked_claim text,
  source text not null check (source in ('STUDENT_UPLOAD', 'STUDENT_LINK', 'STUDENT_NOTE', 'CLIENT')),
  created_at timestamptz not null default now(),
  check (url is not null or description <> '')
);

create table public.submission_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  version int not null check (version >= 1),
  note text not null default '',
  evidence_ids uuid[] not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'REVISION_REQUESTED', 'APPROVED')),
  submitted_by uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  review_comment text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles,
  unique (project_id, version)
);
alter table public.projects add constraint projects_approved_version_fk foreign key (approved_version_id) references public.submission_versions;

create table public.client_verifications (
  project_id uuid primary key references public.projects on delete cascade,
  submission_version_id uuid not null references public.submission_versions,
  verifier_id uuid not null references public.profiles,
  work_performed boolean not null,
  role_confirmed boolean not null,
  deliverable_received boolean not null,
  completion_criteria_met boolean not null,
  actually_used boolean not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.client_reviews (
  project_id uuid primary key references public.projects on delete cascade,
  reviewer_id uuid not null references public.profiles,
  satisfaction int not null check (satisfaction between 1 and 5),
  deadline int not null check (deadline between 1 and 5),
  communication int not null check (communication between 1 and 5),
  handoff int not null check (handoff between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  metric_name text not null check (length(metric_name) between 1 and 80),
  measured boolean not null,
  value numeric,                                       -- null = 미측정 (0 과 다르다)
  unit text not null default '',
  baseline numeric,
  measurement_period text not null default '',
  source text not null default '',
  evidence_id uuid references public.evidence on delete set null,
  qualitative_description text not null default '',
  verified boolean not null default false,
  verified_by uuid references public.profiles,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (measured = (value is not null))
);

-- ── 포트폴리오: 원본 스냅샷 → 생성 초안 → 학생 편집본 (서로 덮어쓰지 않는다) ─────────
create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  hash text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, student_id, hash)
);
create table public.portfolio_drafts (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.portfolio_snapshots on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  generator text not null check (generator in ('AI', 'TEMPLATE')),
  model text,
  content jsonb not null,
  guard_report jsonb,
  created_at timestamptz not null default now()
);
create table public.portfolio_edits (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.portfolio_drafts on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  version int not null check (version >= 1),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, student_id, version)
);

-- ── 신뢰 지표 (승인 시 DB 함수만 기록. 학생·프로젝트·종류당 한 번) ───────────────
create table public.tier_score_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  kind text not null check (kind in ('PROJECT_VERIFIED', 'CLIENT_USED')),
  points int not null,
  created_at timestamptz not null default now(),
  unique (student_id, project_id, kind)
);
create table public.badges (
  student_id uuid not null references public.profiles on delete cascade,
  code text not null,
  label text not null,
  project_id uuid not null references public.projects on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, code)
);

-- ── Notion (토큰은 서버 함수만 읽고 쓴다: RLS 켜고 정책 없음) ─────────────────────
create table public.notion_connections (
  user_id uuid primary key references public.profiles on delete cascade,
  access_token_enc text not null,                      -- AES-GCM 암호문 (키는 Edge Function secret)
  refresh_token_enc text,
  bot_id text not null,
  workspace_id text not null,
  workspace_name text,
  workspace_icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.notion_oauth_states (
  state text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  return_to text not null,
  created_at timestamptz not null default now()
);
create table public.notion_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  portfolio_version_id uuid not null references public.portfolio_edits on delete cascade,
  idempotency_key text not null unique,
  parent_page_id text,
  notion_page_id text,
  notion_page_url text,
  status text not null check (status in ('PENDING', 'SUCCEEDED', 'PARTIAL', 'FAILED')),
  failed_attachments jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.project_members (student_id);
create index on public.evidence (project_id);
create index on public.activity_logs (project_id, created_at);
create index on public.outcomes (project_id);
create index on public.portfolio_edits (student_id);
create index on public.notion_exports (portfolio_version_id);

-- ── 권한 도우미 ──────────────────────────────────────────────────────────────
create function public.is_project_member(p uuid) returns boolean language sql security definer stable set search_path = public
  as $$ select exists (select 1 from project_members where project_id = p and student_id = auth.uid()) $$;
create function public.is_project_owner(p uuid) returns boolean language sql security definer stable set search_path = public
  as $$ select exists (select 1 from projects where id = p and owner_id = auth.uid()) $$;
create function public.is_project_completed(p uuid) returns boolean language sql security definer stable set search_path = public
  as $$ select exists (select 1 from projects where id = p and status = 'COMPLETED') $$;
create function public.can_see_project(p uuid) returns boolean language sql security definer stable set search_path = public
  as $$ select public.is_project_member(p) or public.is_project_owner(p) or public.is_project_completed(p) $$;

-- ── 상태 머신 (src 쪽 supabase/functions/_shared/portfolio/stateMachine.ts 와 같은 표) ─────
create function public.project_next_status(cur text, ev text, mode text) returns text language plpgsql immutable as $$
declare nxt text;
begin
  if ev = 'SELECT' and cur = 'IN_PROGRESS' and mode <> 'TEAM' then
    raise exception 'INVALID_TRANSITION: 개인 프로젝트는 이미 학생이 선정되었어요';
  end if;
  nxt := case
    when cur = 'RECRUITING' and ev = 'SELECT' then 'IN_PROGRESS'
    when cur = 'IN_PROGRESS' and ev = 'SELECT' then 'IN_PROGRESS'
    when cur = 'IN_PROGRESS' and ev = 'SUBMIT' then 'REVIEW_PENDING'
    when cur = 'REVIEW_PENDING' and ev = 'REQUEST_REVISION' then 'REVISION_REQUESTED'
    when cur = 'REVIEW_PENDING' and ev = 'APPROVE' then 'COMPLETED'
    when cur = 'REVISION_REQUESTED' and ev = 'RESUBMIT' then 'REVIEW_PENDING'
  end;
  if nxt is null then raise exception 'INVALID_TRANSITION: 지금 상태(%)에서는 할 수 없는 작업이에요', cur; end if;
  return nxt;
end $$;

create function public.domain_label(d text) returns text language sql immutable
  as $$ select case d when 'DESIGN' then '디자인' when 'MARKETING' then '마케팅' when 'DEVELOPMENT' then '개발' else '일반' end $$;

-- ── 지원: 모집 중인지, 유료 공고 자격이 있는지 ───────────────────────────────────
create function public.check_application() returns trigger language plpgsql security definer set search_path = public as $$
declare p posts;
begin
  select * into p from posts where id = new.post_id;
  if not (p.status = 'open' or (p.is_team and p.status = 'in_progress')) then
    raise exception 'INVALID_STATE: 모집이 끝난 공고예요';
  end if;
  if p.compensation_type = 'PAID' and (select count(*) from tier_score_events where student_id = new.student_id and kind = 'PROJECT_VERIFIED') < 1 then
    raise exception 'PAID_NOT_ELIGIBLE: 유료 의뢰는 검증된 프로젝트가 1개 이상일 때 지원할 수 있어요';
  end if;
  return new;
end $$;
create trigger applications_check before insert on public.applications for each row execute function public.check_application();

-- ── 선정: 프로젝트 생성(또는 팀원 추가) ──────────────────────────────────────────
create function public.select_applicant(p_application uuid, p_question_snapshot jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare a applications; p posts; pr projects; v_domain text; v_mode text; v_found boolean;
begin
  select * into a from applications where id = p_application for update;
  if not found then raise exception 'NOT_FOUND: 지원서를 찾을 수 없어요'; end if;
  select * into p from posts where id = a.post_id for update;
  if p.author_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 이 공고를 올린 의뢰인만 선정할 수 있어요'; end if;
  if a.status = 'rejected' then raise exception 'INVALID_STATE: 거절한 지원서예요'; end if;

  select * into pr from projects where post_id = p.id for update;
  v_found := found;
  if v_found and exists (select 1 from project_members where project_id = pr.id and student_id = a.student_id) then
    return pr.id;                                       -- 이미 선정됨 (중복 클릭)
  end if;
  v_domain := coalesce(p.domain, case p.category when '디자인' then 'DESIGN' when 'SNS홍보' then 'MARKETING' when '웹/앱' then 'DEVELOPMENT' else 'GENERAL' end);
  v_mode := case when p.is_team then 'TEAM' else 'INDIVIDUAL' end;
  if not v_found then
    if p_question_snapshot is null or jsonb_typeof(p_question_snapshot -> 'questions') is distinct from 'array'
       or p_question_snapshot ->> 'domain' is distinct from v_domain then
      raise exception 'INVALID_INPUT: 질문 목록이 공고 분야와 맞지 않아요';
    end if;
    insert into projects (post_id, owner_id, domain, mode, status, question_snapshot)
      values (p.id, p.author_id, v_domain, v_mode, 'RECRUITING', p_question_snapshot) returning * into pr;
  end if;
  update projects set status = project_next_status(pr.status, 'SELECT', pr.mode) where id = pr.id;
  insert into project_members (project_id, student_id, role_label, application_id) values (pr.id, a.student_id, domain_label(pr.domain), a.id);
  update applications set status = 'accepted' where id = a.id;
  update posts set status = 'in_progress' where id = p.id;
  return pr.id;
end $$;

-- ── 제출 (버전 관리) ─────────────────────────────────────────────────────────
create function public.submit_version(p_project uuid, p_note text, p_evidence_ids uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr projects; ids uuid[]; v_next text; v_id uuid; v_ver int;
begin
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'NOT_FOUND: 프로젝트를 찾을 수 없어요'; end if;
  if not exists (select 1 from project_members where project_id = pr.id and student_id = auth.uid()) then
    raise exception 'FORBIDDEN: 선정된 학생만 제출할 수 있어요';
  end if;
  v_next := project_next_status(pr.status, case when pr.status = 'REVISION_REQUESTED' then 'RESUBMIT' else 'SUBMIT' end, pr.mode);
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(p_evidence_ids, '{}')) x;
  if cardinality(ids) = 0 then raise exception 'INVALID_INPUT: 제출할 결과물 증빙을 하나 이상 골라 주세요'; end if;
  if (select count(*) from evidence where id = any(ids) and project_id = pr.id) <> cardinality(ids) then
    raise exception 'INVALID_INPUT: 이 프로젝트의 증빙만 제출할 수 있어요';
  end if;
  select coalesce(max(version), 0) + 1 into v_ver from submission_versions where project_id = pr.id;
  insert into submission_versions (project_id, version, note, evidence_ids, submitted_by)
    values (pr.id, v_ver, left(coalesce(p_note, ''), 2000), ids, auth.uid()) returning id into v_id;
  update projects set status = v_next where id = pr.id;
  return v_id;
end $$;

-- 점주가 검토할 수 있는 버전인지: 최신 버전 + 검토 대기 (이전 버전 승인 방지)
create function public.lock_reviewable(p_version uuid, out v submission_versions, out pr projects)
language plpgsql security definer set search_path = public as $$
begin
  select * into v from submission_versions where id = p_version;
  if not found then raise exception 'NOT_FOUND: 제출 버전을 찾을 수 없어요'; end if;
  select * into pr from projects where id = v.project_id for update;
  if pr.owner_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 이 공고를 올린 의뢰인만 할 수 있어요'; end if;
  if pr.status = 'COMPLETED' then raise exception 'ALREADY_APPROVED: 이미 승인된 프로젝트예요'; end if;
  if v.version <> (select max(version) from submission_versions where project_id = pr.id) then
    raise exception 'STALE_VERSION: v% 은 최신 제출이 아니에요. 최신 버전을 검토해 주세요', v.version;
  end if;
  if v.status <> 'PENDING' then raise exception 'INVALID_STATE: 검토 대기 중인 제출이 아니에요'; end if;
end $$;

create function public.request_revision(p_version uuid, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_limit int; v_used int;
begin
  select * into r from lock_reviewable(p_version);
  if coalesce(trim(p_comment), '') = '' then raise exception 'INVALID_INPUT: 무엇을 보완하면 좋을지 적어 주세요'; end if;
  select revision_limit into v_limit from posts where id = (r.pr).post_id;
  select count(*) into v_used from submission_versions where project_id = (r.pr).id and status = 'REVISION_REQUESTED';
  if v_used >= v_limit then raise exception 'REVISION_LIMIT: 보완 요청은 %번까지 할 수 있어요', v_limit; end if;
  update projects set status = project_next_status((r.pr).status, 'REQUEST_REVISION', (r.pr).mode) where id = (r.pr).id;
  update submission_versions set status = 'REVISION_REQUESTED', review_comment = trim(p_comment), reviewed_at = now(), reviewed_by = auth.uid() where id = p_version;
end $$;

-- 승인 = 버전 승인 + Claim 단위 검증 + 평가 + 점수·뱃지 (한 트랜잭션)
create function public.approve_version(p_version uuid, p_claims jsonb, p_review jsonb, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare r record; p posts; m record; v_used boolean; v_had boolean; s int; d int; c int; h int;
begin
  select * into r from lock_reviewable(p_version);
  if coalesce((p_claims ->> 'workPerformed')::boolean, false) is not true then
    raise exception 'INVALID_INPUT: 학생이 실제로 작업했음을 확인해야 승인할 수 있어요';
  end if;
  s := (p_review ->> 'satisfaction')::int; d := (p_review ->> 'deadline')::int; c := (p_review ->> 'communication')::int; h := (p_review ->> 'handoff')::int;
  if s is null or d is null or c is null or h is null or least(s, d, c, h) < 1 or greatest(s, d, c, h) > 5 then
    raise exception 'INVALID_INPUT: 평가는 1~5 로 골라 주세요';
  end if;
  v_used := coalesce((p_claims ->> 'actuallyUsed')::boolean, false);
  select * into p from posts where id = (r.pr).post_id;

  update submission_versions set status = 'APPROVED', reviewed_at = now(), reviewed_by = auth.uid() where id = p_version;
  update projects set status = project_next_status((r.pr).status, 'APPROVE', (r.pr).mode), approved_version_id = p_version, completed_at = now() where id = (r.pr).id;
  insert into client_verifications (project_id, submission_version_id, verifier_id, work_performed, role_confirmed, deliverable_received, completion_criteria_met, actually_used, note)
    values ((r.pr).id, p_version, auth.uid(), true, coalesce((p_claims ->> 'roleConfirmed')::boolean, false), coalesce((p_claims ->> 'deliverableReceived')::boolean, false),
            coalesce((p_claims ->> 'completionCriteriaMet')::boolean, false), v_used, left(coalesce(p_note, ''), 1000));
  insert into client_reviews (project_id, reviewer_id, satisfaction, deadline, communication, handoff, comment)
    values ((r.pr).id, auth.uid(), s, d, c, h, left(coalesce(p_review ->> 'comment', ''), 1000));
  update posts set status = 'done' where id = p.id;

  for m in select * from project_members where project_id = (r.pr).id loop
    v_had := exists (select 1 from tier_score_events where student_id = m.student_id and kind = 'PROJECT_VERIFIED');
    insert into tier_score_events (student_id, project_id, kind, points) values (m.student_id, (r.pr).id, 'PROJECT_VERIFIED', 10 + p.difficulty * 3) on conflict do nothing;
    if v_used then
      insert into tier_score_events (student_id, project_id, kind, points) values (m.student_id, (r.pr).id, 'CLIENT_USED', 5) on conflict do nothing;
      insert into badges (student_id, code, label, project_id) values (m.student_id, 'USED_IN_FIELD', '현장에서 쓰인 결과물', (r.pr).id) on conflict do nothing;
    end if;
    if not v_had then
      insert into badges (student_id, code, label, project_id) values (m.student_id, 'FIRST_VERIFIED', '첫 검증 프로젝트', (r.pr).id) on conflict do nothing;
    end if;
    insert into badges (student_id, code, label, project_id) values (m.student_id, 'DOMAIN_' || (r.pr).domain, domain_label((r.pr).domain) || ' 검증 경험', (r.pr).id) on conflict do nothing;
    -- 예전 화면(랭킹·포트폴리오 카드)이 읽는 기록
    insert into reviews (post_id, student_id, rating, comment, verified) values (p.id, m.student_id, s, left(coalesce(p_review ->> 'comment', ''), 1000), true) on conflict do nothing;
    if not exists (select 1 from portfolio_cards where post_id = p.id and student_id = m.student_id) then
      insert into portfolio_cards (student_id, post_id, title, role_label, tasks, duration_days, rating, verified) values (m.student_id, p.id, p.title, m.role_label, '{}', p.duration_days, s, true);
    end if;
  end loop;
end $$;

create function public.verify_outcome(p_outcome uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o outcomes;
begin
  select * into o from outcomes where id = p_outcome for update;
  if not found then raise exception 'NOT_FOUND: 성과를 찾을 수 없어요'; end if;
  if not exists (select 1 from projects where id = o.project_id and owner_id = auth.uid()) then raise exception 'FORBIDDEN: 이 공고를 올린 의뢰인만 할 수 있어요'; end if;
  if not o.measured then raise exception 'INVALID_STATE: 측정되지 않은 성과는 확인할 수 없어요'; end if;
  update outcomes set verified = true, verified_by = auth.uid(), verified_at = now() where id = p_outcome;
end $$;

-- 학생 편집본: 항상 새 버전으로 쌓는다
create function public.save_portfolio_edit(p_draft uuid, p_content jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare d portfolio_drafts; v_ver int; v_id uuid;
begin
  select * into d from portfolio_drafts where id = p_draft;
  if not found then raise exception 'NOT_FOUND: 초안을 찾을 수 없어요'; end if;
  if d.student_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 본인 포트폴리오만 고칠 수 있어요'; end if;
  if coalesce(trim(p_content ->> 'title'), '') = '' then raise exception 'INVALID_INPUT: 제목을 적어 주세요'; end if;
  perform pg_advisory_xact_lock(hashtext(d.project_id::text || d.student_id::text));
  select coalesce(max(version), 0) + 1 into v_ver from portfolio_edits where project_id = d.project_id and student_id = d.student_id;
  insert into portfolio_edits (draft_id, project_id, student_id, version, content) values (d.id, d.project_id, d.student_id, v_ver, p_content) returning id into v_id;
  return v_id;
end $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_answers enable row level security;
alter table public.activity_logs enable row level security;
alter table public.evidence enable row level security;
alter table public.submission_versions enable row level security;
alter table public.client_verifications enable row level security;
alter table public.client_reviews enable row level security;
alter table public.outcomes enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.portfolio_drafts enable row level security;
alter table public.portfolio_edits enable row level security;
alter table public.tier_score_events enable row level security;
alter table public.badges enable row level security;
alter table public.notion_connections enable row level security;   -- 정책 없음 = 앱에서 접근 불가 (서버 함수만)
alter table public.notion_oauth_states enable row level security;  -- 정책 없음
alter table public.notion_exports enable row level security;

-- 진행 중 기록은 당사자만, 완료된 프로젝트의 결과(검증·평가·증빙)는 로그인 사용자 누구나 (공개 포트폴리오)
create policy "프로젝트는 당사자 또는 완료 후 공개" on public.projects for select to authenticated using (public.can_see_project(id));
create policy "팀원은 당사자 또는 완료 후 공개" on public.project_members for select to authenticated using (public.can_see_project(project_id));
create policy "제출은 당사자 또는 완료 후 공개" on public.submission_versions for select to authenticated using (public.can_see_project(project_id));
create policy "검증은 당사자 또는 완료 후 공개" on public.client_verifications for select to authenticated using (public.can_see_project(project_id));
create policy "평가는 당사자 또는 완료 후 공개" on public.client_reviews for select to authenticated using (public.can_see_project(project_id));
create policy "증빙은 당사자 또는 완료 후 공개" on public.evidence for select to authenticated using (public.can_see_project(project_id));
create policy "성과는 당사자 또는 완료 후 공개" on public.outcomes for select to authenticated using (public.can_see_project(project_id));

create policy "답변은 당사자만 본다" on public.project_answers for select to authenticated using (public.is_project_member(project_id) or public.is_project_owner(project_id));
create policy "답변은 선정된 학생이 자기 것만 쓴다" on public.project_answers for insert to authenticated with check (author_id = auth.uid() and public.is_project_member(project_id));
create policy "답변은 선정된 학생이 자기 것만 고친다" on public.project_answers for update to authenticated
  using (author_id = auth.uid() and public.is_project_member(project_id)) with check (author_id = auth.uid() and public.is_project_member(project_id));

create policy "활동 기록은 당사자만 본다" on public.activity_logs for select to authenticated using (public.is_project_member(project_id) or public.is_project_owner(project_id));
create policy "활동 기록은 선정된 학생만 쓴다" on public.activity_logs for insert to authenticated with check (author_id = auth.uid() and public.is_project_member(project_id));

-- 증빙은 추가만 된다 (수정·삭제 없음 = 원본 보존). 의뢰인이 올린 증빙은 source = CLIENT
create policy "증빙은 당사자가 올린다" on public.evidence for insert to authenticated with check (
  author_id = auth.uid() and ((public.is_project_member(project_id) and source <> 'CLIENT') or (public.is_project_owner(project_id) and source = 'CLIENT')));

create policy "성과는 선정된 학생이 올린다(미확인 상태로)" on public.outcomes for insert to authenticated
  with check (author_id = auth.uid() and public.is_project_member(project_id) and verified = false and verified_by is null and verified_at is null);
create policy "확인 전 성과는 작성자가 지울 수 있다" on public.outcomes for delete to authenticated using (author_id = auth.uid() and verified = false);

create policy "스냅샷은 본인만" on public.portfolio_snapshots for select to authenticated using (student_id = auth.uid());
create policy "스냅샷은 완료된 내 프로젝트만" on public.portfolio_snapshots for insert to authenticated
  with check (student_id = auth.uid() and public.is_project_member(project_id) and public.is_project_completed(project_id));
create policy "초안은 본인만" on public.portfolio_drafts for select to authenticated using (student_id = auth.uid());
create policy "초안은 내 스냅샷에서만" on public.portfolio_drafts for insert to authenticated
  with check (student_id = auth.uid() and exists (select 1 from public.portfolio_snapshots s where s.id = snapshot_id and s.student_id = auth.uid() and s.project_id = portfolio_drafts.project_id));
create policy "편집본은 공개 포트폴리오" on public.portfolio_edits for select to authenticated using (true);

create policy "점수 기록은 누구나 본다" on public.tier_score_events for select to authenticated using (true);
create policy "뱃지는 누구나 본다" on public.badges for select to authenticated using (true);
create policy "Notion 저장 기록은 본인만" on public.notion_exports for select to authenticated using (user_id = auth.uid());

-- ── 증빙 파일 저장소 (공개 읽기: Notion 이 이미지를 불러올 수 있어야 한다. 경로 = <project_id>/<무작위>.<확장자>) ──
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', true) on conflict (id) do nothing;
create policy "증빙 파일은 프로젝트 당사자만 올린다" on storage.objects for insert to authenticated with check (
  bucket_id = 'evidence' and (public.is_project_member(((storage.foldername(name))[1])::uuid) or public.is_project_owner(((storage.foldername(name))[1])::uuid)));

-- 내부 도우미는 앱에서 직접 부르지 못하게 한다
revoke execute on function public.lock_reviewable(uuid) from public, anon, authenticated;
