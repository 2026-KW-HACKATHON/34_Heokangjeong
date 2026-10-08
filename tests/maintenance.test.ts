// 유지보수·인수인계 규칙 검증 (PGlite 에 마이그레이션을 전부 올려서 실제 DB 함수를 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { selectWithAgreement } from "./agreementSelect";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "supabase/migrations");
const FILES = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

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

const U = {
  owner: "00000000-0000-0000-0000-0000000000a1",
  stu: "00000000-0000-0000-0000-0000000000a2",
  stu2: "00000000-0000-0000-0000-0000000000a3",
};
let db: PGlite;

/** 특정 사용자로 실행 (auth.uid() 가 바뀐다) */
async function as<T = Record<string, unknown>>(uid: string, q: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false);`);
  return (await db.query<T>(q, params)).rows;
}

/** 공고 → 프로젝트 → 완료까지 만든다 (ongoing: 계속 운영되는 결과물인지) */
async function completedProject(ongoing: boolean, opts: { requestDays?: number; defectDays?: number; requestCount?: number } = {}) {
  const [post] = await as<{ id: string }>(U.owner,
    `insert into posts (title, category, description, author_id, lat, lng, domain, ongoing, warranty_request_days, warranty_defect_days, warranty_request_count)
     values ('가게 웹사이트','웹/앱','만들어 주세요',$1,37.6,127.0,'DEVELOPMENT',$2,$3,$4,$5) returning id`,
    [U.owner, ongoing, opts.requestDays ?? 30, opts.defectDays ?? 90, opts.requestCount ?? 3]);
  const [project] = await as<{ id: string }>(U.owner,
    `insert into projects (post_id, owner_id, domain, mode, status, question_snapshot) values ($1,$2,'DEVELOPMENT','INDIVIDUAL','IN_PROGRESS','{}'::jsonb) returning id`,
    [post.id, U.owner]);
  await as(U.owner, `insert into project_members (project_id, student_id, role_label) values ($1,$2,'개발')`, [project.id, U.stu]);
  await as(U.owner, `update projects set status = 'COMPLETED', completed_at = now() where id = $1`, [project.id]);
  return { postId: post.id, projectId: project.id };
}

const ops = async (projectId: string) =>
  (await db.query<{ status: string; maintainer_id: string; request_used: number; warranty_request_until: string; warranty_defect_until: string }>(
    "select * from operations where project_id = $1", [projectId])).rows[0];

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const f of FILES) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  for (const id of Object.values(U)) await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into profiles(id, role, name, kind, lat, lng) values ($1,'resident','월계 커피','상인',37.6,127.0)", [U.owner]);
  await db.query("insert into profiles(id, role, name, department, college, lat, lng) values ($1,'student','김광운','소프트웨어학부','AI',37.6,127.0)", [U.stu]);
  await db.query("insert into profiles(id, role, name, department, college, lat, lng) values ($1,'student','이어받','컴퓨터정보공학부','AI',37.6,127.0)", [U.stu2]);
});

describe("운영 시작", () => {
  it("계속 운영되는 결과물이면 완료와 동시에 운영이 시작되고 보증 기간이 잡힌다", async () => {
    const { projectId } = await completedProject(true, { requestDays: 30, defectDays: 90 });
    const o = await ops(projectId);
    expect(o.status).toBe("WARRANTY");
    expect(o.maintainer_id).toBe(U.stu);
    const days = (d: string) => Math.round((new Date(d).getTime() - Date.now()) / 86400000);
    expect(days(o.warranty_request_until)).toBeGreaterThanOrEqual(29);
    expect(days(o.warranty_defect_until)).toBeGreaterThanOrEqual(89);
  });

  it("만들고 끝나는 일(포스터 등)은 운영이 생기지 않는다", async () => {
    const { projectId } = await completedProject(false);
    expect(await ops(projectId)).toBeUndefined();
  });

  it("담당자 이력이 남는다", async () => {
    const { projectId } = await completedProject(true);
    const h = (await db.query("select * from maintainer_history where project_id = $1", [projectId])).rows;
    expect(h).toHaveLength(1);
  });
});

describe("유지보수 요청 범위 판정", () => {
  it("보증 기간 안의 버그는 무상(하자)", async () => {
    const { projectId } = await completedProject(true);
    const [t] = await as<{ create_ticket: string }>(U.owner, "select create_ticket($1,'BUG','메뉴 사진이 안 떠요')", [projectId]);
    const row = (await db.query<{ coverage: string; assignee_id: string }>("select * from maintenance_tickets where id = $1", [t.create_ticket])).rows[0];
    expect(row.coverage).toBe("FREE_DEFECT");
    expect(row.assignee_id).toBe(U.stu);
  });

  it("내용 수정은 무상 횟수 안에서만 무상이고, 횟수를 넘으면 새 공고로 안내한다", async () => {
    const { projectId } = await completedProject(true, { requestCount: 2 });
    for (const n of [1, 2]) await as(U.owner, "select create_ticket($1,'CONTENT','메뉴 가격 바꿔 주세요 " + n + "')", [projectId]);
    expect((await ops(projectId)).request_used).toBe(2);
    const [t] = await as<{ create_ticket: string }>(U.owner, "select create_ticket($1,'CONTENT','또 바꿔 주세요')", [projectId]);
    const row = (await db.query<{ coverage: string }>("select * from maintenance_tickets where id = $1", [t.create_ticket])).rows[0];
    expect(row.coverage).toBe("EXPIRED");
  });

  it("기능 추가는 언제나 새 공고로 분류된다", async () => {
    const { projectId } = await completedProject(true);
    const [t] = await as<{ create_ticket: string }>(U.owner, "select create_ticket($1,'FEATURE','예약 기능도 넣어 주세요')", [projectId]);
    const row = (await db.query<{ coverage: string; assignee_id: string | null }>("select * from maintenance_tickets where id = $1", [t.create_ticket])).rows[0];
    expect(row.coverage).toBe("NEW_POST");
    expect(row.assignee_id).toBeNull();
  });

  it("보증 기간이 지난 버그는 무상이 아니다", async () => {
    const { projectId } = await completedProject(true);
    await db.query("update operations set warranty_defect_until = current_date - 1, warranty_request_until = current_date - 1 where project_id = $1", [projectId]);
    const [t] = await as<{ create_ticket: string }>(U.owner, "select create_ticket($1,'BUG','이제 와서 오류가 나요')", [projectId]);
    const row = (await db.query<{ coverage: string }>("select * from maintenance_tickets where id = $1", [t.create_ticket])).rows[0];
    expect(row.coverage).toBe("EXPIRED");
  });

  it("학생은 유지보수 요청을 만들 수 없다 (의뢰인만)", async () => {
    const { projectId } = await completedProject(true);
    await expect(as(U.stu, "select create_ticket($1,'BUG','내가 올리기')", [projectId])).rejects.toThrow(/FORBIDDEN/);
  });

  it("담당 학생이 처리하면 이력의 처리 건수가 올라간다", async () => {
    const { projectId } = await completedProject(true);
    const [t] = await as<{ create_ticket: string }>(U.owner, "select create_ticket($1,'BUG','오류')", [projectId]);
    await as(U.stu, "select close_ticket($1)", [t.create_ticket]);
    const h = (await db.query<{ tickets_closed: number }>("select * from maintainer_history where project_id = $1", [projectId])).rows[0];
    expect(h.tickets_closed).toBe(1);
  });
});

describe("인수인계와 이어받기", () => {
  it("인수인계 정보는 현재 담당자만 저장한다", async () => {
    const { projectId } = await completedProject(true);
    await expect(as(U.stu2, `select save_handover($1, '{"repoUrl":"https://github.com/x/y"}'::jsonb)`, [projectId])).rejects.toThrow(/FORBIDDEN/);
    await as(U.stu, `select save_handover($1, '{"repoUrl":"https://github.com/x/y","adminHanded":true}'::jsonb)`, [projectId]);
    const o = (await db.query<{ repo_url: string; admin_handed: boolean }>("select * from operations where project_id = $1", [projectId])).rows[0];
    expect(o.repo_url).toBe("https://github.com/x/y");
    expect(o.admin_handed).toBe(true);
  });

  it("인수인계 정보가 비어 있으면 인계를 요청할 수 없다", async () => {
    const { projectId } = await completedProject(true);
    await expect(as(U.stu, "select open_handover($1)", [projectId])).rejects.toThrow(/HANDOVER_INCOMPLETE/);
  });

  it("인계를 요청하면 이어받기 공고가 홈 피드에 올라간다", async () => {
    const { projectId } = await completedProject(true);
    await as(U.stu, `select save_handover($1, '{"repoUrl":"https://github.com/x/y"}'::jsonb)`, [projectId]);
    const [{ open_handover: postId }] = await as<{ open_handover: string }>(U.stu, "select open_handover($1)", [projectId]);
    expect((await ops(projectId)).status).toBe("HANDOVER_OPEN");

    const post = (await db.query<{ title: string; status: string; ongoing: boolean }>("select * from posts where id = $1", [postId])).rows[0];
    expect(post.title).toContain("[이어받기]");
    expect(post.status).toBe("open");       // 다른 공고와 똑같이 모집 중으로 보인다
    expect(post.ongoing).toBe(true);
  });

  it("이어받기 공고에 지원한 학생을 사장님이 선정하면 담당자가 바뀐다", async () => {
    const { projectId } = await completedProject(true);
    await as(U.stu, `select save_handover($1, '{"repoUrl":"https://github.com/x/y"}'::jsonb)`, [projectId]);
    const [{ open_handover: postId }] = await as<{ open_handover: string }>(U.stu, "select open_handover($1)", [projectId]);

    const [app] = await as<{ id: string }>(U.stu2, "insert into applications (post_id, student_id, message) values ($1,$2,'이어받고 싶어요') returning id", [postId, U.stu2]);
    await selectWithAgreement(as, U.owner, U.stu2, app.id, JSON.stringify({ domain: "DEVELOPMENT", version: 1, questions: [], takenAt: "2026-10-07T00:00:00Z" }));   // 0037: 약속서 확정 = 선정

    const o = await ops(projectId);
    expect(o.status).toBe("OPERATING");
    expect(o.maintainer_id).toBe(U.stu2);

    const h = (await db.query<{ student_id: string; ended_on: string | null }>("select * from maintainer_history where project_id = $1 order by started_on", [projectId])).rows;
    expect(h).toHaveLength(2);
    expect(h.find((x) => x.student_id === U.stu)?.ended_on).not.toBeNull();
    expect(h.find((x) => x.student_id === U.stu2)?.ended_on).toBeNull();
  });

  it("학생이 혼자 즉시 이어받을 수는 없다 (사장님 선정 필요)", async () => {
    const { projectId } = await completedProject(true);
    await expect(as(U.stu2, "select take_over($1)", [projectId])).rejects.toThrow(/DEPRECATED/);
  });

  it("가동 점검 실패는 담당자에게 알림이 간다", async () => {
    const { projectId } = await completedProject(true);
    await as(U.owner, "select record_uptime($1, false)", [projectId]);
    const n = (await db.query<{ n: number }>("select count(*)::int n from notifications where user_id = $1 and kind = 'UPTIME'", [U.stu])).rows[0].n;
    expect(n).toBe(1);
  });
});
