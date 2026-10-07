// 단체(동아리·학회)와 관리자 흐름을 실제 Supabase 에서 검증한다.
//   단체 등록 신청 → 관리자 승인 → 가입 신청 → 대표 수락 → 단체 이름으로 지원
//   → 지원 대상 제한(개인만/단체만) → 여러 단체 소속
// 실행: node scripts/verify-clubs.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split("=").map((s) => s.trim())));
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "");
let pass = 0, fail = 0;
const check = (label, ok, detail = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`); ok ? pass++ : fail++; };
const mk = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_KEY, { auth: { persistSession: false } });
async function login(email, password = "wolgye-demo-1234") {
  const db = mk();
  let { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) { await db.auth.signUp({ email, password }); ({ data } = await db.auth.signInWithPassword({ email, password })); }
  return { db, id: data.user.id };
}

const main = async () => {
  const admin = await login("admin@admin.com", "admin1234");
  const owner = await login("demo.owner@wolgye-demo.com");
  const leader = await login("demo.student@wolgye-demo.com");
  const member = await login("demo.student2@wolgye-demo.com");

  console.log("\n① 단체 등록 신청 → 관리자 승인");
  const name = `광운 웹스튜디오 ${stamp}`;
  const { data: clubId, error: e1 } = await leader.db.rpc("create_club", {
    p_name: name, p_kind: "CENTRAL", p_description: "웹사이트를 만들고 관리해요", p_college: "AI", p_kind_other: null,
  });
  check("학생이 단체 등록을 신청한다", !e1, e1?.message);
  let club = (await admin.db.from("clubs").select("*").eq("id", clubId).single()).data;
  check("승인 전에는 PENDING", club.status === "PENDING");
  check("승인 전에는 목록에 안 뜬다", !(await member.db.from("clubs").select("id").eq("status", "APPROVED").eq("id", clubId)).data.length);

  const notAdmin = await leader.db.rpc("review_club", { p_club: clubId, p_approve: true, p_reason: null });
  check("관리자가 아니면 승인할 수 없다", !!notAdmin.error, notAdmin.error?.message.slice(0, 30));
  check("관리자가 승인한다", !(await admin.db.rpc("review_club", { p_club: clubId, p_approve: true, p_reason: null })).error);
  club = (await member.db.from("clubs").select("*").eq("id", clubId).single()).data;
  check("승인 후 APPROVED 로 바뀐다", club.status === "APPROVED");

  console.log("\n② 가입 신청 → 대표 수락");
  check("다른 학생이 가입을 신청한다", !(await member.db.rpc("join_club", { p_club: clubId })).error);
  let m = (await member.db.from("club_members").select("*").eq("club_id", clubId).eq("student_id", member.id).single()).data;
  check("수락 전에는 PENDING (소속 아님)", m.status === "PENDING");
  const notLeader = await member.db.rpc("review_member", { p_club: clubId, p_student: member.id, p_approve: true });
  check("대표가 아니면 수락할 수 없다", !!notLeader.error);
  check("대표가 수락한다", !(await leader.db.rpc("review_member", { p_club: clubId, p_student: member.id, p_approve: true })).error);
  m = (await member.db.from("club_members").select("*").eq("club_id", clubId).eq("student_id", member.id).single()).data;
  check("수락 후 ACTIVE 로 바뀐다", m.status === "ACTIVE");

  console.log("\n③ 지원 대상 (개인만 / 단체만 / 둘 다)");
  const post = async (scope) => (await owner.db.from("posts").insert({
    title: `[단체검증 ${stamp}] ${scope}`, category: "웹/앱", description: "x", problem: "x", author_id: owner.id,
    lat: 37.6248, lng: 127.0598, address: "월계로 45길 12", domain: "DEVELOPMENT", applicant_scope: scope,
  }).select().single()).data.id;

  const clubOnly = await post("CLUB");
  const a1 = await leader.db.from("applications").insert({ post_id: clubOnly, student_id: leader.id, message: "개인으로" });
  check("단체만 공고에 개인으로 지원하면 막힌다", !!a1.error, a1.error?.message.slice(0, 30));
  const a2 = await leader.db.from("applications").insert({ post_id: clubOnly, student_id: leader.id, message: "단체로", club_id: clubId });
  check("단체 이름으로는 지원된다", !a2.error, a2.error?.message);

  const indivOnly = await post("INDIVIDUAL");
  const a3 = await leader.db.from("applications").insert({ post_id: indivOnly, student_id: leader.id, message: "단체로", club_id: clubId });
  check("개인만 공고에 단체 이름으로 지원하면 막힌다", !!a3.error, a3.error?.message.slice(0, 30));
  check("개인으로는 지원된다", !(await leader.db.from("applications").insert({ post_id: indivOnly, student_id: leader.id, message: "개인으로" })).error);

  const any = await post("ANY");
  const okClub = await leader.db.from("applications").insert({ post_id: any, student_id: leader.id, message: "단체로", club_id: clubId });
  const okSolo = await member.db.from("applications").insert({ post_id: any, student_id: member.id, message: "개인으로" });
  check("둘 다 받는 공고는 개인도 단체도 지원된다", !okClub.error && !okSolo.error);

  console.log("\n④ 소속 아닌 단체 이름으로 지원 차단 / 여러 단체 소속");
  const outsider = await login("demo.outsider@wolgye-demo.com");
  await outsider.db.from("profiles").upsert({ id: outsider.id, role: "student", name: "외부 학생 (데모)", department: "경영학부", college: "BIZ", lat: 37.62, lng: 127.06 });
  const a4 = await outsider.db.from("applications").insert({ post_id: any, student_id: outsider.id, message: "남의 단체로", club_id: clubId });
  check("소속이 아닌 단체 이름으로는 지원할 수 없다", !!a4.error, a4.error?.message.slice(0, 30));

  const { data: club2 } = await member.db.rpc("create_club", { p_name: `광운 사진부 ${stamp}`, p_kind: "CENTRAL", p_description: "사진 찍어요", p_college: "HSS", p_kind_other: null });
  await admin.db.rpc("review_club", { p_club: club2, p_approve: true, p_reason: null });
  const mine = (await member.db.from("club_members").select("club_id").eq("student_id", member.id).eq("status", "ACTIVE")).data;
  check("한 학생이 여러 단체에 소속된다", mine.length >= 2, `${mine.length}곳`);

  console.log("\n⑤ 기타 유형 직접 입력 / 관리자 거절");
  const { data: club3 } = await outsider.db.rpc("create_club", { p_name: `교내 방송국 ${stamp}`, p_kind: "OTHER", p_description: "영상 찍어요", p_college: null, p_kind_other: "교내 방송국" });
  const c3 = (await admin.db.from("clubs").select("*").eq("id", club3).single()).data;
  check("기타 유형은 직접 적은 이름이 저장된다", c3.kind === "OTHER" && c3.kind_other === "교내 방송국", c3.kind_other);
  await admin.db.rpc("review_club", { p_club: club3, p_approve: false, p_reason: "실제 단체인지 확인이 어려워요" });
  const c3b = (await admin.db.from("clubs").select("*").eq("id", club3).single()).data;
  check("거절하면 사유가 남는다", c3b.status === "REJECTED" && !!c3b.reject_reason, c3b.reject_reason);

  console.log("\n⑥ 관리자 화면 데이터");
  const pending = (await admin.db.from("clubs").select("id").eq("status", "PENDING")).data;
  check("관리자가 심사 대기 목록을 읽는다", Array.isArray(pending), `${pending.length}건 대기`);

  console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`);
  console.log(`검증용 단체: "${name}" / 공고 제목 앞에 "[단체검증 ${stamp}]"`);
  process.exit(fail ? 1 : 0);
};

main().catch((e) => { console.error("\n중단:", e.message); console.log(`결과: ${pass}개 통과, ${fail}개 실패`); process.exit(1); });
