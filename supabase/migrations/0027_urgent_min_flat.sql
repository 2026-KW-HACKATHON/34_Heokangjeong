-- 긴급 공고 최소 사례비를 난이도와 상관없이 10,000원으로 통일한다.
-- 난이도는 사장님이 정하기엔 주관적이라 입력에서 뺐고, 앞으로 완전히 사라질 예정이라 기준에서도 제외한다.

create or replace function public.urgent_min_reward(p_difficulty int default null) returns int
language sql immutable set search_path = public as $$ select 10000 $$;

-- 제약조건이 새 함수를 읽도록 다시 건다
alter table public.posts drop constraint if exists posts_urgent_reward_chk;
alter table public.posts add constraint posts_urgent_reward_chk check (
  not urgent
  or (compensation_type = 'PAID' and coalesce(paid_amount, 0) >= 10000)
);
