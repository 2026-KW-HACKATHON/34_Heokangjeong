-- 공고마다 "누가 지원할 수 있나" 를 사장님이 고른다.
--   ANY        개인도 단체도 지원 가능 (기본)
--   INDIVIDUAL 개인만
--   CLUB       단체(동아리·학회 등)만 — 오래 운영해야 하는 결과물에 쓴다
-- 한 학생이 여러 단체에 소속될 수 있고(club_members 는 학생+단체 조합이 열쇠), 지원할 때 어느 이름으로 낼지 고른다.

alter table public.posts
  add column if not exists applicant_scope text not null default 'ANY'
    check (applicant_scope in ('ANY', 'INDIVIDUAL', 'CLUB'));

-- 전에 '단체에 맡기고 싶어요' 로 올린 공고는 둘 다 받는 상태로 둔다 (이미 올라간 공고의 조건을 좁히지 않는다)
update public.posts set applicant_scope = 'ANY' where prefer_club and applicant_scope = 'ANY';

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

  -- 지원 대상
  if p.applicant_scope = 'CLUB' and new.club_id is null then
    raise exception 'CLUB_ONLY: 단체 이름으로만 지원할 수 있는 공고예요';
  end if;
  if p.applicant_scope = 'INDIVIDUAL' and new.club_id is not null then
    raise exception 'INDIVIDUAL_ONLY: 개인으로만 지원할 수 있는 공고예요';
  end if;
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
