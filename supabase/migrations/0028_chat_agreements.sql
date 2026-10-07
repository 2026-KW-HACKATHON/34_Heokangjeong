create table public.chat_agreements (
  application_id uuid primary key references public.applications(id) on delete cascade,
  version integer not null check (version > 0),
  terms jsonb not null,
  student_confirmed_at timestamptz,
  owner_confirmed_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.chat_agreements enable row level security;
grant select on public.chat_agreements to authenticated;
create policy "Agreement parties read" on public.chat_agreements for select to authenticated using (
  exists(select 1 from applications a join posts p on p.id=a.post_id
    where a.id=application_id and auth.uid() in (a.student_id,p.author_id))
);

-- Serialize writes against the application row, including the first draft.
create function public.save_chat_agreement(p_application uuid, p_version integer, p_terms jsonb)
returns public.chat_agreements language plpgsql security definer set search_path=public as $$
declare a applications; owner uuid; previous chat_agreements; result chat_agreements; field text;
begin
  select * into a from applications where id=p_application for update;
  select author_id into owner from posts where id=a.post_id;
  if auth.uid() is null or a.id is null or auth.uid() not in (a.student_id,owner) then raise exception '당사자만 작성할 수 있어요'; end if;
  select * into previous from chat_agreements where application_id=p_application;
  if previous.finalized_at is not null then raise exception '이미 확정된 최종본이에요'; end if;
  if p_version is null or coalesce(previous.version,0)<>p_version then raise exception '상대방이 수정했어요. 최신 약속서를 다시 열어 주세요'; end if;
  if p_terms is null or jsonb_typeof(p_terms)<>'object' then raise exception '약속서 내용을 입력해 주세요'; end if;
  foreach field in array array['startDate','endDate','scope','deliverables','acceptance','coupon','handoff'] loop
    if jsonb_typeof(p_terms->field) is distinct from 'string' or length(trim(p_terms->>field))=0 or length(p_terms->>field)>3000 then raise exception '필수 항목을 3000자 이내로 입력해 주세요'; end if;
  end loop;
  if (p_terms->>'startDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_terms->>'endDate') !~ '^\d{4}-\d{2}-\d{2}$' or (p_terms->>'endDate')::date < (p_terms->>'startDate')::date then raise exception '작업 기간을 확인해 주세요'; end if;
  if jsonb_typeof(p_terms->'revisions') is distinct from 'number' or (p_terms->>'revisions') !~ '^(0|[1-9]|10)$' then raise exception '수정 횟수는 0~10회로 정해 주세요'; end if;
  if jsonb_typeof(p_terms->'exclusions') is distinct from 'string' or length(p_terms->>'exclusions')>3000 then raise exception '제외 범위를 3000자 이내로 입력해 주세요'; end if;
  insert into chat_agreements(application_id,version,terms) values(p_application,p_version+1,p_terms)
    on conflict(application_id) do update set version=p_version+1,terms=p_terms,student_confirmed_at=null,owner_confirmed_at=null,finalized_at=null,updated_at=now()
    returning * into result;
  return result;
end $$;

create function public.confirm_chat_agreement(p_application uuid,p_version integer)
returns public.chat_agreements language plpgsql security definer set search_path=public as $$
declare a applications; owner uuid; result chat_agreements;
begin
  select * into a from applications where id=p_application for update;
  select author_id into owner from posts where id=a.post_id;
  if auth.uid() is null or a.id is null or auth.uid() not in (a.student_id,owner) then raise exception '당사자만 확인할 수 있어요'; end if;
  select * into result from chat_agreements where application_id=p_application;
  if result.application_id is null or p_version is null or result.version<>p_version then raise exception '최신 약속서를 다시 열어 주세요'; end if;
  if result.finalized_at is not null then return result; end if;
  if auth.uid()=a.student_id then result.student_confirmed_at:=now(); else result.owner_confirmed_at:=now(); end if;
  if result.student_confirmed_at is not null and result.owner_confirmed_at is not null then result.finalized_at:=now(); end if;
  update chat_agreements set student_confirmed_at=result.student_confirmed_at,owner_confirmed_at=result.owner_confirmed_at,finalized_at=result.finalized_at,updated_at=now() where application_id=p_application returning * into result;
  return result;
end $$;
revoke all on function public.save_chat_agreement(uuid,integer,jsonb) from public;
revoke all on function public.confirm_chat_agreement(uuid,integer) from public;
grant execute on function public.save_chat_agreement(uuid,integer,jsonb) to authenticated;
grant execute on function public.confirm_chat_agreement(uuid,integer) to authenticated;
