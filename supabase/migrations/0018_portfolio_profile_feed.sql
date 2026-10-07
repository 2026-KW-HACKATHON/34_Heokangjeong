-- Profile introduction and explicitly selected public portfolio imagery.
alter table public.profiles add column if not exists about text not null default '';
alter table public.profiles add column if not exists avatar_url text;
alter table public.portfolio_publications add column if not exists cover_url text;

insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do nothing;

create policy "Read portfolio images" on storage.objects
  for select using (bucket_id = 'portfolio-images');
create policy "Upload own portfolio images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio-images' and (storage.foldername(name))[1] = auth.uid()::text);
