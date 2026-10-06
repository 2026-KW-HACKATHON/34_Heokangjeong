-- 학생 참여자 프로필에 선택 입력 기본 정보를 추가한다.
alter table public.profiles
  add column if not exists school text,
  add column if not exists age int check (age between 17 and 100),
  add column if not exists phone text check (phone is null or length(phone) <= 30);

