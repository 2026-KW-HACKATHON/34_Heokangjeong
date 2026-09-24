-- 0001 이후 발견한 권한(RLS) 구멍 메우기 + 증빙 파일 저장소 준비.
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.

-- ── 공고: 작성자가 삭제 ──────────────────────────────────────────────────────
drop policy if exists "공고 작성자만 삭제한다" on public.posts;
create policy "공고 작성자만 삭제한다" on public.posts for delete to authenticated using (author_id = auth.uid());

-- ── 지원: 학생이 확인 대기 중일 때 지원 취소, 지원 메시지 수정 ────────────────
drop policy if exists "학생은 대기 중인 지원을 취소한다" on public.applications;
create policy "학생은 대기 중인 지원을 취소한다" on public.applications for delete to authenticated
  using (student_id = auth.uid() and status = 'pending');
drop policy if exists "학생은 내 지원 메시지를 고친다" on public.applications;
create policy "학생은 내 지원 메시지를 고친다" on public.applications for update to authenticated using (student_id = auth.uid());

-- ── 채팅: 내가 보낸 메시지 삭제 ──────────────────────────────────────────────
drop policy if exists "내가 보낸 메시지를 지운다" on public.messages;
create policy "내가 보낸 메시지를 지운다" on public.messages for delete to authenticated using (sender_id = auth.uid());

-- ── 평가: 공고 작성자가 수정 ────────────────────────────────────────────────
drop policy if exists "공고 작성자가 평가를 고친다" on public.reviews;
create policy "공고 작성자가 평가를 고친다" on public.reviews for update to authenticated using (public.is_post_author(post_id));

-- ── 포트폴리오 카드: 본인 것만 만들고 고친다 (AI 생성 결과 저장) ─────────────
drop policy if exists "내 포트폴리오 카드를 만든다" on public.portfolio_cards;
create policy "내 포트폴리오 카드를 만든다" on public.portfolio_cards for insert to authenticated with check (student_id = auth.uid());
drop policy if exists "내 포트폴리오 카드를 고친다" on public.portfolio_cards;
create policy "내 포트폴리오 카드를 고친다" on public.portfolio_cards for update to authenticated using (student_id = auth.uid());
drop policy if exists "내 포트폴리오 카드를 지운다" on public.portfolio_cards;
create policy "내 포트폴리오 카드를 지운다" on public.portfolio_cards for delete to authenticated using (student_id = auth.uid());

-- ── 알림: 나에게 보내는 알림, 또는 내 공고와 관련된 알림만 만든다 ────────────
drop policy if exists "알림을 만든다" on public.notifications;
create policy "알림을 만든다" on public.notifications for insert to authenticated
  with check (user_id = auth.uid() or (post_id is not null and public.is_post_author(post_id)));

-- ── 증빙 파일 저장소(사진·결과물). 다음 단계에서 쓴다 ────────────────────────
-- 공개 읽기 버킷: 포트폴리오에 결과물 사진을 보여 주기 위해. 업로드는 로그인 사용자가 자기 폴더에만.
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', true) on conflict (id) do nothing;

drop policy if exists "증빙 파일은 누구나 본다" on storage.objects;
create policy "증빙 파일은 누구나 본다" on storage.objects for select using (bucket_id = 'evidence');
drop policy if exists "증빙 파일은 내 폴더에만 올린다" on storage.objects;
create policy "증빙 파일은 내 폴더에만 올린다" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "내가 올린 증빙 파일만 고친다" on storage.objects;
create policy "내가 올린 증빙 파일만 고친다" on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "내가 올린 증빙 파일만 지운다" on storage.objects;
create policy "내가 올린 증빙 파일만 지운다" on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
