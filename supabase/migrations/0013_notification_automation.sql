-- 주요 서비스 이벤트를 사용자별 알림으로 저장하고 Realtime으로 전달한다.
alter table public.notifications
  add column if not exists kind text not null default 'GENERAL',
  add column if not exists href text,
  add column if not exists source_key text;

create unique index if not exists notifications_user_source_uq
  on public.notifications(user_id, source_key) where source_key is not null;
create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read, created_at desc);

drop policy if exists "알림을 만든다" on public.notifications;
revoke insert on public.notifications from authenticated;
grant select, update on public.notifications to authenticated;

create or replace function public.enqueue_notification(
  p_user uuid,
  p_kind text,
  p_text text,
  p_href text,
  p_post uuid default null,
  p_distance int default null,
  p_source text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into notifications(user_id, post_id, kind, href, text, distance_m, source_key)
  values(p_user, p_post, p_kind, p_href, left(p_text, 500), p_distance, p_source)
  on conflict (user_id, source_key) where source_key is not null do nothing;
end $$;
revoke all on function public.enqueue_notification(uuid, text, text, text, uuid, int, text) from public;

create or replace function public.notify_matching_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, post_id, kind, href, text, distance_m, source_key)
  select s.id, new.id, 'MATCHED_POST', '/posts/detail?id=' || new.id,
         format('내 관심 분야의 새 공고: %s', new.title), d.distance_m,
         'post:new:' || new.id
  from profiles s
  cross join lateral (
    select round(111320 * sqrt(
      power(new.lat - s.lat, 2) +
      power((new.lng - s.lng) * cos(radians(new.lat)), 2)
    ))::int as distance_m
  ) d
  where s.role = 'student'
    and new.category = any(coalesce(s.interests, '{}'))
    and d.distance_m <= s.max_distance_m
  on conflict (user_id, source_key) where source_key is not null do nothing;
  return new;
end $$;
drop trigger if exists posts_notify_matching_students on public.posts;
create trigger posts_notify_matching_students after insert on public.posts
for each row execute function public.notify_matching_post();

create or replace function public.notify_application_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare p posts; student_name text; project_id uuid;
begin
  select * into p from posts where id = new.post_id;
  select name into student_name from profiles where id = new.student_id;
  if tg_op = 'INSERT' then
    perform enqueue_notification(p.author_id, 'APPLICATION', format('%s님이 %s 공고에 지원했어요.', student_name, p.title), '/posts/detail?id=' || p.id, p.id, null, 'application:new:' || new.id);
  elsif new.status is distinct from old.status and new.status in ('accepted', 'rejected') then
    select id into project_id from projects where post_id = p.id;
    perform enqueue_notification(new.student_id, case when new.status = 'accepted' then 'APPLICATION_ACCEPTED' else 'APPLICATION_REJECTED' end,
      case when new.status = 'accepted' then format('%s 프로젝트에 선정됐어요.', p.title) else format('%s 지원 결과를 확인해 주세요.', p.title) end,
      case when new.status = 'accepted' and project_id is not null then '/projects/detail?id=' || project_id else '/posts/detail?id=' || p.id end,
      p.id, null, 'application:' || new.id || ':' || new.status);
  end if;
  return new;
end $$;
drop trigger if exists applications_notify_event on public.applications;
create trigger applications_notify_event after insert or update of status on public.applications
for each row execute function public.notify_application_event();

create or replace function public.notify_message_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare a applications; p posts; recipient uuid; sender_name text;
begin
  select * into a from applications where id = new.application_id;
  select * into p from posts where id = a.post_id;
  recipient := case when new.sender_id = a.student_id then p.author_id else a.student_id end;
  select name into sender_name from profiles where id = new.sender_id;
  perform enqueue_notification(recipient, 'CHAT', format('%s님이 새 메시지를 보냈어요.', sender_name), '/chats/room?id=' || a.id, p.id, null, 'message:' || new.id);
  return new;
end $$;
drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient after insert on public.messages
for each row execute function public.notify_message_event();

create or replace function public.notify_project_started() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record; title text;
begin
  if new.started_at is not null and old.started_at is null then
    select p.title into title from posts p where p.id = new.post_id;
    for m in select student_id from project_members where project_id = new.id loop
      perform enqueue_notification(m.student_id, 'PROJECT_STARTED', format('%s 프로젝트가 시작됐어요.', title), '/projects/detail?id=' || new.id, new.post_id, null, 'project:start:' || new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists projects_notify_started on public.projects;
create trigger projects_notify_started after update on public.projects
for each row execute function public.notify_project_started();

create or replace function public.notify_submission_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr projects; title text;
begin
  select * into pr from projects where id = new.project_id;
  select p.title into title from posts p where p.id = pr.post_id;
  if tg_op = 'INSERT' then
    perform enqueue_notification(pr.owner_id, 'SUBMISSION', format('%s 결과물 v%s가 제출됐어요.', title, new.version), '/projects/detail?id=' || pr.id, pr.post_id, null, 'submission:new:' || new.id);
  elsif new.status is distinct from old.status and new.status = 'REVISION_REQUESTED' then
    perform enqueue_notification(new.submitted_by, 'REVISION', format('%s 결과물에 보완 요청이 도착했어요.', title), '/projects/detail?id=' || pr.id, pr.post_id, null, 'submission:revision:' || new.id);
  elsif new.status is distinct from old.status and new.status = 'APPROVED' then
    perform enqueue_notification(new.submitted_by, 'COMPLETED', format('%s 결과물이 승인됐어요.', title), '/projects/detail?id=' || pr.id, pr.post_id, null, 'submission:approved:' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists submissions_notify_event on public.submission_versions;
create trigger submissions_notify_event after insert or update of status on public.submission_versions
for each row execute function public.notify_submission_event();

create or replace function public.notify_member_verification() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr projects; title text;
begin
  select * into pr from projects where id = new.project_id;
  select p.title into title from posts p where p.id = pr.post_id;
  perform enqueue_notification(new.student_id, case when new.verified then 'PARTICIPATION_VERIFIED' else 'PARTICIPATION_UNVERIFIED' end,
    case when new.verified then format('%s 참여가 인증됐어요. 팀원 상호평가를 남겨 주세요.', title) else format('%s 참여 인증 결과를 확인해 주세요.', title) end,
    case when new.verified then '/projects/peer-review?id=' || pr.id else '/projects/detail?id=' || pr.id end,
    pr.post_id, null, 'member-verification:' || pr.id || ':' || new.student_id);
  return new;
end $$;
drop trigger if exists member_verifications_notify on public.member_verifications;
create trigger member_verifications_notify after insert or update of verified on public.member_verifications
for each row execute function public.notify_member_verification();

create or replace function public.notify_peer_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare pr projects;
begin
  select * into pr from projects where id = new.project_id;
  perform enqueue_notification(new.reviewee_id, 'PEER_REVIEW', '팀원 상호평가가 등록됐어요.', '/projects/peer-review?id=' || new.project_id, pr.post_id, null, 'peer-review:' || new.id);
  return new;
end $$;
drop trigger if exists peer_reviews_notify on public.team_peer_reviews;
create trigger peer_reviews_notify after insert on public.team_peer_reviews
for each row execute function public.notify_peer_review();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

