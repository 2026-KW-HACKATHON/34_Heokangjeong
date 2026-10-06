-- 이어받기도 다른 공고와 똑같이 모집한다.
--   인계 요청 → '이어받기 공고'가 자동으로 생성 → 홈 피드·지도에 노출 → 학생이 지원 → 사장님이 선정
--   → 선정되는 순간 담당자가 바뀐다 (기존 take_over 즉시 교체는 사장님 동의가 없어서 폐기)

alter table public.posts
  add column if not exists handover_of_project uuid references public.projects on delete cascade;
create index if not exists posts_handover_idx on public.posts(handover_of_project) where handover_of_project is not null;

-- ── 인계 요청: 상태 변경 + 이어받기 공고 생성 ────────────────────────────────
-- 0018 의 open_handover 는 void 를 돌려줬다. 반환 형식이 바뀌어 먼저 지운다.
drop function if exists public.open_handover(uuid);
create function public.open_handover(p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare o operations; pr projects; p posts; new_post uuid;
begin
  select * into o from operations where project_id = p_project;
  if o.project_id is null then raise exception 'NOT_FOUND: 운영 중인 프로젝트가 아니에요'; end if;
  if o.maintainer_id <> auth.uid() then raise exception 'FORBIDDEN: 현재 담당자만 인계를 요청할 수 있어요'; end if;
  if coalesce(o.repo_url, '') = '' then raise exception 'HANDOVER_INCOMPLETE: 인수인계 정보(저장소 주소)를 먼저 채워 주세요'; end if;

  select * into pr from projects where id = p_project;
  select * into p from posts where id = pr.post_id;

  update operations set status = 'HANDOVER_OPEN' where project_id = p_project;
  update maintainer_history set ended_on = current_date
   where project_id = p_project and student_id = o.maintainer_id and ended_on is null;

  -- 이미 모집 중인 이어받기 공고가 있으면 다시 만들지 않는다
  select id into new_post from posts where handover_of_project = p_project and status = 'open' limit 1;
  if new_post is null then
    insert into posts (title, category, description, problem, author_id, lat, lng, address, domain,
                       expected_deliverables, completion_criteria, duration_days, difficulty,
                       compensation_type, compensation_description, ongoing,
                       warranty_request_days, warranty_request_count, warranty_defect_days, client_owned_billing,
                       handover_of_project)
    values ('[이어받기] ' || p.title, p.category,
            format('이미 운영 중인 서비스를 이어받아 관리할 학생을 찾습니다.%s%s', chr(10),
                   coalesce(nullif(o.known_issues, ''), '인수인계서가 준비되어 있어 바로 시작할 수 있어요.')),
            '담당 학생이 빠져 유지보수할 사람이 필요해요', p.author_id, p.lat, p.lng, p.address, p.domain,
            array['유지보수 기간 동안의 오류 수정', '요청받은 내용 수정'], '요청한 수정이 실제 서비스에 반영된다',
            30, p.difficulty, p.compensation_type, p.compensation_description, true,
            p.warranty_request_days, p.warranty_request_count, p.warranty_defect_days, p.client_owned_billing,
            p_project)
    returning id into new_post;
  end if;

  perform enqueue_notification(pr.owner_id, 'HANDOVER_OPEN',
    '담당 학생이 인계를 요청해 이어받기 공고를 올렸어요.', '/posts/detail?id=' || new_post, new_post, null,
    'handover:open:' || p_project || ':' || o.maintainer_id);
  return new_post;
end $$;

-- ── 선정되면 담당자 교체 ────────────────────────────────────────────────────
-- 이어받기 공고로 만들어진 프로젝트에 팀원(= 선정된 학생)이 들어오면 운영 담당자를 바꾼다.
create or replace function public.apply_handover_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select p.handover_of_project into target
    from projects pr join posts p on p.id = pr.post_id
   where pr.id = new.project_id;
  if target is null then return new; end if;

  update operations set status = 'OPERATING', maintainer_id = new.student_id where project_id = target;
  insert into maintainer_history (project_id, student_id) values (target, new.student_id);
  perform enqueue_notification(new.student_id, 'HANDOVER_TAKEN',
    '프로젝트를 이어받았어요. 인수인계서를 먼저 확인해 주세요.', '/projects/handover?id=' || target, null, null,
    'handover:taken:' || target || ':' || new.student_id);
  return new;
end $$;

drop trigger if exists project_members_handover on public.project_members;
create trigger project_members_handover after insert on public.project_members
for each row execute function public.apply_handover_member();

-- ── 즉시 이어받기(take_over)는 더 이상 쓰지 않는다 ───────────────────────────
create or replace function public.take_over(p_project uuid) returns void
language plpgsql set search_path = public as $$
begin
  raise exception 'DEPRECATED: 이어받기 공고에 지원하면 사장님이 선정합니다';
end $$;

grant execute on function public.open_handover(uuid) to authenticated;
