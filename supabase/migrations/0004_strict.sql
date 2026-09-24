-- 0003_dev_open.sql 로 열어 둔 권한을 원래대로 잠근다. 발표 전·실제 사용자를 받기 전에 실행한다.
-- 본인 것만 고칠 수 있고, 지원서와 채팅은 당사자(지원 학생 ↔ 공고 작성자)만 볼 수 있는 상태로 돌아간다.
-- SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.

do $$
declare t text; p record;
begin
  foreach t in array array['profiles', 'posts', 'applications', 'messages', 'reviews', 'portfolio_cards', 'notifications'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
  end loop;
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- 프로필
create policy "프로필은 로그인하면 누구나 본다" on public.profiles for select to authenticated using (true);
create policy "내 프로필만 만든다" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "내 프로필만 고친다" on public.profiles for update to authenticated using (id = auth.uid());

-- 공고
create policy "공고는 로그인하면 누구나 본다" on public.posts for select to authenticated using (true);
create policy "주민·상인만 내 이름으로 공고를 올린다" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'resident'));
create policy "공고 작성자만 공고를 고친다" on public.posts for update to authenticated using (author_id = auth.uid());
create policy "공고 작성자만 삭제한다" on public.posts for delete to authenticated using (author_id = auth.uid());

-- 지원
create policy "지원서는 당사자만 본다" on public.applications for select to authenticated
  using (student_id = auth.uid() or public.is_post_author(post_id));
create policy "학생만 내 이름으로 지원한다" on public.applications for insert to authenticated
  with check (student_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'student'));
create policy "공고 작성자가 수락·거절한다" on public.applications for update to authenticated using (public.is_post_author(post_id));
create policy "학생은 내 지원 메시지를 고친다" on public.applications for update to authenticated using (student_id = auth.uid());
create policy "학생은 대기 중인 지원을 취소한다" on public.applications for delete to authenticated
  using (student_id = auth.uid() and status = 'pending');

-- 채팅
create policy "채팅은 당사자만 본다" on public.messages for select to authenticated using (public.is_application_member(application_id));
create policy "채팅은 당사자만 보낸다" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_application_member(application_id));
create policy "내가 보낸 메시지를 지운다" on public.messages for delete to authenticated using (sender_id = auth.uid());

-- 평가·포트폴리오·알림
create policy "평가는 누구나 본다" on public.reviews for select to authenticated using (true);
create policy "공고 작성자가 평가한다" on public.reviews for insert to authenticated with check (public.is_post_author(post_id));
create policy "공고 작성자가 평가를 고친다" on public.reviews for update to authenticated using (public.is_post_author(post_id));
create policy "포트폴리오는 누구나 본다" on public.portfolio_cards for select to authenticated using (true);
create policy "내 포트폴리오 카드를 만든다" on public.portfolio_cards for insert to authenticated with check (student_id = auth.uid());
create policy "내 포트폴리오 카드를 고친다" on public.portfolio_cards for update to authenticated using (student_id = auth.uid());
create policy "내 포트폴리오 카드를 지운다" on public.portfolio_cards for delete to authenticated using (student_id = auth.uid());
create policy "알림은 본인만 본다" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "알림 읽음 처리는 본인만" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "알림을 만든다" on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or (post_id is not null and public.is_post_author(post_id)));

-- 파일: 읽기는 공개, 업로드·삭제는 본인 폴더만
create policy "증빙 파일은 누구나 본다" on storage.objects for select using (bucket_id = 'evidence');
create policy "증빙 파일은 내 폴더에만 올린다" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "내가 올린 증빙 파일만 고친다" on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "내가 올린 증빙 파일만 지운다" on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
