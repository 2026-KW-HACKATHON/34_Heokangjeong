-- 닉네임: 동명이인을 구분하고 검색에 쓴다. 대소문자 구분 없이 하나만 (기존 계정은 비워 두고 프로필 편집에서 정한다)
alter table public.profiles add column if not exists nickname text;
alter table public.profiles drop constraint if exists profiles_nickname_format;
alter table public.profiles add constraint profiles_nickname_format
  check (nickname is null or nickname ~ '^[가-힣A-Za-z0-9_.]{2,16}$');
create unique index if not exists profiles_nickname_unique on public.profiles (lower(nickname)) where nickname is not null;
