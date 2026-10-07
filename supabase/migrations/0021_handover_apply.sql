-- 이어받기 공고는 유료여도 모든 학생이 지원할 수 있게 한다.
-- 평소 유료 공고는 검증된 프로젝트가 1개 이상인 학생만 지원할 수 있지만,
-- 이어받기는 "담당자가 빠진 서비스를 이어받을 사람"을 찾는 자리라 지원 문턱을 두면 프로젝트가 방치된다.
-- (누가 맡을지는 어차피 사장님이 지원자 중에서 고른다. 긴급 공고와 같은 이유의 예외다.)

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
  -- 긴급 공고와 이어받기 공고는 지원 자격 제한을 건너뛴다
  if p.compensation_type = 'PAID' and not coalesce(p.urgent, false) and p.handover_of_project is null
     and (select count(*) from tier_score_events where student_id = new.student_id and kind = 'PROJECT_VERIFIED') < 1 then
    raise exception 'PAID_NOT_ELIGIBLE: 유료 의뢰는 검증된 프로젝트가 1개 이상이어야 지원할 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists applications_check on public.applications;
create trigger applications_check before insert on public.applications
for each row execute function public.check_application();
