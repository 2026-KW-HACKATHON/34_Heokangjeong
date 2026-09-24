# 월계 재능나눔 — 대학생 재능기부 플랫폼 (뼈대)

월계1동 주민·상인이 필요한 재능을 공고로 올리면, 광운대 학생이 전공·관심·거리에 맞춰 지원하고
완료 후 인증·평가를 받아 포트폴리오와 지역 기여 랭킹으로 남기는 **지역 기반 재능 매칭 서비스**의 뼈대입니다.

> 주민에게는 필요한 재능을, 대학생에게는 실제 경험을, 그 결과는 월계1동에 남긴다.

지금 상태: **Supabase 에 연결된 프로토타입.** 실제 로그인·지원·수락·채팅·AI 공고 초안(Gemini)이 동작합니다.
연결 정보를 비우면 가짜 데이터 + 계정 전환 모드로도 돕니다 → [docs/SUPABASE.md](docs/SUPABASE.md)

> 개발 기간에는 DB 권한을 열어 두었습니다(로그인만 하면 모두 가능). 발표 전에 `supabase/migrations/0004_strict.sql` 로 잠급니다.
당근마켓처럼 "동네 공고 피드 + 지도" 를 축으로, 토스처럼 흰 배경·큰 카드·파란 포인트의 단순한 UI 로 잡았습니다.
누구나 원하는 부분부터 채워 넣을 수 있게 구조를 나눠 두었습니다.

## 바로 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

Node 18 이상. 지도는 OpenStreetMap(Leaflet) 이라 API 키가 필요 없습니다.
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

## 화면 (6개 기능 → 9개 화면)

| 경로 | 기능 | 상태 |
|---|---|---|
| `/` | ① 맞춤 공고 추천 피드 (학과·관심·기술·거리 점수) | 동작 (규칙 기반) |
| `/map` | ② 위치 기반 지도 (🔴모집 🟡진행 🟢완료, 거리·도보 시간) | 동작 |
| `/posts/detail?id=` | 공고 상세 · 지원 · 지원자 수락/거절 · 팀 역할 현황 · 상태 변경 | 동작 (평가 입력은 TODO) |
| `/posts/new` | 공고 등록. 대충 적으면 AI(Gemini)가 제목·필요 재능·추천 학과·결과물·기간 초안 | 동작 (지도에서 위치 고르기 TODO) |
| `/chats`, `/chats/room?id=` | 가게 ↔ 학생 채팅 (지원서마다 채팅방, 실시간) | 동작 |
| `/login`, `/onboarding` | 이메일 로그인 · 프로필(학생/주민·상인) 만들기 | Supabase 연결 시 |
| `/teams` | ⑤ 팀 프로젝트 목록 | 목록만 (팀 채팅·역할 확정 TODO) |
| `/ranking` | ③ 지역 기여 랭킹 (개인/팀/학과) | 동작 (점수 공식 임시) |
| `/portfolio` | ④ 인증형 포트폴리오 카드 | 동작 (카드 자동 생성 로직 TODO) |
| `/notifications` | ⑥ 알림 목록 | 목록만 (푸시·매칭 조건 계산 TODO) |
| `/me` | 내 정보 · 계정 전환(임시 로그인) | 동작 |

## 구조 — 어디를 채우면 되나

```
src/
  types/index.ts        도메인 타입 (User, Post, Application, Review, PortfolioCard, Notification…)
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
supabase/                DB 스키마(migrations), 서버 함수(functions)
docs/ARCHITECTURE.md    설계, 로드맵
docs/SUPABASE.md        Supabase·Gemini 연결 방법
```

핵심 원칙 하나: **화면은 `repo` 인터페이스만 부른다.** 그래서 나중에 Supabase/REST 를 붙여도 화면 코드를 다시 짜지 않고
`lib/repo/` 아래에 새 구현을 추가해 `index.ts` 의 한 줄만 바꾸면 됩니다.

## 기여하기

이 저장소는 public 입니다. 원하는 기능을 골라 PR 을 보내 주세요. 처음 손대기 좋은 것들:

- [ ] 공고 등록 시 지도에서 위치 찍기 (`posts/new`, `MapView`)
- [ ] 완료·인증 시 평가 입력 → 포트폴리오 카드 자동 생성 (`repo.updatePostStatus` 확장)
- [ ] 팀 역할 지원·확정 흐름 (`Post.teamSlots.filled`)
- [ ] 알림 생성 규칙: 새 공고가 오면 관심·거리 조건에 맞는 학생에게 (`recommend.ts` 재사용)
- [ ] 카카오/네이버 지도로 교체 (`components/MapView.tsx` 만 바꾸면 됨)

자세한 방법은 [CONTRIBUTING.md](CONTRIBUTING.md), 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 라이선스

MIT
