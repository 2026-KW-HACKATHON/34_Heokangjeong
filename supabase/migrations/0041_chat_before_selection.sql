-- 지원 직후 대화 허용. 당사자 전용 RLS와 계약서 선정 조건은 유지한다.
create or replace function public.require_shortlist_for_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from applications where id = new.application_id and status in ('pending', 'accepted')) then
    raise exception 'APPLICATION_CLOSED: 종료된 지원은 메시지를 보낼 수 없어요';
  end if;
  return new;
end $$;
