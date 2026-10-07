-- Demo listing policy: higher minimum tiers require a higher cash reward.
alter table public.posts add column minimum_tier text not null default 'SEED'
  check (minimum_tier in ('SEED', 'TRUST', 'RECOMMENDED'));
alter table public.posts add constraint posts_tier_reward_floor check (
  minimum_tier = 'SEED' or (
    compensation_type = 'PAID' and paid_amount is not null and
    paid_amount >= case minimum_tier when 'TRUST' then 30000 else 50000 end
  )
);

create function public.student_application_tier(p_student uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare current_position integer; client_delta numeric; peer_delta numeric; temperature numeric;
begin
  if not exists (select 1 from profiles where id = p_student and role = 'student') then return null; end if;
  select current_rank into current_position from compute_individual_rankings() where student_id = p_student;
  if current_position <= 5 then return 'RECOMMENDED'; end if;
  select coalesce(sum(((r.deadline + r.communication + r.handoff)::numeric / 3 - 3) * 0.8), 0)
    into client_delta from client_reviews r where exists
    (select 1 from tier_score_events e where e.project_id = r.project_id and e.student_id = p_student);
  select coalesce(sum((p.average_score - 3) * 0.8), 0) into peer_delta from (
    select avg((communication + collaboration + responsibility)::numeric / 3) average_score
    from team_peer_reviews where reviewee_id = p_student group by project_id
  ) p;
  temperature := round(greatest(30::numeric, least(99::numeric, 36.5 + client_delta + peer_delta)), 1);
  return case when temperature >= 50 then 'RECOMMENDED' when temperature >= 40 then 'TRUST' else 'SEED' end;
end $$;
revoke all on function public.student_application_tier(uuid) from public;

create function public.check_application_minimum_tier() returns trigger
language plpgsql security definer set search_path = public as $$
declare required text; actual text; compensation text;
begin
  select minimum_tier, compensation_type into required, compensation from posts where id = new.post_id;
  actual := student_application_tier(new.student_id);
  if actual is null then raise exception 'FORBIDDEN: 학생만 지원할 수 있어요'; end if;
  if required = 'RECOMMENDED' and actual <> 'RECOMMENDED'
    or required = 'TRUST' and actual = 'SEED' then
    raise exception 'TIER_NOT_ELIGIBLE: 공고의 최소 지원 등급에 미달합니다';
  end if;
  if compensation = 'PAID' and (select count(*) from tier_score_events where student_id = new.student_id and kind = 'PROJECT_VERIFIED') < 1 then
    raise exception 'PAID_NOT_ELIGIBLE: 유료 의뢰는 검증된 프로젝트가 1개 이상이어야 지원할 수 있어요';
  end if;
  return new;
end $$;
revoke all on function public.check_application_minimum_tier() from public;
create trigger applications_minimum_tier before insert or update of post_id, student_id on public.applications
  for each row execute function public.check_application_minimum_tier();
