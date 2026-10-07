-- 유료 공고 지원 자격 제한을 없앤다.
-- 팀이 랭킹·등급 보상 체계를 걷어내면서 "검증된 프로젝트 1건 이상" 조건도 함께 삭제하기로 했다.
-- 지원은 누구나 할 수 있고, 누구를 뽑을지는 사장님이 지원자 중에서 고른다.
-- (보상은 평소엔 가게 쿠폰, 긴급 공고일 때만 현금 사례비)

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
      select 1 from club_members where club_id = new.club_id and student_id = new.student_id and status = 'ACTIVE') then
    raise exception 'NOT_MEMBER: 소속이 확정된 단체 이름으로만 지원할 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists applications_check on public.applications;
create trigger applications_check before insert on public.applications
for each row execute function public.check_application();
