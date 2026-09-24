# Supabase 연결 (로그인·DB·채팅·AI·검증형 포트폴리오)

> 팀 프로젝트(`wolgye-hackathon`)에는 `0005_verified_portfolio` 적용, `portfolio-ai`·`notion` 배포, Notion secret 설정이 끝났다 (2026-09-24).
> 새 프로젝트에 붙일 때 `0005` 를 빠뜨리면 공고 등록부터 실패한다 (새 컬럼 없음).

저장소의 `.env` 에 팀 Supabase 프로젝트(wolgye-hackathon) 연결 정보가 들어 있어서, 받아서 `npm run dev` 만 하면 실제 DB 에 붙는다.
아래는 프로젝트를 새로 만들 때의 절차다.

## 1. 프로젝트 만들기
1. https://supabase.com 가입 → New project (무료 플랜, 지역은 Northeast Asia (Seoul))
2. **Authentication → Sign In / Providers → Email** 에서 *Confirm email* 을 끈다 (해커톤용: 가입 즉시 로그인)

## 2. DB 만들기
**SQL Editor** 에 [`supabase/migrations/`](../supabase/migrations/) 안의 파일을 번호 순서대로 붙여 넣고 Run.
DB 구조나 권한을 바꾸면 새 파일(`0006_무엇.sql`)로 남기고, 팀에 "SQL 실행해 주세요" 라고 알린다.

| 파일 | 내용 |
|---|---|
| `0001_init.sql` | 기본 표 7개(profiles, posts, applications, messages, reviews, portfolio_cards, notifications)와 권한 |
| `0002_permissions.sql` | 기본 표 권한 보강, 증빙 버킷 `evidence` (업로드는 `<내 id>/…` 폴더만) |
| `0003_dev_open.sql` | **개발 기간용**: 기본 표 7개와 Storage 권한을 로그인 사용자에게 전부 연다 |
| `0004_strict.sql` | **발표 전**: 0003 으로 연 권한을 원래대로 잠근다 |
| `0005_verified_portfolio.sql` | 검증형 포트폴리오: 프로젝트·답변·증빙·제출 버전·검증·평가·성과·포트폴리오·신뢰 지표·Notion 표, RLS, 상태 전이 DB 함수 |

**지금은 개발 편의를 위해 권한을 열어 둔 상태다** (`0003_dev_open.sql`): 로그인만 하면 기본 표 7개를 읽고 쓸 수 있어 작업 중 막히지 않는다.
대신 남의 공고·채팅도 고치거나 볼 수 있으므로, **발표 전이나 실제 사용자를 받기 전에 `0004_strict.sql` 을 실행해 잠근다.**
0003/0004 는 `0005` 의 표(프로젝트·검증·포트폴리오·Notion 토큰)를 건드리지 않는다. 이 표들은 항상 자기 권한 규칙으로 잠겨 있다.
증빙 파일은 `<내 id>/<프로젝트 id>/파일` 경로로 올리므로 0002·0003·0004 어느 상태에서도 업로드된다.

적용 전에 로컬에서 확인: `npm test` 가 마이그레이션을 PGlite(WASM Postgres)에 올려 DB 함수·RLS 를 검사한다 (0003 → 0004 순서까지).
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

## 팀원 추가
DB 구조를 바꾸거나 함수를 배포하려면 Supabase 접근 권한이 필요하다.
프로젝트 소유자가 **Organization → Team → Invite member** 에서 팀원 이메일을 초대한다 (역할 Developer 이상).
화면·기능만 만드는 사람은 초대 없이도 저장소를 받아 바로 개발할 수 있다.

## 구조 메모
- 테이블: profiles(auth.users 1:1), posts, applications, messages, reviews, portfolio_cards, notifications
- 0005: projects, project_members, project_answers, activity_logs, evidence, submission_versions, client_verifications, client_reviews, outcomes,
  portfolio_snapshots → portfolio_drafts → portfolio_edits, tier_score_events, badges, notion_connections, notion_oauth_states, notion_exports
- 상태 전이·승인·보완 요청·점수 지급은 `select_applicant`, `submit_version`, `request_revision`, `approve_version`, `verify_outcome`, `save_portfolio_edit` DB 함수만 한다 (앱이 직접 상태를 바꾸지 못함).
  에러는 `CODE: 설명` 형식 (예: `STALE_VERSION: v1 은 최신 제출이 아니에요`).
- 권한(RLS): 지원서·채팅은 지원한 학생과 공고 작성자만 읽고 쓴다. 공고는 주민·상인만, 지원은 학생만.
- 채팅방 = 지원서 하나. 새 메시지는 Supabase Realtime 으로 바로 뜬다.
- 증빙 파일은 Storage 버킷 `evidence` 에 `<내 id>/<프로젝트 id>/파일명` 으로 올린다 (읽기는 공개, 쓰기는 본인 폴더만).
