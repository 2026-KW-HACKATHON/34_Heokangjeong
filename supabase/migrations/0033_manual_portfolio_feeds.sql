alter table public.portfolio_publications drop constraint portfolio_publications_source_kind_check;
alter table public.portfolio_publications add constraint portfolio_publications_source_kind_check
  check (source_kind in ('project', 'card', 'manual'));
alter table public.portfolio_publications add column image_urls jsonb not null default '[]'
  check (jsonb_typeof(image_urls) = 'array');
