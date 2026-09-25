-- Apply after 0005. No external pages or credentials are created by this migration.
alter table public.notion_connections add column connection_id uuid not null default gen_random_uuid();
alter table public.notion_exports drop constraint notion_exports_status_check;
alter table public.notion_exports add constraint notion_exports_status_check check
  (status in ('READY','PENDING','SUCCEEDED','PARTIAL','FAILED','UNKNOWN'));
alter table public.notion_exports
  add column connection_id uuid,
  add column title text not null default '',
  add column blocks jsonb not null default '[]',
  add column next_index integer not null default 0 check (next_index >= 0),
  add column pending_action text;
-- Old failed/in-flight exports may have created a remote page. Never automatically replay them.
update public.notion_exports set status = 'UNKNOWN', pending_action = 'legacy',
  error = '이전 버전의 저장 기록입니다. Notion에서 생성 여부를 확인해 주세요.'
  where status in ('PENDING','FAILED');

create unique index notion_one_unfinished_export on public.notion_exports (user_id, portfolio_version_id)
  where connection_id is not null and (status in ('READY','PENDING','UNKNOWN','FAILED')
    or (status = 'PARTIAL' and next_index < jsonb_array_length(blocks)));

-- No public/anonymous/browser writes, even if broad default grants were enabled before.
revoke all on public.notion_connections, public.notion_oauth_states from anon, authenticated;
revoke insert, update, delete on public.notion_exports from anon, authenticated;
grant select on public.notion_exports to authenticated;
grant all on public.notion_connections, public.notion_oauth_states, public.notion_exports to service_role;

-- One statement claims a job; simultaneous callers cannot both send writes to Notion.
create function public.claim_notion_export(job_id uuid, owner_id uuid) returns setof public.notion_exports
language sql security definer set search_path = public as $$
  update public.notion_exports set status = 'PENDING', updated_at = now()
  where id = job_id and user_id = owner_id and pending_action is null
    and (status in ('READY','FAILED') or (status = 'PARTIAL' and next_index < jsonb_array_length(blocks)))
  returning *;
$$;
revoke all on function public.claim_notion_export(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_notion_export(uuid,uuid) to service_role;
