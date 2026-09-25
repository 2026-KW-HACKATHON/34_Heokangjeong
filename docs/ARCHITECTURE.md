# 설계 메모

## KDU 통합 보완 (2026-09-25)

HJW cf23154의 워크플로/질문/문서/Repo/SQL을 가져오되 기존 홈·지도·온보딩·세션과 매트 디자인은 유지했다.
Notion 저장은 prepare → frozen preview → explicit export 방식이다. 서버가 문서·저장 위치·연결 ID를 고정한다.
0006은 claim RPC, 미완료 작업 unique index, 블록별 checkpoint, UNKNOWN 상태와 인증 테이블 권한 철회를 추가한다.
네트워크 결과가 불명확하면 재생성하지 않는다. 상세 복구 절차와 실제 배포 조건은 NOTION.md 참고.
테스트/배포 사실은 INTEGRATION.md를 기준으로 하며, HJW 문서의 기존 실서버 검증 설명을 이번 통합의 검증 결과로 간주하지 않는다.

## 핵심 흐름 (Product Loop)
```
지역 문제 등록(공고) → 학생 지원 → 점주 선정 = 프로젝트 시작
→ 분야별 Guided Activity Logging (START / PROGRESS / FINISH, 한 번에 1~3문항)
→ Evidence 수집 → 결과물 제출(v1) → 점주 검토 → 보완 요청 → 재제출(v2) → 승인
→ Client Verification (Claim 단위) + Client Review → Portfolio 자료 준비도
→ Portfolio Narrative Engine → 학생 편집 → Notion 실제 저장
```
"봉사시간이 아니라 문제를 해결한 경험을 기록한다" — 학생의 주장만이 아니라 증빙과 의뢰인 확인을 거친 기록만 Case Study 가 된다.

## 계층
```
화면(src/app, 모두 클라이언트 컴포넌트)
  ↓ repo 인터페이스만 호출 (src/lib/repo/index.ts)
Repo 구현
  ├ mock.ts      : localStorage + src/lib/workflow/engine.ts (순수 규칙)
  └ supabase.ts  : 테이블/RLS + DB 함수(supabase/migrations/0005) + Edge Function
공유 순수 로직 (supabase/functions/_shared/portfolio/, 앱에서는 @shared/*)
  domains · stateMachine · readiness · snapshot · narrative(+guard) · document · notionBlocks · policy
Edge Functions (Deno): portfolio-ai(Gemini), notion(OAuth·저장), draft-post(공고 초안)
```
- 앱은 정적 export(Capacitor APK)라 API 라우트가 없다. 비밀 키가 필요한 일은 Edge Function 에서 한다.
- 규칙은 세 곳이 같은 표를 쓴다: `stateMachine.ts`(공유), `engine.ts`(mock), SQL `project_next_status`·DB 함수(Supabase). 테스트가 둘 다 검사한다.
- 화면은 localStorage 를 직접 만지지 않는다. 예외는 사용자별 편의 기능(계정 전환, 저장 전 편집 임시 보관)뿐.

## 주요 데이터 모델 (`supabase/functions/_shared/portfolio/types.ts`)
| 엔티티 | 핵심 |
|---|---|
| Listing (posts 확장) | problem, domain, expectedDeliverables, completionCriteria, deadline, revisionLimit, compensationType(VOLUNTEER/NON_MONETARY/PAID), paidAmount, projectMode |
| Project | status 상태 머신, questionSnapshot(선정 시점 질문 고정), approvedVersionId |
| ProjectMember / ProjectRole | 선정된 학생과 역할 라벨 |
| QuestionDefinition → ProjectQuestionSnapshot → ProjectAnswer | 상태 UNANSWERED/SKIPPED/NOT_APPLICABLE/ANSWERED, 후속 질문은 origin AI_FOLLOWUP/RULE_FOLLOWUP |
| ActivityLog | 중간 활동 기록 |
| Evidence | type 11종, linkedField(답변 필드), linkedClaim(주장), source, 수정·삭제 없음 |
| SubmissionVersion (Submission = 버전 목록) | v1, v2 …, PENDING/REVISION_REQUESTED/APPROVED |
| ClientVerification | workPerformed, roleConfirmed, deliverableReceived, completionCriteriaMet, actuallyUsed + 승인한 버전 id |
| ClientReview | satisfaction·deadline·communication·handoff(1~5), comment 원문 |
| Outcome | measured(미측정 ≠ 0), value/baseline/unit/period/source/evidenceId, verified(의뢰인만) |
| PortfolioSourceSnapshot → PortfolioDraft → PortfolioEditedVersion | 원본 고정 → AI/템플릿 초안 → 학생 편집본(항상 새 버전) |
| TierScoreEvent / Badge | 승인 시 (학생, 프로젝트, 종류)당 1회 |
| NotionConnection / NotionExport | 암호화 토큰(서버 전용) / idempotencyKey |

## 상태 머신
```
RECRUITING ─선정→ IN_PROGRESS ─제출→ REVIEW_PENDING ─승인→ COMPLETED
                      (팀: 추가 선정)      │ ↑
                                보완 요청 ↓ │ 재제출
                                  REVISION_REQUESTED
```
막는 것: 선정 안 된 학생의 답변·제출, 다른 점주의 선정·검토·승인, 최신이 아닌 버전 승인(STALE_VERSION), 중복 승인(ALREADY_APPROVED),
보완 요청 횟수 초과(REVISION_LIMIT), 실제 작업 확인 없는 승인, 유료 공고 무자격 지원(PAID_NOT_ELIGIBLE).

## 분야 모듈 (Config-driven)
`domains.ts` 의 DomainModule = fields + questions(Layer A) + sections(포트폴리오 템플릿) + readiness(REQUIRED/RECOMMENDED/OPTIONAL).
DESIGN · MARKETING · DEVELOPMENT 전용, 그 밖의 카테고리(영상·사진·디지털도움…)는 Common Core 만 쓰는 GENERAL.
새 분야는 모듈 하나를 추가하면 화면 수정 없이 질문·준비도·템플릿·Notion 이 따라온다.

## 질문 엔진
- Layer A: 스키마 고정 질문. 각 질문은 데이터 필드 하나에 연결된다.
- Layer B: 답이 짧거나(`minChars`) 이유가 안 보일 때(`askWhy`)만 후속 질문 1~2개. 서버 AI(portfolio-ai) → 실패·mock 이면 질문 정의의 규칙 기반 질문(“추천 질문”으로 표시). 답하지 않아도 넘어간다.
- UX: 한 화면 한 질문, 선택형 우선, 자동 저장(0.7초), 위치를 URL(`q`, `set`)에 둬서 새로고침·뒤로 가기에도 유지, 하단 sticky CTA(다음/건너뛰기/해당 없음).

## 포트폴리오 자료 준비도
결정적 계산: `REQUIRED 70 + RECOMMENDED 25 + OPTIONAL 5` × (완료 / 해당 항목). SKIPPED 는 미완료, NOT_APPLICABLE 은 분모에서 제외. 가중치는 `policy.ts`.
실력 점수가 아니고, 100% 가 아니어도 생성할 수 있다.

## Narrative Engine
1. `buildSource` : AI 가 볼 수 있는 자료만 스냅샷으로 고정 (ANSWERED 답, 공고, 증빙, 제출, 검증, 성과). 건너뛴 필드는 `omitted` 로만 남는다. 해시로 중복 생성 방지.
2. `planSections` : 분야 템플릿 중 재료가 있는 섹션만. 의뢰인 평가 원문 섹션은 잠김(AI·학생이 쓰지 않음).
3. AI(Gemini) : Problem → Decision → Action → Evidence → Result → Reflection 서사로 쓰게 하는 지시 + 섹션 key enum 스키마.
4. `guardNarrative` : 스냅샷에 없는 숫자·성과 주장 문장 삭제, 기록에 없는 도구 삭제, 계획 밖 섹션·없는 증빙 id 삭제, 빈 섹션은 템플릿으로 채움 → 보고서(guardReport)를 화면에 보여 준다.
5. AI 실패 → `templateDraft` (화면·DB 에 `TEMPLATE` = "템플릿 초안 · AI 미사용" 로 표시).
6. 학생 편집본은 재생성으로 덮어쓰지 않는다. 검증·평가 원문·증빙은 편집 대상이 아니라 문서에 원본을 붙인다 (`document.ts`).

## 신뢰 지표 (P2)
- 티어 = 검증된 프로젝트 수 (새싹 0 · 브론즈 1 · 실버 3 · 골드 6). 유료 공고 지원 자격 = 1개 이상.
- 협업 온도 = 36.5 + 의뢰인의 기한·소통·인계 평가.
- 뱃지 = 실제 활동 기록 (첫 검증, 현장에서 쓰인 결과물, 분야별 검증 경험).
- 랭킹은 기존 공식(해결 수×10 + 평가 평균×4 + 난이도×3)을 유지하고, 승인 시 기존 `portfolio_cards`·`reviews` 도 채운다.

## 테스트
- `npm test` : 워크플로 엔진·준비도·Narrative guard 단위 테스트 + 마이그레이션을 PGlite 에 올린 DB 함수·RLS 테스트
- `npm run check:functions` : Edge Function Deno 타입 검사
- `npm run test:e2e` : mock 모드 디자인 프로젝트 End-to-End (Playwright)

## 로드맵
1. 실제 Notion 계정으로 OAuth·저장 검증  2. 팀 프로젝트: 역할별 기록·팀원별 포트폴리오 화면  3. 알림 생성 규칙 + 푸시
4. 공고 위치 지도 선택  5. 관리자(주민센터) 화면  6. Capacitor 앱에서 Notion OAuth 복귀(딥링크)
