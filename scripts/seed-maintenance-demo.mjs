// 유지보수·인수인계 확인용 더미 데이터.
// 네 가지 상태의 프로젝트를 한 번에 만들어서, 화면에서 바로 눌러 볼 수 있게 한다.
//   ① 완료 직후 (인수인계 미작성)  ② 보증 기간 중 (준비도 100%, 요청 1건)
//   ③ 인계 모집 중 (다른 학생이 이어받기 가능)  ④ 운영 중 (담당자 2명 거쳐감, 보증 만료)
//
// 실행: node scripts/seed-maintenance-demo.mjs
// 필요한 것: .env 의 Supabase 설정 + 0018 마이그레이션 적용 + 아래 데모 계정(없으면 자동 가입)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split("=").map((s) => s.trim())));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_KEY;
const PW = "wolgye-demo-1234";
const ACCOUNTS = {
  owner: { email: "demo.owner@wolgye-demo.com", profile: { role: "resident", name: "월계 커피 (데모)", kind: "상인", address: "월계로 45길 12", lat: 37.6248, lng: 127.0598 } },
  student: { email: "demo.student@wolgye-demo.com", profile: { role: "student", name: "김광운 (데모)", department: "소프트웨어학부", college: "AI", skills: ["Next.js", "Supabase"], interests: ["웹/앱"], available_hours: "주말", max_distance_m: 3000, lat: 37.6196, lng: 127.0592 } },
  student2: { email: "demo.student2@wolgye-demo.com", profile: { role: "student", name: "이어받 (데모)", department: "컴퓨터정보공학부", college: "AI", skills: ["React", "Vercel"], interests: ["웹/앱"], available_hours: "평일 저녁", max_distance_m: 3000, lat: 37.6210, lng: 127.0620 } },
};

const client = () => createClient(URL_, KEY, { auth: { persistSession: false } });
async function login(key) {
  const db = client(); const { email, profile } = ACCOUNTS[key];
  let { data, error } = await db.auth.signInWithPassword({ email, password: PW });
  if (error) {
    const up = await db.auth.signUp({ email, password: PW });
    if (up.error) throw up.error;
    ({ data } = await db.auth.signInWithPassword({ email, password: PW }));
  }
  const id = data.user.id;
  await db.from("profiles").upsert({ id, ...profile });
  return { db, id };
}
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const fail = (label, error) => { if (error) { console.error(`✗ ${label}:`, error.message); throw error; } };

/** 공고 → 지원 → 선정 → 제출 → 승인(완료)까지 한 번에 */
async function completedProject({ owner, student, title, description }) {
  const existing = await owner.db.from("posts").select("id").eq("title", title).maybeSingle();
  if (existing.data) {
    const p = await owner.db.from("projects").select("id").eq("post_id", existing.data.id).maybeSingle();
    console.log(`· 이미 있음: ${title}`);
    return p.data?.id;
  }
  const { data: post, error: e1 } = await owner.db.from("posts").insert({
    title, category: "웹/앱", description, problem: description, author_id: owner.id,
    lat: 37.6248, lng: 127.0598, address: "월계로 45길 12", domain: "DEVELOPMENT",
    expected_deliverables: ["동작하는 웹페이지", "관리자 수정 화면"], completion_criteria: "사장님 폰에서 열리고 메뉴가 보인다",
    duration_days: 14, difficulty: 2, compensation_type: "NON_MONETARY", compensation_description: "식사권 5장",
    ongoing: true, warranty_request_days: 30, warranty_request_count: 3, warranty_defect_days: 90, client_owned_billing: true,
  }).select().single();
  fail("공고 등록", e1);

  const { data: app, error: e2 } = await student.db.from("applications").insert({ post_id: post.id, student_id: student.id, message: "만들어 드릴게요!" }).select().single();
  fail("지원", e2);
  const { data: projectId, error: e3 } = await owner.db.rpc("select_applicant", { p_application: app.id, p_question_snapshot: { domain: "DEVELOPMENT", version: 1, questions: [], takenAt: new Date().toISOString() } });
  fail("선정", e3);

  const { data: ev, error: e4 } = await student.db.from("evidence").insert({
    project_id: projectId, author_id: student.id, type: "DELIVERABLE_URL", description: "완성된 사이트", url: "https://example.com", source: "STUDENT_LINK",
  }).select().single();
  fail("증빙", e4);
  const { data: versionId, error: e5 } = await student.db.rpc("submit_version", { p_project: projectId, p_note: "1차 완성본입니다", p_evidence_ids: [ev.id] });
  fail("제출", e5);
  const { error: e6 } = await owner.db.rpc("approve_version", {
    p_version: versionId,
    p_claims: { workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true },
    p_review: { satisfaction: 5, deadline: 5, communication: 5, handoff: 4, comment: "손님들이 편해졌어요" },
    p_note: "잘 받았습니다",
  });
  fail("승인", e6);
  console.log(`✓ 완료 프로젝트: ${title}`);
  return projectId;
}

const HANDOVER = {
  repoUrl: "https://github.com/wolgye-demo/cafe-site",
  deployUrl: "https://wolgye-cafe.example.com",
  adminHanded: true,
  envList: "Supabase(DB), 카카오 지도 키",
  monthlyCost: "도메인 연 22,000원 (매년 3월 2일), 호스팅 무료",
  billingOwner: "CLIENT",
  expiresOn: day(20),
  backupNote: "Supabase 자동 백업 7일",
  knownIssues: "사파리에서 사진 업로드가 가끔 실패해요",
};

const main = async () => {
  if (!URL_ || !KEY) throw new Error(".env 에 Supabase 설정이 없어요");
  const owner = await login("owner"), student = await login("student"), student2 = await login("student2");

  // ① 완료 직후 — 인수인계 미작성 (준비도 0%)
  await completedProject({ owner, student, title: "[데모①] 카페 소개 웹사이트", description: "가게 소개와 메뉴를 보여 주는 웹사이트가 필요해요." });

  // ② 보증 기간 중 — 인수인계 100%, 유지보수 요청 1건
  const p2 = await completedProject({ owner, student, title: "[데모②] QR 메뉴판", description: "QR 로 여는 모바일 메뉴판이 필요해요." });
  if (p2) {
    fail("인수인계 저장", (await student.db.rpc("save_handover", { p_project: p2, p_data: HANDOVER })).error);
    const t = await owner.db.rpc("create_ticket", { p_project: p2, p_kind: "CONTENT", p_body: "아메리카노 가격을 4,000원으로 바꿔 주세요" });
    fail("유지보수 요청", t.error);
  }

  // ③ 인계 모집 중 — 다른 학생이 이어받을 수 있다
  const p3 = await completedProject({ owner, student, title: "[데모③] 예약 페이지", description: "손님이 예약할 수 있는 페이지가 필요해요." });
  if (p3) {
    fail("인수인계 저장", (await student.db.rpc("save_handover", { p_project: p3, p_data: { ...HANDOVER, deployUrl: "https://wolgye-reserve.example.com" } })).error);
    const { error } = await student.db.rpc("open_handover", { p_project: p3 });
    if (error && !/INVALID|FORBIDDEN/.test(error.message)) fail("인계 요청", error);
  }

  // ④ 운영 중 — 담당자 2명을 거쳤고 보증은 끝났다
  const p4 = await completedProject({ owner, student, title: "[데모④] 주문 관리 시스템", description: "주문을 모아 보는 관리 화면이 필요해요." });
  if (p4) {
    fail("인수인계 저장", (await student.db.rpc("save_handover", { p_project: p4, p_data: { ...HANDOVER, deployUrl: "https://wolgye-order.example.com" } })).error);
    await student.db.rpc("open_handover", { p_project: p4 });
    const taken = await student2.db.rpc("take_over", { p_project: p4 });
    if (taken.error && !/INVALID_STATE/.test(taken.error.message)) fail("이어받기", taken.error);
    const t = await owner.db.rpc("create_ticket", { p_project: p4, p_kind: "BUG", p_body: "주문 목록이 가끔 안 보여요" });
    if (!t.error) await student2.db.rpc("close_ticket", { p_ticket: t.data });
  }

  console.log("\n데모 계정 (비밀번호 모두 " + PW + ")");
  for (const [k, v] of Object.entries(ACCOUNTS)) console.log(`  ${k.padEnd(8)} ${v.email}  ${v.profile.name}`);
  console.log("\n내 프로젝트 화면에서 [데모①~④] 를 눌러 확인하세요.");
};

main().catch((e) => { console.error("실패:", e.message); process.exit(1); });
