-- 완료된 팀 프로젝트에서 검증된 팀원끼리 남기는 상호평가.
create table public.team_peer_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  reviewer_id uuid not null references public.profiles on delete cascade,
  reviewee_id uuid not null references public.profiles on delete cascade,
  communication int not null check (communication between 1 and 5),
  collaboration int not null check (collaboration between 1 and 5),
  responsibility int not null check (responsibility between 1 and 5),
  comment text not null default '' check (length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique(project_id, reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);
create index team_peer_reviews_reviewee_idx on public.team_peer_reviews(reviewee_id, project_id);

alter table public.team_peer_reviews enable row level security;

create or replace function public.can_submit_peer_review(p_project uuid, p_reviewee uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from projects p
    join project_members reviewer on reviewer.project_id = p.id and reviewer.student_id = auth.uid()
    join member_verifications reviewer_v on reviewer_v.project_id = p.id and reviewer_v.student_id = reviewer.student_id and reviewer_v.verified
    join project_members reviewee on reviewee.project_id = p.id and reviewee.student_id = p_reviewee
    join member_verifications reviewee_v on reviewee_v.project_id = p.id and reviewee_v.student_id = reviewee.student_id and reviewee_v.verified
    where p.id = p_project and p.mode = 'TEAM' and p.status = 'COMPLETED' and auth.uid() <> p_reviewee
  )
$$;

create policy "팀원 상호평가는 당사자만 조회" on public.team_peer_reviews for select to authenticated
using (
  reviewer_id = auth.uid() or reviewee_id = auth.uid()
  or exists (select 1 from projects p where p.id = project_id and p.owner_id = auth.uid())
);
create policy "검증된 팀원이 다른 검증 팀원을 평가" on public.team_peer_reviews for insert to authenticated
with check (reviewer_id = auth.uid() and public.can_submit_peer_review(project_id, reviewee_id));
create policy "작성자가 자신의 상호평가 수정" on public.team_peer_reviews for update to authenticated
using (reviewer_id = auth.uid())
with check (reviewer_id = auth.uid() and public.can_submit_peer_review(project_id, reviewee_id));

grant select, insert, update on public.team_peer_reviews to authenticated;
revoke all on function public.can_submit_peer_review(uuid, uuid) from public;
grant execute on function public.can_submit_peer_review(uuid, uuid) to authenticated;

