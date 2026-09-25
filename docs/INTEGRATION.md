# 통합 및 검증 기록

## 이번 브랜치에 포함된 범위

- 기존 공고·지도·팀·랭킹·내 정보 화면을 유지하면서 개인 프로젝트 흐름을 연결했습니다.
- 프로젝트 선정, 단계별 질문, 임시 저장·건너뛰기, 자료 준비도, 증빙·제출, 점주 보완 요청·승인·평가를 구현했습니다.
- 공통 포트폴리오 문서와 디자인·마케팅/SNS·IT/개발 질문·템플릿을 분리하고, 원본 답변·생성 초안·학생 편집본을 구분했습니다.
- Notion OAuth, 저장 위치 선택, frozen preview 기반 페이지 생성, idempotency 및 불확실한 외부 응답 복구 상태를 포함했습니다.
- 점수·온도·뱃지는 정책 모듈에서 계산하며, 준비도나 성과 수치를 실력 점수로 사용하지 않습니다.

## 검증 결과

로컬에서 다음 검증을 통과했습니다.

- `npm run typecheck`
- `npm run lint`
- `npm test` — 4개 스위트, 58개 테스트
- `npm run check:functions` — Supabase Edge Function TypeScript 검사
- `NEXT_BUILD_DIR=.next-check npm run build` — Next.js 프로덕션 빌드

실제 Notion OAuth와 페이지 생성은 이 저장소에 외부 인증 정보가 없으므로 수행하지 않았습니다. 따라서 실제 연결 성공은 모의 응답이나 UI 상태로 간주하지 않으며, 배포 후 허용된 테스트 워크스페이스에서 별도로 확인해야 합니다.

## 배포 전 확인

1. Supabase migration `0005_verified_portfolio.sql`, `0006_notion_safe_exports.sql`을 순서대로 적용합니다.
2. `supabase/functions/notion`과 `portfolio-ai`를 배포하고 Notion OAuth client secret 및 Supabase service role 환경변수를 서버 측에만 설정합니다.
3. Notion OAuth redirect URL과 공개 증빙 파일 저장소 정책을 배포 도메인에 맞게 설정합니다.
4. 테스트 계정으로 연결 취소·권한 부족·네트워크 실패·재시도·중복 저장을 확인한 뒤 운영 workspace에서 사용합니다.

세부 환경변수와 복구 절차는 [NOTION.md](NOTION.md)를 참고하세요.
