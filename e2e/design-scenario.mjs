// 디자인 프로젝트 End-to-End (mock 모드): 공고 → 지원 → 선정 → 기록(건너뛰기 포함) → 증빙 → v1 → 보완 → v2 → 승인·검증 → 준비도 → 포트폴리오 → 편집 → Notion 패널
// 실행: .env.local 로 mock 모드(두 값을 비움) → npm run dev → npm run test:e2e  (처음 한 번: npx playwright install chromium)
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "e2e/shots";
mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log("✔", ...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
// 실제 PNG 두 장 (Before / 최종본) 을 브라우저 스크린샷으로 만든다
await page.setContent('<div style="font:40px sans-serif;padding:40px;background:#eee">OLD MENU 38 items</div>'); writeFileSync(`${SHOTS}/before.png`, await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 200 } }));
await page.setContent('<div style="font:40px sans-serif;padding:40px;background:#e8f3ff">NEW MENU 4 zones</div>'); writeFileSync(`${SHOTS}/menu-final.png`, await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 200 } }));

async function as(userId) {
  await page.goto(`${BASE}/me/`);
  await page.evaluate((id) => localStorage.setItem("wolgye-user", id), userId);
}
const go = async (path) => { await page.goto(`${BASE}${path}`); await page.waitForLoadState("networkidle"); };
const click = (name, opts = {}) => page.getByRole("button", { name, exact: opts.exact ?? false }).first().click();
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 8000 }); };
/** 포트폴리오 페이지의 편집본 버전 (⋯ 메뉴 안에 있다) */
const version = async (v) => { await page.getByRole("button", { name: "더보기" }).click(); await expectText(`편집본 v${v}`); await page.getByRole("button", { name: "닫기" }).click(); };

process.on("unhandledRejection", async (e) => { console.error("FAIL:", e?.message ?? e); try { await shot("fail"); console.error("URL:", page.url()); } catch {} process.exit(1); });
try {
// 0. 깨끗한 데모 데이터
await go("/me/");
await page.evaluate(() => { localStorage.clear(); });

// 1. 점주(행복분식 r2)가 메뉴판 개선 공고 등록
await as("r2"); await go("/posts/new/");
await page.getByPlaceholder("어떤 도움이 필요한가요?").fill("분식집 메뉴판 개선 (E2E)");
await page.getByRole("button", { name: "디자인", exact: true }).click();
await page.getByPlaceholder("예: 메뉴가 한 판에 섞여 있어").fill("메뉴가 한 판에 섞여 있어 손님이 메뉴를 못 찾아요");
await page.getByPlaceholder("원하는 결과물, 가능한 시간, 제공할 자료").fill("벽에 붙일 메뉴판이 필요해요");
await page.locator("textarea").nth(3).fill("A2 메뉴판 인쇄 파일 1종\n원본 디자인 파일");
await page.getByPlaceholder("예: 인쇄소에 바로 넘길 수 있는 PDF").fill("인쇄소에 바로 넘길 수 있는 PDF");
await page.getByPlaceholder(/예: 음료 쿠폰/).fill("음료 쿠폰 5장 · 유효기간 3개월");   // main 에서 필수가 된 보상 쿠폰
await click("등록하기");
await page.waitForURL(/posts\/detail/);
const postId = new URL(page.url()).searchParams.get("id");
await expectText("해결할 문제와 완료 기준");
log("1 공고 등록", postId);

// 2. 학생(김하늘 s1) 지원
await as("s1"); await go(`/posts/detail/?id=${postId}`);
await page.getByLabel("지원 메시지").fill("Figma 로 정보 구조부터 정리해 볼게요");
await click("지원하기");
await expectText("확인 대기 중");
log("2 학생 지원");

// 3. 선정되지 않은 학생(박도윤 s2)도 지원만 해 둔다 (나중에 제출 권한 없음 확인)
await as("s2"); await go(`/posts/detail/?id=${postId}`);
await page.getByLabel("지원 메시지").fill("저도 지원합니다"); await click("지원하기"); await expectText("확인 대기 중");

// 4. 점주가 김하늘 선정 → 프로젝트
await as("r2"); await go(`/posts/detail/?id=${postId}`);
await page.locator("li", { hasText: "김하늘" }).getByRole("button", { name: "선정" }).click();
await page.waitForURL(/projects\/detail/);
const projectId = new URL(page.url()).searchParams.get("id");
await expectText("학생이 작업 중이에요");
log("3 점주 선정 → 프로젝트", projectId);

// 5. 학생: 시작 질문 (1개 답, 짧은 답 → 후속 질문, 1개 건너뛰기)
await as("s1"); await go(`/projects/detail/?id=${projectId}`);
await page.getByRole("link", { name: "시작 기록하기" }).click();
await page.waitForURL(/q=d_target/);
await page.getByRole("button", { name: "매장 방문 손님" }).click();
await expectText("자동 저장됨");
await shot("05-question");
await click("다음", { exact: true });
await page.waitForURL(/q=d_problem/);
// 모든 질문에 답변 예시가 보이고, 입력해도 사라지지 않는다
await expectText("답변 예시");
await page.locator("textarea").first().fill("메뉴가 너무 복잡함");
await expectText("답변 예시");
// 새로고침해도 답이 남는지 (자동 저장)
await page.waitForTimeout(1200); await page.reload(); await page.waitForLoadState("networkidle");
const kept = await page.locator("textarea").first().inputValue();
if (kept !== "메뉴가 너무 복잡함") throw new Error(`새로고침 후 답 손실: "${kept}"`);
log("4 새로고침 후 답 유지");
await click("다음", { exact: true });
await expectText("추천 질문");
await shot("06-followup");
await page.locator("textarea").nth(1).fill("손님들이 주문할 때마다 대표 메뉴가 뭐냐고 물어봤어요");
if ((await page.getByText("답변 예시").count()) < 2) throw new Error("후속 질문에 답변 예시가 없음");
await click("저장하고 다음");
await page.waitForURL(/q=d_before/);
// 뒤로 가기 → 이전 답 유지
await page.goBack(); await page.waitForURL(/q=d_problem/); await page.waitForLoadState("networkidle");
if ((await page.locator("textarea").first().inputValue()) !== "메뉴가 너무 복잡함") throw new Error("뒤로 가기 후 답 손실");
log("5 뒤로 가기 후 답 유지");
await page.goForward(); await page.waitForURL(/q=d_before/); await page.waitForLoadState("networkidle");
await click("건너뛰기");
await page.waitForURL(/done=1/);
await expectText("건너뜀");
log("6 질문 건너뛰기 → 요약에 '건너뜀'");

// 6. Before 이미지 증빙
await page.getByRole("link", { name: /Before 이미지/ }).click();
await page.waitForURL(/projects\/evidence/);
await page.locator('input[type="file"]').setInputFiles(`${SHOTS}/before.png`);
await page.getByRole("checkbox", { name: /이 파일은 링크를 아는 누구나/ }).check();
await page.getByPlaceholder("예: 작업 전 메뉴판").fill("작업 전 메뉴판 (메뉴 38개가 한 판에)");
await click("증빙 저장");
await page.waitForURL(/done=1/);
log("7 Before 이미지 등록");

// 나머지 시작 질문 (제약 조건은 해당 없음, 목표·역할 답)
await page.getByRole("link", { name: "이어서 답하기" }).click();
await page.waitForURL(/q=d_constraints/);
await click("해당 없음");
await page.waitForURL(/q=d_goal/);
await page.locator("input").first().fill("손님이 메뉴를 빨리 고르게 하기");
await click("다음", { exact: true });
await page.waitForURL(/q=d_role/);
await page.getByRole("button", { name: "시안 디자인" }).click();
await page.getByRole("button", { name: "최종 디자인" }).click();
await click("다음", { exact: true });
await page.waitForURL(/done=1/);

// 7. 진행: 중간 기록 + 질문
await go(`/projects/log/?id=${projectId}&stage=PROGRESS`);
await page.waitForURL(/q=d_reference/);
await click("해당 없음");
await page.waitForURL(/q=d_decision/);
await page.locator("textarea").first().fill("메뉴를 식사·분식·음료·사이드 4개 카테고리로 나누고 대표 메뉴 3개를 맨 위에 크게 배치");
await click("다음", { exact: true });
await page.waitForURL(/q=d_rationale/);
await page.locator("textarea").first().fill("손님들이 대표 메뉴를 가장 많이 물어봐서 먼저 보이게 하려고");
await click("다음", { exact: true });
await page.waitForURL(/done=1/);
await page.getByLabel("중간 기록").fill("점주님과 시안 2개 중 B안으로 결정, 가격 표기를 크게 하기로 함");
await click("기록 저장");
await expectText("B안으로 결정");
log("8 중간 활동 기록");
await page.getByRole("link", { name: "이어서 답하기" }).click();
// 새 질문: 다른 방법(해당 없음 가능) → 과정 → 확인 방법
await page.waitForURL(/q=d_alternatives/);
await expectText("QR 메뉴판도 생각했지만");
await click("해당 없음");
await page.waitForURL(/q=d_process/);
await page.locator("textarea").first().fill("기존 메뉴 분류 → 시안 2종 → 점주 피드백 → 최종본");
await click("다음", { exact: true });
await page.waitForURL(/q=d_validation/);
await page.getByRole("button", { name: "의뢰인·손님에게 질문" }).click();
await page.locator("input").first().fill("시안 2종을 점주님께 보여 드리고 어느 쪽이 손님에게 쉬울지 여쭤봤어요");
await click("다음", { exact: true });
await page.waitForURL(/done=1/);
log("8b 새 질문(다른 방법·확인 방법) + 답변 예시");

// 8. 마무리 질문 + 결과물 업로드
await go(`/projects/log/?id=${projectId}&stage=FINISH`);
await page.waitForURL(/q=d_deliverable/);
await page.locator("input").first().fill("A2 메뉴판 인쇄용 PDF 1종 + Figma 원본");
await click("다음", { exact: true });
await page.waitForURL(/q=d_after/);
await page.locator("textarea").first().fill("메뉴가 4개 구역으로 나뉘어 대표 메뉴가 먼저 보여요");
await click("다음", { exact: true });
await page.waitForURL(/q=d_tools/);
await page.getByRole("button", { name: "Figma" }).click();
await click("다음", { exact: true });
await page.waitForURL(/done=1/);
await page.getByRole("link", { name: /결과물 파일/ }).click();
await page.locator('input[type="file"]').setInputFiles(`${SHOTS}/menu-final.png`);
await page.getByRole("checkbox", { name: /이 파일은 링크를 아는 누구나/ }).check();
await page.getByPlaceholder("예: 작업 전 메뉴판").fill("최종 메뉴판 v1");
await click("증빙 저장");
await page.waitForURL(/done=1/);
log("9 결과물 업로드");

// 9. 선정 안 된 학생은 제출 화면 진입 불가
await as("s2"); await go(`/projects/submit/?id=${projectId}`);
await expectText("선정된 학생만 제출할 수 있어요");
log("10 비선정 학생 제출 차단");

// 10. v1 제출
await as("s1"); await go(`/projects/submit/?id=${projectId}`);
await page.getByPlaceholder("예: 인쇄용 PDF 와 원본 파일을 함께 올렸어요").fill("1차 시안입니다");
await click("v1 제출하기");
await page.waitForURL(/projects\/detail/);
await expectText("의뢰인이 검토 중이에요");
log("11 v1 제출");

// 11. 다른 점주는 검토 불가, 점주가 보완 요청
await as("r1"); await go(`/projects/review/?id=${projectId}`);
await expectText("의뢰인만 검토할 수 있어요");
log("12 다른 점주 검토 차단");
await as("r2"); await go(`/projects/review/?id=${projectId}`);
await page.getByRole("tab", { name: /보완 요청/ }).click();
await page.getByPlaceholder("예: 가격 글씨를 더 크게 해 주세요").fill("가격 글씨를 더 크게 해 주세요");
await click("보완 요청 보내기");
await page.waitForURL(/projects\/detail/);
await expectText("보완을 기다리는 중");
log("13 보완 요청");

// 12. 학생 수정 → v2
await as("s1"); await go(`/projects/detail/?id=${projectId}`);
await expectText("가격 글씨를 더 크게");
await page.getByRole("link", { name: /v2 제출하기/ }).click();
await page.getByPlaceholder("예: 가격 글씨를 14pt → 20pt 로 키웠어요").fill("가격 글씨를 14pt → 20pt 로 키웠어요");
await click("v2 제출하기");
await page.waitForURL(/projects\/detail/);
log("14 v2 재제출");

// 13. 점주 승인 + Claim 검증 + 평가
await as("r2"); await go(`/projects/review/?id=${projectId}`);
await expectText("제출 v2");
for (const c of ["학생이 실제로 작업함", "기록된 역할이 맞음", "결과물을 전달받음", "완료 기준을 충족함", "실제로 사용되고 있음"]) await page.getByText(c, { exact: true }).click();
for (const r of ["만족도 5점", "기한 준수 4점", "소통 5점", "인계 4점", "결과물 품질 5점"]) await page.getByRole("radio", { name: r }).click();
await page.locator("textarea").last().fill("손님들이 메뉴를 훨씬 빨리 고르세요. 주문 받기가 편해졌어요.");
await shot("13-review");
await click("v2 승인하고 검증 남기기");
await page.waitForURL(/projects\/detail/);
await expectText("완료·검증된 프로젝트");
log("15 승인 + 의뢰인 검증 + 평가");

// 14. 학생: 검증 표시 + 준비도 + 누락 보완
await as("s1"); await go(`/projects/detail/?id=${projectId}`);
await expectText("의뢰인 검증 완료");
await expectText("포트폴리오 자료 준비도");
const before = await page.locator("[role=progressbar]").getAttribute("aria-valuenow");
await shot("14-verified");
await page.locator("li", { hasText: "회고" }).getByRole("link").first().click();
await page.waitForURL(/q=d_reflection/);
await page.locator("textarea").first().fill("첫 미팅에서 우선순위를 먼저 정했으면 수정이 줄었을 것 같아요");
await click("다음", { exact: true });
await page.waitForURL(/projects\/detail/);
const after = await page.locator("[role=progressbar]").getAttribute("aria-valuenow");
if (!(Number(after) > Number(before))) throw new Error(`준비도 증가 안 함 ${before} → ${after}`);
log(`16 누락 보완 → 준비도 ${before}% → ${after}%`);

// 15. 포트폴리오 생성 → 변환 화면
await page.getByRole("link", { name: "포트폴리오 만들기" }).click();
await page.waitForURL(/portfolio\/build/);
await click("포트폴리오 초안 만들기");
// 초안 전 점검: 보완 요청을 받았는데 '피드백 반영'이 비어 있다 → 1가지만 묻는다
// (문제 답 "메뉴가 너무 복잡함"은 짧지만 후속 답에 "물어봤어요"가 있어 근거·길이 모두 충분)
await expectText("초안 전에 1가지만 더 물어볼게요");
await expectText('보완 요청 "가격 글씨를 더 크게 해 주세요"을 받고 무엇을 바꿨나요?');
await expectText("요청을 받고, 메뉴 이름 옆에 고추 아이콘으로");    // 점검 질문에도 답변 예시
await shot("15a-gapcheck");
await page.getByLabel(/보완 요청 "가격 글씨를/).fill("가격 글씨를 14pt에서 20pt로 키우고 가격을 오른쪽 끝에 맞췄어요");
await click("저장하고 초안 만들기");
await expectText("기록이 어떻게 바뀌었나");
await expectText("가격을 오른쪽 끝에 맞췄어요");                    // 점검 답이 초안 재료로 들어갔다
log("17a 초안 전 점검(보완 요청 반영) → 답이 초안 재료에 반영");
await expectText("템플릿 초안 · AI 미사용");
const transform = await page.locator(".card", { hasText: "기록이 어떻게 바뀌었나" }).innerText();
if (transform.includes("정해진 크기")) throw new Error("해당 없음/건너뛴 항목이 초안에 들어감");
await shot("15-transform");
log("17 포트폴리오 초안 생성 + 변환 화면 (mock = 템플릿 초안 표시)");
// 중복 생성 방지: 같은 기록으로 다시 누르면 기존 초안
await click("기록이 바뀌었으면 새 초안 만들기");
await expectText("기존 초안을 그대로");
log("18 중복 생성 방지");

// 16. 초안 → 포트폴리오 페이지: 처음이면 디자인부터 고른다 (초안 화면에는 글 편집 칸이 없다)
if (await page.getByLabel(/^제목/).count()) throw new Error("초안 화면에 폼 편집기가 남아 있음");
await click("이 초안으로 포트폴리오 만들기");
await page.waitForURL(/portfolio\/templates/);
await expectText("포트폴리오 디자인을 골라 주세요");
await page.getByRole("option", { name: "에디토리얼" }).click();
await shot("16a-templates");
await click("‘에디토리얼’ 디자인 쓰기");
await page.waitForURL(/portfolio\/view/);
await expectText("월계 재능나눔 · 의뢰인 검증 포트폴리오");          // 에디토리얼 템플릿의 꼬리말
await version(2);                                                   // v1 초안 + 디자인 선택 = v2
log("19 템플릿 넘겨 보고 고르기 → 포트폴리오 페이지");

// 17. 같은 페이지에서 편집 → 저장하면 버전이 쌓인다. 잠긴 원본에는 입력칸이 없다
await click("편집", { exact: true });
await expectText("잠김 · 의뢰인 원본");
for (const box of await page.locator("[data-locked]").all()) {
  if (await box.locator("textarea, input").count()) throw new Error("잠긴 블록에 입력칸이 있음");
}
await page.getByLabel("제목", { exact: true }).fill("행복분식 메뉴판 정보 구조 개선");
await page.getByLabel("한 줄 요약", { exact: true }).fill("38개 메뉴를 4개 구역으로 재구성해 손님이 대표 메뉴를 먼저 찾도록 만든 디자인 프로젝트");
await shot("16b-editing");
await click("v3 저장");
await version(3);
await expectText("행복분식 메뉴판 정보 구조 개선");
await expectText("의뢰인 평가");
await expectText("손님들이 메뉴를 훨씬 빨리");
if (await page.locator("textarea").count()) throw new Error("저장 뒤에도 입력칸이 남아 있음");
log("20 페이지에서 바로 편집 → v3 저장 (잠긴 원본은 입력칸 없음)");

// 18. 디자인 바꾸기 → 글은 그대로
await click("디자인", { exact: true });
await page.waitForURL(/portfolio\/templates/);
await expectText("지금 쓰는 디자인");
await page.getByRole("option", { name: "기본" }).click();
await click("‘기본’ 디자인 쓰기");
await page.waitForURL(/portfolio\/view/);
await version(4);
await expectText("행복분식 메뉴판 정보 구조 개선");
if (await page.getByText("월계 재능나눔 · 의뢰인 검증 포트폴리오").count()) throw new Error("기본 템플릿으로 바뀌지 않음");
log("21 디자인 바꾸기 → 글은 그대로, 버전 v4");

// 19. Notion 은 '⋯' 메뉴 안의 선택 기능
await page.getByRole("button", { name: "더보기" }).click();
await expectText("Notion으로도 내보내기");
await expectText("데모 모드에서는 실제 계정 연결·저장을 사용할 수 없어요.");
await shot("16c-menu");
await page.getByRole("button", { name: "닫기" }).click();
log("22 Notion 내보내기는 더보기 메뉴의 선택 기능");

// 20. 재생성해도 편집본 유지 + 새 초안 안내
await go(`/portfolio/build/?id=${projectId}`);
await expectText("저장된 편집본 v4");
await click("같은 기록으로 다시 생성");
await page.waitForTimeout(500);
await go(`/portfolio/view/?id=${projectId}&s=s1`);
await expectText("행복분식 메뉴판 정보 구조 개선");
await expectText("새 초안이 있어요");
log("23 재생성 후에도 편집본 유지 + 새 초안 안내");

// 21. 갤러리에 공개 → 다른 학생이 피드에서 누르면 간단한 게시물 화면, 거기서 '자세한 포트폴리오 보기' → 읽기 전용 HTML 페이지
await go("/portfolio/");
await page.locator("div").filter({ hasText: "행복분식 메뉴판 정보 구조 개선" }).getByRole("button", { name: "갤러리에 공개" }).last().click();
await expectText("자세한 포트폴리오 보기' 버튼이 붙어");
await click("이 내용을 갤러리에 공개");
await page.waitForTimeout(500);
await as("s2"); await go("/portfolio/gallery/?s=s1");
await page.getByRole("link", { name: /행복분식 메뉴판 정보 구조 개선/ }).first().click();
await page.waitForURL(/portfolio\/experience/);                      // 피드는 지금처럼 간단한 게시물 화면
await page.getByRole("link", { name: "자세한 포트폴리오 보기" }).click();
await page.waitForURL(/portfolio\/view/);
await expectText("손님들이 메뉴를 훨씬 빨리");
await expectText("38개 메뉴를 4개 구역으로");
if (await page.getByRole("button", { name: "편집", exact: true }).count()) throw new Error("소유자가 아닌데 편집 버튼이 보임");
if (await page.locator("textarea, [data-editable]").count()) throw new Error("소유자가 아닌데 입력칸이 있음");
await shot("16d-public");
log("24 피드 → 게시물 화면 → '자세한 포트폴리오 보기' → 남의 포트폴리오 페이지 (읽기 전용)");

// 22. 데모 데이터: 김하늘 피드 5개는 완료 프로젝트, HTML 포트폴리오는 메뉴판 1개만 → 버튼도 그 게시물에만
await go("/portfolio/gallery/?s=s1");
await page.getByRole("link", { name: /외국인 손님을 위한 한식당 영문 메뉴판/ }).first().click();
await page.waitForURL(/portfolio\/experience/);
await expectText("메뉴를 두 구역으로 줄이고");
await page.getByRole("link", { name: "자세한 포트폴리오 보기" }).click();
await page.waitForURL(/portfolio\/view/);
await expectText("월계 재능나눔 · 의뢰인 검증 포트폴리오");          // 에디토리얼 디자인
await expectText("이제 외국인 손님이 메뉴판만 보고 바로 주문해요");
await shot("16f-demo-menu");
await go("/portfolio/gallery/?s=s1");
await page.getByRole("link", { name: /미용실 가게 홍보 배너/ }).first().click();
await page.waitForURL(/portfolio\/experience/);
await expectText("업종 이름을 가장 크게");
await page.waitForTimeout(800);
if (await page.getByRole("link", { name: "자세한 포트폴리오 보기" }).count()) throw new Error("HTML 포트폴리오가 없는 게시물에 버튼이 보임");
log("25 데모 완료 프로젝트 5개 · 메뉴판만 '자세한 포트폴리오 보기'");

// (예전 21단계 '티어·뱃지 표시'는 main 에서 티어 화면이 분야 표시로 바뀌어(0017) 뺐다)

} catch (e) { console.error("FAIL:", e.message.split(/\r?\n/).slice(0, 6).join(" | ")); console.error("URL:", page.url()); await shot("fail"); process.exitCode = 1; }
if (errors.length) { console.error("페이지 에러:", errors); process.exitCode = 1; }
await browser.close();
console.log("E2E 완료");
