# Supabase 연결 (로그인·DB·채팅·AI 초안)

저장소의 `.env` 에 팀 Supabase 프로젝트(wolgye-hackathon) 연결 정보가 들어 있어서, 받아서 `npm run dev` 만 하면 실제 DB 에 붙는다.
아래는 프로젝트를 새로 만들 때의 절차다.

## 1. 프로젝트 만들기
1. https://supabase.com 가입 → New project (무료 플랜, 지역은 Northeast Asia (Seoul))
2. **Authentication → Sign In / Providers → Email** 에서 *Confirm email* 을 끈다 (해커톤용: 가입 즉시 로그인)

## 2. DB 만들기
**SQL Editor** 에 [`supabase/migrations/`](../supabase/migrations/) 안의 파일을 번호 순서대로 붙여 넣고 Run.
DB 구조나 권한을 바꾸면 새 파일(`0003_무엇.sql`)로 남기고, 팀에 "SQL 실행해 주세요" 라고 알린다.

## 3. 앱에 연결
**Project Settings → API** 의 Project URL 과 publishable(anon) 키를 저장소 루트 `.env` 에 넣는다 (APK 빌드도 이 값을 쓴다).
이 키는 앱에 들어가도 되는 공개 키다. `service_role`/secret 키와 Gemini 키는 절대 넣지 않는다.
혼자 가짜 데이터로 돌려 보고 싶으면 `.env.local` 에 두 값을 빈 값으로 적는다 (`.env.local` 은 git 에 안 올라감).

## 4. AI 공고 초안 (Gemini, 무료)
1. https://aistudio.google.com/apikey 에서 API 키 발급 (무료 등급은 입력이 구글 모델 개선에 쓰일 수 있음)
2. 함수 배포 — 둘 중 편한 쪽
   - **대시보드:** Edge Functions → Deploy a new function → 이름 `draft-post` → [`supabase/functions/draft-post/index.ts`](../supabase/functions/draft-post/index.ts) 내용 붙여 넣기 → Deploy.
     Edge Functions → Secrets 에 `GEMINI_API_KEY` 추가.
   - **CLI:**
     ```bash
     npx supabase login
     npx supabase secrets set GEMINI_API_KEY=발급받은키 --project-ref <프로젝트ref>
     npx supabase functions deploy draft-post --project-ref <프로젝트ref>
     ```
모델은 무료 Flash 모델을 차례로 시도한다 (붐비면 다음 모델). 순서를 바꾸려면 secret `GEMINI_MODELS=모델1,모델2`.

## 팀원 추가
DB 구조를 바꾸거나 함수를 배포하려면 Supabase 접근 권한이 필요하다.
프로젝트 소유자가 **Organization → Team → Invite member** 에서 팀원 이메일을 초대한다 (역할 Developer 이상).
화면·기능만 만드는 사람은 초대 없이도 저장소를 받아 바로 개발할 수 있다.

## 구조 메모
- 테이블: profiles(auth.users 1:1), posts, applications, messages, reviews, portfolio_cards, notifications
- 권한(RLS): 지원서·채팅은 지원한 학생과 공고 작성자만 읽고 쓴다. 공고는 주민·상인만, 지원은 학생만.
- 채팅방 = 지원서 하나. 새 메시지는 Supabase Realtime 으로 바로 뜬다.
- 증빙 파일은 Storage 버킷 `evidence` 에 `<내 id>/파일명` 으로 올린다 (읽기는 공개, 쓰기는 본인 폴더만).
