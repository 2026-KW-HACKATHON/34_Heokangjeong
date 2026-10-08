-- 합의 취소.
-- 진행 중인 프로젝트는 사장님이 마음대로 지울 수 없다(0033). 대신 양쪽이 합의해서 끝낸다.
--   요청(사유 10자 이상) → 상대 쪽 대표 1명이 수락·거절 → 3일 무응답은 거절로 처리
--   수락하면 프로젝트는 CANCELLED, 공고는 모집 마감. 활동 기록·제출물·채팅은 지우지 않는다.
--   취소된 프로젝트는 포트폴리오·공개 피드·평판 집계에서 빠진다.

-- ── 상태에 CANCELLED 추가 ───────────────────────────────────────────────────
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('RECRUITING', 'IN_PROGRESS', 'REVIEW_PENDING', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED'));

create table if not exists public.project_cancellations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  requested_by uuid not null references public.profiles on delete cascade,
  responder_id uuid not null references public.profiles on delete cascade,   -- 수락 권한을 가진 한 명
  reason text not null check (length(trim(reason)) >= 10),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  expires_at timestamptz not null default now() + interval '3 days',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
-- 프로젝트당 대기 중 요청은 1건만
create unique index if not exists project_cancellations_pending_uq
  on public.project_cancellations(project_id) where status = 'PENDING';
create index if not exists project_cancellations_project_idx on public.project_cancellations(project_id, created_at desc);

-- ── 학생 쪽 대표 한 명 (개인이면 그 학생, 팀·단체면 팀장) ────────────────────
create or replace function public.project_student_lead(p_project uuid) returns uuid
language sql stable set search_path = public as $$
  select coalesce(
    -- 단체가 맡았으면 그 단체의 대표 중 프로젝트에 참여한 사람
    (select m.student_id from project_members m
       join projects pr on pr.id = m.project_id
       join club_members cm on cm.club_id = pr.club_id and cm.student_id = m.student_id
      where m.project_id = p_project and cm.role = 'LEADER' and cm.status = 'ACTIVE'
      order by m.joined_at limit 1),
    -- 팀 프로젝트면 팀장으로 표시된 멤버
    (select student_id from project_members where project_id = p_project and is_lead order by joined_at limit 1),
    -- 그 외에는 가장 먼저 선정된 학생
    (select student_id from project_members where project_id = p_project order by joined_at limit 1))
$$;

-- ── 기한 지난 요청을 거절로 정리 (읽을 때마다 먼저 부른다) ───────────────────
create or replace function public.expire_cancellations() returns void
language plpgsql security definer set search_path = public as $$
declare c project_cancellations;
begin
  for c in select * from project_cancellations where status = 'PENDING' and expires_at < now() loop
    update project_cancellations set status = 'EXPIRED', responded_at = now() where id = c.id;
    perform enqueue_notification(c.requested_by, 'CANCEL_REJECTED',
      '취소 요청이 거절됐어요. 채팅으로 상대방과 합의해 주세요.',
      '/projects/detail?id=' || c.project_id, null, null, 'cancel:expired:' || c.id);
  end loop;
end $$;

-- ── 취소 요청 ───────────────────────────────────────────────────────────────
create or replace function public.request_cancellation(p_project uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr projects; lead uuid; responder uuid; new_id uuid;
begin
  perform expire_cancellations();
  select * into pr from projects where id = p_project;
  if pr.id is null then raise exception 'NOT_FOUND: 프로젝트를 찾을 수 없어요'; end if;
  if pr.status = 'COMPLETED' then raise exception 'ALREADY_DONE: 이미 완료된 프로젝트는 취소할 수 없어요'; end if;
  if pr.status = 'CANCELLED' then raise exception 'ALREADY_CANCELLED: 이미 취소된 프로젝트예요'; end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then raise exception 'REASON_REQUIRED: 취소 사유를 10자 이상 적어 주세요'; end if;
  if exists (select 1 from project_cancellations where project_id = p_project and status = 'PENDING') then
    raise exception 'ALREADY_REQUESTED: 이미 응답을 기다리는 취소 요청이 있어요';
  end if;

  lead := project_student_lead(p_project);
  -- 사장님이 요청하면 학생 쪽 대표가, 학생 쪽 대표가 요청하면 사장님이 수락자
  if auth.uid() = pr.owner_id then responder := lead;
  elsif auth.uid() = lead then responder := pr.owner_id;
  else raise exception 'FORBIDDEN: 의뢰인 또는 학생 쪽 대표만 취소를 요청할 수 있어요';
  end if;
  if responder is null then raise exception 'NO_RESPONDER: 상대방을 찾을 수 없어요'; end if;

  insert into project_cancellations (project_id, requested_by, responder_id, reason)
    values (p_project, auth.uid(), responder, trim(p_reason)) returning id into new_id;

  perform enqueue_notification(responder, 'CANCEL_REQUESTED',
    '상대방이 프로젝트 취소를 요청했어요. 3일 안에 수락하거나 거절해 주세요.',
    '/projects/detail?id=' || p_project, null, null, 'cancel:req:' || new_id);
  return new_id;
end $$;

-- ── 수락 · 거절 ─────────────────────────────────────────────────────────────
create or replace function public.respond_cancellation(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c project_cancellations; pr projects; m project_members;
begin
  perform expire_cancellations();
  select * into c from project_cancellations where id = p_id;
  if c.id is null then raise exception 'NOT_FOUND: 취소 요청을 찾을 수 없어요'; end if;
  if c.responder_id <> auth.uid() then raise exception 'FORBIDDEN: 상대방만 수락하거나 거절할 수 있어요'; end if;
  if c.status <> 'PENDING' then raise exception 'ALREADY_RESPONDED: 이미 처리된 요청이에요'; end if;

  if not p_accept then
    update project_cancellations set status = 'REJECTED', responded_at = now() where id = p_id;
    perform enqueue_notification(c.requested_by, 'CANCEL_REJECTED',
      '취소 요청이 거절됐어요. 채팅으로 상대방과 합의해 주세요.',
      '/projects/detail?id=' || c.project_id, null, null, 'cancel:rej:' || p_id);
    return;
  end if;

  update project_cancellations set status = 'ACCEPTED', responded_at = now() where id = p_id;
  select * into pr from projects where id = c.project_id;
  update projects set status = 'CANCELLED' where id = c.project_id;
  update posts set status = 'done' where id = pr.post_id;   -- 모집 마감 (기록은 그대로 둔다)

  perform enqueue_notification(pr.owner_id, 'CANCELLED',
    '프로젝트가 합의 취소됐어요.', '/projects/detail?id=' || c.project_id, null, null, 'cancel:done:' || p_id || ':owner');
  for m in select * from project_members where project_id = c.project_id loop
    perform enqueue_notification(m.student_id, 'CANCELLED',
      '프로젝트가 합의 취소됐어요.', '/projects/detail?id=' || c.project_id, null, null, 'cancel:done:' || p_id || ':' || m.student_id);
  end loop;
end $$;

-- ── 권한 ────────────────────────────────────────────────────────────────────
alter table public.project_cancellations enable row level security;
drop policy if exists "취소 요청은 당사자만 본다" on public.project_cancellations;
create policy "취소 요청은 당사자만 본다" on public.project_cancellations for select to authenticated using (
  exists (select 1 from projects pr where pr.id = project_id and pr.owner_id = auth.uid())
  or exists (select 1 from project_members m where m.project_id = project_cancellations.project_id and m.student_id = auth.uid()));

grant select on public.project_cancellations to authenticated;
grant execute on function public.request_cancellation(uuid, text), public.respond_cancellation(uuid, boolean),
  public.expire_cancellations(), public.project_student_lead(uuid) to authenticated;
