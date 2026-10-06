-- 긴급 공고 규칙 두 가지.
-- (1) 알림 대상 확대: 고른 단과대학 학생 + 관심 분야가 공고와 겹치는 학생 (합집합).
--     AI 없이 값 비교로 판단한다. 관심 분야와 공고 카테고리가 같은 목록(디자인/영상/사진/SNS홍보/웹/앱/디지털도움/기타)이기 때문.
-- (2) 최소 보상: 긴급 공고는 사례비(PAID)가 있어야 하고 난이도별 최소 금액을 넘어야 한다.
--     아무나 긴급을 쓰면 알림이 의미를 잃기 때문에, 평소 공고보다 문턱을 둔다.

-- ── (2) 난이도별 최소 사례비 ────────────────────────────────────────────────
create or replace function public.urgent_min_reward(p_difficulty int) returns int
language sql immutable set search_path = public as $$
  select case coalesce(p_difficulty, 2) when 1 then 20000 when 2 then 30000 else 50000 end
$$;
grant execute on function public.urgent_min_reward(int) to authenticated;

alter table public.posts drop constraint if exists posts_urgent_reward_chk;
alter table public.posts add constraint posts_urgent_reward_chk check (
  not urgent
  or (compensation_type = 'PAID' and coalesce(paid_amount, 0) >= public.urgent_min_reward(difficulty))
);

-- ── (1) 알림 대상: 단과대학 ∪ 관심 분야 ─────────────────────────────────────
create or replace function public.notify_matching_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.urgent then return new; end if;   -- 평소 공고는 알림 없음

  insert into notifications(user_id, post_id, kind, href, text, distance_m, source_key)
  select s.id, new.id, 'URGENT_POST', '/posts/detail?id=' || new.id,
         format('긴급 공고: %s', new.title), d.distance_m,
         'post:urgent:' || new.id
  from profiles s
  cross join lateral (
    select round(111320 * sqrt(
      power(new.lat - s.lat, 2) +
      power((new.lng - s.lng) * cos(radians(new.lat)), 2)
    ))::int as distance_m
  ) d
  where s.role = 'student'
    and (
      -- 사장님이 고른 단과대학 (고르지 않았으면 이 조건은 모두 통과)
      cardinality(new.urgent_colleges) = 0 or s.college = any(new.urgent_colleges)
      -- 또는(합집합) 학생이 지정한 관심 분야가 공고 분야와 겹치는 경우
      -- 교집합으로 바꾸려면 위 or 를 and 로 바꾼다
      or new.category = any(coalesce(s.interests, '{}'))
    )
  on conflict (user_id, source_key) where source_key is not null do nothing;
  return new;
end $$;

drop trigger if exists posts_notify_matching_students on public.posts;
create trigger posts_notify_matching_students after insert on public.posts
for each row execute function public.notify_matching_post();
