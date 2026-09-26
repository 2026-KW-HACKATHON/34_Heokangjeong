-- Personal team records, leader-only submission, and per-member verification.
create table public.member_verifications (
  project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  verifier_id uuid not null references public.profiles on delete cascade,
  verified boolean not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (project_id, student_id)
);

-- Previously completed teams awarded every member, so preserve that behavior as verified.
insert into public.member_verifications(project_id, student_id, verifier_id, verified, note, created_at)
select m.project_id, m.student_id, v.verifier_id, true, '기존 완료 프로젝트 참여 확인', v.created_at
from public.project_members m
join public.projects p on p.id = m.project_id and p.mode = 'TEAM' and p.status = 'COMPLETED'
join public.client_verifications v on v.project_id = m.project_id
on conflict do nothing;

alter table public.member_verifications enable row level security;
create policy "project parties see member verification" on public.member_verifications for select to authenticated
  using (public.can_see_project(project_id));
grant select on public.member_verifications to authenticated;

create or replace function public.check_team_submitter() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr projects;
begin
  select * into pr from projects where id = new.project_id;
  if pr.mode = 'TEAM' and not exists (
    select 1 from project_members m where m.project_id = pr.id and m.student_id = auth.uid() and m.is_lead
  ) then raise exception 'LEADER_ONLY: 팀장만 팀의 최종 결과물을 제출할 수 있어요'; end if;
  return new;
end $$;
drop trigger if exists submission_versions_team_leader on public.submission_versions;
create trigger submission_versions_team_leader before insert on public.submission_versions
for each row execute function public.check_team_submitter();

create or replace function public.approve_team_version(
  p_version uuid, p_claims jsonb, p_review jsonb, p_note text, p_verified_members uuid[]
) returns void
language plpgsql security definer set search_path = public as $$
declare pr projects; m project_members;
begin
  select p.* into pr from projects p join submission_versions v on v.project_id = p.id where v.id = p_version;
  if not found then raise exception 'NOT_FOUND: 제출 버전을 찾을 수 없어요'; end if;
  if pr.mode <> 'TEAM' then raise exception 'INVALID_STATE: 팀 프로젝트가 아니에요'; end if;
  if coalesce(array_length(p_verified_members, 1), 0) = 0 then
    raise exception 'INVALID_INPUT: 실제 참여를 확인한 팀원을 한 명 이상 선택해 주세요';
  end if;
  if exists (select 1 from unnest(p_verified_members) x where not exists (
    select 1 from project_members pm where pm.project_id = pr.id and pm.student_id = x
  )) then raise exception 'INVALID_INPUT: 프로젝트 팀원이 아닌 사용자가 포함되어 있어요'; end if;

  perform public.approve_version(p_version, p_claims, p_review, p_note);

  for m in select * from project_members where project_id = pr.id loop
    insert into member_verifications(project_id, student_id, verifier_id, verified, note)
      values(pr.id, m.student_id, auth.uid(), m.student_id = any(p_verified_members),
             case when m.student_id = any(p_verified_members) then '실제 참여 확인' else '참여 확인 안 됨' end)
      on conflict(project_id, student_id) do update set verified=excluded.verified, note=excluded.note, verifier_id=excluded.verifier_id, created_at=now();
    if not (m.student_id = any(p_verified_members)) then
      delete from tier_score_events where project_id = pr.id and student_id = m.student_id;
      delete from badges where project_id = pr.id and student_id = m.student_id;
      delete from reviews where post_id = pr.post_id and student_id = m.student_id;
      delete from portfolio_cards where post_id = pr.post_id and student_id = m.student_id;
    else
      delete from badges where project_id = pr.id and student_id = m.student_id and code like 'DOMAIN_%';
      insert into badges(student_id, code, label, project_id)
        values(m.student_id, 'DOMAIN_' || coalesce(m.domain, pr.domain), domain_label(coalesce(m.domain, pr.domain)) || ' 검증 경험', pr.id)
        on conflict do nothing;
    end if;
  end loop;
end $$;

revoke all on function public.approve_team_version(uuid, jsonb, jsonb, text, uuid[]) from public;
grant execute on function public.approve_team_version(uuid, jsonb, jsonb, text, uuid[]) to authenticated;

create or replace function public.check_team_portfolio_verification() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr projects;
begin
  select * into pr from projects where id = new.project_id;
  if pr.mode = 'TEAM' and not exists (
    select 1 from member_verifications mv where mv.project_id = new.project_id and mv.student_id = new.student_id and mv.verified
  ) then raise exception 'NOT_VERIFIED: 의뢰인이 실제 참여를 확인한 팀원만 포트폴리오를 만들 수 있어요'; end if;
  return new;
end $$;
drop trigger if exists portfolio_snapshots_team_verification on public.portfolio_snapshots;
create trigger portfolio_snapshots_team_verification before insert on public.portfolio_snapshots
for each row execute function public.check_team_portfolio_verification();
