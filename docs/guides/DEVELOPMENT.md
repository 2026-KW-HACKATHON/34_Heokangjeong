# 개발 가이드

[문서 목록](../README.md) · [서비스 소개](../../README.md)

## 준비

Node.js 22 LTS와 npm을 권장합니다(GitHub Actions도 Node 22 사용). Android 빌드는 Android Studio와 JDK 21이 필요합니다. 웹 화면 개발은 브라우저에서 할 수 있습니다.

```bash
npm ci
```

## 환경변수

`.env.example`을 `.env.local`로 복사합니다.

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

### 데모 모드

`.env.local`에 아래 값을 설정하면 Supabase 설정이 있어도 데모 모드를 사용합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_KEY=
NEXT_PUBLIC_DEMO_MODE=true
```

데모 계정 선택은 탭별로 유지되고, 공고·지원·채팅 데이터는 같은 브라우저의 탭 사이에서 공유됩니다. 다른 브라우저나 기기에는 자동 공유되지 않습니다.

### 실제 서비스 연결

`NEXT_PUBLIC_DEMO_MODE=false`와 Supabase URL·공개 키를 설정합니다. DB와 Edge Functions 설정은 [Supabase 가이드](SUPABASE.md)를 따릅니다.

`GEMINI_API_KEY`, OAuth 비밀 값, service role 키는 브라우저 환경변수에 넣지 않고 Supabase Edge Function secrets에 둡니다. 전체 변수 목록은 [.env.example](../../.env.example)을 참고하세요.

## 실행과 검증

```bash
npm run dev              # http://localhost:3000
npm run typecheck
npm run lint
npm test
npm run build            # out/에 정적 앱 생성
npm run preview          # http://localhost:3002
npm run check:functions  # Edge Functions 타입 검사
```

E2E는 실행 중인 데모 개발 서버를 대상으로 합니다.

```bash
npx playwright install chromium
npm run test:e2e
```

실제 Supabase 시나리오(`e2e/real-scenario.mjs`)는 공유 DB에 테스트 계정·데이터를 만듭니다. 실행 전 파일 상단의 준비 및 정리 절차를 확인하세요.

## Android

```bash
npm run android:sync
npm run android:open
```

GitHub Actions의 **Android APK** 실행에서 `wolgye-talent-debug-apk` artifact를 받을 수도 있습니다. 서명 키는 커밋하지 않습니다.

## 코드 위치

화면은 `src/app`, 재사용 UI는 `src/components`, 데이터 접근은 `src/lib/repo`, 포트폴리오 디자인은 `src/templates/portfolio`에 둡니다. 화면은 Repo 인터페이스를 사용하고 mock·Supabase 구현은 이 계층에서 분리합니다.

정적 내보내기(`output: "export"`)를 사용하므로 상세 화면 ID는 쿼리로 전달합니다. 웹 배포는 [Vercel 가이드](VERCEL.md), 구조 설명은 [설계 문서](../design/ARCHITECTURE.md), 작업 규칙은 [기여 안내](../../CONTRIBUTING.md)를 참고하세요.
