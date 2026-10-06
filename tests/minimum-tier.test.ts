import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applicationTierFor, validateTierReward, meetsApplicationTier } from "@shared/portfolio/policy";
import { apply } from "@/lib/workflow/engine";
import { seed, ctx } from "./fixtures";

it("unifies top-five and temperature tiers and scales reward floors", () => {
  expect(applicationTierFor(36.5, 2).key).toBe("RECOMMENDED");
  expect(applicationTierFor(36.5, 6).key).toBe("SEED");
  expect(applicationTierFor(40, 6).key).toBe("TRUST");
  expect(applicationTierFor(50, 6).key).toBe("RECOMMENDED");
  expect(meetsApplicationTier("TRUST", "RECOMMENDED")).toBe(false);
  expect(() => validateTierReward("TRUST", "NON_MONETARY", 99999)).toThrow();
  expect(() => validateTierReward("TRUST", "PAID", 29999)).toThrow();
  expect(() => validateTierReward("TRUST", "PAID", 30000)).not.toThrow();
  expect(() => validateTierReward("RECOMMENDED", "PAID", 49999)).toThrow();
  expect(() => validateTierReward("RECOMMENDED", "PAID", 50000)).not.toThrow();
  expect(() => validateTierReward("RECOMMENDED", "PAID", NaN)).toThrow();
});

it("mock engine rejects insufficient tiers and preserves the paid verification requirement", () => {
  const db = seed();
  const student = db.users.find(u => u.id === "stu")!;
  for (let i = 1; i <= 4; i++) db.users.push({ ...student, id: `a${i}` });
  Object.assign(db.posts[0], { minimumTier: "TRUST", compensationType: "PAID", paidAmount: 30000 });
  expect(() => apply(db, { postId: "post", studentId: "stu2", message: "지원" }, ctx())).toThrow(/등급 이상/);
  expect(() => apply(db, { postId: "post", studentId: "stu", message: "지원" }, ctx())).toThrow(/검증된 프로젝트/);
  db.tierEvents.push({ id: "verified", studentId: "stu", projectId: "old", kind: "PROJECT_VERIFIED", points: 10, createdAt: "2026-01-01" });
  expect(apply(db, { postId: "post", studentId: "stu", message: "지원" }, ctx()).status).toBe("pending");
});

it("DB checks reward floors and rejects tier bypass through direct application inserts", async () => {
  const db = new PGlite();
  const first = "00000000-0000-0000-0000-000000000001";
  const last = "00000000-0000-0000-0000-000000000006";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select '${first}'::uuid $$;
      create table profiles(id uuid primary key, name text, department text, role text);
      create table posts(id integer primary key, difficulty integer, compensation_type text, paid_amount integer);
      create table portfolio_cards(id integer primary key, student_id uuid, post_id integer, rating integer);
      create table applications(id serial primary key, post_id integer, student_id uuid);
      create table tier_score_events(student_id uuid, project_id integer, kind text);
      create table client_reviews(project_id integer, deadline integer, communication integer, handoff integer);
      create table team_peer_reviews(project_id integer, reviewee_id uuid, communication integer, collaboration integer, responsibility integer);
      insert into profiles select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, 'Student', 'Dept', 'student' from generate_series(1,6) n;
      grant usage on schema public, auth to authenticated;
      grant insert, select on posts, applications to authenticated;
      grant usage on sequence applications_id_seq to authenticated;`);
    for (const file of ["0015_personal_rankings.sql", "0016_post_minimum_tier.sql"]) await db.exec(readFileSync(path.resolve(__dirname, "../supabase/migrations", file), "utf8"));
    await db.exec("set role authenticated");
    await expect(db.exec("insert into posts values(1,2,'PAID',49999,'RECOMMENDED')")).rejects.toThrow(/posts_tier_reward_floor/);
    await expect(db.exec("insert into posts values(1,2,'PAID',null,'RECOMMENDED')")).rejects.toThrow(/posts_tier_reward_floor/);
    await db.exec("insert into posts values(1,2,'PAID',50000,'RECOMMENDED')");
    await expect(db.query("insert into applications(post_id,student_id) values(1,$1)", [last])).rejects.toThrow(/TIER_NOT_ELIGIBLE/);
    await expect(db.query("insert into applications(post_id,student_id) values(1,$1)", [first])).rejects.toThrow(/PAID_NOT_ELIGIBLE/);
    await db.exec(`reset role; insert into tier_score_events values('${first}',1,'PROJECT_VERIFIED'); set role authenticated;`);
    await db.query("insert into applications(post_id,student_id) values(1,$1)", [first]);
    expect((await db.query("select * from applications")).rows).toHaveLength(1);
    await db.exec(`reset role; insert into client_reviews select n,5,5,5 from generate_series(1,9) n; insert into tier_score_events select '${last}',n,'PROJECT_VERIFIED' from generate_series(1,9) n;`);
    expect((await db.query<{ tier: string }>("select student_application_tier($1) tier", [last])).rows[0].tier).toBe("RECOMMENDED");
    await db.exec("set role authenticated");
    await db.query("insert into applications(post_id,student_id) values(1,$1)", [last]);
  } finally { await db.close(); }
});
