# Notion 연동 설정

포트폴리오를 사용자의 Notion 에 **실제 페이지로** 저장한다 (Markdown 다운로드가 아님). 서버 함수는 `supabase/functions/notion`.
Notion API 버전은 `2026-03-11` 기준이다 (블록 추가의 `position`, `in_trash` 등).

## 흐름
포트폴리오 상세 → Notion 에 저장 → (미연결이면) Notion 계정 연결 = OAuth → 저장할 페이지 선택(또는 워크스페이스 최상위, 나만 보기) → 저장 내용 미리보기 → 페이지 생성 → Notion URL

## 1. Notion public integration 만들기
1. https://www.notion.so/profile/integrations → 새 통합 → 유형 **Public**
2. Redirect URI: `https://<프로젝트ref>.supabase.co/functions/v1/notion/callback`
3. 기능(Capabilities): 콘텐츠 읽기·삽입 (Read content, Insert content)
4. OAuth client ID / client secret 을 복사

## 2. 서버 설정 (Edge Function secrets)
```bash
npx supabase secrets set --project-ref <ref> \
  NOTION_CLIENT_ID=... NOTION_CLIENT_SECRET=... \
  NOTION_REDIRECT_URI=https://<ref>.supabase.co/functions/v1/notion/callback \
  NOTION_TOKEN_KEY=$(openssl rand -base64 32) \
  APP_ORIGINS=http://localhost:3000
npx supabase functions deploy notion --no-verify-jwt --project-ref <ref>
```
`--no-verify-jwt` 는 Notion 이 브라우저를 보내는 OAuth 콜백(GET) 때문이다. 콜백을 뺀 모든 요청은 함수 안에서 로그인 사용자를 검사한다 (`supabase/config.toml` 에도 같은 설정).
`APP_ORIGINS` 는 OAuth 후 돌아갈 수 있는 앱 주소 목록이다. 목록에 없는 주소로는 돌려보내지 않는다.

## 보안
- 토큰은 AES-GCM 으로 암호화해 `notion_connections` 에 저장한다. 이 테이블은 RLS 를 켜고 정책을 두지 않아 **앱(브라우저)에서 읽을 수 없고** 서버 함수(service role)만 쓴다.
- 토큰은 localStorage·클라이언트 JS·로그에 나오지 않는다. 연결은 로그인 사용자별이다 (공유 데모 계정 없음).
- OAuth `state` 는 1회용, 10분 유효.

## 중복 저장 방지
`notion_exports.idempotency_key = edit:<편집본 id>` (unique). 같은 편집본을 다시 저장하면 새 페이지를 만들지 않고 기존 페이지 URL 을 돌려준다.
"새 버전으로 저장" 을 누를 때만 새 키로 새 페이지를 만든다. 동시에 두 번 누르면 unique 제약으로 한쪽만 진행된다.

## 첨부
Notion 이 서버에서 가져올 수 있는 공개 `http(s)` 주소만 넣는다. `C:\…`, `file://`, `blob:`, `data:`, `localhost` 는 넣지 않고 **부분 실패**로 기록·표시한다.
증빙 파일은 Supabase Storage 의 공개 버킷 `evidence` 에 무작위 이름으로 올라가므로 Notion 에서 열린다.
Notion 이 외부 이미지를 거부하면 이미지를 링크로 바꿔 다시 저장하고, 그 사실을 부분 실패로 표시한다.

## 오류 처리
| 상황 | 표시 |
|---|---|
| OAuth 취소 (`error=access_denied`) | "Notion 연결을 취소했어요" |
| 권한 부족 (403 / 공유 안 된 페이지 404) | 저장할 페이지를 공유하라는 안내 |
| 토큰 만료 (401) | refresh token 으로 1회 갱신 → 실패 시 다시 연결 안내 |
| 요청 과다 (429) | `Retry-After` 를 지켜 최대 3회 재시도 |
| 블록 100개 초과 | 페이지 생성 후 100개씩 이어 붙임 |

## 검증 상태
이 저장소에서는 Notion 호출을 **실제 계정으로 검증하지 못했다** (통합 client ID/secret 없음). 코드 타입 검사(`npm run check:functions`)와 블록 생성 로직만 확인했다.
처음 설정할 때 위 흐름을 한 번 직접 확인해 주세요.
