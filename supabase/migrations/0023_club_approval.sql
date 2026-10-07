-- 단체 등록·가입에 승인 단계를 둔다.
--   단체 등록: 학생이 신청 → 앱 관리자가 승인해야 목록에 뜬다 (아무나 가짜 동아리를 만들지 못하게)
--   단체 가입: 학생이 신청 → 그 단체의 대표가 수락해야 소속이 된다 (이름만 적으면 소속되는 걸 막는다)
-- 관리자 계정: profiles.role = 'admin'

-- ── 역할에 관리자 추가 ──────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'resident', 'admin'));

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;
grant execute on function public.is_admin() to authenticated;

-- ── 단체: 승인 상태 ─────────────────────────────────────────────────────────
alter table public.clubs
  add column if not exists status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  add column if not exists reviewed_by uuid references public.profiles on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reject_reason text;

-- 이미 만들어진 단체(승인 개념이 없던 때)는 승인된 것으로 둔다
update public.clubs set status = 'APPROVED' where status = 'PENDING' and created_at < now() - interval '1 second';

alter table public.club_members
  add column if not exists status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE'));

-- ── 단체 등록 신청 (승인 전에는 목록에 안 뜬다) ──────────────────────────────
create or replace function public.create_club(p_name text, p_kind text, p_description text, p_college text default null, p_kind_other text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'FORBIDDEN: 학생만 단체를 등록할 수 있어요';
  end if;
  if exists (select 1 from clubs where name = trim(p_name) and status <> 'REJECTED') then
    raise exception 'DUPLICATE: 같은 이름으로 이미 등록됐거나 신청 중이에요';
  end if;
  insert into clubs (name, kind, kind_other, description, college, created_by, status)
    values (trim(p_name), coalesce(p_kind, 'OTHER'),
            case when coalesce(p_kind, 'OTHER') = 'OTHER' then nullif(trim(coalesce(p_kind_other, '')), '') end,
            coalesce(p_description, ''), p_college, auth.uid(), 'PENDING')
    returning id into c;
  -- 신청한 학생은 승인되면 바로 대표가 된다
  insert into club_members (club_id, student_id, role, status) values (c, auth.uid(), 'LEADER', 'ACTIVE');
  return c;
end $$;

-- ── 관리자: 단체 승인·거절 ──────────────────────────────────────────────────
create or replace function public.review_club(p_club uuid, p_approve boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c clubs;
begin
  if not is_admin() then raise exception 'FORBIDDEN: 관리자만 심사할 수 있어요'; end if;
  select * into c from clubs where id = p_club;
  if c.id is null then raise exception 'NOT_FOUND: 단체를 찾을 수 없어요'; end if;

  update clubs set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
                   reviewed_by = auth.uid(), reviewed_at = now(), reject_reason = case when p_approve then null else p_reason end
   where id = p_club;

  perform enqueue_notification(c.created_by, 'CLUB_REVIEW',
    case when p_approve then format('신청한 단체 "%s" 가 등록됐어요.', c.name)
         else format('단체 "%s" 등록이 반려됐어요. %s', c.name, coalesce(p_reason, '')) end,
    '/clubs', null, null, 'club:review:' || p_club);
end $$;

-- ── 가입 신청 → 대표 수락 ───────────────────────────────────────────────────
create or replace function public.join_club(p_club uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c clubs; leader uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'FORBIDDEN: 학생만 단체에 가입할 수 있어요';
  end if;
  select * into c from clubs where id = p_club;
  if c.status <> 'APPROVED' then raise exception 'NOT_APPROVED: 아직 등록 심사 중인 단체예요'; end if;

  insert into club_members (club_id, student_id, role, status) values (p_club, auth.uid(), 'MEMBER', 'PENDING')
    on conflict (club_id, student_id) do nothing;

  for leader in select student_id from club_members where club_id = p_club and role = 'LEADER' and status = 'ACTIVE' loop
    perform enqueue_notification(leader, 'CLUB_JOIN',
      format('%s 님이 "%s" 가입을 신청했어요.', (select name from profiles where id = auth.uid()), c.name),
      '/clubs/detail?id=' || p_club, null, null, 'club:join:' || p_club || ':' || auth.uid());
  end loop;
end $$;

create or replace function public.review_member(p_club uuid, p_student uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from club_members where club_id = p_club and student_id = auth.uid() and role = 'LEADER' and status = 'ACTIVE') then
    raise exception 'FORBIDDEN: 단체 대표만 가입을 수락할 수 있어요';
  end if;
  if p_approve then
    update club_members set status = 'ACTIVE' where club_id = p_club and student_id = p_student;
    perform enqueue_notification(p_student, 'CLUB_JOIN',
      format('"%s" 가입이 수락됐어요.', (select name from clubs where id = p_club)),
      '/clubs/detail?id=' || p_club, null, null, 'club:approved:' || p_club || ':' || p_student);
  else
    delete from club_members where club_id = p_club and student_id = p_student and status = 'PENDING';
  end if;
end $$;

-- ── 소속으로 인정되는 건 ACTIVE 뿐 ──────────────────────────────────────────
create or replace function public.assign_maintainer(p_project uuid, p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o operations;
begin
  select * into o from operations where project_id = p_project;
  if o.project_id is null then raise exception 'NOT_FOUND: 운영 중인 프로젝트가 아니에요'; end if;
  if o.club_id is null then raise exception 'NO_CLUB: 단체가 맡은 프로젝트만 내부에서 담당자를 바꿀 수 있어요'; end if;
  if o.maintainer_id <> auth.uid()
     and not exists (select 1 from club_members where club_id = o.club_id and student_id = auth.uid() and role = 'LEADER' and status = 'ACTIVE') then
    raise exception 'FORBIDDEN: 현재 담당자나 단체 대표만 담당자를 바꿀 수 있어요';
  end if;
  if not exists (select 1 from club_members where club_id = o.club_id and student_id = p_student and status = 'ACTIVE') then
    raise exception 'NOT_MEMBER: 같은 단체 소속 학생에게만 넘길 수 있어요';
  end if;

  update maintainer_history set ended_on = current_date
   where project_id = p_project and student_id = o.maintainer_id and ended_on is null;
  update operations set maintainer_id = p_student, status = case when status = 'HANDOVER_OPEN' then 'OPERATING' else status end
   where project_id = p_project;
  insert into maintainer_history (project_id, student_id) values (p_project, p_student);

  perform enqueue_notification(p_student, 'HANDOVER_TAKEN',
    '단체에서 맡고 있는 서비스의 담당자가 되었어요. 인수인계서를 확인해 주세요.', '/projects/handover?id=' || p_project, null, null,
    'club:assign:' || p_project || ':' || p_student);
  perform enqueue_notification((select owner_id from projects where id = p_project), 'HANDOVER_TAKEN',
    '단체 내에서 담당 학생이 바뀌었어요.', '/projects/detail?id=' || p_project, null, null,
    'club:assign:owner:' || p_project || ':' || p_student);
end $$;

-- 단체 이름으로 지원하려면 그 단체의 ACTIVE 소속이어야 한다
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
  if new.club_id is not null and not exists (
      select 1 from club_members where club_id = new.club_id and student_id = new.student_id and status = 'ACTIVE') then
    raise exception 'NOT_MEMBER: 소속이 확정된 단체 이름으로만 지원할 수 있어요';
  end if;
  if p.compensation_type = 'PAID' and not coalesce(p.urgent, false) and p.handover_of_project is null
     and (select count(*) from tier_score_events where student_id = new.student_id and kind = 'PROJECT_VERIFIED') < 1 then
    raise exception 'PAID_NOT_ELIGIBLE: 유료 의뢰는 검증된 프로젝트가 1개 이상이어야 지원할 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists applications_check on public.applications;
create trigger applications_check before insert on public.applications
for each row execute function public.check_application();

grant execute on function public.review_club(uuid, boolean, text), public.review_member(uuid, uuid, boolean) to authenticated;
