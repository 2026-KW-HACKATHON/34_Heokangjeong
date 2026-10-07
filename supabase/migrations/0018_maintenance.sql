-- 유지보수·인수인계. "만들고 끝"이 아닌 결과물(웹사이트, 예약 시스템 등)을 플랫폼이 계속 관리하게 한다.
--   공고에 '계속 운영되는 결과물' 체크 → 완료되면 운영(operations) 시작 → 인수인계 정보 입력
--   → 점주는 유지보수 티켓으로 요청 → 담당 학생이 빠지면 다음 학생이 이어받는다(Project Baton)
-- 핵심 원칙: 프로젝트는 학생 개인이 아니라 플랫폼에 남는다.

-- ── 공고: 유지보수가 필요한 일인지 + 보증 조건 ───────────────────────────────
alter table public.posts
  add column if not exists ongoing boolean not null default false,          -- 계속 운영되는 결과물인가
  add column if not exists warranty_request_days int not null default 30,   -- 점주 요청(내용 수정 등) 무상 기간
  add column if not exists warranty_request_count int not null default 3,   -- 그 기간의 무상 횟수
  add column if not exists warranty_defect_days int not null default 90,    -- 학생 작업 하자(버그) 무상 기간
  add column if not exists client_owned_billing boolean not null default true; -- 도메인·호스팅 명의와 결제를 점주가 보유

-- ── 운영 상태: 완료된 프로젝트 하나당 한 행 ──────────────────────────────────
create table if not exists public.operations (
  project_id uuid primary key references public.projects on delete cascade,
  status text not null default 'WARRANTY' check (status in ('WARRANTY', 'OPERATING', 'HANDOVER_OPEN', 'ARCHIVED')),
  maintainer_id uuid references public.profiles on delete set null,  -- 현재 담당 학생 (바뀐다)
  -- 인수인계 정보 (다음 사람이 이어받는 데 필요한 것)
  repo_url text, deploy_url text,
  admin_handed boolean not null default false,   -- 관리자 계정 전달 완료 (비밀번호는 저장하지 않는다)
  env_list text,                                  -- 외부 서비스·환경값 목록
  monthly_cost text,                              -- 월 비용과 결제일
  billing_owner text check (billing_owner in ('CLIENT', 'STUDENT')),
  expires_on date,                                -- 도메인·인증서·키 등 가장 먼저 만료되는 날
  backup_note text, known_issues text,
  -- 보증
  warranty_request_until date, warranty_defect_until date, request_used int not null default 0,
  -- 가동 점검
  last_check_at timestamptz, last_check_ok boolean,
  created_at timestamptz not null default now()
);

-- 담당자 이력: 누가 언제부터 언제까지 맡았나 (포트폴리오 재료)
create table if not exists public.maintainer_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  started_on date not null default current_date,
  ended_on date,
  tickets_closed int not null default 0
);
create index if not exists maintainer_history_project_idx on public.maintainer_history(project_id, started_on);

-- 유지보수 요청 티켓
create table if not exists public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('BUG', 'CONTENT', 'FEATURE', 'OTHER')),
  body text not null check (length(body) between 1 and 2000),
  -- 무상 범위 판정 결과
  coverage text not null check (coverage in ('FREE_DEFECT', 'FREE_REQUEST', 'NEW_POST', 'EXPIRED')),
  assignee_id uuid references public.profiles on delete set null,
  status text not null default 'OPEN' check (status in ('OPEN', 'DONE')),
  new_post_id uuid references public.posts on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists maintenance_tickets_project_idx on public.maintenance_tickets(project_id, created_at desc);

-- AI 인수인계서
create table if not exists public.handover_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  markdown text not null,
  model text,
  generated_at timestamptz not null default now()
);
create index if not exists handover_docs_project_idx on public.handover_docs(project_id, generated_at desc);

-- ── 완료되면 운영 시작 ───────────────────────────────────────────────────────
create or replace function public.start_operations() returns trigger
language plpgsql security definer set search_path = public as $$
declare p posts; m uuid;
begin
  if new.status <> 'COMPLETED' or coalesce(old.status, '') = 'COMPLETED' then return new; end if;
  select * into p from posts where id = new.post_id;
  if not coalesce(p.ongoing, false) then return new; end if;   -- 만들고 끝나는 일은 운영이 없다

  select student_id into m from project_members where project_id = new.id order by joined_at limit 1;
  insert into operations (project_id, maintainer_id, warranty_request_until, warranty_defect_until)
  values (new.id, m, current_date + p.warranty_request_days, current_date + p.warranty_defect_days)
  on conflict (project_id) do nothing;
  if m is not null then
    insert into maintainer_history (project_id, student_id) values (new.id, m);
  end if;
  return new;
end $$;

drop trigger if exists projects_start_operations on public.projects;
create trigger projects_start_operations after update on public.projects
for each row execute function public.start_operations();

-- ── 인수인계 정보 저장 (담당 학생) ───────────────────────────────────────────
create or replace function public.save_handover(p_project uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from operations where project_id = p_project and maintainer_id = auth.uid()) then
    raise exception 'FORBIDDEN: 현재 담당자만 인수인계 정보를 저장할 수 있어요';
  end if;
  update operations set
    repo_url = coalesce(p_data->>'repoUrl', repo_url),
    deploy_url = coalesce(p_data->>'deployUrl', deploy_url),
    admin_handed = coalesce((p_data->>'adminHanded')::boolean, admin_handed),
    env_list = coalesce(p_data->>'envList', env_list),
    monthly_cost = coalesce(p_data->>'monthlyCost', monthly_cost),
    billing_owner = coalesce(p_data->>'billingOwner', billing_owner),
    expires_on = coalesce(nullif(p_data->>'expiresOn', '')::date, expires_on),
    backup_note = coalesce(p_data->>'backupNote', backup_note),
    known_issues = coalesce(p_data->>'knownIssues', known_issues)
  where project_id = p_project;
end $$;

-- ── 인계 요청 / 이어받기 (Project Baton) ─────────────────────────────────────
create or replace function public.open_handover(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o operations;
begin
  select * into o from operations where project_id = p_project;
  if o.project_id is null then raise exception 'NOT_FOUND: 운영 중인 프로젝트가 아니에요'; end if;
  if o.maintainer_id <> auth.uid() then raise exception 'FORBIDDEN: 현재 담당자만 인계를 요청할 수 있어요'; end if;
  if coalesce(o.repo_url, '') = '' then raise exception 'HANDOVER_INCOMPLETE: 인수인계 정보(저장소 주소)를 먼저 채워 주세요'; end if;

  update operations set status = 'HANDOVER_OPEN' where project_id = p_project;
  update maintainer_history set ended_on = current_date
   where project_id = p_project and student_id = o.maintainer_id and ended_on is null;

  -- 점주에게 알림
  perform enqueue_notification(
    (select owner_id from projects where id = p_project), 'HANDOVER_OPEN',
    '담당 학생이 인계를 요청했어요. 다음 담당자를 모집합니다.', '/projects/detail?id=' || p_project, null, null,
    'handover:open:' || p_project || ':' || o.maintainer_id);
end $$;

create or replace function public.take_over(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o operations;
begin
  select * into o from operations where project_id = p_project;
  if o.project_id is null then raise exception 'NOT_FOUND: 운영 중인 프로젝트가 아니에요'; end if;
  if o.status <> 'HANDOVER_OPEN' then raise exception 'INVALID_STATE: 지금은 이어받을 수 있는 상태가 아니에요'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'FORBIDDEN: 학생만 이어받을 수 있어요';
  end if;

  update operations set status = 'OPERATING', maintainer_id = auth.uid() where project_id = p_project;
  insert into maintainer_history (project_id, student_id) values (p_project, auth.uid());
  perform enqueue_notification(
    (select owner_id from projects where id = p_project), 'HANDOVER_TAKEN',
    '새 담당 학생이 프로젝트를 이어받았어요.', '/projects/detail?id=' || p_project, null, null,
    'handover:taken:' || p_project || ':' || auth.uid());
end $$;

-- ── 유지보수 티켓: 무상 범위 자동 판정 ───────────────────────────────────────
-- BUG  → 하자 보증 기간 안이면 무상(FREE_DEFECT)
-- CONTENT/OTHER → 요청 보증 기간 안이고 횟수가 남았으면 무상(FREE_REQUEST)
-- FEATURE → 언제나 새 공고로 (추가 개발)
-- 그 외 → EXPIRED (기간이 지남 → 새 공고 권장)
create or replace function public.ticket_coverage(p_project uuid, p_kind text) returns text
language sql stable set search_path = public as $$
  select case
    when p_kind = 'FEATURE' then 'NEW_POST'
    when p_kind = 'BUG' and o.warranty_defect_until >= current_date then 'FREE_DEFECT'
    when p_kind in ('CONTENT', 'OTHER') and o.warranty_request_until >= current_date
         and o.request_used < (select warranty_request_count from posts p join projects pr on pr.post_id = p.id where pr.id = p_project)
      then 'FREE_REQUEST'
    else 'EXPIRED' end
  from operations o where o.project_id = p_project
$$;

create or replace function public.create_ticket(p_project uuid, p_kind text, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare o operations; cov text; t uuid;
begin
  select * into o from operations where project_id = p_project;
  if o.project_id is null then raise exception 'NOT_FOUND: 운영 중인 프로젝트가 아니에요'; end if;
  if (select owner_id from projects where id = p_project) <> auth.uid() then
    raise exception 'FORBIDDEN: 의뢰인만 유지보수를 요청할 수 있어요';
  end if;

  cov := ticket_coverage(p_project, p_kind);
  insert into maintenance_tickets (project_id, author_id, kind, body, coverage, assignee_id)
  values (p_project, auth.uid(), p_kind, p_body, cov, case when cov like 'FREE%' then o.maintainer_id end)
  returning id into t;

  if cov = 'FREE_REQUEST' then
    update operations set request_used = request_used + 1 where project_id = p_project;
  end if;
  if cov like 'FREE%' and o.maintainer_id is not null then
    perform enqueue_notification(o.maintainer_id, 'MAINTENANCE', '유지보수 요청이 도착했어요.', '/projects/detail?id=' || p_project, null, null, 'ticket:' || t);
  end if;
  return t;
end $$;

create or replace function public.close_ticket(p_ticket uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t maintenance_tickets;
begin
  select * into t from maintenance_tickets where id = p_ticket;
  if t.id is null then raise exception 'NOT_FOUND: 요청을 찾을 수 없어요'; end if;
  if t.assignee_id <> auth.uid() and t.author_id <> auth.uid() then
    raise exception 'FORBIDDEN: 담당자나 요청한 분만 처리할 수 있어요';
  end if;
  update maintenance_tickets set status = 'DONE', closed_at = now() where id = p_ticket;
  update maintainer_history set tickets_closed = tickets_closed + 1
   where project_id = t.project_id and student_id = t.assignee_id and ended_on is null;
end $$;

-- ── 가동 점검 결과 기록 (앱의 '지금 점검하기' 또는 Cron) ─────────────────────
create or replace function public.record_uptime(p_project uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update operations set last_check_at = now(), last_check_ok = p_ok where project_id = p_project;
  if not p_ok then
    perform enqueue_notification((select maintainer_id from operations where project_id = p_project), 'UPTIME',
      '배포된 사이트가 응답하지 않아요.', '/projects/detail?id=' || p_project, null, null,
      'uptime:' || p_project || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  end if;
end $$;

-- ── 권한 ────────────────────────────────────────────────────────────────────
alter table public.operations enable row level security;
alter table public.maintainer_history enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.handover_docs enable row level security;

-- 읽기는 로그인한 사용자 모두 (이어받을 학생이 상태와 인수인계 준비도를 봐야 한다).
-- 쓰기는 위의 함수(SECURITY DEFINER)로만 — 직접 insert/update 정책을 두지 않는다.
drop policy if exists "운영 상태는 로그인하면 본다" on public.operations;
create policy "운영 상태는 로그인하면 본다" on public.operations for select to authenticated using (true);
drop policy if exists "담당자 이력은 로그인하면 본다" on public.maintainer_history;
create policy "담당자 이력은 로그인하면 본다" on public.maintainer_history for select to authenticated using (true);
drop policy if exists "유지보수 요청은 당사자만 본다" on public.maintenance_tickets;
create policy "유지보수 요청은 당사자만 본다" on public.maintenance_tickets for select to authenticated
  using (author_id = auth.uid() or assignee_id = auth.uid()
         or exists (select 1 from operations o where o.project_id = maintenance_tickets.project_id and o.maintainer_id = auth.uid()));
drop policy if exists "인수인계서는 로그인하면 본다" on public.handover_docs;
create policy "인수인계서는 로그인하면 본다" on public.handover_docs for select to authenticated using (true);

grant select on public.operations, public.maintainer_history, public.maintenance_tickets, public.handover_docs to authenticated;
grant execute on function public.save_handover(uuid, jsonb), public.open_handover(uuid), public.take_over(uuid),
  public.create_ticket(uuid, text, text), public.close_ticket(uuid), public.record_uptime(uuid, boolean),
  public.ticket_coverage(uuid, text) to authenticated;
