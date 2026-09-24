// Supabase 마이그레이션을 PGlite(WASM Postgres)에 올려 DB 함수·RLS 를 실제로 검증한다.
// 팀 DB 와 같은 순서: 0001 → 0005(이미 적용) → 이후 팀이 실행할 0002 → 0003(개방) → 0004(잠금). 테스트는 잠금 상태에서 돈다.
// Supabase 의 auth/storage 스키마와 역할은 최소한으로 흉내 낸다. RLS 가 적용되도록 authenticated 역할로 실행한다.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DOMAINS, QUESTION_SET_VERSION } from "@shared/portfolio/domains";

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
const review = JSON.stringify({ satisfaction: 5, deadline: 4, communication: 5, handoff: 4, comment: "손님들이 좋아해요" });

async function newPost(title: string, extra = "") {
  const [p] = await as<{ id: string }>(U.owner, `insert into posts (title, category, description, author_id, lat, lng, domain, revision_limit ${extra ? ", compensation_type" : ""})
    values ($1, '디자인', '메뉴판이 복잡해요', $2, 37.6, 127.0, 'DESIGN', 2 ${extra ? `, '${extra}'` : ""}) returning id`, [title, U.owner]);
  return p.id;
}
async function startProject(title = "메뉴판 개선") {
  const postId = await newPost(title);
  const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id, message) values ($1, $2, '지원') returning id", [postId, U.stu]);
  const [r] = await rpc<{ select_applicant: string }>(U.owner, "select_applicant", [app.id, snapshotFor("DESIGN")]);
  return { postId, appId: app.id, projectId: r.select_applicant };
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
  for (const [k, id] of Object.entries(U)) {
    await db.query("insert into auth.users (id) values ($1)", [id]);
    const student = k.startsWith("stu");
    await db.query("insert into profiles (id, role, name, kind) values ($1, $2, $3, $4)", [id, student ? "student" : "resident", k, student ? null : "상인"]);
  }
});

describe("SQL: 선정·제출·검토 (DB 함수)", () => {
  it("선정 → IN_PROGRESS, 질문 스냅샷 저장, 공고 진행 중", async () => {
    const { projectId, postId } = await startProject();
    expect(await status(projectId)).toBe("IN_PROGRESS");
    const [p] = (await db.query<{ status: string }>("select status from posts where id = $1", [postId])).rows;
    expect(p.status).toBe("in_progress");
  });
  it("다른 점주는 선정할 수 없다", async () => {
    const postId = await newPost("x");
    const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id) values ($1, $2) returning id", [postId, U.stu]);
    await expect(rpc(U.owner2, "select_applicant", [app.id, snapshotFor("DESIGN")])).rejects.toThrow(/FORBIDDEN/);
  });
  it("잘못된 질문 스냅샷은 거부", async () => {
    const postId = await newPost("y");
    const [app] = await as<{ id: string }>(U.stu, "insert into applications (post_id, student_id) values ($1, $2) returning id", [postId, U.stu]);
    await expect(rpc(U.owner, "select_applicant", [app.id, snapshotFor("MARKETING")])).rejects.toThrow(/INVALID_INPUT/);
  });
  it("선정되지 않은 학생은 제출·답변·증빙 불가 (RLS + 함수)", async () => {
    const { projectId } = await startProject("z");
    const ev = await addEvidence(projectId);
    await expect(rpc(U.stu2, "submit_version", [projectId, "", [ev]])).rejects.toThrow(/FORBIDDEN/);
    await expect(as(U.stu2, "insert into project_answers (project_id, author_id, question_id, field, stage, status, value) values ($1, $2, 'd_problem', 'existingProblem', 'START', 'ANSWERED', 'x')", [projectId, U.stu2])).rejects.toThrow(/row-level security/);
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
  it("유료 공고: 검증 이력 없으면 지원 불가, 생기면 가능", async () => {
    const paid = await newPost("paid", "PAID");
    await expect(as(U.stu2, "insert into applications (post_id, student_id) values ($1, $2)", [paid, U.stu2])).rejects.toThrow(/PAID_NOT_ELIGIBLE/);
    await as(U.stu, "insert into applications (post_id, student_id) values ($1, $2)", [paid, U.stu]); // stu 는 앞 테스트에서 검증됨
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
    expect(await as(U.stu, "select * from notion_connections")).toHaveLength(0);
    await expect(as(U.stu, "insert into notion_connections (user_id, access_token_enc, bot_id, workspace_id) values ($1, 'x', 'b', 'w')", [U.stu2])).rejects.toThrow(/row-level security/);
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
  it("0003/0004 는 검증형 포트폴리오 표의 권한을 바꾸지 않는다", async () => {
    const r = await db.query<{ tablename: string }>("select distinct tablename from pg_policies where schemaname = 'public' and policyname like '개발 중%'");
    expect(r.rows).toHaveLength(0); // 0004 로 개방 정책이 모두 사라졌다
    const mine = await db.query<{ n: number }>("select count(*)::int n from pg_policies where schemaname = 'public' and tablename in ('projects','evidence','project_answers','portfolio_edits','notion_exports')");
    expect(mine.rows[0].n).toBeGreaterThanOrEqual(7);
  });
});

describe("SQL: 새 DB 에 번호 순서대로", () => {
  it("0001 → 0002 → 0003 → 0004 → 0005 가 오류 없이 적용된다", async () => {
    const fresh = new PGlite();
    await fresh.exec(STUBS);
    for (const f of ["0001_init.sql", "0002_permissions.sql", "0003_dev_open.sql", "0004_strict.sql", "0005_verified_portfolio.sql"]) await fresh.exec(sql(f));
    const t = await fresh.query<{ n: number }>("select count(*)::int n from information_schema.tables where table_schema = 'public'");
    expect(t.rows[0].n).toBe(24);
    await fresh.close();
  });
});
