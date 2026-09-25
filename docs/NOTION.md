# Notion 연결 및 안전한 저장

HJW `cf23154`의 연동을 현재 KDU 작업 코드에 선택적으로 통합하고 저장 안전성을 보완했다.
이 문서의 코드는 실제 Notion API를 사용하지만 **실제 계정 OAuth/저장은 아직 검증하지 않았다**.
로컬 테스트의 모의 Notion 응답을 실제 저장 성공으로 간주하지 않는다.

## 사용자 흐름

내 정보 → 내 진행 프로젝트 → 기록/제출 → 점주 검토 승인 → 포트폴리오 생성/편집/저장 →
포트폴리오 상세 → Notion 연결 → 저장 위치 선택 → 서버에서 고정한 문서 확인 →
‘확인한 내용을 Notion에 저장’ → 페이지 링크 및 저장 기록.
OAuth에서 돌아왔다는 URL 파라미터만으로 연결 성공을 표시하지 않으며 서버 상태를 조회한다.
데모 모드에는 실제 Notion 연결 버튼이 없다. 기존 /design-preview는 시각 참고용 구 데모다.

## 배포 전 필수 설정

1. 운영 DB 백업 및 적용 이력을 확인한다. 새 DB는 migrations 0001~0006을 순서대로 적용한다.
   기존 HJW DB에 0005가 있다면 **0006_notion_safe_exports.sql만 추가 적용**한다.
   운영 DB에 개발용 0003을 재실행하지 않는다. 이 통합 작업은 원격 DB에 SQL을 실행하지 않았다.
2. Notion Developer portal에서 Public connection을 등록한다.
   Read content / Insert content 권한, 아래 callback URL을 설정한다.
3. 서버 secrets:
   - NOTION_CLIENT_ID
   - NOTION_CLIENT_SECRET
   - NOTION_REDIRECT_URI=https://<ref>.supabase.co/functions/v1/notion/callback
   - NOTION_TOKEN_KEY: 암호학적으로 무작위인 32바이트를 base64로 인코딩한 값
   - APP_ORIGINS: 허용할 앱 origin들을 쉼표로 구분 (예: http://localhost:3000)
4. Supabase 제공 SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY가 함수 런타임에 필요하다.
   service role / OAuth secrets / 암호화 키를 NEXT_PUBLIC 변수, Git, 브라우저 저장소에 넣지 않는다.
5. 함수 배포:
   `npx supabase functions deploy notion --no-verify-jwt --project-ref <ref>`
   `npx supabase functions deploy portfolio-ai --project-ref <ref>`
   callback만 인증 헤더 없이 접근하며, 나머지 API는 내부에서 JWT의 실제 사용자를 검사한다.
6. 허용된 테스트 위치에서 연결 → 준비 → 저장 → 내용/이미지/공유 권한을 실제 확인한다.
   취소, 권한 철회, 다른 앱 계정, 같은 편집본 재시도, 100개 초과 블록도 검증한다.

## 저장 프로토콜

- prepare: 소유자 검증 후 서버 원본으로 문서 생성. 제목·본문 블록·저장 위치·연결 ID를 DB에 고정.
  미리보기는 이 고정된 블록을 표시한다. 준비만으로 Notion에 페이지를 만들지 않는다.
- export: job ID로 요청. 서비스 전용 DB 함수가 원자적으로 READY/FAILED/재시도 가능한 PARTIAL을 claim한다.
- 각 외부 쓰기 **전** pending_action을 기록한다. 생성 응답 직후 페이지 ID/URL을 기록한 뒤 추가 블록을 전송한다.
- 명확한 4xx 거부는 FAILED 또는 PARTIAL. 사용자가 같은 작업을 선택해 확인 후 이어 저장할 수 있다.
- 네트워크/5xx/timeout/불명확한 응답은 UNKNOWN. 생성 여부가 불명확하므로 자동 재전송하지 않는다.
- DB 체크포인트 저장 실패는 성공으로 보고하지 않는다. durable marker가 남아 중복 생성을 차단한다.
- 새 버전은 사용자 동작에서 만든 안정적인 request ID를 사용한다.
  새로고침해도 미완료 작업을 DB에서 찾아 이어가며, 같은 편집본의 미완료 작업은 unique index로 하나만 허용한다.
- 완료된 편집본 기본 저장은 기존 기록을 반환한다. 새 페이지는 명시적인 ‘새 페이지로 저장 준비’를 통해서만 만든다.
- 저장 당시 연결 ID가 달라지면 재시도하지 않는다. 동일 workspace/bot 재인증은 연결 ID를 유지한다.
- 429는 Retry-After를 준수한다. 긴 대기는 즉시 실패로 돌려 사용자 재시도를 기다린다.

## 상태와 복구

READY / PENDING / SUCCEEDED / PARTIAL / FAILED / UNKNOWN을 구분한다.
PARTIAL은 누락 첨부 또는 중간 블록 거부이며, 기존 페이지 링크와 진행 블록 수를 보여 준다.
기존 버전의 FAILED/PENDING 기록은 안전하게 UNKNOWN으로 마이그레이션한다.

외부 API와 DB를 하나의 트랜잭션으로 묶을 수 없으므로 완전한 exactly-once를 주장하지 않는다.
UNKNOWN 또는 오래 멈춘 PENDING은 자동 해제하지 않는다. 관리자 수동 복구가 필요하다.

관리자는 작업자 종료를 확인한 뒤 job ID·고정 문서·pending_action·Notion 실제 페이지를 대조한다.
페이지가 있다면 ID/URL과 실제 저장된 블록 수를 확인해 checkpoint를 복구한다.
생성되지 않았다는 사실을 확인한 경우에만 pending_action을 해제해 FAILED로 전환한다.
확인 없이 기록 삭제, 시간 만료 후 새 페이지 생성, 무조건 새 버전 발행을 하지 않는다.
현재 관리자 복구 UI는 없으며, 이 절차는 서버 관리자가 수행해야 한다.

## 인증 격리와 연결 해제

토큰은 사용자별 AES-GCM 암호문이다. 인증 테이블은 브라우저 역할 권한을 철회하고 RLS로도 차단한다.
OAuth state는 DELETE RETURNING 한 문장으로 한 번만 소비하며 10분 유효하다.
저장 기록은 본인만 조회하고 쓰기는 서버만 가능하다.
앱 연결 해제는 서버 자격 정보와 미사용 state를 삭제한다.
Notion 자체 권한 철회는 Notion 설정에서 별도로 수행한다.
다른 연결로 바뀐 미완료 작업을 옮기는 UI는 없으며 관리자 확인이 필요하다.

## 첨부와 공개 범위

MVP는 공개 HTTPS/HTTP 링크 기반. Notion File Upload API를 통한 비공개 파일 전송은 아직 구현하지 않았다.
파일 업로드 전 **공개 저장소에 게시됨에 대한 별도 체크박스 동의**가 필수다.
무작위 파일명은 접근 통제가 아니다. 비공개/개인정보 자료는 업로드하면 안 된다.
동의 없는 업로드는 화면과 Repo 모두 차단한다. 기존 업로드 파일의 공개 범위는 바꾸지 않는다.
Notion 저장도 별도 확인 버튼을 눌러야 한다.

local path, blob, data, 사설 IP 링크는 외부 첨부로 내보내지 않는다.
잘못된 첨부는 누락 이유를 본문/저장 기록에 남겨 PARTIAL로 표시한다.
Notion이 외부 이미지를 거부해도 새 페이지로 자동 우회하지 않는다.
비공개 파일 지원이 필요하면 별도 비공개 Storage와 공식 File Upload 전송을 추가해야 한다.

## 확인한 공식 문서

- https://developers.notion.com/guides/get-started/authorization
- https://developers.notion.com/reference/post-page
- https://developers.notion.com/guides/data-apis/uploading-small-files

API version: 2026-03-11. OAuth refresh token 저장·갱신 및 100개 단위 블록 추가 사용.
웹만 지원하며 Capacitor OAuth 복귀 딥링크는 후속 작업이다.
