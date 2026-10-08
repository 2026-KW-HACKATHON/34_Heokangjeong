-- 끝난(완료·취소) 프로젝트의 확정 계약서는 바꿀 수 없다.
-- 수정 제안을 새로 걸거나, 걸린 제안을 수락해 내용이 바뀌는 것만 막는다 (거절·철회로 제안을 지우는 것은 허용).
create or replace function public.agreement_closed_project_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if ((new.proposed_terms is not null and new.proposed_terms is distinct from old.proposed_terms)
      or (old.finalized_at is not null and new.terms is distinct from old.terms))
     and exists (
       select 1 from project_members m join projects p on p.id = m.project_id
       where m.application_id = new.application_id and p.status in ('COMPLETED', 'CANCELLED'))
  then
    raise exception 'PROJECT_CLOSED: 끝난 프로젝트의 계약서는 수정할 수 없어요';
  end if;
  return new;
end $$;
drop trigger if exists agreement_closed_project_guard on public.chat_agreements;
create trigger agreement_closed_project_guard before update on public.chat_agreements
  for each row execute function public.agreement_closed_project_guard();
