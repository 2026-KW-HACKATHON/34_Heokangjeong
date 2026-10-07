// 파이프라인 전체를 실제 Supabase 에서 계정을 바꿔가며 검증한다 (화면이 아니라 데이터 흐름 확인용).
//   공고 등록 → 긴급 알림 → 지원 → 선정 → 기록·제출 → 검증 완료 → 운영 시작
//   → 유지보수 요청(무상 범위 자동 판정) → 인수인계 작성 → 인계 요청(이어받기 공고 생성)
//   → 다른 학생 지원 → 사장님 선정 → 담당자 교체
// 실행: node scripts/verify-pipeline.mjs      (매번 새 제목으로 만들어 기존 데모 데이터와 섞이지 않는다)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split("=").map((s) => s.trim())));
const PW = "wolgye-demo-1234";
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");

let pass = 0, fail = 0;
const check = (label, okFlag, detail = "") => {
  console.log(`${okFlag ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  okFlag ? pass++ : fail++;
};
const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_KEY, { auth: { persistSession: false } });
async function login(email) {
  const db = mk();
  let { data, error } = await db.auth.signInWithPassword({ email, password: PW });
  if (error) { await db.auth.signUp({ email, password: PW }); ({ data } = await db.auth.signInWithPassword({ email, password: PW })); }
  return { db, id: data.user.id, email };
}
const must = (label, { data, error }) => { if (error) { check(label, false, error.message); throw new Error(error.message); } return data; };
const snapshot = { domain: "DEVELOPMENT", version: 1, questions: [], takenAt: new Date().toISOString() };

const main = async () => {
  const owner = await login("demo.owner@wolgye-demo.com");
  const stu = await login("demo.student@wolgye-demo.com");
  const stu2 = await login("demo.student2@wolgye-demo.com");

  console.log("\n① 공고 등록 (계속 운영되는 결과물 + 긴급)");
  const title = `[검증 ${stamp}] 가게 웹사이트`;
  const post = must("공고 등록", await owner.db.from("posts").insert({
    title, category: "웹/앱", description: "사이트를 만들어 주세요", problem: "온라인에서 가게를 찾을 수 없어요",
    author_id: owner.id, lat: 37.6248, lng: 127.0598, address: "월계로 45길 12", domain: "DEVELOPMENT",
    expected_deliverables: ["웹페이지"], completion_criteria: "폰에서 열린다", duration_days: 14, difficulty: 2,
    compensation_type: "PAID", paid_amount: 50000, urgent: true, urgent_colleges: ["AI"],
    ongoing: true, warranty_request_days: 30, warranty_request_count: 3, warranty_defect_days: 90, client_owned_billing: true,
  }).select().single());
  check("공고가 등록된다", !!post.id);
  check("긴급 + 계속 운영되는 결과물로 저장", post.urgent === true && post.ongoing === true);

  const cheap = await owner.db.from("posts").insert({ ...post, id: undefined, title: title + " (싼 긴급)", paid_amount: 5000 }).select().single();
  check("최소 사례비 미만 긴급 공고는 거절된다", !!cheap.error, cheap.error?.message.slice(0, 40));

  console.log("\n② 긴급 알림");
  const notis = must("알림 조회", await stu.db.from("notifications").select("*").eq("post_id", post.id));
  check("단과대학이 맞는 학생에게 긴급 알림이 간다", notis.length === 1, notis[0]?.text);
  check("알림 종류가 URGENT_POST", notis[0]?.kind === "URGENT_POST");

  const quiet = must("평소 공고 등록", await owner.db.from("posts").insert({
    title: title + " (평소)", category: "웹/앱", description: "천천히", problem: "x", author_id: owner.id,
    lat: 37.6248, lng: 127.0598, address: "월계로 45길 12", domain: "DEVELOPMENT", duration_days: 7, difficulty: 1,
  }).select().single());
  const quietNoti = must("평소 공고 알림 조회", await stu.db.from("notifications").select("id").eq("post_id", quiet.id));
  check("평소 공고는 알림이 가지 않는다", quietNoti.length === 0);

  console.log("\n③ 지원 → 선정 → 제출 → 검증 완료");
  const app = must("지원", await stu.db.from("applications").insert({ post_id: post.id, student_id: stu.id, message: "만들어 드릴게요" }).select().single());
  check("긴급(유료) 공고에 검증 경험 없이도 지원된다", !!app.id);
  const projectId = must("선정", await owner.db.rpc("select_applicant", { p_application: app.id, p_question_snapshot: snapshot }));
  check("사장님이 선정하면 프로젝트가 시작된다", !!projectId);

  const ev = must("증빙", await stu.db.from("evidence").insert({ project_id: projectId, author_id: stu.id, type: "DELIVERABLE_URL", description: "완성본", url: "https://example.com", source: "STUDENT_LINK" }).select().single());
  const versionId = must("제출", await stu.db.rpc("submit_version", { p_project: projectId, p_note: "완성했습니다", p_evidence_ids: [ev.id] }));
  must("승인", await owner.db.rpc("approve_version", {
    p_version: versionId,
    p_claims: { workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true },
    p_review: { satisfaction: 5, deadline: 5, communication: 5, handoff: 4, comment: "좋아요" }, p_note: "확인했습니다",
  }));
  const pr = must("프로젝트 조회", await owner.db.from("projects").select("status").eq("id", projectId).single());
  check("검증까지 끝나면 완료 상태", pr.status === "COMPLETED");

  console.log("\n④ 운영 시작 (계속 운영되는 결과물)");
  let o = must("운영 조회", await owner.db.from("operations").select("*").eq("project_id", projectId).single());
  check("완료와 동시에 운영이 시작된다", o.status === "WARRANTY");
  check("담당자가 작업한 학생으로 지정된다", o.maintainer_id === stu.id);
  check("보증 기간이 잡힌다", !!o.warranty_request_until && !!o.warranty_defect_until, `수정 ~${o.warranty_request_until}, 버그 ~${o.warranty_defect_until}`);

  console.log("\n⑤ 유지보수 요청 (무상 범위 자동 판정)");
  const cov = async (kind, body) => {
    const id = must(`${kind} 요청`, await owner.db.rpc("create_ticket", { p_project: projectId, p_kind: kind, p_body: body }));
    const t = must("요청 조회", await owner.db.from("maintenance_tickets").select("*").eq("id", id).single());
    return t;
  };
  const bug = await cov("BUG", "사진이 안 올라가요");
  check("버그 → 무상(하자 보증)", bug.coverage === "FREE_DEFECT");
  check("담당 학생에게 자동 배정", bug.assignee_id === stu.id);
  const content = await cov("CONTENT", "가격을 바꿔 주세요");
  check("내용 수정 → 무상(요청 보증)", content.coverage === "FREE_REQUEST");
  const feature = await cov("FEATURE", "예약 기능을 넣어 주세요");
  check("기능 추가 → 새 공고 필요", feature.coverage === "NEW_POST");
  const mine = await stu.db.rpc("create_ticket", { p_project: projectId, p_kind: "BUG", p_body: "학생이 올리기" });
  check("학생은 유지보수 요청을 못 만든다", !!mine.error);
  must("요청 처리", await stu.db.rpc("close_ticket", { p_ticket: bug.id }));
  const closed = must("처리 확인", await stu.db.from("maintenance_tickets").select("status").eq("id", bug.id).single());
  check("담당 학생이 처리 완료로 바꿀 수 있다", closed.status === "DONE");

  console.log("\n⑥ 인수인계 작성");
  const early = await stu.db.rpc("open_handover", { p_project: projectId });
  check("인수인계가 비면 인계를 요청할 수 없다", !!early.error, early.error?.message.slice(0, 40));
  const notMine = await stu2.db.rpc("save_handover", { p_project: projectId, p_data: { repoUrl: "https://x" } });
  check("담당자가 아니면 인수인계를 못 쓴다", !!notMine.error);
  must("인수인계 저장", await stu.db.rpc("save_handover", { p_project: projectId, p_data: {
    repoUrl: "https://github.com/wolgye-demo/site", deployUrl: "https://wolgye-demo.example.com", adminHanded: true,
    envList: "Supabase, 카카오 지도", monthlyCost: "도메인 연 22,000원", billingOwner: "CLIENT",
    expiresOn: "2027-03-02", backupNote: "자동 7일", knownIssues: "사파리 업로드 간헐 실패",
  } }));
  o = must("운영 재조회", await stu.db.from("operations").select("*").eq("project_id", projectId).single());
  check("인수인계 필수 항목이 채워진다", !!o.repo_url && !!o.deploy_url && o.admin_handed && !!o.monthly_cost && o.billing_owner === "CLIENT");
  const doc = must("인수인계서 저장", await stu.db.from("handover_docs").insert({ project_id: projectId, markdown: "# 인수인계서\n## 어디에 무엇이 있나\n- 저장소: https://github.com/wolgye-demo/site", model: "TEMPLATE" }).select().single());
  check("담당자가 인수인계서를 저장할 수 있다", !!doc.id);

  console.log("\n⑦ 인계 요청 → 이어받기 공고");
  const handoverPostId = must("인계 요청", await stu.db.rpc("open_handover", { p_project: projectId }));
  const hpost = must("이어받기 공고 조회", await stu2.db.from("posts").select("*").eq("id", handoverPostId).single());
  check("[이어받기] 공고가 자동 생성된다", hpost.title.startsWith("[이어받기]"), hpost.title);
  check("다른 공고처럼 모집 중으로 보인다", hpost.status === "open");
  check("원래 프로젝트와 연결된다", hpost.handover_of_project === projectId);
  o = must("운영 재조회", await stu2.db.from("operations").select("*").eq("project_id", projectId).single());
  check("운영 상태가 '다음 담당자 모집 중'", o.status === "HANDOVER_OPEN");
  const direct = await stu2.db.rpc("take_over", { p_project: projectId });
  check("학생이 혼자 즉시 가져갈 수 없다", !!direct.error, direct.error?.message.slice(0, 40));

  console.log("\n⑧ 다른 학생이 지원 → 사장님 선정 → 담당자 교체");
  let r2 = await stu2.db.from("applications").insert({ post_id: handoverPostId, student_id: stu2.id, message: "이어받고 싶어요" }).select().single();
  if (r2.error && /PAID_NOT_ELIGIBLE/.test(r2.error.message)) {
    // 0021 미적용 DB: 이어받기 공고의 유료 제한을 아직 풀지 않은 상태 → 보상 조건만 바꿔 흐름을 계속 확인한다
    check("이어받기 공고는 유료여도 지원 가능해야 한다 (0021 필요)", false, "0021_handover_apply.sql 실행 필요");
    await owner.db.from("posts").update({ compensation_type: "NON_MONETARY", paid_amount: null }).eq("id", handoverPostId);
    r2 = await stu2.db.from("applications").insert({ post_id: handoverPostId, student_id: stu2.id, message: "이어받고 싶어요" }).select().single();
  } else {
    check("이어받기 공고는 유료여도 지원 가능", !r2.error, r2.error?.message);
  }
  const app2 = must("이어받기 지원", r2);
  must("선정", await owner.db.rpc("select_applicant", { p_application: app2.id, p_question_snapshot: snapshot }));
  o = must("운영 재조회", await owner.db.from("operations").select("*").eq("project_id", projectId).single());
  check("담당자가 새 학생으로 바뀐다", o.maintainer_id === stu2.id);
  check("운영 상태가 '운영 중'으로 돌아온다", o.status === "OPERATING");
  const hist = must("담당자 이력", await owner.db.from("maintainer_history").select("*").eq("project_id", projectId).order("started_on"));
  check("담당자 이력이 2명으로 쌓인다", hist.length === 2, hist.map((h) => `${h.student_id === stu.id ? "학생1" : "학생2"}:${h.ended_on ? "종료" : "현재"}`).join(", "));
  const taken = must("알림 확인", await stu2.db.from("notifications").select("*").eq("kind", "HANDOVER_TAKEN"));
  check("이어받은 학생에게 안내 알림이 간다", taken.length > 0);

  console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`);
  console.log(`검증용 공고 제목: "${title}" (화면에서도 이 제목으로 확인 가능)`);
  process.exit(fail ? 1 : 0);
};

main().catch((e) => { console.error("\n중단:", e.message); console.log(`결과: ${pass}개 통과, ${fail}개 실패`); process.exit(1); });
