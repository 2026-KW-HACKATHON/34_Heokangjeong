-- Rank and compensation tiers are retired. Preserve historical columns and
-- personal-best data for rollback, but stop enforcing or exposing them.
alter table public.posts drop constraint if exists posts_tier_reward_floor;
drop trigger if exists applications_minimum_tier on public.applications;
drop function if exists public.check_application_minimum_tier();
drop function if exists public.student_application_tier(uuid);

drop trigger if exists record_ranks_after_cards on public.portfolio_cards;
drop trigger if exists record_ranks_after_profiles on public.profiles;
drop trigger if exists record_ranks_after_posts on public.posts;
revoke execute on function public.personal_rankings(uuid) from authenticated;

-- Existing application checks (open post and team role) still apply.
create or replace function public.check_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare p posts;
begin
  select * into p from posts where id = new.post_id;
  if p.id is null or p.status <> 'open' then
    raise exception 'INVALID_STATE: 모집이 끝난 공고예요';
  end if;
  if p.is_team and not exists (select 1 from post_roles r where r.id = new.role_id and r.post_id = p.id) then
    raise exception 'ROLE_REQUIRED: 지원할 역할을 선택해 주세요';
  end if;
  if not p.is_team and new.role_id is not null then
    raise exception 'INVALID_ROLE: 개인 프로젝트에는 역할을 선택할 수 없어요';
  end if;
  return new;
end $$;
