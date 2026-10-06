-- 긴급 공고: 평소 공고는 알림을 보내지 않고, 사장님이 "긴급"으로 올린 공고만
-- 사장님이 고른 단과대학 학생에게 즉시 알림을 보낸다.
-- (예: 만든 웹사이트가 갑자기 멈춤 → 인공지능융합대학 학생에게 바로 알림)

alter table public.posts
  add column if not exists urgent boolean not null default false,
  add column if not exists urgent_colleges text[] not null default '{}';

-- 학생 프로필의 단과대학. 값은 src/lib/colleges.ts 의 key (AI, ICT, HSS, BIZ, ENG, SCI, LAW, TALENT, INGENIUM)
alter table public.profiles
  add column if not exists college text;

create index if not exists profiles_college_idx on public.profiles(college) where role = 'student';
create index if not exists posts_urgent_idx on public.posts(created_at desc) where urgent;

-- 기존 알림 트리거를 "긴급 공고만" 보내도록 교체한다.
-- 평소 공고는 알림 없이 홈 피드·지도에서 찾아보게 둔다 (알림 피로도 방지).
create or replace function public.notify_matching_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.urgent then return new; end if;

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
    -- 사장님이 단과대학을 고르지 않았으면 전체 학생에게, 골랐으면 그 단과대학 학생에게만
    and (cardinality(new.urgent_colleges) = 0 or s.college = any(new.urgent_colleges))
  on conflict (user_id, source_key) where source_key is not null do nothing;
  return new;
end $$;

drop trigger if exists posts_notify_matching_students on public.posts;
create trigger posts_notify_matching_students after insert on public.posts
for each row execute function public.notify_matching_post();
