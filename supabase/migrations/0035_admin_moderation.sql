-- 관리자가 부적절하거나 잘못 올라온 공고를 닫을 수 있게 한다.
-- 지우지는 않는다(학생 활동 기록이 걸려 있을 수 있다). 모집만 멈춰 지도·피드에서 내려간다.

create or replace function public.admin_close_post(p_post uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p posts;
begin
  if not is_admin() then raise exception 'FORBIDDEN: 관리자만 할 수 있어요'; end if;
  select * into p from posts where id = p_post;
  if p.id is null then raise exception 'NOT_FOUND: 공고를 찾을 수 없어요'; end if;

  update posts set status = 'done' where id = p_post;
  perform enqueue_notification(p.author_id, 'POST_CLOSED',
    coalesce(nullif(p_reason, ''), '관리자가 공고를 닫았어요.'), '/posts/detail?id=' || p_post, p_post, null,
    'admin:close:' || p_post);
end $$;

grant execute on function public.admin_close_post(uuid, text) to authenticated;
