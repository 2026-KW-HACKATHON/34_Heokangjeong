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
| `/posts/detail?id=` | 공고 상세(문제·결과물·완료 기준·보상 유형) · 지원(유료는 검증 이력 필요) · 지원자 선정/거절 | 동작 |
| `/posts/new` | 공고 등록. AI(Gemini) 초안 + 구조화된 공고 정보 | 동작 (지도에서 위치 고르기 TODO) |
| `/projects`, `/projects/detail?id=` | 내 프로젝트 · 프로젝트 허브(단계·기록·증빙·제출·검증·성과·준비도) | 동작 |
| `/projects/log?id=&stage=` | 분야별 Guided Activity Logging (한 화면 한 질문, 자동 저장, 건너뛰기/해당 없음, 후속 질문) | 동작 |
| `/projects/evidence`, `/projects/submit`, `/projects/review`, `/projects/outcome` | 증빙 · 버전 제출 · 점주 검토(보완/승인+Claim 검증+평가) · 성과 | 동작 |
| `/portfolio/build?id=`, `/portfolio/view?id=&s=` | 준비도 → 생성 → 변환 보기 → 편집 · Case Study 상세 + Notion 저장 | 동작 (Notion 실계정 미검증) |
| `/chats`, `/chats/room?id=` | 가게 ↔ 학생 채팅 (지원서마다 채팅방, 실시간) | 동작 |
| `/login`, `/onboarding` | 이메일 로그인 · 프로필(학생/주민·상인) 만들기 | Supabase 연결 시 |
| `/teams` | ⑤ 팀 프로젝트 목록 | 목록만 (팀 채팅·역할 확정 TODO) |
| `/ranking` | ③ 지역 기여 랭킹 (개인/팀/학과) — 나 탭에서 이동 | 동작 (점수 공식 임시) |
| `/portfolio` | ④ 검증된 Case Study 목록 + 활동 카드(승인 시 자동 생성) | 동작 |
| `/notifications` | ⑥ 알림 목록 | 관심 분야·거리, 지원, 채팅, 프로젝트 진행 이벤트 자동 생성·실시간 표시 (모바일 푸시 TODO) |
| `/me` | 내 정보 · 계정 전환(임시 로그인) · 티어/협업 온도/뱃지 | 동작 |

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
