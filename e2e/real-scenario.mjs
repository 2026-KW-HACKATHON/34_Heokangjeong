// 실제 Supabase 로 도는 디자인 프로젝트 End-to-End.
// 가입(점주·학생·비선정 학생) → 공고 → 지원 → 선정 → 기록 → 증빙(Storage 업로드) → v1 → 보완 → v2 → 승인·검증 → 준비도 → 포트폴리오(AI/템플릿) → 편집
// 실행: .env 가 실제 Supabase 를 가리키는 상태로 npm run dev → BASE_URL=http://localhost:3000 node e2e/real-scenario.mjs
// ⚠️ 공유 DB 에 테스트 계정·데이터가 생긴다. 만든 id 는 e2e/shots/real-run.json 에 남기고, 끝나면 정리 SQL 로 지운다.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "e2e/shots";
mkdirSync(SHOTS, { recursive: true });
const TS = Date.now();
const run = { ts: TS, emails: [], postId: null, projectId: null, notes: [] };
const save = () => writeFileSync(`${SHOTS}/real-run.json`, JSON.stringify(run, null, 2));
const log = (...a) => { console.log("✔", ...a); };

const browser = await chromium.launch();
const errors = [];
async function actor(tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  page.on("dialog", (d) => d.accept());
  return page;
}
const owner = await actor("owner"), stu = await actor("stu"), other = await actor("other");
await owner.setContent('<div style="font:40px sans-serif;padding:40px;background:#eee">OLD MENU 38 items</div>');
writeFileSync(`${SHOTS}/before.png`, await owner.screenshot({ clip: { x: 0, y: 0, width: 390, height: 200 } }));
await owner.setContent('<div style="font:40px sans-serif;padding:40px;background:#e8f3ff">NEW MENU 4 zones</div>');
writeFileSync(`${SHOTS}/menu-final.png`, await owner.screenshot({ clip: { x: 0, y: 0, width: 390, height: 200 } }));

const go = async (p, path) => { await p.goto(`${BASE}${path}`); await p.waitForLoadState("networkidle"); };
const click = (p, name, exact = false) => p.getByRole("button", { name, exact }).first().click();
const see = (p, t, timeout = 15000) => p.getByText(t, { exact: false }).first().waitFor({ timeout });
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/real-${n}.png`, fullPage: true });

async function signUp(p, kind, name) {
  const email = `e2e-${kind}-${TS}@example.com`;
  run.emails.push(email); save();
  await go(p, "/login/");
  await p.getByRole("button", { name: /처음이에요/ }).click();
  await p.getByPlaceholder("이메일").fill(email);
  await p.getByPlaceholder(/비밀번호/).fill(`E2e!${TS}`);
  await p.getByRole("button", { name: "가입하기", exact: true }).click();
  await p.waitForURL(/onboarding/, { timeout: 20000 });
  if (kind === "owner") {
    await p.getByRole("button", { name: /주민·상인/ }).click();
    await p.getByPlaceholder(/상호 또는 이름/).fill(name);
    await p.getByPlaceholder(/주소/).fill("광운로 21");
  } else {
    await p.getByPlaceholder("이름", { exact: true }).fill(name);
    await p.getByPlaceholder(/학과/).fill("디자인학과");
    await p.getByPlaceholder(/보유 기술/).fill("Figma, 포스터");
  }
  await click(p, "시작하기");
  await p.waitForURL((u) => !/onboarding|login/.test(u.pathname), { timeout: 20000 });
}

try {
  const OWNER = `E2E분식${TS % 10000}`, STU = `E2E하늘${TS % 10000}`, OTHER = `E2E도윤${TS % 10000}`;
  await signUp(owner, "owner", OWNER);
  await signUp(stu, "student", STU);
  await signUp(other, "other", OTHER);
  log("0 실제 가입 3명 (점주·학생·비선정 학생)");

  // 1. 공고
  await go(owner, "/posts/new/");
  await owner.getByPlaceholder("어떤 도움이 필요한가요?").fill(`[E2E] 분식집 메뉴판 개선 ${TS}`);
  await owner.getByRole("button", { name: "디자인", exact: true }).click();
  await owner.getByPlaceholder("예: 메뉴가 한 판에 섞여 있어").fill("메뉴가 한 판에 섞여 있어 손님이 메뉴를 못 찾아요");
  await owner.getByPlaceholder("원하는 결과물, 가능한 시간, 제공할 자료").fill("벽에 붙일 메뉴판이 필요해요 (자동 테스트 공고)");
  await owner.locator("textarea").nth(3).fill("A2 메뉴판 인쇄 파일 1종\n원본 디자인 파일");
  await owner.getByPlaceholder("예: 인쇄소에 바로 넘길 수 있는 PDF").fill("인쇄소에 바로 넘길 수 있는 PDF");
  await click(owner, "등록하기");
  await owner.waitForURL(/posts\/detail/);
  run.postId = new URL(owner.url()).searchParams.get("id"); save();
  await see(owner, "해결할 문제와 완료 기준");
  log("1 공고 등록 (새 칼럼 저장)", run.postId);

  // 2. 지원 (학생·비선정 학생)
  for (const [p, m] of [[stu, "Figma 로 정보 구조부터 정리해 볼게요"], [other, "저도 지원합니다"]]) {
    await go(p, `/posts/detail/?id=${run.postId}`);
    await p.getByLabel("지원 메시지").fill(m);
    await click(p, "지원하기");
    await see(p, "확인 대기 중");
  }
  log("2 학생 2명 지원");

  // 3. 선정 → select_applicant RPC
  await go(owner, `/posts/detail/?id=${run.postId}`);
  await owner.locator("li", { hasText: STU }).getByRole("button", { name: "선정" }).click();
  await owner.waitForURL(/projects\/detail/, { timeout: 20000 });
  run.projectId = new URL(owner.url()).searchParams.get("id"); save();
  await see(owner, "학생이 작업 중이에요");
  log("3 선정 → 프로젝트 (DB 함수)", run.projectId);

  // 4. 학생 기록: 답·후속 질문·건너뛰기
  const P = run.projectId;
  await go(stu, `/projects/detail/?id=${P}`);
  await stu.getByRole("link", { name: "시작 기록하기" }).click();
  await stu.waitForURL(/q=d_target/);
  await stu.getByRole("button", { name: "매장 방문 손님" }).click();
  await see(stu, "자동 저장됨");
  await click(stu, "다음", true);
  await stu.waitForURL(/q=d_problem/);
  await stu.locator("textarea").first().fill("메뉴가 너무 복잡함");
  await stu.waitForTimeout(1500); await stu.reload(); await stu.waitForLoadState("networkidle");
  await stu.locator("textarea").first().waitFor();
  const kept = await stu.locator("textarea").first().inputValue();
  if (kept !== "메뉴가 너무 복잡함") throw new Error(`새로고침 후 답 손실: "${kept}"`);
  log("4 새로고침 후 답 유지 (DB 자동 저장)");
  await click(stu, "다음", true);
  await see(stu, "추천 질문", 30000);
  // 규칙 기반 질문이 바로 뜨고, AI 질문이 도착하면 바뀐다 (최대 35초 대기)
  await stu.getByText("✨ AI 추천 질문").first().waitFor({ timeout: 35000 }).catch(() => {});
  const fuLabel = (await stu.getByText(/추천 질문/).first().innerText()).trim();
  run.notes.push(`후속 질문 출처: ${fuLabel}`); save();
  await shot(stu, "followup");
  await stu.locator("textarea").nth(1).fill("손님들이 주문할 때마다 대표 메뉴가 뭐냐고 물어봤어요");
  await click(stu, "저장하고 다음");
  await stu.waitForURL(/q=d_before/);
  await click(stu, "건너뛰기");
  await stu.waitForURL(/done=1/);
  await see(stu, "건너뜀");
  log(`5 후속 질문(${fuLabel.includes("AI") ? "AI" : "규칙"}) 답변 + 건너뛰기`);

  // 5. Before 이미지 → Storage 업로드
  await stu.getByRole("link", { name: /Before 이미지/ }).click();
  await stu.locator('input[type="file"]').setInputFiles(`${SHOTS}/before.png`);
  await stu.getByPlaceholder("예: 작업 전 메뉴판").fill("작업 전 메뉴판 (메뉴 38개가 한 판에)");
  await click(stu, "증빙 저장");
  await stu.waitForURL(/done=1/, { timeout: 30000 });
  log("6 Before 이미지 Storage 업로드");

  await stu.getByRole("link", { name: "이어서 답하기" }).click();
  await stu.waitForURL(/q=d_constraints/);
  await click(stu, "해당 없음");
  await stu.waitForURL(/q=d_goal/);
  await stu.locator("input").first().fill("손님이 메뉴를 빨리 고르게 하기");
  await click(stu, "다음", true);
  await stu.waitForURL(/q=d_role/);
  await stu.getByRole("button", { name: "시안 디자인" }).click();
  await stu.getByRole("button", { name: "최종 디자인" }).click();
  await click(stu, "다음", true);
  await stu.waitForURL(/done=1/);

  await go(stu, `/projects/log/?id=${P}&stage=PROGRESS`);
  await stu.waitForURL(/q=d_reference/);
  await click(stu, "해당 없음");
  await stu.waitForURL(/q=d_decision/);
  await stu.locator("textarea").first().fill("메뉴를 식사·분식·음료·사이드 4개 카테고리로 나누고 대표 메뉴 3개를 맨 위에 크게 배치");
  await click(stu, "다음", true);
  await stu.waitForURL(/q=d_rationale/, { timeout: 30000 });
  await stu.locator("textarea").first().fill("손님들이 대표 메뉴를 가장 많이 물어봐서 먼저 보이게 하려고");
  await click(stu, "다음", true);
  await stu.waitForURL(/done=1/, { timeout: 30000 });
  await stu.getByLabel("중간 기록").fill("점주님과 시안 2개 중 B안으로 결정, 가격 표기를 크게 하기로 함");
  await click(stu, "기록 저장");
  await see(stu, "B안으로 결정");
  await stu.getByRole("link", { name: "이어서 답하기" }).click();
  await stu.waitForURL(/q=d_process/);
  await stu.locator("textarea").first().fill("기존 메뉴 분류 → 시안 2종 → 점주 피드백 → 최종본");
  await click(stu, "다음", true);
  await stu.waitForURL(/done=1/, { timeout: 30000 });
  log("7 진행 기록 + 중간 활동 기록");

  await go(stu, `/projects/log/?id=${P}&stage=FINISH`);
  await stu.waitForURL(/q=d_deliverable/);
  await stu.locator("input").first().fill("A2 메뉴판 인쇄용 PDF 1종 + Figma 원본");
  await click(stu, "다음", true);
  await stu.waitForURL(/q=d_after/);
  await stu.locator("textarea").first().fill("메뉴가 4개 구역으로 나뉘어 대표 메뉴가 먼저 보여요");
  await click(stu, "다음", true);
  await stu.waitForURL(/q=d_tools/, { timeout: 30000 });
  await stu.getByRole("button", { name: "Figma" }).click();
  await click(stu, "다음", true);
  await stu.waitForURL(/done=1/);
  await stu.getByRole("link", { name: /결과물 파일/ }).click();
  await stu.locator('input[type="file"]').setInputFiles(`${SHOTS}/menu-final.png`);
  await stu.getByPlaceholder("예: 작업 전 메뉴판").fill("최종 메뉴판");
  await click(stu, "증빙 저장");
  await stu.waitForURL(/done=1/, { timeout: 30000 });
  log("8 마무리 기록 + 결과물 업로드");

  // 6. 비선정 학생: 화면·RLS 차단
  await go(other, `/projects/submit/?id=${P}`);
  await other.getByText(/선정된 학생만 제출할 수 있어요|볼 권한이 없어요/).first().waitFor({ timeout: 15000 });
  log("9 비선정 학생 제출 차단");

  // 7. v1 → 보완 → v2
  await go(stu, `/projects/submit/?id=${P}`);
  await stu.getByPlaceholder("예: 인쇄용 PDF 와 원본 파일을 함께 올렸어요").fill("1차 시안입니다");
  await click(stu, "v1 제출하기");
  await stu.waitForURL(/projects\/detail/, { timeout: 20000 });
  await see(stu, "의뢰인이 검토 중이에요");
  await go(owner, `/projects/review/?id=${P}`);
  await owner.getByRole("tab", { name: /보완 요청/ }).click();
  await owner.getByPlaceholder("예: 가격 글씨를 더 크게 해 주세요").fill("가격 글씨를 더 크게 해 주세요");
  await click(owner, "보완 요청 보내기");
  await owner.waitForURL(/projects\/detail/, { timeout: 20000 });
  await see(owner, "보완을 기다리는 중");
  await go(stu, `/projects/detail/?id=${P}`);
  await see(stu, "가격 글씨를 더 크게");
  await stu.getByRole("link", { name: /v2 제출하기/ }).click();
  await stu.getByPlaceholder("예: 가격 글씨를 14pt → 20pt 로 키웠어요").fill("가격 글씨를 14pt → 20pt 로 키웠어요");
  await click(stu, "v2 제출하기");
  await stu.waitForURL(/projects\/detail/, { timeout: 20000 });
  log("10 v1 제출 → 보완 요청 → v2 재제출");

  // 8. 승인 + 검증 + 평가
  await go(owner, `/projects/review/?id=${P}`);
  await see(owner, "제출 v2");
  for (const c of ["학생이 실제로 작업함", "기록된 역할이 맞음", "결과물을 전달받음", "완료 기준을 충족함", "실제로 사용되고 있음"]) await owner.getByText(c, { exact: true }).click();
  for (const r of ["만족도 5점", "기한 준수 4점", "소통 5점", "인계 4점"]) await owner.getByRole("radio", { name: r }).click();
  await owner.locator("textarea").last().fill("손님들이 메뉴를 훨씬 빨리 고르세요. 주문 받기가 편해졌어요.");
  await click(owner, "v2 승인하고 검증 남기기");
  await owner.waitForURL(/projects\/detail/, { timeout: 20000 });
  await see(owner, "완료·검증된 프로젝트");
  log("11 v2 승인 + Claim 검증 + 평가 (DB 함수)");

  // 9. 준비도·보완
  await go(stu, `/projects/detail/?id=${P}`);
  await see(stu, "Client Verified");
  const before = await stu.locator("[role=progressbar]").getAttribute("aria-valuenow");
  await stu.locator("li", { hasText: "회고" }).getByRole("link").first().click();
  await stu.waitForURL(/q=d_reflection/);
  await stu.locator("textarea").first().fill("첫 미팅에서 우선순위를 먼저 정했으면 수정이 줄었을 것 같아요");
  await click(stu, "다음", true);
  await stu.waitForURL(/projects\/detail/, { timeout: 30000 });
  await stu.locator("[role=progressbar]").waitFor();
  const after = await stu.locator("[role=progressbar]").getAttribute("aria-valuenow");
  log(`12 준비도 ${before}% → ${after}%`);

  // 10. 포트폴리오 생성 (실제 portfolio-ai)
  await stu.getByRole("link", { name: "포트폴리오 만들기" }).click();
  await stu.waitForURL(/portfolio\/build/);
  await click(stu, "포트폴리오 초안 만들기");
  await see(stu, "기록이 어떻게 바뀌었나", 150000);
  const gen = (await stu.getByText(/AI 생성 초안|Template-generated draft/).first().innerText()).trim();
  const notice = await stu.locator("[role=status]").first().innerText().catch(() => "");
  run.notes.push(`초안: ${gen}${notice ? ` / ${notice}` : ""}`); save();
  await shot(stu, "transform");
  log(`13 포트폴리오 초안 생성 → ${gen}${notice ? ` (${notice})` : ""}`);
  await click(stu, "기록이 바뀌었으면 새 초안 만들기");
  await see(stu, "기존 초안을 그대로", 30000);
  log("14 중복 생성 방지");

  // 11. 편집 → 저장 → 상세
  await stu.getByLabel("제목").fill("[E2E] 분식집 메뉴판 정보 구조 개선");
  await click(stu, "포트폴리오 저장");
  await stu.waitForURL(/portfolio\/view/, { timeout: 20000 });
  await see(stu, "[E2E] 분식집 메뉴판 정보 구조 개선");
  await see(stu, "Client Feedback");
  await see(stu, "Notion 에 저장");
  const notionMsg = await stu.locator(".card", { hasText: "Notion 에 저장" }).innerText();
  run.notes.push(`Notion 패널: ${notionMsg.replace(/\s+/g, " ").slice(0, 160)}`); save();
  await shot(stu, "portfolio");
  log("15 학생 편집 저장 → 포트폴리오 상세, Notion 패널 표시");

  // 12. 재생성해도 편집본 유지
  await go(stu, `/portfolio/build/?id=${P}`);
  await click(stu, "같은 기록으로 다시 생성");
  await stu.waitForTimeout(3000);
  await see(stu, "저장된 편집본 v1", 60000);
  await go(stu, `/portfolio/view/?id=${P}`);
  await see(stu, "[E2E] 분식집 메뉴판 정보 구조 개선");
  log("16 재생성 후에도 편집본 유지");

  await go(stu, "/me/");
  await see(stu, "브론즈"); await see(stu, "첫 검증 프로젝트");
  log("17 티어·뱃지 반영");
} catch (e) {
  console.error("FAIL:", e.message.split(/\r?\n/).slice(0, 6).join(" | "));
  for (const [n, p] of [["owner", owner], ["stu", stu], ["other", other]]) { console.error(`URL ${n}:`, p.url()); await shot(p, `fail-${n}`).catch(() => {}); }
  process.exitCode = 1;
}
if (errors.length) { console.error("페이지 에러:", errors); process.exitCode = 1; }
console.log("notes:", run.notes);
await browser.close();
