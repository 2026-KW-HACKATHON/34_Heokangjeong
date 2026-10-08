// Supabase 마이그레이션을 PGlite(WASM Postgres)에 올려 DB 함수·RLS 를 실제로 검증한다.
// 팀 DB 와 같은 순서: 0001 → 0005(이미 적용) → 이후 팀이 실행할 0002 → 0003(개방) → 0004(잠금). 테스트는 잠금 상태에서 돈다.
// Supabase 의 auth/storage 스키마와 역할은 최소한으로 흉내 낸다. RLS 가 적용되도록 authenticated 역할로 실행한다.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DOMAINS, QUESTION_SET_VERSION } from "@shared/portfolio/domains";
import { AGREEMENT_TERMS, selectWithAgreement } from "./agreementSelect";

const root = path.resolve(__dirname, "..");
const sql = (f: string) => readFileSync(path.join(root, "supabase/migrations", f), "utf8");

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
`;
const GRANTS = `
grant usage on schema public, auth, storage to authenticated;
grant all on all tables in schema public to authenticated;
grant all on storage.objects to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function auth.uid() to authenticated;
`;

const U = {
  owner: "00000000-0000-0000-0000-000000000001",
  owner2: "00000000-0000-0000-0000-000000000002",
  stu: "00000000-0000-0000-0000-000000000003",
  stu2: "00000000-0000-0000-0000-000000000004",
};
let db: PGlite;

/** 특정 사용자로 SQL 실행 (RLS 적용) */
async function as<T = Record<string, unknown>>(uid: string, q: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try { return (await db.query<T>(q, params)).rows; } finally { await db.exec("reset role;"); }
}
const rpc = <T = Record<string, unknown>>(uid: string, fn: string, args: unknown[]) =>
  as<T>(uid, `select * from public.${fn}(${args.map((_, i) => `$${i + 1}`).join(", ")})`, args);
const snapshotFor = (domain: keyof typeof DOMAINS) => JSON.stringify({ domain, version: QUESTION_SET_VERSION, questions: DOMAINS[domain].questions, takenAt: "2026-09-10T00:00:00Z" });
const claims = JSON.stringify({ workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true });
const review = JSON.stringify({ satisfaction: 5, deadline: 4, communication: 5, handoff: 4, deliverableQuality: 5, comment: "손님들이 좋아해요" });

async function newPost(title: string, extra = "") {
  const [p] = await as<{ id: string }>(U.owner, `insert into posts (title, category, description, author_id, lat, lng, domain, revision_limit ${extra ? ", compensation_type" : ""})
    values ($1, '디자인', '메뉴판이 복잡해요', $2, 37.6, 127.0, 'DESIGN', 2 ${extra ? `, '${extra}'` : ""}) returning id`, [title, U.owner]);
  return p.id;
}
async function startProject(title = "메뉴판 개선") {
  const postId = await newPost(title);
  const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id, message) values ($1, $2, '지원') returning id", [postId, U.stu]);
  const projectId = await selectWithAgreement(as, U.owner, U.stu, app.id, snapshotFor("DESIGN"));   // 0037: 약속서 확정 = 선정
  return { postId, appId: app.id, projectId };
}
async function addEvidence(projectId: string, uid = U.stu) {
  const [e] = await as<{ id: string }>(uid, `insert into evidence (project_id, author_id, type, description, url, source) values ($1, $2, 'DELIVERABLE_FILE', '메뉴판 PDF', 'https://example.com/a.pdf', 'STUDENT_LINK') returning id`, [projectId, uid]);
  return e.id;
}
const submit = async (projectId: string, ev: string) => (await rpc<{ submit_version: string }>(U.stu, "submit_version", [projectId, "제출", [ev]]))[0].submit_version;
const status = async (projectId: string) => (await db.query<{ status: string }>("select status from projects where id = $1", [projectId])).rows[0].status;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(sql("0001_init.sql"));
  await db.exec(sql("0005_verified_portfolio.sql"));
  for (const f of ["0002_permissions.sql", "0003_dev_open.sql", "0004_strict.sql"]) await db.exec(sql(f));
  await db.exec(GRANTS);
  await db.exec(sql("0006_notion_safe_exports.sql"));
  await db.exec(sql("0007_team_projects.sql"));
  await db.exec(sql("0008_team_member_work.sql"));
  await db.exec(sql("0009_team_record_privacy.sql"));
  await db.exec(sql("0010_profile_details.sql"));
  await db.exec(sql("0011_team_peer_reviews.sql"));
  await db.exec(sql("0012_project_started_at.sql"));
  await db.exec(sql("0013_notification_automation.sql"));
  for (const file of ["0014_portfolio_publications.sql", "0015_personal_rankings.sql", "0016_post_minimum_tier.sql", "0017_work_fields_instead_of_rank.sql", "0018_portfolio_profile_feed.sql", "0028_chat_agreements.sql", "0029_individual_applicant_decision.sql", "0030_evidence_based_reputation.sql", "0031_portfolio_visibility.sql", "0033_manual_portfolio_feeds.sql", "0035_disable_peer_reviews.sql", "0036_public_portfolio_page.sql", "0037_agreement_selection.sql", "0038_club_worker_agreement.sql", "0039_agreement_closed_project.sql", "0040_profile_nickname.sql", "0041_chat_before_selection.sql", "0042_chat_agreement_notifications.sql"]) await db.exec(sql(file));
  await db.exec("grant all on public.post_roles to authenticated");
  for (const [k, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id) values ($1)", [id]);
    const student = k.startsWith("stu");
    await db.query("insert into profiles (id, role, name, kind) values ($1, $2, $3, $4)", [id, student ? "student" : "resident", k, student ? null : "상인"]);
  }
  await db.query("update profiles set interests = array['디자인'], max_distance_m = 10000 where id in ($1, $2)", [U.stu, U.stu2]);
});

describe("SQL: 선정·제출·검토 (DB 함수)", () => {
  it("약속서는 선정된 뒤 당사자만 쓰고, 같은 버전을 양쪽이 확인하면 확정 = 선정 확정", async () => {
    const postId = await newPost("약속서");
    const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id, message) values ($1, $2, '지원') returning id", [postId, U.stu]);
    const appId = app.id;
    const terms={startDate:"2026-10-07",endDate:"2026-10-20",scope:"디자인",deliverables:"PDF",acceptance:"점주 확인",coupon:"음료 쿠폰",handoff:"파일 전달",exclusions:"인쇄",revisions:2};
    await expect(rpc(U.stu,"save_chat_agreement",[appId,0,JSON.stringify(terms)])).rejects.toThrow(/선정한 뒤/);
    await rpc(U.owner,"shortlist_applicant",[appId]);
    await rpc(U.stu,"save_chat_agreement",[appId,0,JSON.stringify(terms)]);
    const [draftNotice] = await as<{ href: string }>(U.owner,"select href from notifications where kind='AGREEMENT' and source_key like 'agreement:%:v1:saved:%' and post_id=(select post_id from applications where id=$1)",[appId]);
    expect(draftNotice.href).toBe(`/chats/room?id=${appId}`);
    await expect(rpc(U.stu2,"confirm_chat_agreement",[appId,1])).rejects.toThrow(/당사자/);
    expect(await as(U.stu2,"select * from chat_agreements where application_id=$1",[appId])).toHaveLength(0);
    await expect(as(U.stu,"update chat_agreements set version=99 where application_id=$1",[appId])).rejects.toThrow(/permission denied/);
    await rpc(U.stu,"confirm_chat_agreement",[appId,1]);
    await rpc(U.owner,"save_chat_agreement",[appId,1,JSON.stringify({...terms,scope:"메뉴판 디자인"})]);
    const [changed]=await as(U.stu,"select * from chat_agreements where application_id=$1",[appId]);
    expect(changed.student_confirmed_at).toBeNull();
    await expect(rpc(U.stu,"confirm_chat_agreement",[appId,1])).rejects.toThrow(/최신/);
    await rpc(U.stu,"confirm_chat_agreement",[appId,2]);
    expect((await db.query<{ status: string }>("select status from applications where id=$1",[appId])).rows[0].status).toBe("pending");   // 한쪽만 확인 → 아직 매칭 대기
    await expect(rpc(U.owner,"confirm_chat_agreement",[appId,2,null])).rejects.toThrow(/질문 목록/);
    expect(await as(U.owner,"select id from notifications where kind='AGREEMENT' and source_key like 'agreement:%:v2:student-confirmed:%' and post_id=(select post_id from applications where id=$1)",[appId])).toHaveLength(1);
    await rpc(U.owner,"confirm_chat_agreement",[appId,2,snapshotFor("DESIGN")]);
    const [finalNotice] = await as<{ text: string }>(U.stu,"select text from notifications where kind='AGREEMENT' and source_key like 'agreement:%:v2:finalized:%' and post_id=(select post_id from applications where id=$1)",[appId]);
    expect(finalNotice.text).toContain("양쪽 확인으로 확정");
    const [final]=await as(U.stu,"select * from chat_agreements where application_id=$1",[appId]);
    expect(final.finalized_at).toBeTruthy();
    expect((await db.query<{ status: string }>("select status from applications where id=$1",[appId])).rows[0].status).toBe("accepted");   // 확정 = 선정 확정
    expect((await db.query("select 1 from project_members where application_id=$1",[appId])).rows).toHaveLength(1);
    await expect(rpc(U.owner,"save_chat_agreement",[appId,2,JSON.stringify(terms)])).rejects.toThrow(/최종본/);
  });
  it("선정 → IN_PROGRESS, 질문 스냅샷 저장, 공고 진행 중", async () => {
    const { projectId, postId } = await startProject();
    expect(await status(projectId)).toBe("IN_PROGRESS");
    const [p] = (await db.query<{ status: string }>("select status from posts where id = $1", [postId])).rows;
    expect(p.status).toBe("in_progress");
    const [project] = (await db.query<{ started_at: string | null }>("select started_at from projects where id = $1", [projectId])).rows;
    expect(project.started_at).not.toBeNull();
  });
  it("맞춤 공고·지원·채팅 알림을 만들고 당사자만 읽는다", async () => {
    const postId = await newPost("알림 흐름");
    const [matched] = await as<{ id: string; href: string }>(U.stu, "select id,href from notifications where kind='MATCHED_POST' and post_id=$1", [postId]);
    expect(matched.href).toBe(`/posts/detail?id=${postId}`);
    expect(await as(U.owner2, "select id from notifications where id=$1", [matched.id])).toHaveLength(0);
    expect(await as(U.stu, "update notifications set read=true where id=$1 returning id", [matched.id])).toHaveLength(1);
    const [application] = await as<{ id: string }>(U.stu, "insert into applications(post_id,student_id,message) values($1,$2,'지원') returning id", [postId, U.stu]);
    expect(await as(U.owner, "select id from notifications where kind='APPLICATION' and post_id=$1", [postId])).toHaveLength(1);
    await as(U.owner, "insert into messages(application_id,sender_id,body) values($1,$2,'안녕하세요')", [application.id, U.owner]);
    await expect(as(U.stu2, "insert into messages(application_id,sender_id,body) values($1,$2,'외부인')", [application.id, U.stu2])).rejects.toThrow();
    await expect(as(U.owner, "insert into messages(application_id,sender_id,body) values($1,$2,'사칭')", [application.id, U.stu])).rejects.toThrow();
    expect(await as(U.stu2, "select id from messages where application_id=$1", [application.id])).toHaveLength(0);
    await as(U.stu, "insert into messages(application_id,sender_id,body) values($1,$2,'안녕하세요')", [application.id, U.stu]);
    const [chat] = await as<{ href: string }>(U.owner, "select href from notifications where kind='CHAT' and post_id=$1", [postId]);
    expect(chat.href).toBe(`/chats/room?id=${application.id}`);
  });
  it("개인 공고에서 선정되지 않은 대기 지원자를 자동 거절하고 알림을 보낸다", async () => {
    const postId = await newPost("여러 지원자 중 선정");
    const [selected] = await as<{ id: string }>(U.stu, "insert into applications(post_id,student_id,message) values($1,$2,'첫 번째 지원') returning id", [postId, U.stu]);
    const [unselected] = await as<{ id: string }>(U.stu2, "insert into applications(post_id,student_id,message) values($1,$2,'두 번째 지원') returning id", [postId, U.stu2]);
    await selectWithAgreement(as, U.owner, U.stu, selected.id, snapshotFor("DESIGN"));   // 0037: 약속서 확정 = 선정
    const statuses = (await db.query<{ id: string; status: string }>("select id,status from applications where id in ($1,$2)", [selected.id, unselected.id])).rows;
    expect(statuses.find((application) => application.id === selected.id)?.status).toBe("accepted");
    expect(statuses.find((application) => application.id === unselected.id)?.status).toBe("rejected");
    expect(await as(U.stu2, "select id from notifications where kind='APPLICATION_REJECTED' and post_id=$1", [postId])).toHaveLength(1);
  });
  it("다른 점주는 선정할 수 없다", async () => {
    const postId = await newPost("x");
    const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id) values ($1, $2) returning id", [postId, U.stu]);
    await expect(rpc(U.owner2, "select_applicant", [app.id, snapshotFor("DESIGN")])).rejects.toThrow(/FORBIDDEN/);
    await expect(rpc(U.owner2, "shortlist_applicant", [app.id])).rejects.toThrow(/FORBIDDEN/);
  });
  it("잘못된 질문 스냅샷은 거부", async () => {
    const postId = await newPost("y");
    const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id) values ($1, $2) returning id", [postId, U.stu]);
    await rpc(U.owner, "shortlist_applicant", [app.id]);
    await rpc(U.stu, "save_chat_agreement", [app.id, 0, JSON.stringify(AGREEMENT_TERMS)]);
    await rpc(U.stu, "confirm_chat_agreement", [app.id, 1, null]);
    await expect(rpc(U.owner, "confirm_chat_agreement", [app.id, 1, snapshotFor("MARKETING")])).rejects.toThrow(/INVALID_INPUT/);
  });
  it("선정되지 않은 학생은 제출·답변·증빙 불가 (RLS + 함수)", async () => {
    const { projectId } = await startProject("z");
    const ev = await addEvidence(projectId);
    await expect(rpc(U.stu2, "submit_version", [projectId, "", [ev]])).rejects.toThrow(/FORBIDDEN/);
    await expect(as(U.stu2, "insert into project_answers (project_id, author_id, question_id, field, stage, status, value) values ($1, $2, 'd_problem', 'existingProblem', 'START', 'ANSWERED', 'x')", [projectId, U.stu2])).rejects.toThrow(/row-level security|FORBIDDEN/);
    await expect(addEvidence(projectId, U.stu2)).rejects.toThrow(/row-level security/);
  });
  it("v1 → 보완 요청 → v2 → v1 승인 거부 → v2 승인 → 중복 승인 거부, 점수 1회", async () => {
    const { projectId, postId } = await startProject("full");
    const ev = await addEvidence(projectId);
    const v1 = await submit(projectId, ev);
    expect(await status(projectId)).toBe("REVIEW_PENDING");
    await expect(submit(projectId, ev)).rejects.toThrow(/INVALID_TRANSITION/);
    await expect(rpc(U.owner2, "request_revision", [v1, "x"])).rejects.toThrow(/FORBIDDEN/);
    await rpc(U.owner, "request_revision", [v1, "가격 글씨를 키워 주세요"]);
    expect(await status(projectId)).toBe("REVISION_REQUESTED");
    await expect(rpc(U.owner, "approve_version", [v1, claims, review, ""])).rejects.toThrow(/INVALID_STATE|STALE/);
    const v2 = await submit(projectId, ev);
    await expect(rpc(U.owner, "approve_version", [v1, claims, review, ""])).rejects.toThrow(/STALE_VERSION/);
    await expect(rpc(U.owner2, "approve_version", [v2, claims, review, ""])).rejects.toThrow(/FORBIDDEN/);
    await rpc(U.owner, "approve_version", [v2, claims, review, ""]);
    expect(await status(projectId)).toBe("COMPLETED");
    await expect(rpc(U.owner, "approve_version", [v2, claims, review, ""])).rejects.toThrow(/ALREADY_APPROVED/);
    const [pv] = (await db.query<{ approved_version_id: string }>("select approved_version_id from projects where id = $1", [projectId])).rows;
    expect(pv.approved_version_id).toBe(v2);
    const [cv] = (await db.query<{ submission_version_id: string }>("select submission_version_id from client_verifications where project_id = $1", [projectId])).rows;
    expect(cv.submission_version_id).toBe(v2);
    const ev2 = (await db.query("select kind from tier_score_events where project_id = $1", [projectId])).rows;
    expect(ev2).toHaveLength(2);
    const cards = (await db.query("select * from portfolio_cards where post_id = $1", [postId])).rows;
    expect(cards).toHaveLength(1);
  });
  it("보완 요청 횟수 제한", async () => {
    const { projectId, postId } = await startProject("limit");
    await db.query("update posts set revision_limit = 1 where id = $1", [postId]);
    const ev = await addEvidence(projectId);
    const v1 = await submit(projectId, ev);
    await rpc(U.owner, "request_revision", [v1, "a"]);
    const v2 = await submit(projectId, ev);
    await expect(rpc(U.owner, "request_revision", [v2, "b"])).rejects.toThrow(/REVISION_LIMIT/);
  });
  it("학생 이의제기 시 평가를 보류하고 감사 로그를 남긴다", async () => {
    const { projectId } = await startProject("dispute");
    const evidenceId = await addEvidence(projectId);
    const versionId = await submit(projectId, evidenceId);
    await rpc(U.owner, "approve_version", [versionId, claims, review, ""]);
    await rpc(U.stu, "dispute_client_review", [projectId, "승인된 제출 결과물과 평가 내용이 일치하지 않습니다."]);
    const [clientReview] = (await db.query<{ status: string }>("select status from client_reviews where project_id=$1", [projectId])).rows;
    expect(clientReview.status).toBe("DISPUTED");
    const events = await as(U.stu, "select reason from reputation_events where project_id=$1", [projectId]);
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
  it("이전 유료 공고도 순위·등급·검증 이력과 무관하게 지원 가능", async () => {
    const paid = await newPost("paid", "PAID");
    await expect(as(U.stu2, "insert into applications (post_id, student_id) values ($1, $2)", [paid, U.stu2])).resolves.toHaveLength(0);
    await as(U.stu, "insert into applications (post_id, student_id) values ($1, $2)", [paid, U.stu]);
  });
});

describe("SQL: 팀 프로젝트 전체 흐름", () => {
  it("역할별 선발·개인 기록·팀장 제출·팀원별 검증을 서버에서 강제한다", async () => {
    const postId = await newPost("역할 분리 팀 프로젝트");
    await db.query("update posts set is_team = true where id = $1", [postId]);
    const roles = (await as<{ id: string; domain: string }>(U.owner, `insert into post_roles(post_id,label,category,domain,capacity,sort_order) values
      ($1,'디자이너','디자인','DESIGN',1,0),($1,'개발자','웹/앱','DEVELOPMENT',1,1) returning id,domain`, [postId])).sort((a, b) => a.domain.localeCompare(b.domain));
    const designRole = roles.find((r) => r.domain === "DESIGN")!;
    const devRole = roles.find((r) => r.domain === "DEVELOPMENT")!;
    const [a1] = await as<{ id: string }>(U.stu, "insert into applications(post_id,student_id,message,role_id) values($1,$2,'디자인 지원',$3) returning id", [postId, U.stu, designRole.id]);
    const [a2] = await as<{ id: string }>(U.stu2, "insert into applications(post_id,student_id,message,role_id) values($1,$2,'개발 지원',$3) returning id", [postId, U.stu2, devRole.id]);
    const projectId = await selectWithAgreement(as, U.owner, U.stu, a1.id, snapshotFor("DESIGN"));   // 0037: 약속서 확정 = 선정
    expect(await status(projectId)).toBe("RECRUITING");
    expect((await db.query<{ started_at: string | null }>("select started_at from projects where id=$1", [projectId])).rows[0].started_at).toBeNull();
    await expect(rpc(U.owner, "start_team_project", [projectId, U.stu])).rejects.toThrow(/TEAM_INCOMPLETE/);
    await selectWithAgreement(as, U.owner, U.stu2, a2.id, snapshotFor("DEVELOPMENT"));
    await rpc(U.owner, "start_team_project", [projectId, U.stu]);
    expect(await status(projectId)).toBe("IN_PROGRESS");
    expect((await db.query<{ started_at: string | null }>("select started_at from projects where id=$1", [projectId])).rows[0].started_at).not.toBeNull();

    const dq = DOMAINS.DESIGN.questions[0], wq = DOMAINS.DEVELOPMENT.questions[0];
    await as(U.stu, "insert into project_answers(project_id,author_id,question_id,field,stage,status,value) values($1,$2,$3,$4,$5,'ANSWERED','디자인 문제 분석')", [projectId, U.stu, dq.id, dq.field, dq.stage]);
    expect(await as(U.stu2, "select * from project_answers where project_id=$1", [projectId])).toHaveLength(0);
    expect(await as(U.owner, "select * from project_answers where project_id=$1", [projectId])).toHaveLength(1);
    await expect(as(U.stu2, "insert into project_answers(project_id,author_id,question_id,field,stage,status,value) values($1,$2,$3,$4,$5,'ANSWERED','잘못된 답')", [projectId, U.stu2, dq.id, dq.field, dq.stage])).rejects.toThrow(/INVALID_QUESTION/);
    await as(U.stu2, "insert into project_answers(project_id,author_id,question_id,field,stage,status,value) values($1,$2,$3,$4,$5,'ANSWERED','개발 문제 분석')", [projectId, U.stu2, wq.id, wq.field, wq.stage]);

    const ev = await addEvidence(projectId, U.stu);
    await expect(rpc(U.stu2, "submit_version", [projectId, "일반 팀원 제출", [ev]])).rejects.toThrow(/LEADER_ONLY/);
    const [submitted] = await rpc<{ submit_version: string }>(U.stu, "submit_version", [projectId, "팀장 최종 제출", [ev]]);
    await rpc(U.owner, "approve_team_version", [submitted.submit_version, claims, review, "팀 검증", [U.stu]]);
    expect(await status(projectId)).toBe("COMPLETED");
    const verified = (await db.query<{ student_id: string; verified: boolean }>("select student_id,verified from member_verifications where project_id=$1 order by student_id", [projectId])).rows;
    expect(verified).toEqual([{ student_id: U.stu, verified: true }, { student_id: U.stu2, verified: false }]);
    expect((await db.query("select * from tier_score_events where project_id=$1 and student_id=$2", [projectId, U.stu])).rows.length).toBeGreaterThan(0);
    expect((await db.query("select * from tier_score_events where project_id=$1 and student_id=$2", [projectId, U.stu2])).rows).toHaveLength(0);
    await expect(as(U.stu2, "insert into portfolio_snapshots(project_id,student_id,hash,data) values($1,$2,'team-unverified','{}')", [projectId, U.stu2])).rejects.toThrow(/NOT_VERIFIED/);
    expect(await as(U.stu, "insert into portfolio_snapshots(project_id,student_id,hash,data) values($1,$2,'team-verified','{}') returning id", [projectId, U.stu])).toHaveLength(1);

    await expect(as(U.stu, `insert into team_peer_reviews(project_id,reviewer_id,reviewee_id,communication,collaboration,responsibility)
      values($1,$2,$3,5,5,5)`, [projectId, U.stu, U.stu2])).rejects.toThrow(/permission denied|row-level security/);
    await db.query("update member_verifications set verified = true where project_id = $1 and student_id = $2", [projectId, U.stu2]);
    await expect(as(U.stu, `insert into team_peer_reviews(project_id,reviewer_id,reviewee_id,communication,collaboration,responsibility,comment)
      values($1,$2,$3,5,4,5,'협업과 소통이 원활했습니다') returning id`, [projectId, U.stu, U.stu2])).rejects.toThrow(/permission denied|row-level security/);
    expect(await as(U.stu2, "select * from team_peer_reviews where project_id = $1", [projectId])).toHaveLength(0);
  });
});

describe("SQL: 답변·성과·포트폴리오·Notion 권한", () => {
  it("건너뜀 답변에는 값이 들어갈 수 없다", async () => {
    const { projectId } = await startProject("skip");
    await expect(as(U.stu, "insert into project_answers (project_id, author_id, question_id, field, stage, status, value) values ($1, $2, 'd_constraints', 'constraints', 'START', 'SKIPPED', '몰래 값')", [projectId, U.stu])).rejects.toThrow(/check constraint/);
    await as(U.stu, "insert into project_answers (project_id, author_id, question_id, field, stage, status) values ($1, $2, 'd_constraints', 'constraints', 'START', 'SKIPPED')", [projectId, U.stu]);
  });
  it("증빙 URL 은 http(s) 만", async () => {
    const { projectId } = await startProject("url");
    for (const bad of ["file:///C:/a.png", "blob:http://localhost/x", "data:image/png;base64,AA", "C:\\a.png"])
      await expect(as(U.stu, "insert into evidence (project_id, author_id, type, url, source) values ($1, $2, 'AFTER_IMAGE', $3, 'STUDENT_LINK')", [projectId, U.stu, bad])).rejects.toThrow(/check constraint/);
  });
  it("성과: 미측정은 value null, 학생은 verified 를 직접 켤 수 없고 의뢰인만 확인", async () => {
    const { projectId } = await startProject("outcome");
    await expect(as(U.stu, "insert into outcomes (project_id, author_id, metric_name, measured, value) values ($1, $2, '조회수', false, 0)", [projectId, U.stu])).rejects.toThrow(/check constraint/);
    await expect(as(U.stu, "insert into outcomes (project_id, author_id, metric_name, measured, value, verified) values ($1, $2, '조회수', true, 10, true)", [projectId, U.stu])).rejects.toThrow(/row-level security/);
    const [o] = await as<{ id: string }>(U.stu, "insert into outcomes (project_id, author_id, metric_name, measured, value) values ($1, $2, '조회수', true, 0) returning id", [projectId, U.stu]);
    await expect(rpc(U.stu, "verify_outcome", [o.id])).rejects.toThrow(/FORBIDDEN/);
    await rpc(U.owner, "verify_outcome", [o.id]);
    const [row] = (await db.query<{ verified: boolean; value: string }>("select verified, value from outcomes where id = $1", [o.id])).rows;
    expect(row.verified).toBe(true); expect(Number(row.value)).toBe(0);
  });
  it("포트폴리오: 완료 전 스냅샷 금지, 편집본은 새 버전으로 쌓임, 남의 초안 편집 금지", async () => {
    const { projectId } = await startProject("pf");
    const ins = "insert into portfolio_snapshots (project_id, student_id, hash, data) values ($1, $2, 'h1', '{}') returning id";
    await expect(as(U.stu, ins, [projectId, U.stu])).rejects.toThrow(/row-level security/);
    const ev = await addEvidence(projectId);
    const v1 = await submit(projectId, ev);
    await rpc(U.owner, "approve_version", [v1, claims, review, ""]);
    const [s] = await as<{ id: string }>(U.stu, ins, [projectId, U.stu]);
    await expect(as(U.stu, ins, [projectId, U.stu])).rejects.toThrow(/duplicate key/);   // 같은 자료 = 같은 스냅샷
    const [d] = await as<{ id: string }>(U.stu, "insert into portfolio_drafts (snapshot_id, project_id, student_id, generator, content) values ($1, $2, $3, 'TEMPLATE', '{}') returning id", [s.id, projectId, U.stu]);
    const e1 = await rpc<{ save_portfolio_edit: string }>(U.stu, "save_portfolio_edit", [d.id, JSON.stringify({ title: "첫 편집" })]);
    const e2 = await rpc<{ save_portfolio_edit: string }>(U.stu, "save_portfolio_edit", [d.id, JSON.stringify({ title: "두 번째" })]);
    expect(e1[0].save_portfolio_edit).not.toBe(e2[0].save_portfolio_edit);
    const versions = (await db.query<{ version: number }>("select version from portfolio_edits where draft_id = $1 order by version", [d.id])).rows.map((r) => r.version);
    expect(versions).toEqual([1, 2]);
    await expect(rpc(U.stu2, "save_portfolio_edit", [d.id, JSON.stringify({ title: "x" })])).rejects.toThrow(/FORBIDDEN/);
    await expect(as(U.stu2, "insert into portfolio_drafts (snapshot_id, project_id, student_id, generator, content) values ($1, $2, $3, 'AI', '{}')", [s.id, projectId, U.stu2])).rejects.toThrow(/row-level security/);
  });
  it("Notion 토큰 테이블은 앱(authenticated)에서 읽을 수 없다", async () => {
    await db.query("insert into notion_connections (user_id, access_token_enc, bot_id, workspace_id) values ($1, 'enc', 'b', 'w')", [U.stu]);
    await expect(as(U.stu, "select * from notion_connections")).rejects.toThrow(/permission denied/);
    await expect(as(U.stu, "insert into notion_connections (user_id, access_token_enc, bot_id, workspace_id) values ($1, 'x', 'b', 'w')", [U.stu2])).rejects.toThrow(/permission denied/);
    await expect(rpc(U.stu, "claim_notion_export", [U.stu, U.stu])).rejects.toThrow(/permission denied/);
  });
  it("진행 중 프로젝트의 답변은 제3자가 못 본다", async () => {
    const { projectId } = await startProject("private");
    await as(U.stu, "insert into project_answers (project_id, author_id, question_id, field, stage, status, value) values ($1, $2, 'd_problem', 'existingProblem', 'START', 'ANSWERED', '비밀')", [projectId, U.stu]);
    expect(await as(U.stu2, "select * from project_answers where project_id = $1", [projectId])).toHaveLength(0);
    expect(await as(U.owner2, "select * from projects where id = $1", [projectId])).toHaveLength(0);
    expect(await as(U.owner, "select * from project_answers where project_id = $1", [projectId])).toHaveLength(1);
  });
  it("증빙 파일은 <내 id>/<프로젝트 id>/… 에만 올린다 (0004 잠금 후에도)", async () => {
    const { projectId } = await startProject("storage");
    await as(U.stu, "insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${U.stu}/${projectId}/a.png`]);
    await expect(as(U.stu2, "insert into storage.objects (bucket_id, name) values ('evidence', $1)", [`${U.stu}/${projectId}/b.png`])).rejects.toThrow(/row-level security/);
  });
  it("프로필 소개와 공개 이미지는 소유자만 수정·업로드한다", async () => {
    expect(await as(U.stu, "update profiles set about='동네를 위한 디자인', avatar_url='https://example.com/avatar.jpg' where id=$1 returning id", [U.stu])).toHaveLength(1);
    expect(await as(U.stu2, "update profiles set about='변조' where id=$1 returning id", [U.stu])).toHaveLength(0);
    await as(U.stu, "insert into storage.objects (bucket_id, name) values ('portfolio-images', $1)", [`${U.stu}/cover.jpg`]);
    await expect(as(U.stu2, "insert into storage.objects (bucket_id, name) values ('portfolio-images', $1)", [`${U.stu}/other.jpg`])).rejects.toThrow(/row-level security/);
  });
  it("닉네임은 대소문자 구분 없이 하나만, 형식(2~16자 한글·영문·숫자·_.)을 지킨다 (0040)", async () => {
    expect(await as(U.stu, "update profiles set nickname='Haneul_01' where id=$1 returning id", [U.stu])).toHaveLength(1);
    await expect(as(U.stu2, "update profiles set nickname='haneul_01' where id=$1", [U.stu2])).rejects.toThrow(/profiles_nickname_unique/);
    await expect(as(U.stu2, "update profiles set nickname='공 백' where id=$1", [U.stu2])).rejects.toThrow(/profiles_nickname_format/);
    await expect(as(U.stu2, "update profiles set nickname='a' where id=$1", [U.stu2])).rejects.toThrow(/profiles_nickname_format/);
    expect(await as(U.stu2, "update profiles set nickname='도윤.dev' where id=$1 returning id", [U.stu2])).toHaveLength(1);
  });
  it("0003/0004 는 검증형 포트폴리오 표의 권한을 바꾸지 않는다", async () => {
    const r = await db.query<{ tablename: string }>("select distinct tablename from pg_policies where schemaname = 'public' and policyname like '개발 중%'");
    expect(r.rows).toHaveLength(0); // 0004 로 개방 정책이 모두 사라졌다
    const mine = await db.query<{ n: number }>("select count(*)::int n from pg_policies where schemaname = 'public' and tablename in ('projects','evidence','project_answers','portfolio_edits','notion_exports')");
    expect(mine.rows[0].n).toBeGreaterThanOrEqual(7);
  });
});

describe("SQL: Notion 저장 잠금과 사용자 격리", () => {
  it("같은 편집본의 준비 작업 중복 차단, 소유자별 조회, 작업당 한 번만 claim", async () => {
    const edit = (await db.query<{id:string}>("select id from portfolio_edits where student_id = $1 limit 1", [U.stu])).rows[0];
    const insert = "insert into notion_exports (user_id, portfolio_version_id, idempotency_key, status, connection_id, blocks) values ($1,$2,$3,'READY',gen_random_uuid(),'[{}]') returning id";
    const job = (await db.query<{id:string}>(insert,[U.stu,edit.id,"job-one"])).rows[0];
    await expect(db.query(insert,[U.stu,edit.id,"job-two"])).rejects.toThrow(/duplicate key/);
    expect(await as(U.stu2,"select * from notion_exports where id = $1",[job.id])).toHaveLength(0);
    expect(await as(U.stu,"select * from notion_exports where id = $1",[job.id])).toHaveLength(1);
    await expect(as(U.stu,"update notion_exports set status = 'SUCCEEDED' where id = $1",[job.id])).rejects.toThrow(/permission denied/);
    expect((await db.query("select * from claim_notion_export($1,$2)",[job.id,U.stu2])).rows).toHaveLength(0);
    expect((await db.query("select * from claim_notion_export($1,$2)",[job.id,U.stu])).rows).toHaveLength(1);
    expect((await db.query("select * from claim_notion_export($1,$2)",[job.id,U.stu])).rows).toHaveLength(0);
    await db.query("update notion_exports set status='UNKNOWN', pending_action='create' where id=$1",[job.id]);
    expect((await db.query("select * from claim_notion_export($1,$2)",[job.id,U.stu])).rows).toHaveLength(0);
  });
  it("OAuth state 는 delete returning 으로 한 번만 소비", async () => {
    await db.query("insert into notion_oauth_states(state,user_id,return_to) values ('once',$1,'http://localhost:3000')",[U.stu]);
    const consume = () => db.query("delete from notion_oauth_states where state='once' returning *");
    expect((await consume()).rows).toHaveLength(1); expect((await consume()).rows).toHaveLength(0);
    await expect(as(U.stu,"select * from notion_oauth_states")).rejects.toThrow(/permission denied/);
  });
});

describe("SQL: 새 DB 에 번호 순서대로", () => {
  it("applies every migration through 0035 in order", async () => {
    const fresh = new PGlite();
    await fresh.exec(STUBS);
    // 폴더에 있는 마이그레이션을 번호 순서대로 모두 적용한다 (파일이 늘어도 목록을 고칠 필요가 없다)
    for (const f of readdirSync(path.join(root, "supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) await fresh.exec(sql(f));
    const t = await fresh.query<{ n: number }>("select count(*)::int n from information_schema.tables where table_schema = 'public'");
    expect(t.rows[0].n).toBe(39);
    await fresh.close();
  });
});

it("hidden portfolio stays readable only to its owner and can be shown again", async () => {
  await as(U.stu, "insert into portfolio_publications(student_id,source_kind,source_id,title,is_visible) values($1,'card','visibility-test','Private work',false)", [U.stu]);
  expect(await as(U.stu2, "select * from portfolio_publications where source_id='visibility-test'")).toHaveLength(0);
  expect(await as(U.stu, "select * from portfolio_publications where source_id='visibility-test'")).toHaveLength(1);
  expect(await as(U.stu2, "update portfolio_publications set is_visible=true where source_id='visibility-test' returning *")).toHaveLength(0);
  await as(U.stu, "update portfolio_publications set is_visible=true where source_id='visibility-test'");
  expect(await as(U.stu2, "select * from portfolio_publications where source_id='visibility-test'")).toHaveLength(1);
});

it("direct photo feed belongs to its author and keeps the selected cover", async () => {
  const images = ["https://example.com/first.jpg", "https://example.com/cover.jpg"];
  const insert = "insert into portfolio_publications(student_id,source_kind,source_id,title,summary,category,sections,cover_url,image_urls) values($1,'manual','manual-sql-test','직접 쓴 글','소개','개인 작업','[{\"title\":\"작업 이야기\",\"body\":\"내용\"}]',$2,$3::jsonb)";
  await expect(as(U.stu2, insert, [U.stu, images[1], JSON.stringify(images)])).rejects.toThrow();
  await as(U.stu, insert, [U.stu, images[1], JSON.stringify(images)]);
  const [row] = await as<{ cover_url: string; image_urls: string[] }>(U.stu2, "select cover_url,image_urls from portfolio_publications where source_id='manual-sql-test'");
  expect(row.cover_url).toBe(images[1]);
  expect(row.image_urls).toEqual(images);
});

describe("SQL: 공개 포트폴리오 페이지 (0036)", () => {
  it("피드에 공개 중인 작업만, 화면에 필요한 칸만 돌려준다", async () => {
    const { projectId } = await startProject("공개 포트폴리오");
    const ev = await addEvidence(projectId);
    const v1 = await submit(projectId, ev);
    await rpc(U.owner, "approve_version", [v1, claims, review, ""]);
    const [s] = await as<{ id: string }>(U.stu, "insert into portfolio_snapshots (project_id, student_id, hash, data) values ($1, $2, 'pub', '{}') returning id", [projectId, U.stu]);
    const [d] = await as<{ id: string }>(U.stu, "insert into portfolio_drafts (snapshot_id, project_id, student_id, generator, content) values ($1, $2, $3, 'TEMPLATE', '{}') returning id", [s.id, projectId, U.stu]);
    await rpc(U.stu, "save_portfolio_edit", [d.id, JSON.stringify({ title: "공개 v1", templateId: "editorial" })]);
    await rpc(U.stu, "save_portfolio_edit", [d.id, JSON.stringify({ title: "공개 v2", templateId: "editorial" })]);
    const get = async (viewer: string, student = U.stu) => (await rpc<{ get_public_portfolio: Record<string, any> | null }>(viewer, "get_public_portfolio", [projectId, student]))[0].get_public_portfolio;

    // 편집본 테이블은 여전히 본인만 읽는다 (권한은 그대로)
    expect(await as(U.stu2, "select * from portfolio_edits where project_id = $1", [projectId])).toHaveLength(0);
    // 공개 전: 남은 못 본다
    expect(await get(U.stu2)).toBeNull();

    await as(U.stu, "insert into portfolio_publications (student_id, source_kind, source_id, title) values ($1, 'project', $2, '공개 v2')", [U.stu, projectId]);
    const p = await get(U.stu2);
    expect(p!.edit.content.title).toBe("공개 v2");                 // 최신 편집본
    expect(p!.edit.content.templateId).toBe("editorial");           // 고른 템플릿 그대로
    expect(p!.edit.version).toBe(2);
    expect(p!.review.comment).toBe("손님들이 좋아해요");
    expect(p!.verification.actually_used).toBe(true);
    expect(p!.evidence.map((e: { id: string }) => e.id)).toEqual([ev]);
    expect(p!.client).toEqual({ name: "owner", role: "resident", kind: "상인" });
    expect(p!.approved_version).toBe(1);
    // 평판 계산용 내부 값·의뢰인 id 는 나가지 않는다
    expect(Object.keys(p!.review)).not.toContain("reviewer_id");
    expect(Object.keys(p!.review)).not.toContain("reviewer_reliability");

    // 다른 학생 이름으로는 안 열린다 (그 학생은 이 작업을 공개하지 않음)
    expect(await get(U.stu2, U.stu2)).toBeNull();
    // 숨기면 남은 못 보고, 본인은 본다
    await as(U.stu, "update portfolio_publications set is_visible = false where source_id = $1", [projectId]);
    expect(await get(U.stu2)).toBeNull();
    expect((await get(U.stu))!.edit.content.title).toBe("공개 v2");
  });
});

describe("SQL: 선정 → 약속서 → 확정 (0037)", () => {
  const newApp = async (title: string, student = U.stu) => {
    const postId = await newPost(title);
    const [app] = await as<{ id: string }>(student, "insert into applications (post_id, student_id, message) values ($1, $2, '지원') returning id", [postId, student]);
    return { postId, appId: app.id };
  };
  it("개인 공고는 한 번에 한 명만 선정, 선정 취소 뒤 다른 지원자를 선정할 수 있다", async () => {
    const { postId, appId } = await newApp("한 명씩 선정");
    const [other] = await as<{ id: string }>(U.stu2, "insert into applications (post_id, student_id, message) values ($1, $2, '지원') returning id", [postId, U.stu2]);
    await rpc(U.owner, "shortlist_applicant", [appId]);
    await expect(rpc(U.owner, "shortlist_applicant", [other.id])).rejects.toThrow(/ALREADY_SHORTLISTED/);
    await rpc(U.stu, "save_chat_agreement", [appId, 0, JSON.stringify(AGREEMENT_TERMS)]);
    // 대화하다 틀어짐 → 학생도 취소할 수 있고, 쓰던 약속서 초안은 지워진다
    await expect(rpc(U.stu2, "cancel_shortlist", [appId])).rejects.toThrow(/FORBIDDEN/);
    await rpc(U.stu, "cancel_shortlist", [appId]);
    expect((await db.query("select 1 from chat_agreements where application_id=$1", [appId])).rows).toHaveLength(0);
    await as(U.stu, "insert into messages(application_id,sender_id,body) values($1,$2,'다시 이야기해요')", [appId, U.stu]);
    await rpc(U.owner, "shortlist_applicant", [other.id]);
    await as(U.stu2, "insert into messages(application_id,sender_id,body) values($1,$2,'안녕하세요')", [other.id, U.stu2]);
    // 확정되면 나머지 대기 지원자는 거절
    const projectId = await selectWithAgreement(as, U.owner, U.stu2, other.id, snapshotFor("DESIGN"));
    expect(projectId).toBeTruthy();
    expect((await db.query<{ status: string }>("select status from applications where id=$1", [appId])).rows[0].status).toBe("rejected");
    await expect(rpc(U.owner, "cancel_shortlist", [other.id])).rejects.toThrow(/합의 취소/);   // 확정 뒤에는 합의 취소
  });
  it("사장님 직접 선정(select_applicant)은 확정된 약속서가 있어야 한다", async () => {
    const { appId } = await newApp("직접 선정");
    await rpc(U.owner, "shortlist_applicant", [appId]);
    await expect(rpc(U.owner, "select_applicant", [appId, snapshotFor("DESIGN")])).rejects.toThrow(/AGREEMENT_REQUIRED/);
  });
  it("약속서가 확정되지 않은 학생은 결과물을 제출할 수 없다", async () => {
    const { projectId, appId } = await startProject("제출 규칙");
    const ev = await addEvidence(projectId);
    await db.query("delete from chat_agreements where application_id = $1", [appId]);   // 규칙 전 프로젝트처럼 약속서가 없는 상태
    await expect(submit(projectId, ev)).rejects.toThrow(/AGREEMENT_REQUIRED/);
  });
  it("확정 뒤 변경: 제안 → 상대 수락이면 새 내용, 거절·철회면 기존 유지", async () => {
    const { appId } = await startProject("변경 제안");
    await expect(rpc(U.owner, "save_chat_agreement", [appId, 1, JSON.stringify(AGREEMENT_TERMS)])).rejects.toThrow(/변경 제안/);
    await rpc(U.owner, "propose_agreement_change", [appId, JSON.stringify({ ...AGREEMENT_TERMS, endDate: "2026-10-30" })]);
    await expect(rpc(U.stu, "propose_agreement_change", [appId, JSON.stringify(AGREEMENT_TERMS)])).rejects.toThrow(/먼저 답해/);
    await expect(rpc(U.owner, "respond_agreement_change", [appId, true])).rejects.toThrow(/상대방이 수락/);
    await rpc(U.stu, "respond_agreement_change", [appId, false]);                                  // 거절 → 기존 유지
    let [a] = await as<{ terms: { endDate: string }; proposed_terms: unknown; version: number }>(U.stu, "select * from chat_agreements where application_id=$1", [appId]);
    expect(a.terms.endDate).toBe("2026-10-20"); expect(a.proposed_terms).toBeNull();
    await rpc(U.stu, "propose_agreement_change", [appId, JSON.stringify({ ...AGREEMENT_TERMS, revisions: 3 })]);
    await rpc(U.owner, "respond_agreement_change", [appId, true]);                                 // 수락 → 새 내용으로 다시 확정
    [a] = await as(U.stu, "select * from chat_agreements where application_id=$1", [appId]);
    expect((a.terms as unknown as { revisions: number }).revisions).toBe(3); expect(a.version).toBe(2);
    await rpc(U.owner, "propose_agreement_change", [appId, JSON.stringify(AGREEMENT_TERMS)]);
    await rpc(U.owner, "respond_agreement_change", [appId, false]);                                // 제안한 쪽의 철회
    [a] = await as(U.stu, "select * from chat_agreements where application_id=$1", [appId]);
    expect(a.proposed_terms).toBeNull();
  });
  it("끝난 프로젝트의 계약서는 수정 제안·수락이 안 되고, 걸린 제안 거절은 된다 (0039)", async () => {
    const { projectId, appId } = await startProject("끝난 프로젝트 계약서");
    await rpc(U.owner, "propose_agreement_change", [appId, JSON.stringify({ ...AGREEMENT_TERMS, revisions: 4 })]);   // 진행 중에 걸린 제안
    await db.query("update projects set status = 'COMPLETED' where id = $1", [projectId]);
    await expect(rpc(U.stu, "respond_agreement_change", [appId, true])).rejects.toThrow(/PROJECT_CLOSED/);
    await rpc(U.stu, "respond_agreement_change", [appId, false]);                                  // 거절은 된다
    await expect(rpc(U.stu, "propose_agreement_change", [appId, JSON.stringify(AGREEMENT_TERMS)])).rejects.toThrow(/PROJECT_CLOSED/);
    await db.query("update projects set status = 'REVIEW_PENDING' where id = $1", [projectId]);   // 검토 중은 아직 진행 중
    await rpc(U.stu, "propose_agreement_change", [appId, JSON.stringify(AGREEMENT_TERMS)]);
  });
});
