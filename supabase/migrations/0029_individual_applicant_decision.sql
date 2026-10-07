-- 개인 공고에서 한 명을 선정하면 남은 대기 지원자를 자동 거절한다.
-- applications_notify_event(0013)가 각 미선정 학생에게 결과 알림을 생성한다.
create or replace function public.select_applicant(p_application uuid, p_question_snapshot jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare a applications; p posts; pr projects; r post_roles; v_domain text; v_mode text; v_found boolean;
begin
  select * into a from applications where id = p_application for update;
  if not found then raise exception 'NOT_FOUND: 지원서를 찾을 수 없어요'; end if;
  select * into p from posts where id = a.post_id for update;
  if p.author_id is distinct from auth.uid() then raise exception 'FORBIDDEN: 공고 작성자만 선정할 수 있어요'; end if;
  if a.status = 'rejected' then raise exception 'INVALID_STATE: 거절된 지원서예요'; end if;
  if p.is_team then
    select * into r from post_roles where id = a.role_id and post_id = p.id for update;
    if not found then raise exception 'INVALID_ROLE: 지원 역할을 찾을 수 없어요'; end if;
    if r.filled_count >= r.capacity then raise exception 'ROLE_FULL: 이 역할의 모집 인원이 이미 찼어요'; end if;
    v_domain := r.domain;
  else
    v_domain := coalesce(p.domain, 'GENERAL');
  end if;
  if p_question_snapshot is null or jsonb_typeof(p_question_snapshot -> 'questions') is distinct from 'array'
     or p_question_snapshot ->> 'domain' is distinct from v_domain then
    raise exception 'INVALID_INPUT: 질문 목록과 지원 역할의 분야가 맞지 않아요';
  end if;
  select * into pr from projects where post_id = p.id for update;
  v_found := found;
  if v_found and exists (select 1 from project_members where project_id = pr.id and student_id = a.student_id) then return pr.id; end if;
  v_mode := case when p.is_team then 'TEAM' else 'INDIVIDUAL' end;
  if not v_found then
    insert into projects (post_id, owner_id, domain, mode, status, question_snapshot)
      values (p.id, p.author_id, coalesce(p.domain, v_domain), v_mode, 'RECRUITING', p_question_snapshot) returning * into pr;
  end if;
  update projects set status = project_next_status(pr.status, 'SELECT', pr.mode) where id = pr.id returning * into pr;
  insert into project_members (project_id, student_id, role_label, role_id, domain, question_snapshot, application_id)
    values (pr.id, a.student_id, coalesce(r.label, domain_label(v_domain)), r.id, v_domain, p_question_snapshot, a.id);
  if p.is_team then
    update post_roles set filled_count = filled_count + 1 where id = r.id;
  else
    update posts set status = 'in_progress' where id = p.id;
  end if;
  update applications set status = 'accepted' where id = a.id;
  if not p.is_team then
    update applications set status = 'rejected'
      where post_id = p.id and id <> a.id and status = 'pending';
  end if;
  return pr.id;
end $$;
