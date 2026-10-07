-- 단체(동아리·학회·학생회 등) 단위 활동.
-- 로그인은 개인 학생 계정 그대로 두고, 프로필에 소속 단체를 단다.
--   · 지원할 때 "개인" 또는 "○○동아리 이름으로" 를 고른다
--   · 계속 운영되는 결과물을 단체가 맡으면, 담당자가 빠져도 같은 단체 안에서 바로 넘긴다
--     (단체 밖으로 넘길 때만 이어받기 공고가 올라간다)
-- 왜 단체 전용 로그인을 쓰지 않나: 비밀번호를 돌려 쓰게 되고, 졸업하면 계정이 꼬이고,
-- 누가 실제로 작업했는지 남지 않아 개인 포트폴리오가 비어 버린다.

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 2 and 40),
  kind text not null default 'OTHER' check (kind in ('CENTRAL', 'DEPARTMENT', 'COUNCIL', 'VOLUNTEER', 'OTHER')),
  kind_other text check (kind_other is null or length(kind_other) <= 20),   -- 기타일 때 직접 적는 유형 (예: 교내 방송국, 캡스톤 팀)
  description text not null default '',
  college text,                       -- 주로 활동하는 단과대학 (src/lib/colleges.ts 의 key)
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  role text not null default 'MEMBER' check (role in ('LEADER', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (club_id, student_id)
);
create index if not exists club_members_student_idx on public.club_members(student_id);

-- 공고: 사장님이 "단체에 맡기고 싶어요" 를 고를 수 있다 (계속 운영되는 결과물에 특히 권장)
alter table public.posts add column if not exists prefer_club boolean not null default false;
-- 지원: 어떤 단체 이름으로 지원했는가 (없으면 개인 지원)
alter table public.applications add column if not exists club_id uuid references public.clubs on delete set null;
-- 프로젝트·운영: 어느 단체가 맡고 있는가
alter table public.projects add column if not exists club_id uuid references public.clubs on delete set null;
alter table public.operations add column if not exists club_id uuid references public.clubs on delete set null;

-- ── 단체 만들기·가입 ────────────────────────────────────────────────────────
create or replace function public.create_club(p_name text, p_kind text, p_description text, p_college text default null, p_kind_other text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'FORBIDDEN: 학생만 단체를 만들 수 있어요';
  end if;
  insert into clubs (name, kind, kind_other, description, college, created_by)
    values (trim(p_name), coalesce(p_kind, 'OTHER'),
            case when coalesce(p_kind, 'OTHER') = 'OTHER' then nullif(trim(coalesce(p_kind_other, '')), '') end,
            coalesce(p_description, ''), p_college, auth.uid())
    returning id into c;
  insert into club_members (club_id, student_id, role) values (c, auth.uid(), 'LEADER');
  return c;
end $$;

create or replace function public.join_club(p_club uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'student') then
    raise exception 'FORBIDDEN: 학생만 단체에 가입할 수 있어요';
  end if;
  insert into club_members (club_id, student_id) values (p_club, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.leave_club(p_club uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 운영 중인 서비스를 맡고 있으면 먼저 담당자를 넘겨야 한다
  if exists (select 1 from operations where club_id = p_club and maintainer_id = auth.uid() and status in ('WARRANTY', 'OPERATING')) then
    raise exception 'HAS_DUTY: 맡고 있는 서비스의 담당자를 먼저 넘겨 주세요';
  end if;
  delete from club_members where club_id = p_club and student_id = auth.uid();
end $$;

-- ── 지원한 단체를 프로젝트·운영까지 이어 준다 ───────────────────────────────
create or replace function public.carry_club_to_project() returns trigger
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select club_id into c from applications where id = new.application_id;
  if c is not null then update projects set club_id = c where id = new.project_id and club_id is null; end if;
  return new;
end $$;

drop trigger if exists project_members_carry_club on public.project_members;
create trigger project_members_carry_club after insert on public.project_members
for each row execute function public.carry_club_to_project();

-- 완료 시 운영에도 단체를 기록한다 (0018 의 start_operations 에 club_id 추가)
create or replace function public.start_operations() returns trigger
language plpgsql security definer set search_path = public as $$
declare p posts; m uuid;
begin
  if new.status <> 'COMPLETED' or coalesce(old.status, '') = 'COMPLETED' then return new; end if;
  select * into p from posts where id = new.post_id;
  if not coalesce(p.ongoing, false) then return new; end if;

  select student_id into m from project_members where project_id = new.id order by joined_at limit 1;
  insert into operations (project_id, maintainer_id, club_id, warranty_request_until, warranty_defect_until)
  values (new.id, m, new.club_id, current_date + p.warranty_request_days, current_date + p.warranty_defect_days)
  on conflict (project_id) do nothing;
  if m is not null then
    insert into maintainer_history (project_id, student_id) values (new.id, m);
  end if;
  return new;
end $$;

-- ── 단체 안에서 담당자 넘기기 (사장님 승인 없이 가능) ────────────────────────
-- 단체가 맡은 서비스는 단체가 책임진다. 그래서 같은 단체 안에서는 바로 넘길 수 있고,
-- 단체 밖으로 넘길 때만 이어받기 공고(open_handover)가 올라간다.
create or replace function public.assign_maintainer(p_project uuid, p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o operations;
begin
  select * into o from operations where project_id = p_project;
  if o.project_id is null then raise exception 'NOT_FOUND: 운영 중인 프로젝트가 아니에요'; end if;
  if o.club_id is null then raise exception 'NO_CLUB: 단체가 맡은 프로젝트만 내부에서 담당자를 바꿀 수 있어요'; end if;
  if o.maintainer_id <> auth.uid()
     and not exists (select 1 from club_members where club_id = o.club_id and student_id = auth.uid() and role = 'LEADER') then
    raise exception 'FORBIDDEN: 현재 담당자나 단체 대표만 담당자를 바꿀 수 있어요';
  end if;
  if not exists (select 1 from club_members where club_id = o.club_id and student_id = p_student) then
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

-- ── 권한 ────────────────────────────────────────────────────────────────────
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;

drop policy if exists "단체는 로그인하면 누구나 본다" on public.clubs;
create policy "단체는 로그인하면 누구나 본다" on public.clubs for select to authenticated using (true);
drop policy if exists "단체 대표만 소개를 고친다" on public.clubs;
create policy "단체 대표만 소개를 고친다" on public.clubs for update to authenticated
  using (exists (select 1 from club_members m where m.club_id = clubs.id and m.student_id = auth.uid() and m.role = 'LEADER'));
drop policy if exists "단체 소속은 로그인하면 본다" on public.club_members;
create policy "단체 소속은 로그인하면 본다" on public.club_members for select to authenticated using (true);

grant select on public.clubs, public.club_members to authenticated;
grant update on public.clubs to authenticated;
grant execute on function public.create_club(text, text, text, text, text), public.join_club(uuid), public.leave_club(uuid),
  public.assign_maintainer(uuid, uuid) to authenticated;
