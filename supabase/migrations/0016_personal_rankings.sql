-- Best rank starts at migration time; historical rankings are not fabricated.
create table public.personal_best_ranks (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  best_rank integer not null check (best_rank > 0)
);
alter table public.personal_best_ranks enable row level security;
revoke all on public.personal_best_ranks from anon, authenticated;

create function public.compute_individual_rankings()
returns table(student_id uuid, label text, department text, score integer, solved integer, current_rank integer)
language sql stable security definer set search_path = public as $$
  with scores as (
    select u.id, u.name, coalesce(u.department, '') dept,
      (count(c.id)*10 + round(coalesce(avg(c.rating), 0)*4) + coalesce(sum(p.difficulty), 0)*3)::integer points,
      count(c.id)::integer completed
    from profiles u left join portfolio_cards c on c.student_id = u.id
    left join posts p on p.id = c.post_id
    where u.role = 'student' group by u.id, u.name, u.department
  )
  select id, name, dept, points, completed, row_number() over(order by points desc, id asc)::integer
  from scores order by points desc, id asc
$$;
revoke all on function public.compute_individual_rankings() from public;

create function public.record_personal_best_ranks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into personal_best_ranks(student_id, best_rank)
  select student_id, current_rank from compute_individual_rankings()
  on conflict (student_id) do update set best_rank = least(personal_best_ranks.best_rank, excluded.best_rank);
  return null;
end $$;
revoke all on function public.record_personal_best_ranks() from public;
create trigger record_ranks_after_cards after insert or update or delete on public.portfolio_cards
for each statement execute function public.record_personal_best_ranks();
create trigger record_ranks_after_profiles after insert or update or delete on public.profiles
for each statement execute function public.record_personal_best_ranks();
create trigger record_ranks_after_posts after insert or update or delete on public.posts
for each statement execute function public.record_personal_best_ranks();

insert into public.personal_best_ranks(student_id, best_rank)
select student_id, current_rank from public.compute_individual_rankings();

create function public.personal_rankings(p_student uuid default null)
returns table(student_id uuid, label text, department text, score integer, solved integer, current_rank integer, best_rank integer)
language sql stable security definer set search_path = public as $$
  select r.student_id, r.label, r.department, r.score, r.solved, r.current_rank,
    least(coalesce(b.best_rank, r.current_rank), r.current_rank)
  from compute_individual_rankings() r left join personal_best_ranks b on b.student_id = r.student_id
  where auth.uid() is not null and (p_student is null or r.student_id = p_student)
  order by r.current_rank
$$;
revoke all on function public.personal_rankings(uuid) from public;
grant execute on function public.personal_rankings(uuid) to authenticated;
