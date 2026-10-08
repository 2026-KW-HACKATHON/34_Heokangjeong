-- 공개 포트폴리오 페이지: 프로필 피드에서 누른 작업을 소유자가 보는 페이지 그대로(편집만 빼고) 보여 준다.
-- 편집본·검증·평가·증빙 테이블의 권한(RLS)은 그대로 둔다. 대신 "공개 중인 작업 한 건"만 통째로 돌려주는 함수 하나를 연다.
--   · 학생이 그 작업을 피드에 공개했고(portfolio_publications, source_kind = 'project') 숨기지 않았을 때만 (본인은 숨김이어도 볼 수 있다)
--   · 화면에 그리는 데 필요한 칸만 돌려준다 (평판 계산용 내부 값, 의뢰인 id 등은 빼고)
--   · 증빙은 학생 본인 것 + 의뢰인이 올린 것 + 승인된 제출본에 들어간 것 (포트폴리오 스냅샷과 같은 기준)
-- 증빙 파일은 원래 공개 저장소이고 올릴 때 공개 동의를 받는다. 의뢰인 평가 원문은 "포트폴리오에 인용된다"는 안내 뒤에 쓴다.

create or replace function public.get_public_portfolio(p_project uuid, p_student uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pub portfolio_publications;
  pr projects;
  e portfolio_edits;
  approved_ids uuid[];
begin
  select * into pub from portfolio_publications
  where student_id = p_student and source_kind = 'project' and source_id = p_project::text;
  if not found or not (pub.is_visible or p_student = auth.uid()) then return null; end if;

  select * into e from portfolio_edits where project_id = p_project and student_id = p_student order by version desc limit 1;
  if not found then return null; end if;
  select * into pr from projects where id = p_project;
  select coalesce(evidence_ids, '{}') into approved_ids from submission_versions where id = pr.approved_version_id;

  return jsonb_build_object(
    'edit', jsonb_build_object('id', e.id, 'draft_id', e.draft_id, 'project_id', e.project_id, 'student_id', e.student_id, 'version', e.version, 'content', e.content, 'created_at', e.created_at),
    'project', jsonb_build_object('id', pr.id, 'domain', pr.domain, 'created_at', pr.created_at, 'started_at', pr.started_at, 'completed_at', pr.completed_at),
    'member', (select jsonb_build_object('role_label', m.role_label, 'domain', m.domain) from project_members m where m.project_id = p_project and m.student_id = p_student),
    'role_answer', (select jsonb_build_object('value', a.value, 'choices', a.choices) from project_answers a
                    where a.project_id = p_project and a.author_id = p_student and a.field = 'role' and a.origin = 'SCHEMA' and a.status = 'ANSWERED' limit 1),
    'approved_version', (select v.version from submission_versions v where v.id = pr.approved_version_id),
    'verification', (select jsonb_build_object('project_id', c.project_id, 'submission_version_id', c.submission_version_id, 'note', c.note, 'created_at', c.created_at,
                       'work_performed', c.work_performed, 'role_confirmed', c.role_confirmed, 'deliverable_received', c.deliverable_received,
                       'completion_criteria_met', c.completion_criteria_met, 'actually_used', c.actually_used)
                     from client_verifications c where c.project_id = p_project),
    'review', (select jsonb_build_object('project_id', r.project_id, 'satisfaction', r.satisfaction, 'deadline', r.deadline, 'communication', r.communication,
                 'handoff', r.handoff, 'comment', r.comment, 'created_at', r.created_at)
               from client_reviews r where r.project_id = p_project),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'project_id', x.project_id, 'author_id', x.author_id, 'type', x.type, 'description', x.description,
                   'url', x.url, 'file_name', x.file_name, 'mime_type', x.mime_type, 'linked_field', x.linked_field, 'linked_claim', x.linked_claim, 'source', x.source, 'created_at', x.created_at)
                   order by x.created_at)
                 from evidence x where x.project_id = p_project and (x.author_id = p_student or x.source = 'CLIENT' or x.id = any(approved_ids))), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from outcomes o where o.project_id = p_project and o.author_id = p_student), '[]'::jsonb),
    'client', (select jsonb_build_object('name', p.name, 'role', p.role, 'kind', p.kind) from profiles p where p.id = pr.owner_id)
  );
end $$;

revoke all on function public.get_public_portfolio(uuid, uuid) from public;
grant execute on function public.get_public_portfolio(uuid, uuid) to authenticated;
