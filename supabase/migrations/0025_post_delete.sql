-- 사장님이 자기 공고를 지울 수 있게 한다.
-- 다만 이미 학생이 선정돼 프로젝트가 시작됐으면 지울 수 없다 (학생의 활동 기록·포트폴리오가 같이 사라지기 때문).
-- 그 경우에는 '모집 마감'으로 닫는다.

create or replace function public.delete_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p posts;
begin
  select * into p from posts where id = p_post;
  if p.id is null then raise exception 'NOT_FOUND: 공고를 찾을 수 없어요'; end if;
  if p.author_id <> auth.uid() then raise exception 'FORBIDDEN: 내가 올린 공고만 지울 수 있어요'; end if;
  if exists (select 1 from projects where post_id = p_post) then
    raise exception 'HAS_PROJECT: 이미 학생이 선정된 공고예요. 학생의 활동 기록이 사라지지 않도록 지울 수 없어요';
  end if;
  delete from posts where id = p_post;
end $$;
grant execute on function public.delete_post(uuid) to authenticated;

-- 직접 삭제도 작성자에게 열어 둔다 (개발 중 권한 개방 SQL 이 정책을 덮어써 빠져 있었다)
drop policy if exists "공고 작성자만 삭제한다" on public.posts;
create policy "공고 작성자만 삭제한다" on public.posts for delete to authenticated using (author_id = auth.uid());
grant delete on public.posts to authenticated;
