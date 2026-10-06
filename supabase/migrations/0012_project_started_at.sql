-- 모집/선발 시각과 실제 활동 시작 시각을 구분한다.
alter table public.projects add column if not exists started_at timestamptz;

-- 기존 진행 프로젝트는 정확한 시작 이력이 없으므로 프로젝트 생성 시각을 안전한 대체값으로 사용한다.
update public.projects
set started_at = created_at
where started_at is null and status <> 'RECRUITING';

create or replace function public.set_project_started_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'IN_PROGRESS' and (tg_op = 'INSERT' or old.status is distinct from 'IN_PROGRESS') and new.started_at is null then
    new.started_at := now();
  end if;
  return new;
end $$;

drop trigger if exists projects_set_started_at on public.projects;
create trigger projects_set_started_at
before insert or update of status on public.projects
for each row execute function public.set_project_started_at();

