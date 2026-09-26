-- Role-based team recruiting and explicit team start.
create table public.post_roles (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  label text not null check (length(trim(label)) between 1 and 60),
  category text not null,
  domain text not null check (domain in ('DESIGN', 'MARKETING', 'DEVELOPMENT', 'GENERAL')),
  capacity int not null check (capacity between 1 and 20),
  filled_count int not null default 0 check (filled_count >= 0 and filled_count <= capacity),
  sort_order int not null default 0
);
create index post_roles_post_idx on public.post_roles(post_id, sort_order);

-- Preserve team roles from posts created before roles were normalized.
insert into public.post_roles (post_id, label, category, domain, capacity, sort_order)
select p.id,
       coalesce(nullif(trim(slot.value ->> 'label'), ''), slot.value ->> 'category'),
       slot.value ->> 'category',
       coalesce(p.domain, case slot.value ->> 'category'
         when '디자인' then 'DESIGN'
         when 'SNS홍보' then 'MARKETING'
         when '웹/앱' then 'DEVELOPMENT'
         else 'GENERAL' end),
       greatest(1, coalesce((slot.value ->> 'count')::int, 1)),
       slot.ordinality - 1
from public.posts p
cross join lateral jsonb_array_elements(coalesce(p.team_slots, '[]'::jsonb)) with ordinality as slot(value, ordinality)
where p.is_team;

alter table public.applications add column role_id uuid references public.post_roles on delete restrict;
alter table public.project_members
  add column role_id uuid references public.post_roles on delete restrict,
  add column domain text check (domain in ('DESIGN', 'MARKETING', 'DEVELOPMENT', 'GENERAL')),
  add column question_snapshot jsonb,
  add column is_lead boolean not null default false,
  add column ready_at timestamptz;

update public.project_members m set
  domain = p.domain,
  question_snapshot = p.question_snapshot
from public.projects p where p.id = m.project_id;

alter table public.post_roles enable row level security;
create policy "roles are visible" on public.post_roles for select to authenticated using (true);
create policy "post owner creates roles" on public.post_roles for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "post owner updates roles" on public.post_roles for update to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "post owner deletes roles" on public.post_roles for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
grant select, insert, update, delete on public.post_roles to authenticated;

create or replace function public.project_next_status(cur text, ev text, mode text) returns text
language plpgsql immutable as $$
declare nxt text;
begin
  nxt := case
    when cur = 'RECRUITING' and ev = 'SELECT' and mode = 'TEAM' then 'RECRUITING'
    when cur = 'RECRUITING' and ev = 'SELECT' then 'IN_PROGRESS'
    when cur = 'RECRUITING' and ev = 'START' and mode = 'TEAM' then 'IN_PROGRESS'
    when cur = 'IN_PROGRESS' and ev = 'SUBMIT' then 'REVIEW_PENDING'
    when cur = 'REVIEW_PENDING' and ev = 'REQUEST_REVISION' then 'REVISION_REQUESTED'
    when cur = 'REVIEW_PENDING' and ev = 'APPROVE' then 'COMPLETED'
    when cur = 'REVISION_REQUESTED' and ev = 'RESUBMIT' then 'REVIEW_PENDING'
  end;
  if nxt is null then raise exception 'INVALID_TRANSITION: 지금 상태에서 할 수 없는 작업이에요'; end if;
  return nxt;
end $$;

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
  if p.compensation_type = 'PAID' and (select count(*) from tier_score_events where student_id = new.student_id and kind = 'PROJECT_VERIFIED') < 1 then
    raise exception 'PAID_NOT_ELIGIBLE: 유료 의뢰는 검증된 프로젝트가 1개 이상이어야 지원할 수 있어요';
  end if;
  return new;
end $$;

create or replace function public.select_applicant(p_application uuid, p_question_snapshot jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare a applications; p posts; pr projects; r post_roles; v_domain text; v_mode text; v_found boolean;
begin
  select * into a from applications where id = p_application for update;
  if not found then raise exception 'NOT_FOUND: 지원서를 찾을 수 없어요'; end if;
  select * into p from posts where id = a.post_id for update;
  if p.author_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 공고 작성자만 선정할 수 있어요'; end if;
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
  if p.is_team then update post_roles set filled_count = filled_count + 1 where id = r.id;
  else update posts set status = 'in_progress' where id = p.id; end if;
  update applications set status = 'accepted' where id = a.id;
  return pr.id;
end $$;

create or replace function public.start_team_project(p_project uuid, p_leader uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr projects; missing text;
begin
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'NOT_FOUND: 프로젝트를 찾을 수 없어요'; end if;
  if pr.owner_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 공고 작성자만 팀을 시작할 수 있어요'; end if;
  if pr.mode <> 'TEAM' then raise exception 'INVALID_STATE: 팀 프로젝트가 아니에요'; end if;
  select string_agg(label, ', ') into missing from post_roles where post_id = pr.post_id and filled_count < capacity;
  if missing is not null then raise exception 'TEAM_INCOMPLETE: 아직 인원이 부족한 역할이 있어요: %', missing; end if;
  if not exists (select 1 from project_members where project_id = pr.id and student_id = p_leader) then
    raise exception 'INVALID_LEADER: 선발된 팀원 중에서 팀장을 선택해 주세요';
  end if;
  update project_members set is_lead = (student_id = p_leader) where project_id = pr.id;
  update projects set status = project_next_status(status, 'START', mode) where id = pr.id;
  update posts set status = 'in_progress' where id = pr.post_id;
  return pr.id;
end $$;

revoke all on function public.start_team_project(uuid, uuid) from public;
grant execute on function public.start_team_project(uuid, uuid) to authenticated;
