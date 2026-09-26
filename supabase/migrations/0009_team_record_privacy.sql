-- Enforce role-specific questions and keep in-progress personal records private between teammates.
create or replace function public.can_see_personal_record(p_project uuid, p_author uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() = p_author
    or public.is_project_owner(p_project)
    or public.is_project_completed(p_project)
$$;

drop policy if exists "답변은 당사자만 본다" on public.project_answers;
create policy "답변은 작성자와 의뢰인만 본다" on public.project_answers for select to authenticated
  using (public.can_see_personal_record(project_id, author_id));

drop policy if exists "활동 기록은 당사자만 본다" on public.activity_logs;
create policy "활동 기록은 작성자와 의뢰인만 본다" on public.activity_logs for select to authenticated
  using (public.can_see_personal_record(project_id, author_id));

drop policy if exists "증빙은 당사자 또는 완료 후 공개" on public.evidence;
create policy "증빙은 작성자와 의뢰인 또는 완료 후 공개" on public.evidence for select to authenticated
  using (public.can_see_personal_record(project_id, author_id));

drop policy if exists "성과는 당사자 또는 완료 후 공개" on public.outcomes;
create policy "성과는 작성자와 의뢰인 또는 완료 후 공개" on public.outcomes for select to authenticated
  using (public.can_see_personal_record(project_id, author_id));

create or replace function public.check_member_question() returns trigger
language plpgsql security definer set search_path = public as $$
declare snap jsonb; q jsonb; parent_id text;
begin
  select coalesce(m.question_snapshot, p.question_snapshot) into snap
  from project_members m join projects p on p.id = m.project_id
  where m.project_id = new.project_id and m.student_id = new.author_id;
  if snap is null then raise exception 'FORBIDDEN: 선정된 팀원만 답변할 수 있어요'; end if;
  parent_id := case when new.origin = 'SCHEMA' then new.question_id else new.parent_question_id end;
  select value into q from jsonb_array_elements(snap -> 'questions') where value ->> 'id' = parent_id;
  if q is null then raise exception 'INVALID_QUESTION: 내 역할에 해당하는 질문만 저장할 수 있어요'; end if;
  if new.field is distinct from q ->> 'field' or new.stage is distinct from q ->> 'stage' then
    raise exception 'INVALID_QUESTION: 질문의 분야 정보가 올바르지 않아요';
  end if;
  if new.origin <> 'SCHEMA' and new.question_id not like parent_id || ':fu%' then
    raise exception 'INVALID_QUESTION: 후속 질문 ID가 올바르지 않아요';
  end if;
  return new;
end $$;
drop trigger if exists project_answers_member_question on public.project_answers;
create trigger project_answers_member_question before insert or update on public.project_answers
for each row execute function public.check_member_question();
