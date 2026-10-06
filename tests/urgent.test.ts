// 긴급 공고 알림 규칙 검증: 평소 공고는 알림이 가지 않고, 긴급 공고만 사장님이 고른 단과대학 학생에게 간다.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const dir = path.join(root, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

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
  owner: "00000000-0000-0000-0000-000000000011",
  ai: "00000000-0000-0000-0000-000000000012",     // 인공지능융합대학 학생
  biz: "00000000-0000-0000-0000-000000000013",    // 경영대학 학생
  none: "00000000-0000-0000-0000-000000000014",   // 단과대학 미입력 학생
};
let db: PGlite;

/** 공고를 올리고(트리거 실행) 학생별로 받은 알림 수를 돌려준다 */
async function post(title: string, urgent: boolean, colleges: string[], category = "웹/앱") {
  await db.query(
    `insert into posts (title, category, description, author_id, lat, lng, urgent, urgent_colleges, difficulty, compensation_type, paid_amount)
     values ($1,$5,'사이트가 멈췄어요',$2,37.625,127.060,$3,$4,2,'PAID',30000)`,
    [title, U.owner, urgent, colleges, category],
  );
  const rows = (await db.query<{ user_id: string; text: string; kind: string }>(
    "select user_id, text, kind from notifications where post_id = (select id from posts where title = $1)", [title],
  )).rows;
  return rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const f of files) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  await db.exec("grant usage on schema public, auth, storage to authenticated; grant all on all tables in schema public to authenticated;");
  for (const id of Object.values(U)) await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into profiles(id, role, name, lat, lng, kind) values ($1,'resident','월계 커피',37.625,127.060,'상인')", [U.owner]);
  await db.query("insert into profiles(id, role, name, department, college, interests, lat, lng, max_distance_m) values ($1,'student','개발 학생','소프트웨어학부','AI','{웹/앱}',37.619,127.059,1500)", [U.ai]);
  await db.query("insert into profiles(id, role, name, department, college, interests, lat, lng, max_distance_m) values ($1,'student','경영 학생','경영학부','BIZ','{SNS홍보}',37.619,127.059,1500)", [U.biz]);
  await db.query("insert into profiles(id, role, name, department, lat, lng, max_distance_m) values ($1,'student','미입력 학생','자율전공학부',37.619,127.059,1500)", [U.none]);
});

describe("긴급 공고 알림", () => {
  it("평소 공고는 아무에게도 알림이 가지 않는다", async () => {
    expect(await post("평소 공고", false, [])).toHaveLength(0);
  });

  it("긴급 공고는 고른 단과대학 학생에게 간다", async () => {
    // 디자인 공고라 관심 분야(웹/앱, SNS홍보)로는 아무도 걸리지 않는다 → 단과대학 조건만 본다
    const rows = await post("긴급: 사이트가 멈췄어요", true, ["AI"], "디자인");
    expect(rows.map((r) => r.user_id)).toEqual([U.ai]);
    expect(rows[0].kind).toBe("URGENT_POST");
    expect(rows[0].text).toContain("긴급 공고");
  });

  it("여러 단과대학을 고르면 모두에게 간다", async () => {
    const rows = await post("긴급: 행사 홍보 급해요", true, ["AI", "BIZ"], "디자인");
    expect(rows.map((r) => r.user_id).sort()).toEqual([U.ai, U.biz].sort());
  });

  it("단과대학을 고르지 않으면 모든 학생에게 간다", async () => {
    const rows = await post("긴급: 아무나 도와주세요", true, []);
    expect(rows).toHaveLength(3);
  });

  it("단과대학이 달라도 관심 분야가 겹치면 알림이 간다", async () => {
    // 경영대학만 골랐지만 공고는 웹/앱 → 관심 분야가 웹/앱인 AI 학생에게도 간다 (합집합)
    const rows = await post("긴급: 결제 페이지 오류", true, ["BIZ"], "웹/앱");
    expect(rows.map((r) => r.user_id).sort()).toEqual([U.ai, U.biz].sort());
  });

  it("거리와 상관없이 알림이 간다 (급한 일이라 범위를 넓게 본다)", async () => {
    await db.query("update profiles set max_distance_m = 100 where role = 'student'");
    const rows = await post("긴급: 멀어도 알림", true, ["AI"], "디자인");
    expect(rows.map((r) => r.user_id)).toEqual([U.ai]);
  });
});

describe("긴급 공고 지원 자격", () => {
  // 평소 유료 공고는 검증된 프로젝트가 1개 이상이어야 지원할 수 있다 (앞으로 들어올 등급 제도 1단계)
  const newPost = async (title: string, urgent: boolean) => {
    const [{ id }] = (await db.query<{ id: string }>(
      `insert into posts (title, category, description, author_id, lat, lng, urgent, difficulty, compensation_type, paid_amount)
       values ($1,'웹/앱','급해요',$2,37.625,127.060,$3,2,'PAID',30000) returning id`, [title, U.owner, urgent])).rows;
    return id;
  };
  const apply = (postId: string, student: string) =>
    db.query("insert into applications (post_id, student_id, message) values ($1,$2,'지원')", [postId, student]);

  it("평소 유료 공고는 검증 경험이 없으면 지원할 수 없다", async () => {
    const id = await newPost("평소 유료 공고", false);
    await expect(apply(id, U.ai)).rejects.toThrow(/PAID_NOT_ELIGIBLE/);
  });

  it("긴급 공고는 유료여도 검증 경험 없이 지원할 수 있다", async () => {
    const id = await newPost("긴급 유료 공고", true);
    await apply(id, U.ai);
    const n = (await db.query<{ n: number }>("select count(*)::int n from applications where post_id = $1", [id])).rows[0].n;
    expect(n).toBe(1);
  });
});

describe("긴급 공고 최소 보상", () => {
  const insert = (title: string, difficulty: number, type: string, amount: number | null) =>
    db.query(`insert into posts (title, category, description, author_id, lat, lng, urgent, difficulty, compensation_type, paid_amount)
      values ($1,'웹/앱','급해요',$2,37.625,127.060,true,$3,$4,$5)`, [title, U.owner, difficulty, type, amount]);

  it("무료 봉사로는 긴급 공고를 올릴 수 없다", async () => {
    await expect(insert("긴급 무료", 2, "VOLUNTEER", null)).rejects.toThrow();
  });

  it("최소 금액보다 적으면 거절된다 (난이도 ★★ → 3만원)", async () => {
    await expect(insert("긴급 2만원", 2, "PAID", 20000)).rejects.toThrow();
  });

  it("난이도가 높으면 기준도 올라간다 (★★★ → 5만원)", async () => {
    await expect(insert("긴급 3만원 어려움", 3, "PAID", 30000)).rejects.toThrow();
    await insert("긴급 5만원 어려움", 3, "PAID", 50000);
  });

  it("기준을 넘으면 등록된다", async () => {
    await insert("긴급 3만원 보통", 2, "PAID", 30000);
    const n = (await db.query<{ n: number }>("select count(*)::int n from posts where title = '긴급 3만원 보통'")).rows[0].n;
    expect(n).toBe(1);
  });

  it("평소 공고는 보상 제한이 없다", async () => {
    await db.query(`insert into posts (title, category, description, author_id, lat, lng, compensation_type) values ('평소 무료','웹/앱','천천히',$1,37.625,127.060,'VOLUNTEER')`, [U.owner]);
    const n = (await db.query<{ n: number }>("select count(*)::int n from posts where title = '평소 무료'")).rows[0].n;
    expect(n).toBe(1);
  });
});
