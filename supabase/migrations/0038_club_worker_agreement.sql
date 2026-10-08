-- 0037 보완: 단체 대표가 추가한 참여 부원(add_club_worker)은 지원서가 없다.
-- 이들은 단체(대표 지원서)의 약속서를 따르므로, 프로젝트에 확정된 약속서가 하나라도 있으면 제출할 수 있다.
create or replace function public.require_finalized_agreement() returns trigger
language plpgsql security definer set search_path = public as $$
declare m project_members;
begin
  select * into m from project_members where project_id = new.project_id and student_id = new.submitted_by;
  if m.project_id is not null and exists (
    select 1 from project_members x join chat_agreements c on c.application_id = x.application_id
    where x.project_id = new.project_id and c.finalized_at is not null
      and (x.application_id = m.application_id or m.application_id is null)
  ) then
    return new;
  end if;
  raise exception 'AGREEMENT_REQUIRED: 약속서를 양쪽이 확정한 뒤에 제출할 수 있어요';
end $$;
