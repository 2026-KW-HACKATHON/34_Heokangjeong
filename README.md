# 월계 재능나눔 — 검증된 지역 문제 해결 경험을 포트폴리오로

> **우리는 봉사시간을 기록하지 않는다. 문제를 해결한 경험을 기록한다.**
> 지역에서 경험하고 → 검증받고 → 커리어로 가져간다.

월계1동 주민·상인이 문제를 공고로 올리면 광운대 학생이 지원·선정되어 해결하고, 그 과정을 **분야별 질문으로 기록**하고,
**증빙**과 **의뢰인의 항목별 검증**을 거쳐 **직무별 포트폴리오 Case Study** 로 만들어 **Notion 에 저장**합니다.

```
공고 → 지원 → 선정 → 분야별 활동 기록 → 증빙 → 제출(v1) → 보완 요청 → 재제출(v2) → 승인
→ Client Verification(무엇을 확인했는지 항목별) + 평가 → 포트폴리오 자료 준비도 → Narrative Engine → 학생 편집 → Notion
```

차별점
1. **직무별 구조** — 디자인·마케팅·개발은 서로 다른 질문·포트폴리오 템플릿·준비도 기준을 가진다 (`supabase/functions/_shared/portfolio/domains.ts`).
2. **Evidence** — Before/After·결과물·테스트 기록·측정 자료를 답변 필드·주장에 연결한다. 학생 주장만으로 만들지 않는다.
3. **Claim-level Verification** — "학생이 실제로 작업함 ✓ 역할이 맞음 ✓ … 성과 수치는 아직 확인되지 않음 —" 처럼 의뢰인이 확인한 것만 표시.
4. **Narrative Engine** — 기록을 나열하지 않고 Problem → Decision → Action → Evidence → Result → Reflection 으로 바꾸되, 기록에 없는 숫자·성과·도구는 사실 검사로 걸러낸다.

지금 상태: Supabase 백엔드(로그인·채팅·AI 공고 초안) 위에 검증형 포트폴리오 파이프라인을 얹은 프로토타입.
HJW `cf23154`의 프로젝트·포트폴리오·Notion 구현을 현재 디자인에 통합했습니다. 이번 통합에서는 원격 DB·함수를 배포하거나 외부 인증 설정을 조회하지 않았습니다. 기존 배포 상태를 확인한 뒤 `0006_notion_safe_exports.sql`과 수정한 서버 함수를 배포해야 합니다. [Notion 설정·복구](docs/NOTION.md), [통합 검증 기록](docs/INTEGRATION.md).
> 서버 없이 보려면 `.env.local` 에 `NEXT_PUBLIC_SUPABASE_URL=` / `NEXT_PUBLIC_SUPABASE_KEY=` (빈 값)을 적어 **가짜 데이터(mock) 모드**로 돌리세요. 전체 흐름이 mock 에서도 동작합니다 (AI 대신 템플릿 초안, Notion 비활성).

> 개발 기간에는 DB 권한을 열어 두었습니다(로그인만 하면 기본 표 모두 가능). 발표 전에 `supabase/migrations/0004_strict.sql` 로 잠급니다. 검증형 포트폴리오 표(`0005`)는 이와 관계없이 항상 잠겨 있습니다.
동네 공고 피드와 지도를 중심으로, 매트한 화이트·차콜 배경과 반투명 메뉴·실버 배지를 사용합니다. 기존 지도 현재 위치·온보딩 필수 입력 검증은 유지합니다.
홈은 **WOLINK — 재능 나눔**의 연결 경험을 보여 줍니다. 분야를 선택하면 재능·이웃 요청을 잇는 선과 실제 공고 목록이 함께 바뀌며, 요청 카드는 해당 공고 상세로 이동합니다. ‘공고 살펴보기’는 검색을 비우고 해당 분야의 활동 중 공고 목록으로 스크롤·포커스를 이동합니다. 연결 그림은 탐색을 표현하며, 지원·선정 상태를 자동으로 바꾸지 않습니다.
모션은 CSS·SVG로 구현했고 `prefers-reduced-motion`을 지원합니다. 홈 인터랙션 검증: mock 서버에서 `node e2e/home-motion-scenario.mjs` (설치된 Edge 사용 시 `PLAYWRIGHT_CHANNEL=msedge`).
데스크톱의 흰색 건물·사람 배경은 스크롤에 따라 연결선이 그려지고 되감깁니다. 모바일에서는 공간을 줄이고 분야 아이콘 위의 흰색 사람이 스크롤 거리에 맞춰 이동하며 팔·다리·무릎이 움직입니다. 역스크롤 시 방향을 바꾸며, 모션 감소 설정에서는 인물과 연결선을 정적으로 표시합니다.
누구나 원하는 부분부터 채워 넣을 수 있게 구조를 나눠 두었습니다.

## 바로 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 정적 앱 생성
npm run preview  # 생성된 out/를 localhost:3002에서 확인
```

Node 18 이상. 지도는 OpenStreetMap(Leaflet) 이라 API 키가 필요 없습니다.

```bash
npm run typecheck        # 타입 검사
npm run lint
npm test                 # 단위 테스트 + DB 마이그레이션·RLS 테스트(PGlite)
npm run check:functions  # Edge Function 타입 검사 (Deno, npx 로 자동 설치)
npm run test:e2e         # mock 모드 E2E (dev 서버 실행 중, 처음 한 번 npx playwright install chromium)
node e2e/real-scenario.mjs  # 실제 Supabase E2E — 공유 DB 에 테스트 계정·데이터가 생기므로 끝나고 정리 (파일 상단 주석)
```

### 환경변수·AI·Notion
- 앱: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` (공개 키). 목록은 [.env.example](.env.example)
- 서버 비밀 값은 Supabase Edge Function secrets 에만: `GEMINI_API_KEY`(AI), `NOTION_CLIENT_ID`/`NOTION_CLIENT_SECRET`/`NOTION_REDIRECT_URI`/`NOTION_TOKEN_KEY`/`APP_ORIGINS`(Notion)
- AI 설정: [docs/SUPABASE.md](docs/SUPABASE.md) §4 · Notion OAuth 설정: [docs/NOTION.md](docs/NOTION.md)

### 데모 계정·시나리오 (mock 모드)
나 탭에서 **대학생 12명과 주민·소상공인 14명**을 자유롭게 전환할 수 있습니다. 홈에는 디자인·사진/영상·웹/앱 개발·SNS 콘텐츠·디지털 도움 분야별 진행 가능한 공고가 6개씩 준비되어 있습니다. 여러 계정에 지원서·양방향 채팅·읽지 않은 알림도 미리 구성되어 있어 역할을 바꾸며 상호작용을 확인할 수 있습니다. "데모 데이터 초기화"로 처음부터 다시 체험할 수 있습니다.

Supabase 환경변수가 있는 PC에서도 PowerShell에서 `$env:NEXT_PUBLIC_DEMO_MODE="true"; npm run dev`로 데모 모드를 고정할 수 있습니다.
빠른 다중 지원자 시연: **월계 미용실** 계정으로 전환 → 홈에서 **미용실 가격표와 시술 안내판 새단장** 공고 선택 → 지원자 4명의 프로필·지원 메시지·개별 채팅 비교 → 1명 선정. 나머지 3명은 자동 거절되고 각 계정에 결과 알림이 도착합니다.
1. 행복분식: 등록 탭에서 메뉴판 개선 공고 (문제·기대 결과물·완료 기준) — 또는 준비된 "분식집 메뉴판 정보 구조 개선" 사용
2. 김하늘: 공고 상세 → 지원 → 행복분식: 지원자 **선정** → 프로젝트 시작
3. 김하늘: 프로젝트 → 시작 기록 (짧게 답하면 추천 후속 질문, 하나는 건너뛰기) → Before 이미지 증빙 → 진행 기록·중간 기록 → 마무리 기록 → 결과물 업로드 → **v1 제출**
4. 행복분식: 검토 → **보완 요청** → 김하늘: 수정해서 **v2 제출** → 행복분식: 확인 항목 체크 + 평가 → **승인**
5. 김하늘: 포트폴리오 자료 준비도 확인 → 빠진 항목 채우기 → **포트폴리오 초안 만들기** → 기록 → Case Study 변환 확인 → 문장 수정·저장
6. 포트폴리오 상세 → **Notion 에 저장** (Supabase + Notion 설정 필요)
저장소의 `.env` 에 팀 Supabase 연결 정보가 있어 바로 실제 DB 로 실행됩니다 (가입 후 사용). 자세한 건 [docs/SUPABASE.md](docs/SUPABASE.md).

## 안드로이드 앱

웹 화면을 [Capacitor](https://capacitorjs.com) 로 감싼 안드로이드 앱입니다. 화면 코드는 웹과 같으므로
**기능·화면 작업은 위의 `npm run dev` 로 브라우저에서 하면 됩니다.** Android Studio 는 앱으로 직접 돌려볼 때만 필요합니다.

- **APK 받기 (설치 없이):** push·PR 마다 GitHub Actions 가 APK 를 빌드합니다.
  저장소 → Actions → "Android APK" → 실행 하나 → 아래 Artifacts 의 `wolgye-talent-debug-apk` 다운로드 → 압축 풀어 폰에 설치.
- **직접 빌드:** Android Studio + JDK 21 설치 후
  ```bash
  npm run android:sync   # 웹 빌드(out/) → android/ 에 복사
  npm run android:open   # Android Studio 로 열어서 ▶ 실행
  ```
- 앱은 정적 HTML(`output: "export"`) 로 빌드되므로 **서버 기능(API 라우트, 동적 경로 `[id]`, 서버 컴포넌트 데이터 fetch)은 쓰지 않습니다.**
  상세 화면처럼 id 가 필요하면 `/posts/detail?id=...` 처럼 쿼리로 넘깁니다.
- 서명 키(`*.jks`, `*.keystore`)는 절대 커밋하지 않습니다.

## 화면

| 경로 | 기능 | 상태 |
|---|---|---|
| `/` | ① 맞춤 공고 추천 피드 (학과·관심·기술·거리 점수) | 동작 (규칙 기반) |
| `/map` | ② 위치 기반 지도 (🔴모집 🟡진행 🟢완료, 거리·도보 시간) | 동작 |
| `/posts/detail?id=` | 공고 상세(문제·결과물·완료 기준·가게 쿠폰) · 지원자 선정/거절 | 동작 |
| `/posts/new` | 공고 등록. AI(Gemini) 초안 + 구조화된 공고 정보 | 동작 (지도에서 위치 고르기 TODO) |
| `/projects`, `/projects/detail?id=` | 내 프로젝트 · 프로젝트 허브(단계·기록·증빙·제출·검증·성과·준비도) | 동작 |
| `/projects/log?id=&stage=` | 분야별 Guided Activity Logging (한 화면 한 질문, 자동 저장, 건너뛰기/해당 없음, 후속 질문) | 동작 |
| `/projects/evidence`, `/projects/submit`, `/projects/review`, `/projects/outcome` | 증빙 · 버전 제출 · 점주 검토(보완/승인+Claim 검증+평가) · 성과 | 동작 |
| `/portfolio/build?id=`, `/portfolio/view?id=&s=` | 준비도 → 생성 → 변환 보기 → 편집 · Case Study 상세 + Notion 저장 | 동작 (Notion 실계정 미검증) |
| `/chats`, `/chats/room?id=` | 가게 ↔ 학생 채팅 (지원서마다 채팅방, 실시간) | 동작 |
| `/login`, `/onboarding` | 이메일 로그인 · 프로필(학생/주민·상인) 만들기 | Supabase 연결 시 |
| `/teams` | ⑤ 팀 프로젝트 목록 | 목록만 (팀 채팅·역할 확정 TODO) |
| `/activity` | 분야별 작업 기록 · 제일 많이 한 분야 · 평균 별점 | 동작 (`/ranking`은 이 화면으로 이동) |
| `/portfolio` | ④ 검증된 Case Study 목록 + 활동 카드(승인 시 자동 생성) | 동작 |
| `/notifications` | ⑥ 알림 목록 | 관심 분야·거리, 지원, 채팅, 프로젝트 진행 이벤트 자동 생성·실시간 표시 (모바일 푸시 TODO) |
| `/me` | 편집 가능한 사진·About me 프로필, 분야별 작업 기록, 공개 포트폴리오 피드 | 동작 |

## 구조 — 어디를 채우면 되나

```
src/
  types/index.ts        도메인 타입 (User, Post, Application…) + 파이프라인 타입 재수출
  lib/workflow/engine.ts  프로젝트 워크플로 규칙 (mock 이 사용, 단위 테스트 대상)
  lib/portfolio, lib/notion.ts, lib/ai/followup.ts  스냅샷 조립 · Notion 호출 · 후속 질문
  lib/repo/index.ts     데이터 접근 인터페이스(Repo)  ← 백엔드를 붙일 때 여기 구현만 교체
  lib/repo/mock.ts      가짜 데이터 + 메모리/localStorage 구현 (Supabase 설정이 비었을 때)
  lib/repo/supabase.ts  Supabase 구현 (.env 에 설정이 있을 때, 기본)
  lib/session.tsx       로그인(Supabase Auth) / mock 에서는 계정 선택
  lib/ai/draft.ts       AI 공고 초안 호출 → supabase/functions/draft-post (Gemini)
  lib/recommend.ts      추천 점수 규칙
  lib/geo.ts            거리·도보시간, 월계1동 좌표
  components/           TopBar, BottomTab, PostCard, StatusBadge, MapView(Leaflet)
  app/                  화면 (Next.js App Router, 모두 클라이언트 컴포넌트)
android/                Capacitor 안드로이드 프로젝트 (웹 빌드를 감싸는 껍데기)
supabase/migrations/     0001 기본 스키마, 0002~0004 권한(개발 중 개방·발표 전 잠금), 0005 검증형 포트폴리오(테이블·RLS·상태 전이 DB 함수)
supabase/functions/      draft-post · portfolio-ai(Gemini) · notion(OAuth·저장)
  _shared/portfolio/     앱과 서버가 같이 쓰는 순수 로직 (분야 모듈·상태 머신·준비도·스냅샷·Narrative·문서·Notion 블록)
tests/, e2e/             vitest(+PGlite) 테스트, Playwright E2E
docs/ARCHITECTURE.md    설계, 로드맵
docs/SUPABASE.md        Supabase·Gemini 연결 방법
```

핵심 원칙 하나: **화면은 `repo` 인터페이스만 부른다.** 그래서 나중에 Supabase/REST 를 붙여도 화면 코드를 다시 짜지 않고
`lib/repo/` 아래에 새 구현을 추가해 `index.ts` 의 한 줄만 바꾸면 됩니다.

## 기여하기

이 저장소는 public 입니다. 원하는 기능을 골라 PR 을 보내 주세요. 처음 손대기 좋은 것들:

- [ ] 공고 등록 시 지도에서 위치 찍기 (`posts/new`, `MapView`)
- [ ] 팀 역할 지원·확정 흐름 (`Post.teamSlots.filled`)
- [ ] 알림 생성 규칙: 새 공고가 오면 관심·거리 조건에 맞는 학생에게 (`recommend.ts` 재사용)
- [ ] 카카오/네이버 지도로 교체 (`components/MapView.tsx` 만 바꾸면 됨)

자세한 방법은 [CONTRIBUTING.md](CONTRIBUTING.md), 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 남은 한계
- Notion OAuth·페이지 생성은 **실제 Notion 계정으로 검증하지 못함** (팀 서버에 Notion secret 없음) (코드·타입 검사·블록 생성 로직만 확인). [docs/NOTION.md](docs/NOTION.md)
- Gemini 응답이 느림 (후속 질문 15~25초, 가끔 시간 초과). 그래서 후속 질문은 규칙 기반 질문을 먼저 보여 주고 AI 질문이 도착하면 바꿔 끼운다. 포트폴리오 초안은 실제 AI 로 생성·사실 검사까지 확인함.
- 팀 프로젝트는 역할별 모집·팀장 제출·팀원별 기록/검증/포트폴리오·상호평가까지 지원한다. 팀 단체 채팅은 아직 없음.
- Capacitor 앱 안에서는 Notion OAuth 후 앱으로 돌아오는 딥링크가 없음 (웹에서 사용).

## 라이선스

MIT

### 공개 포트폴리오 갤러리

- 본인이 직접 공개한 작업만 갤러리에 표시됩니다. 기본값은 비공개입니다.
- 내 포트폴리오 → 갤러리에 공개 → 대표 사진과 본문 미리보기 → 공개를 선택합니다. 비공개 전환과 공개 내용 갱신도 같은 곳에서 합니다.
- `나` 화면에서 프로필 사진과 About me를 편집합니다. 공개한 작업만 사진형 피드에 표시되고, 게시물을 누르면 포트폴리오 상세가 열립니다. 대표 사진을 선택하지 않으면 분야별 기본 표지를 사용합니다.
- 공개본은 제목·요약·본문·선택한 대표 사진을 별도로 저장한 스냅샷입니다. 원본 증빙·의뢰인 평가·프로젝트 기록은 갤러리에 포함하지 않습니다.
- Supabase 사용 시 기존 마이그레이션 이후 `0015_portfolio_publications.sql`을 적용해야 합니다. 공개본에는 소유자 쓰기 권한을 적용하고, 원본 편집본 조회는 본인에게 제한합니다. 이 마이그레이션은 원격 DB에 자동 적용되지 않습니다.
- 프로필 사진·소개글·대표 사진을 저장하려면 `0019_portfolio_profile_feed.sql`도 적용해야 합니다. 이미지 업로드는 본인 폴더로 제한되며, 공개용 이미지만 사용합니다.
- 검증: `npx vitest run tests/portfolio-publication.test.ts`, mock 개발 서버에서 `node e2e/portfolio-gallery.mjs` (설치된 Edge 사용 시 `PLAYWRIGHT_CHANNEL=msedge`).

### 분야별 작업 기록과 쿠폰 보상

- 순위와 등급별 보상 차등을 사용하지 않습니다. 학생의 완료 인증 작업을 공고 분야별로 묶어 건수와 작업명을 보여 주고, 가장 많이 한 분야와 의뢰인 별점 평균을 표시합니다. 평가가 없으면 `평가 전`으로 표시합니다.
- 신규 공고는 완료 시 제공할 가게 쿠폰을 등록합니다. 학생의 순위나 등급에 따라 쿠폰을 달리 지급하거나 지원을 제한하지 않습니다.
- Supabase에서는 기존 마이그레이션 뒤 `0018_work_fields_instead_of_rank.sql`을 적용해야 합니다. 기존 순위·금액 컬럼은 과거 데이터 호환을 위해 보존하지만, 순위 기록과 등급별 지원·보상 검사는 중단합니다. 이 마이그레이션은 원격 DB에 자동 적용되지 않습니다.
- 검증: `npx vitest run tests/work-fields.test.ts tests/workflow.test.ts tests/sql.test.ts`.

### 채팅 작업 약속서

- 채팅 상단에서 작업 범위·결과물·완료 기준 → 날짜 → 쿠폰·수정 횟수·인계 → 검토 순서로 작성합니다. 날짜는 달력 드래그, 두 날짜 클릭 또는 직접 입력으로 선택합니다.
- 검토 단계에서 저장한 초안을 양쪽이 확인합니다. 수정은 새 버전으로 저장하며 기존 확인을 모두 취소합니다. 같은 버전을 두 당사자가 확인하면 확정되어 수정할 수 없습니다.
- 완료 확인일부터 AS 1개월, 기존 기능의 버그 접수 3개월을 명시합니다. 현재 지원 종료일 자동 계산이나 별도 AS 요청 시스템은 포함하지 않습니다.
- Supabase에서는 `0028_chat_agreements.sql` 적용이 필요합니다. 당사자만 읽고 RPC로 저장·확인하며 동시 수정은 버전 검사로 차단합니다. 원격 DB에는 자동 적용되지 않습니다. mock 모드는 브라우저 저장소를 사용합니다.
- 검증: `npx vitest run tests/agreement.test.ts tests/sql.test.ts`, 개발 서버 실행 후 `node e2e/chat-agreement.mjs`.

### 개별 경험 게시물 편집

- 나 → 경험 피드 → 게시물 수정에서 제목, 한 줄 소개, 대표 사진과 경험 소개·문제 정의·해결 방법·작성할 내용·인사이트를 편집합니다. 기존의 다른 본문 항목은 유지합니다.
- 본인에게만 편집 버튼을 표시하며 Supabase는 로그인 사용자 검사와 기존 publication RLS로 본인 수정만 허용합니다. 저장하면 공개 게시물에 반영되며 원본 활동 기록·평가는 변경하지 않습니다.
- mock 샘플도 수정할 수 있고 브라우저 저장소에 유지됩니다. 샘플 표시는 유지하며 실제 수행 기록으로 집계하지 않습니다.
- 추가 DB 마이그레이션은 필요하지 않습니다(기존 0014·0018 적용 기준). 검증: 개발 서버에서 `node e2e/experience-edit.mjs`.

### 프로필 학과 및 포스트 공개 설정

- 프로필 편집에서 학과·소개글·사진을 저장합니다. 피드 오른쪽 위의 열린 눈은 공개, 감긴 눈은 비공개이며 누르면 전환됩니다.
- 비공개 포스트는 본인의 나 화면에 남아 다시 공개하거나 수정할 수 있습니다. 다른 사용자의 목록과 직접 링크에서는 숨깁니다.
- Supabase에는 `0031_portfolio_visibility.sql`을 적용해야 합니다. 비공개 내용은 소유자만 조회하도록 RLS를 적용합니다. 원격 DB에는 자동 적용하지 않습니다.
- 검증: `node e2e/profile-visibility.mjs`, `npx vitest run tests/sql.test.ts`.

### 직접 작성하는 포트폴리오 피드

- `나` 화면의 `+ 피드 작성`에서 사진을 최대 8장 추가하고 사진을 눌러 대표사진을 정한 뒤 제목과 본문을 올립니다. 대표사진·제목·본문은 필수입니다.
- HTML 글 프롬프트 선택 영역은 추후 제공을 위해 비워 두었습니다. 직접 쓴 피드는 개인 작업으로 표시하며 검증된 프로젝트 기록으로 집계하지 않습니다.
- Supabase 사용 시 `0033_manual_portfolio_feeds.sql`을 적용해야 합니다. 직접 작성한 게시물과 사진 목록을 저장하며 소유자만 작성할 수 있습니다. 원격 DB에는 자동 적용하지 않습니다.
- 검증: `npx vitest run tests/sql.test.ts`, 개발 서버에서 `node e2e/manual-portfolio-feed.mjs`.
