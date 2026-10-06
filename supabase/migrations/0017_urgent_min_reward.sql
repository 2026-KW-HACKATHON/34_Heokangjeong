-- 긴급 공고 최소 사례비 조정: 난이도 ★ 20,000원 → 10,000원 (★★ 30,000 / ★★★ 50,000 은 그대로).
-- 0015 를 이미 실행한 DB 도 이 파일만 실행하면 기준이 바뀐다. src/lib/colleges.ts 의 urgentMinReward 와 같은 값이어야 한다.

create or replace function public.urgent_min_reward(p_difficulty int) returns int
language sql immutable set search_path = public as $$
  select case coalesce(p_difficulty, 2) when 1 then 10000 when 2 then 30000 else 50000 end
$$;

-- 제약조건은 함수를 다시 읽도록 새로 건다
alter table public.posts drop constraint if exists posts_urgent_reward_chk;
alter table public.posts add constraint posts_urgent_reward_chk check (
  not urgent
  or (compensation_type = 'PAID' and coalesce(paid_amount, 0) >= public.urgent_min_reward(difficulty))
);
