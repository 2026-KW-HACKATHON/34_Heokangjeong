// 합의 취소: 요청 → 상대 1명이 수락·거절, 3일 무응답은 거절, 수락해도 기록은 남고 포트폴리오에는 안 나온다.
import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "..", "supabase/migrations");
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
  owner: "00000000-0000-0000-0000-0000000000c1",
  stu: "00000000-0000-0000-0000-0000000000c2",
  stu2: "00000000-0000-0000-0000-0000000000c3",   // 같은 프로젝트의 다른 팀원
};
let db: PGlite;
const REASON = "일정이 맞지 않아 더 진행하기 어려워요";

async function as<T = Record<string, unknown>>(uid: string, q: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false);`);
  return (await db.query<T>(q, params)).rows;
}
const project = async () => {
  const [post] = await as<{ id: string }>(U.owner,
    `insert into posts (title, category, description, author_id, lat, lng, domain) values ('가게 웹사이트','웹/앱','x',$1,37.6,127.0,'DEVELOPMENT') returning id`, [U.owner]);
  const [pr] = await as<{ id: string }>(U.owner,
    `insert into projects (post_id, owner_id, domain, mode, status, question_snapshot) values ($1,$2,'DEVELOPMENT','INDIVIDUAL','IN_PROGRESS','{}'::jsonb) returning id`, [post.id, U.owner]);
  await as(U.owner, `insert into project_members (project_id, student_id, role_label, is_lead) values ($1,$2,'개발',true)`, [pr.id, U.stu]);
  await as(U.owner, `insert into project_members (project_id, student_id, role_label) values ($1,$2,'디자인')`, [pr.id, U.stu2]);
  return { postId: post.id, projectId: pr.id };
};
const statusOf = async (projectId: string) =>
  (await db.query<{ status: string }>("select status from projects where id = $1", [projectId])).rows[0].status;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const f of FILES) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  for (const id of Object.values(U)) await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into profiles(id, role, name, kind, lat, lng) values ($1,'resident','월계 커피','상인',37.6,127.0)", [U.owner]);
  for (const [id, name] of [[U.stu, "팀장"], [U.stu2, "팀원"]] as const)
    await db.query("insert into profiles(id, role, name, department, lat, lng) values ($1,'student',$2,'소프트웨어학부',37.6,127.0)", [id, name]);
});

describe("취소 요청", () => {
  it("사장님이 요청하면 학생 쪽 대표가 수락자가 된다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    const c = (await db.query<{ responder_id: string; status: string }>("select * from project_cancellations where id = $1", [id])).rows[0];
    expect(c.responder_id).toBe(U.stu);      // is_lead 인 학생
    expect(c.status).toBe("PENDING");
  });

  it("학생 쪽 대표가 요청하면 사장님이 수락자가 된다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.stu, "select request_cancellation($1,$2)", [projectId, REASON]);
    const c = (await db.query<{ responder_id: string }>("select * from project_cancellations where id = $1", [id])).rows[0];
    expect(c.responder_id).toBe(U.owner);
  });

  it("대표가 아닌 팀원은 요청할 수 없다", async () => {
    const { projectId } = await project();
    await expect(as(U.stu2, "select request_cancellation($1,$2)", [projectId, REASON])).rejects.toThrow(/FORBIDDEN/);
  });

  it("사유가 10자 미만이면 거절된다", async () => {
    const { projectId } = await project();
    await expect(as(U.owner, "select request_cancellation($1,'그냥')", [projectId])).rejects.toThrow(/REASON_REQUIRED/);
  });

  it("대기 중 요청은 하나만", async () => {
    const { projectId } = await project();
    await as(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await expect(as(U.owner, "select request_cancellation($1,$2)", [projectId, REASON])).rejects.toThrow(/ALREADY_REQUESTED/);
  });

  it("완료된 프로젝트는 취소할 수 없다", async () => {
    const { projectId } = await project();
    await db.query("update projects set status = 'COMPLETED' where id = $1", [projectId]);
    await expect(as(U.owner, "select request_cancellation($1,$2)", [projectId, REASON])).rejects.toThrow(/ALREADY_DONE/);
  });
});

describe("수락 · 거절", () => {
  it("수락하면 프로젝트는 취소되고 공고는 모집 마감된다", async () => {
    const { projectId, postId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await as(U.stu, "select respond_cancellation($1, true)", [id]);

    expect(await statusOf(projectId)).toBe("CANCELLED");
    const post = (await db.query<{ status: string }>("select status from posts where id = $1", [postId])).rows[0];
    expect(post.status).toBe("done");
  });

  it("수락해도 활동 기록과 구성원은 지워지지 않는다", async () => {
    const { projectId } = await project();
    await as(U.stu, "insert into activity_logs (project_id, author_id, stage, note) values ($1,$2,'PROGRESS','중간 기록')", [projectId, U.stu]);
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await as(U.stu, "select respond_cancellation($1, true)", [id]);

    const logs = (await db.query("select * from activity_logs where project_id = $1", [projectId])).rows;
    const members = (await db.query("select * from project_members where project_id = $1", [projectId])).rows;
    expect(logs).toHaveLength(1);
    expect(members).toHaveLength(2);
  });

  it("수락 권한이 없는 사람은 수락할 수 없다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await expect(as(U.stu2, "select respond_cancellation($1, true)", [id])).rejects.toThrow(/FORBIDDEN/);
    expect(await statusOf(projectId)).toBe("IN_PROGRESS");
  });

  it("거절하면 프로젝트는 그대로 진행되고 요청자에게 안내가 간다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await as(U.stu, "select respond_cancellation($1, false)", [id]);

    expect(await statusOf(projectId)).toBe("IN_PROGRESS");
    const n = (await db.query<{ text: string }>("select * from notifications where user_id = $1 and kind = 'CANCEL_REJECTED'", [U.owner])).rows;
    expect(n[0].text).toContain("채팅으로 상대방과 합의");
  });

  it("거절 뒤에 다시 요청할 수 있다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await as(U.stu, "select respond_cancellation($1, false)", [id]);
    await as(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    const n = (await db.query<{ n: number }>("select count(*)::int n from project_cancellations where project_id = $1", [projectId])).rows[0].n;
    expect(n).toBe(2);
  });
});

describe("3일 기한", () => {
  it("기한이 지나면 거절로 처리되고 요청자에게 안내가 간다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await db.query("update project_cancellations set expires_at = now() - interval '1 minute' where id = $1", [id]);

    await as(U.owner, "select expire_cancellations()");
    const c = (await db.query<{ status: string }>("select * from project_cancellations where id = $1", [id])).rows[0];
    expect(c.status).toBe("EXPIRED");
    expect(await statusOf(projectId)).toBe("IN_PROGRESS");
    const n = (await db.query<{ text: string }>("select * from notifications where user_id = $1 and kind = 'CANCEL_REJECTED'", [U.owner])).rows;
    expect(n[0].text).toContain("거절됐어요");
  });

  it("기한이 지난 요청은 수락할 수 없고, 새 요청을 넣을 수 있다", async () => {
    const { projectId } = await project();
    const [{ request_cancellation: id }] = await as<{ request_cancellation: string }>(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);
    await db.query("update project_cancellations set expires_at = now() - interval '1 minute' where id = $1", [id]);

    await expect(as(U.stu, "select respond_cancellation($1, true)", [id])).rejects.toThrow(/ALREADY_RESPONDED/);
    await as(U.owner, "select request_cancellation($1,$2)", [projectId, REASON]);   // 만료 처리 후 재요청 가능
  });
});
