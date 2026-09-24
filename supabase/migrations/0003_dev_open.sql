-- 개발 중 권한 때문에 막히지 않도록 전부 여는 설정 (해커톤 개발 기간용).
-- 로그인한 사용자는 모든 표를 읽고 쓰고 지울 수 있다. 로그인 자체는 여전히 필요하다.
-- ⚠️ 이 상태에서는 남의 공고·지원·채팅도 고치거나 지울 수 있고, 채팅 내용도 서로 볼 수 있다.
--    발표 전이나 실제 사용자를 받기 전에 반드시 0004_strict.sql 을 실행해 원래 권한으로 되돌린다.
-- SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.

do $$
declare t text; p record;
begin
  foreach t in array array['profiles', 'posts', 'applications', 'messages', 'reviews', 'portfolio_cards', 'notifications'] loop
    -- 기존 정책 모두 제거
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "개발 중: 로그인하면 모두 허용" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 파일 업로드도 폴더 제한 없이
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', true) on conflict (id) do nothing;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
create policy "개발 중: 파일은 누구나 본다" on storage.objects for select using (true);
create policy "개발 중: 로그인하면 올리고 지운다" on storage.objects for all to authenticated using (true) with check (true);

-- 실시간(Realtime): 채팅 외에 공고·지원·알림도 바로 반영되게
do $$
declare t text;
begin
  foreach t in array array['messages', 'posts', 'applications', 'notifications'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
