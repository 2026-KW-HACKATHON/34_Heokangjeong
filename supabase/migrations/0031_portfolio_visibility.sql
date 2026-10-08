alter table public.portfolio_publications add column is_visible boolean not null default true;
drop policy "Read explicitly published portfolios" on public.portfolio_publications;
create policy "Read visible or own portfolios" on public.portfolio_publications
for select to authenticated using (is_visible or student_id = auth.uid());
