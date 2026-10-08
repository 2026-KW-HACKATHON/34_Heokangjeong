-- 계약서 작성·확인 상태를 상대방에게 알리고 채팅방으로 연결한다.
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

drop trigger if exists chat_agreement_notifications on public.chat_agreements;
create trigger chat_agreement_notifications
after insert or update on public.chat_agreements
for each row execute function public.notify_chat_agreement();
