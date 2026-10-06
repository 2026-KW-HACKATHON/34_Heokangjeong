-- Private drafts stay private. Publishing creates an explicit text-only snapshot.
create table public.portfolio_publications (
  student_id uuid not null references public.profiles(id) on delete cascade,
  source_kind text not null check (source_kind in ('project', 'card')),
  source_id text not null,
  title text not null,
  summary text not null default '',
  category text not null default '',
  sections jsonb not null default '[]' check (jsonb_typeof(sections) = 'array'),
  published_at timestamptz not null default now(),
  primary key (student_id, source_kind, source_id)
);
alter table public.portfolio_publications enable row level security;
grant select, insert, update, delete on public.portfolio_publications to authenticated;
create policy "Read explicitly published portfolios" on public.portfolio_publications
  for select to authenticated using (true);
create policy "Publish own portfolio" on public.portfolio_publications
  for insert to authenticated with check (student_id = auth.uid());
create policy "Update own publication" on public.portfolio_publications
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "Withdraw own publication" on public.portfolio_publications
  for delete to authenticated using (student_id = auth.uid());

drop policy if exists "편집본은 공개 포트폴리오" on public.portfolio_edits;
create policy "Read own private portfolio edits" on public.portfolio_edits
  for select to authenticated using (student_id = auth.uid());
