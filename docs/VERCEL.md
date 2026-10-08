# Vercel 웹 배포

현재 앱은 정적 Next.js 화면을 배포하고, 브라우저가 Supabase의 인증·DB·Realtime·Edge Functions를 직접 사용한다.

## 프로젝트 설정

- Git 저장소: `2026-KW-HACKATHON/34_Heokangjeong`
- Production Branch: `main`
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: Next.js 기본값 (직접 `out`으로 덮어쓰지 않는다)
- Root Directory: 저장소 루트

빌드 설정은 루트의 `vercel.json`에 있다. `JMK` 등 다른 브랜치는 Preview 배포로 사용한다.

## 환경변수

Production과 Preview에 다음 값을 설정한다. 실제 값은 로컬 `.env`의 공개 연결 정보를 사용한다.

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_KEY` | Supabase publishable 키 |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |

`GEMINI_API_KEY`는 Supabase Edge Function의 secret에 둔다. 웹 배포 환경변수에는 넣지 않는다.

## 인증 URL

배포 도메인이 정해지면 Supabase Authentication → URL Configuration에서 Site URL을 실제 운영 주소로 설정한다. 이메일 확인·비밀번호 재설정 등에 사용할 운영 주소와 필요한 Preview 주소를 Redirect URLs에 추가한다.

## 배포 방식

Vercel GitHub 연결을 마치면 main에 push할 때 운영 배포가 자동으로 생성된다. CLI로는 계정 로그인과 프로젝트 연결을 마친 뒤 `npx vercel --prod`로 배포할 수 있다.

DB 마이그레이션과 Supabase Edge Function 배포는 Vercel 빌드와 별도로 적용한다.
