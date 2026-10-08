-- 안전장치 세 가지.
--   ① 역할(profiles.role) 잠금: 사용자가 앱에서 자기 역할을 admin 등으로 바꾸지 못하게 한다.
--      가입할 때는 student / resident 중에서만 고를 수 있고, 가입 후에는 역할을 바꿀 수 없다.
--      관리자 지정은 SQL Editor(서버 권한)에서만 한다.
--      ※ 단체 대표 위임(club_members.role, transfer_leader)은 다른 칸이라 영향이 없다.
--   ② 진행 중인 공고 삭제 차단: 학생이 선정돼 프로젝트가 생긴 공고는 직접 삭제(RLS)로도 지울 수 없다.
--      (delete_post 함수에는 이미 같은 검사가 있다. 직접 삭제 경로에도 똑같이 건다.)
--      진행 중인 프로젝트를 끝내려면 별도의 '합의 취소' 흐름을 쓴다.
--   ③ posts.minimum_tier: 폐지된 등급 기능의 컬럼이지만 앱이 아직 값을 보내므로, 공고 등록이 실패하지 않게 빈 칸만 둔다.
--      (0016_post_minimum_tier 는 실행하지 않는다. 앱에서 minimum_tier 를 빼면 이 컬럼은 지워도 된다.)

-- ── ① 역할 잠금 ──────────────────────────────────────────────────────────────
create or replace function public.lock_profile_role() returns trigger
language plpgsql set search_path = public as $$
begin
  -- 서버 권한(postgres, service_role, security definer 함수)은 통과. 앱 사용자 요청만 검사한다.
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    -- 앱은 프로필 저장에 upsert 를 쓴다. 이미 있는 프로필이면 '수정'과 같은 기준(역할 유지)으로 본다.
    if exists (select 1 from profiles where id = new.id) then
      if new.role is distinct from (select role from profiles where id = new.id) then
        raise exception 'FORBIDDEN: 역할은 직접 바꿀 수 없어요';
      end if;
    elsif new.role not in ('student', 'resident') then
      raise exception 'FORBIDDEN: 가입할 때는 학생 또는 사장님만 고를 수 있어요';
    end if;
  elsif new.role is distinct from old.role then
    raise exception 'FORBIDDEN: 역할은 직접 바꿀 수 없어요';
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role before insert or update on public.profiles
for each row execute function public.lock_profile_role();

-- ── ② 진행 중인 공고 삭제 차단 ───────────────────────────────────────────────
drop policy if exists "공고 작성자만 삭제한다" on public.posts;
create policy "공고 작성자만 삭제한다" on public.posts for delete to authenticated
  using (author_id = auth.uid()
         and not exists (select 1 from public.projects pr where pr.post_id = posts.id));

-- ── ③ minimum_tier 호환 칸 ───────────────────────────────────────────────────
alter table public.posts add column if not exists minimum_tier text not null default 'SEED';
