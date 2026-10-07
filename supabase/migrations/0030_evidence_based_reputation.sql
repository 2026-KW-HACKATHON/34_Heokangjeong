-- 증빙 기반 평판 시스템: 원점수는 보존하고 평판 반영 상태와 근거를 별도로 기록한다.
alter table public.client_reviews add column if not exists deliverable_quality int check (deliverable_quality between 1 and 5);
update public.client_reviews set deliverable_quality = satisfaction where deliverable_quality is null;
alter table public.client_reviews alter column deliverable_quality set not null;
alter table public.client_reviews add column if not exists status text not null default 'NORMAL' check (status in ('NORMAL','FLAGGED','DISPUTED','UNDER_REVIEW','VALID','PARTIALLY_VALID','INVALID'));
alter table public.client_reviews add column if not exists reviewer_reliability numeric not null default 1 check (reviewer_reliability between 0.5 and 1.2);
alter table public.client_reviews add column if not exists evidence_consistency numeric not null default 1 check (evidence_consistency between 0.3 and 1);
alter table public.client_reviews add column if not exists adjusted_rating numeric not null default 3 check (adjusted_rating between 1 and 5);
alter table public.client_reviews add column if not exists anomaly_reasons text[] not null default '{}';
alter table public.client_reviews add column if not exists policy_version text not null default '2026-10-evidence-v1';

create table if not exists public.review_disputes (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
  student_id uuid not null references public.profiles on delete cascade, reason text not null check (length(trim(reason)) between 10 and 1000),
  status text not null default 'DISPUTED' check (status in ('DISPUTED','UNDER_REVIEW','VALID','PARTIALLY_VALID','INVALID')),
  created_at timestamptz not null default now(), resolved_at timestamptz, unique(project_id, student_id)
);
create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles on delete cascade,
  project_id uuid not null references public.projects on delete cascade, previous_score numeric, new_score numeric, delta numeric,
  reason text not null, policy_version text not null, created_at timestamptz not null default now()
);
alter table public.review_disputes enable row level security;
alter table public.reputation_events enable row level security;
create policy "이의제기는 학생 본인 조회" on public.review_disputes for select to authenticated using (student_id = auth.uid());
create policy "평판 변경은 학생 본인 조회" on public.reputation_events for select to authenticated using (student_id = auth.uid());
grant select on public.review_disputes, public.reputation_events to authenticated;

create or replace function public.assess_client_review() returns trigger language plpgsql security definer set search_path = public as $$
declare v client_verifications; avg_given numeric; total_given int; positive_facts int; consistency numeric; reliability numeric; reasons text[] := '{}'; normalized numeric; deadline_met boolean; expected_s int; expected_d int; expected_h int; expected_q int;
begin
  select * into v from client_verifications where project_id = new.project_id;
  select case when p.deadline is null then null else current_date <= p.deadline end into deadline_met from projects pr join posts p on p.id=pr.post_id where pr.id=new.project_id;
  select avg((satisfaction+deadline+communication+handoff+deliverable_quality)::numeric/5), count(*) into avg_given, total_given from client_reviews where reviewer_id = new.reviewer_id;
  reliability := greatest(0.5, least(1.2, 1 + (total_given::numeric/(total_given+5)) * (0.2 - abs(coalesce(avg_given,4.2)-4.2)*0.22)));
  positive_facts := (v.deliverable_received::int + v.completion_criteria_met::int + v.actually_used::int + 2);
  expected_s := case when v.completion_criteria_met then 5 else 1 end;
  expected_d := case when deadline_met is null then new.deadline when deadline_met then 5 else 1 end;
  expected_h := case when v.deliverable_received then 5 else 1 end;
  expected_q := case when v.completion_criteria_met and v.deliverable_received then 5 when v.deliverable_received then 3 else 1 end;
  consistency := greatest(0.3, least(1, 1 - ((abs(new.satisfaction-expected_s)+abs(new.deadline-expected_d)+abs(new.handoff-expected_h)+abs(new.deliverable_quality-expected_q))::numeric/16)*0.7));
  normalized := (new.satisfaction+new.deadline+new.communication+new.handoff+new.deliverable_quality)::numeric/5;
  if new.satisfaction <= 2 and (new.deadline+new.communication+new.handoff+new.deliverable_quality)::numeric/4 >= 4.5 then reasons := array_append(reasons, '평가 항목 간 점수 불일치'); end if;
  if normalized <= 2 and positive_facts >= 5 then reasons := array_append(reasons, '검증된 프로젝트 기록과 낮은 평가가 불일치'); end if;
  if reliability <= 0.65 then reasons := array_append(reasons, '평가자의 반복적인 극단 평가 패턴'); end if;
  if consistency <= 0.5 then reasons := array_append(reasons, '프로젝트 증빙과 평가가 불일치'); end if;
  new.reviewer_reliability := round(reliability,2); new.evidence_consistency := round(consistency,2);
  new.adjusted_rating := round(greatest(1::numeric, least(5::numeric, 4.2 + (normalized-4.2)*reliability*consistency)),1);
  new.anomaly_reasons := reasons; new.status := case when cardinality(reasons)>0 then 'FLAGGED' else 'NORMAL' end; new.policy_version := '2026-10-evidence-v1';
  return new;
end $$;
drop trigger if exists assess_client_review_before_write on public.client_reviews;
create trigger assess_client_review_before_write before insert on public.client_reviews for each row execute function public.assess_client_review();

create or replace function public.approve_version(p_version uuid, p_claims jsonb, p_review jsonb, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare r record; p posts; m record; v_used boolean; v_had boolean; s int; d int; c int; h int; q int;
begin
  select * into r from lock_reviewable(p_version);
  if coalesce((p_claims ->> 'workPerformed')::boolean, false) is not true then
    raise exception 'INVALID_INPUT: 학생이 실제로 작업했음을 확인해야 승인할 수 있어요';
  end if;
  s := (p_review ->> 'satisfaction')::int; d := (p_review ->> 'deadline')::int; c := (p_review ->> 'communication')::int; h := (p_review ->> 'handoff')::int; q := (p_review ->> 'deliverableQuality')::int;
  if s is null or d is null or c is null or h is null or q is null or least(s, d, c, h, q) < 1 or greatest(s, d, c, h, q) > 5 then
    raise exception 'INVALID_INPUT: 평가는 1~5 로 골라 주세요';
  end if;
  v_used := coalesce((p_claims ->> 'actuallyUsed')::boolean, false);
  select * into p from posts where id = (r.pr).post_id;

  update submission_versions set status = 'APPROVED', reviewed_at = now(), reviewed_by = auth.uid() where id = p_version;
  update projects set status = project_next_status((r.pr).status, 'APPROVE', (r.pr).mode), approved_version_id = p_version, completed_at = now() where id = (r.pr).id;
  insert into client_verifications (project_id, submission_version_id, verifier_id, work_performed, role_confirmed, deliverable_received, completion_criteria_met, actually_used, note)
    values ((r.pr).id, p_version, auth.uid(), true, coalesce((p_claims ->> 'roleConfirmed')::boolean, false), coalesce((p_claims ->> 'deliverableReceived')::boolean, false),
            coalesce((p_claims ->> 'completionCriteriaMet')::boolean, false), v_used, left(coalesce(p_note, ''), 1000));
  insert into client_reviews (project_id, reviewer_id, satisfaction, deadline, communication, handoff, deliverable_quality, comment)
    values ((r.pr).id, auth.uid(), s, d, c, h, q, left(coalesce(p_review ->> 'comment', ''), 1000));
  update posts set status = 'done' where id = p.id;

  for m in select * from project_members where project_id = (r.pr).id loop
    v_had := exists (select 1 from tier_score_events where student_id = m.student_id and kind = 'PROJECT_VERIFIED');
    insert into tier_score_events (student_id, project_id, kind, points) values (m.student_id, (r.pr).id, 'PROJECT_VERIFIED', 10 + p.difficulty * 3) on conflict do nothing;
    if v_used then
      insert into tier_score_events (student_id, project_id, kind, points) values (m.student_id, (r.pr).id, 'CLIENT_USED', 5) on conflict do nothing;
      insert into badges (student_id, code, label, project_id) values (m.student_id, 'USED_IN_FIELD', '현장에서 쓰인 결과물', (r.pr).id) on conflict do nothing;
    end if;
    if not v_had then
      insert into badges (student_id, code, label, project_id) values (m.student_id, 'FIRST_VERIFIED', '첫 검증 프로젝트', (r.pr).id) on conflict do nothing;
    end if;
    insert into badges (student_id, code, label, project_id) values (m.student_id, 'DOMAIN_' || (r.pr).domain, domain_label((r.pr).domain) || ' 검증 경험', (r.pr).id) on conflict do nothing;
    -- 예전 화면(랭킹·포트폴리오 카드)이 읽는 기록
    insert into reviews (post_id, student_id, rating, comment, verified) values (p.id, m.student_id, s, left(coalesce(p_review ->> 'comment', ''), 1000), true) on conflict do nothing;
    if not exists (select 1 from portfolio_cards where post_id = p.id and student_id = m.student_id) then
      insert into portfolio_cards (student_id, post_id, title, role_label, tasks, duration_days, rating, verified) values (m.student_id, p.id, p.title, m.role_label, '{}', p.duration_days, s, true);
    end if;
  end loop;
end $$;
create or replace function public.dispute_client_review(p_project uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from project_members where project_id=p_project and student_id=auth.uid()) then raise exception 'FORBIDDEN: 참여 학생만 이의를 제기할 수 있어요'; end if;
  if length(trim(p_reason)) < 10 then raise exception 'INVALID_INPUT: 이의제기 사유를 10자 이상 적어 주세요'; end if;
  insert into review_disputes(project_id,student_id,reason) values (p_project,auth.uid(),left(trim(p_reason),1000))
    on conflict(project_id,student_id) do update set reason=excluded.reason,status='DISPUTED',created_at=now(),resolved_at=null;
  update client_reviews set status='DISPUTED' where project_id=p_project;
  insert into reputation_events(student_id,project_id,reason,policy_version) values(auth.uid(),p_project,'학생 이의제기로 평가 반영 보류','2026-10-evidence-v1');
end $$;
revoke all on function public.dispute_client_review(uuid,text) from public;
grant execute on function public.dispute_client_review(uuid,text) to authenticated;

create or replace function public.log_reputation_review() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select student_id from project_members where project_id=new.project_id loop
    insert into reputation_events(student_id,project_id,new_score,reason,policy_version)
    values(m.student_id,new.project_id,case when new.status in ('NORMAL','VALID','PARTIALLY_VALID') then new.adjusted_rating*20 else null end,
      case when new.status='FLAGGED' then '이상 평가 감지로 평판 반영 보류' else '검증된 프로젝트 평가 반영' end,new.policy_version);
  end loop;
  return new;
end $$;
drop trigger if exists reputation_review_audit on public.client_reviews;
create trigger reputation_review_audit after insert on public.client_reviews for each row execute function public.log_reputation_review();
