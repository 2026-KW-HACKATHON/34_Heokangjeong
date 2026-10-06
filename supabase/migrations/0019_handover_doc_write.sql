-- 인수인계서: 서버 함수(handover-ai)가 없거나 AI 가 실패해도 앱이 기본 문서를 저장할 수 있게 한다.
-- 쓸 수 있는 사람은 현재 담당자뿐이다.

drop policy if exists "인수인계서는 담당자가 만든다" on public.handover_docs;
create policy "인수인계서는 담당자가 만든다" on public.handover_docs for insert to authenticated
  with check (exists (select 1 from public.operations o where o.project_id = handover_docs.project_id and o.maintainer_id = auth.uid()));

grant insert on public.handover_docs to authenticated;
