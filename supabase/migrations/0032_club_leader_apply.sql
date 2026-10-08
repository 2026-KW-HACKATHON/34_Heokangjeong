-- 단체 활동 규칙 정리.
--   ① 단체 이름으로 지원하는 건 팀장(대표)만. 채팅도 팀장 ↔ 사장님 1대1로 유지된다.
--   ② 대표를 넘길 수 있어야 한다. 팀장이 졸업하면 단체 전체가 멈추기 때문.
--   ③ 팀장이 "이번 작업은 누가 했는지" 부원을 추가하면, 그 부원에게도 검증 기록이 남는다.

-- ── ① 단체 지원은 팀장만 ────────────────────────────────────────────────────
create or replace function public.check_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare p posts;
begin
  select * into p from posts where id = new.post_id;
  if p.status <> 'open' then raise exception 'INVALID_STATE: 모집이 끝난 공고예요'; end if;
  if p.is_team and not exists (select 1 from post_roles r where r.id = new.role_id and r.post_id = p.id) then
    raise exception 'ROLE_REQUIRED: 지원할 역할을 선택해 주세요';
  end if;
  if not p.is_team and new.role_id is not null then raise exception 'INVALID_ROLE: 개인 프로젝트에는 역할을 선택할 수 없어요'; end if;

  if p.applicant_scope = 'CLUB' and new.club_id is null then
    raise exception 'CLUB_ONLY: 단체 이름으로만 지원할 수 있는 공고예요';
  end if;
  if p.applicant_scope = 'INDIVIDUAL' and new.club_id is not null then
    raise exception 'INDIVIDUAL_ONLY: 개인으로만 지원할 수 있는 공고예요';
  end if;
  if new.club_id is not null and not exists (
      select 1 from club_members
       where club_id = new.club_id and student_id = new.student_id and status = 'ACTIVE' and role = 'LEADER') then
    raise exception 'LEADER_ONLY: 단체 이름으로는 대표만 지원할 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists applications_check on public.applications;
create trigger applications_check before insert on public.applications
for each row execute function public.check_application();

-- ── ② 대표 위임 ─────────────────────────────────────────────────────────────
create or replace function public.transfer_leader(p_club uuid, p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from club_members where club_id = p_club and student_id = auth.uid() and role = 'LEADER' and status = 'ACTIVE') then
    raise exception 'FORBIDDEN: 현재 대표만 대표를 넘길 수 있어요';
  end if;
  if not exists (select 1 from club_members where club_id = p_club and student_id = p_student and status = 'ACTIVE') then
    raise exception 'NOT_MEMBER: 소속이 확정된 부원에게만 넘길 수 있어요';
  end if;
  update club_members set role = 'MEMBER' where club_id = p_club and student_id = auth.uid();
  update club_members set role = 'LEADER' where club_id = p_club and student_id = p_student;
  perform enqueue_notification(p_student, 'CLUB_LEADER',
    format('"%s" 의 대표가 되었어요.', (select name from clubs where id = p_club)),
    '/clubs/detail?id=' || p_club, null, null, 'club:leader:' || p_club || ':' || p_student);
end $$;

-- 마지막 대표는 먼저 대표를 넘겨야 나갈 수 있다 (단체가 멈추는 걸 막는다)
create or replace function public.leave_club(p_club uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from operations where club_id = p_club and maintainer_id = auth.uid() and status in ('WARRANTY', 'OPERATING')) then
    raise exception 'HAS_DUTY: 맡고 있는 서비스의 담당자를 먼저 넘겨 주세요';
  end if;
  if exists (select 1 from club_members where club_id = p_club and student_id = auth.uid() and role = 'LEADER' and status = 'ACTIVE')
     and (select count(*) from club_members where club_id = p_club and role = 'LEADER' and status = 'ACTIVE') = 1
     and exists (select 1 from club_members where club_id = p_club and student_id <> auth.uid() and status = 'ACTIVE') then
    raise exception 'LAST_LEADER: 대표를 다른 부원에게 먼저 넘겨 주세요';
  end if;
  delete from club_members where club_id = p_club and student_id = auth.uid();
end $$;

-- ── ③ 참여 부원 추가 (팀장이 실제 작업자를 기록) ────────────────────────────
create or replace function public.add_club_worker(p_project uuid, p_student uuid, p_role_label text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pr projects; snap jsonb;
begin
  select * into pr from projects where id = p_project;
  if pr.id is null then raise exception 'NOT_FOUND: 프로젝트를 찾을 수 없어요'; end if;
  if pr.club_id is null then raise exception 'NO_CLUB: 단체가 맡은 프로젝트만 부원을 추가할 수 있어요'; end if;
  if not exists (select 1 from club_members where club_id = pr.club_id and student_id = auth.uid() and role = 'LEADER' and status = 'ACTIVE') then
    raise exception 'FORBIDDEN: 단체 대표만 참여 부원을 추가할 수 있어요';
  end if;
  if not exists (select 1 from club_members where club_id = pr.club_id and student_id = p_student and status = 'ACTIVE') then
    raise exception 'NOT_MEMBER: 같은 단체 소속 부원만 추가할 수 있어요';
  end if;
  if exists (select 1 from project_members where project_id = p_project and student_id = p_student) then return; end if;

  select question_snapshot into snap from projects where id = p_project;
  insert into project_members (project_id, student_id, role_label, domain, question_snapshot)
    values (p_project, p_student, coalesce(nullif(trim(p_role_label), ''), '참여'), pr.domain, snap);
  perform enqueue_notification(p_student, 'PROJECT_STARTED',
    '단체 프로젝트에 참여자로 등록됐어요. 활동을 기록하면 포트폴리오로 남아요.',
    '/projects/detail?id=' || p_project, null, null, 'club:worker:' || p_project || ':' || p_student);
end $$;

grant execute on function public.transfer_leader(uuid, uuid), public.add_club_worker(uuid, uuid, text) to authenticated;
