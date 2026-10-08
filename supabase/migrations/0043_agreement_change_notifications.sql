-- 0042 보완: 계약서 수정 제안(0037)도 상대방에게 알린다.
--   제안 도착 / 수락(새 버전으로 다시 확정) / 거절 / 철회. 나머지(저장·확인·확정)는 0042 그대로.
create or replace function public.notify_chat_agreement() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a applications;
  p posts;
  actor uuid := auth.uid();
  recipient uuid;
  message text;
  event_key text;
begin
  select * into a from applications where id = new.application_id;
  select * into p from posts where id = a.post_id;
  if a.id is null or p.id is null or actor is null then return new; end if;

  recipient := case when actor = a.student_id then p.author_id else a.student_id end;

  if tg_op = 'INSERT' then
    message := format('''%s'' 계약서 v%s을 확인해 주세요.', p.title, new.version);
    event_key := 'saved';
  elsif new.proposed_terms is not null and new.proposed_terms is distinct from old.proposed_terms then
    message := format('''%s'' 계약서 수정 제안이 왔어요. 수락하거나 거절해 주세요.', p.title);
    event_key := 'proposed-' || extract(epoch from coalesce(new.proposed_at, now()))::bigint;
  elsif old.proposed_terms is not null and new.proposed_terms is null and old.version is distinct from new.version then
    message := format('''%s'' 계약서 수정 제안이 수락돼 v%s로 다시 확정됐어요.', p.title, new.version);
    event_key := 'change-accepted';
  elsif old.proposed_terms is not null and new.proposed_terms is null then
    message := case when old.proposed_by = actor
      then format('''%s'' 계약서 수정 제안이 철회됐어요. 기존 계약서가 그대로 유지돼요.', p.title)
      else format('''%s'' 계약서 수정 제안이 거절됐어요. 기존 계약서가 그대로 유지돼요.', p.title) end;
    event_key := 'change-closed-' || extract(epoch from coalesce(old.proposed_at, now()))::bigint;
  elsif old.finalized_at is null and new.finalized_at is not null then
    message := format('''%s'' 계약서가 양쪽 확인으로 확정됐어요.', p.title);
    event_key := 'finalized';
  elsif old.version is distinct from new.version then
    message := format('''%s'' 계약서 v%s을 확인해 주세요.', p.title, new.version);
    event_key := 'saved';
  elsif old.student_confirmed_at is null and new.student_confirmed_at is not null then
    message := format('''%s'' 계약서 v%s을 학생이 확인했어요. 확인해 주세요.', p.title, new.version);
    event_key := 'student-confirmed';
  elsif old.owner_confirmed_at is null and new.owner_confirmed_at is not null then
    message := format('''%s'' 계약서 v%s을 의뢰인이 확인했어요. 확인해 주세요.', p.title, new.version);
    event_key := 'owner-confirmed';
  else
    return new;
  end if;

  perform enqueue_notification(
    recipient,
    'AGREEMENT',
    message,
    '/chats/room?id=' || new.application_id,
    p.id,
    null,
    format('agreement:%s:v%s:%s:%s', new.application_id, new.version, event_key, recipient)
  );
  return new;
end $$;
