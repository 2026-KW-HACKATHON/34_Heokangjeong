# Supabase 연결 (로그인·DB·채팅·AI·검증형 포트폴리오)

> ⚠️ **검증형 포트폴리오 파이프라인은 `0002_verified_portfolio.sql` 이 DB 에 적용돼 있어야 동작한다.**
> 적용 전에 이 버전을 팀 DB(.env)에 붙여 쓰면 공고 등록부터 실패한다 (새 컬럼 없음). 적용 전에는 `.env.local` 로 mock 모드를 쓴다.

저장소의 `.env` 에 팀 Supabase 프로젝트(wolgye-hackathon) 연결 정보가 들어 있어서, 받아서 `npm run dev` 만 하면 실제 DB 에 붙는다.
아래는 프로젝트를 새로 만들 때의 절차다.

## 1. 프로젝트 만들기
1. https://supabase.com 가입 → New project (무료 플랜, 지역은 Northeast Asia (Seoul))
2. **Authentication → Sign In / Providers → Email** 에서 *Confirm email* 을 끈다 (해커톤용: 가입 즉시 로그인)

## 2. DB 만들기
**SQL Editor** 에 아래 두 파일을 순서대로 붙여 넣고 Run (또는 `npx supabase db push`).
1. [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
2. [`supabase/migrations/0002_verified_portfolio.sql`](../supabase/migrations/0002_verified_portfolio.sql) — 프로젝트·답변·증빙·제출 버전·검증·평가·성과·포트폴리오·신뢰 지표·Notion 테이블, RLS, 상태 전이 DB 함수, 증빙 파일 버킷(`evidence`, 공개 읽기)

적용 전에 로컬에서 확인: `npm test` 가 두 마이그레이션을 PGlite(WASM Postgres)에 올려 DB 함수·RLS 를 검사한다.

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
3. 포트폴리오 AI(후속 질문·Case Study 초안) 함수도 배포: `npx supabase functions deploy portfolio-ai --project-ref <프로젝트ref>` (같은 `GEMINI_API_KEY` 사용).
   함수가 없거나 AI 가 실패하면 앱은 **Template-generated draft** 로 표시된 템플릿 초안을 만든다 (AI 인 척하지 않는다).
4. Notion 저장 함수: [NOTION.md](NOTION.md)

모델은 무료 Flash 모델을 차례로 시도한다 (붐비면 다음 모델). 순서를 바꾸려면 secret `GEMINI_MODELS=모델1,모델2`.

## 구조 메모
- 테이블: profiles(auth.users 1:1), posts, applications, messages, reviews, portfolio_cards, notifications
- 0002: projects, project_members, project_answers, activity_logs, evidence, submission_versions, client_verifications, client_reviews, outcomes,
  portfolio_snapshots → portfolio_drafts → portfolio_edits, tier_score_events, badges, notion_connections, notion_oauth_states, notion_exports
- 상태 전이·승인·보완 요청·점수 지급은 `select_applicant`, `submit_version`, `request_revision`, `approve_version`, `verify_outcome`, `save_portfolio_edit` DB 함수만 한다 (앱이 직접 상태를 바꾸지 못함).
  에러는 `CODE: 설명` 형식 (예: `STALE_VERSION: v1 은 최신 제출이 아니에요`).
- 권한(RLS): 지원서·채팅은 지원한 학생과 공고 작성자만 읽고 쓴다. 공고는 주민·상인만, 지원은 학생만.
- 채팅방 = 지원서 하나. 새 메시지는 Supabase Realtime 으로 바로 뜬다.
