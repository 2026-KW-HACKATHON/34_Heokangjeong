-- 팀원 상호평가는 종료한다. 기존 기록은 감사 이력으로 보존하되 신규 작성과 알림은 막는다.
drop trigger if exists peer_reviews_notify on public.team_peer_reviews;
revoke insert, update, delete on public.team_peer_reviews from authenticated;
drop policy if exists "검증된 팀원이 다른 검증 팀원을 평가" on public.team_peer_reviews;
drop policy if exists "작성자가 자신의 상호평가 수정" on public.team_peer_reviews;

create or replace function public.notify_member_verification() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr projects; title text;
begin
  select * into pr from projects where id = new.project_id;
  select p.title into title from posts p where p.id = pr.post_id;
  perform enqueue_notification(
    new.student_id,
    case when new.verified then 'PARTICIPATION_VERIFIED' else 'PARTICIPATION_UNVERIFIED' end,
    case when new.verified then format('%s 참여가 인증됐어요.', title) else format('%s 참여 인증 결과를 확인해 주세요.', title) end,
    '/projects/detail?id=' || pr.id,
    pr.post_id, null, 'member-verification:' || pr.id || ':' || new.student_id
  );
  return new;
end $$;
