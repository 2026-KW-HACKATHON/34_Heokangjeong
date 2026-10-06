import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { rememberBestRanks } from "../src/lib/ranking";

it("retains best ranks when positions fall and improves them when positions rise", () => {
  const row = (id: string) => ({ id, label: id, sub: "", score: 0, solved: 0 });
  const first = rememberBestRanks([row("a"), row("b"), row("c")], {});
  const next = rememberBestRanks([row("c"), row("b"), row("a")], JSON.parse(JSON.stringify(first)));
  expect(next).toEqual({ a: 1, b: 2, c: 1 });
  expect(rememberBestRanks([row("b"), row("a"), row("c")], next)).toEqual({ a: 1, b: 1, c: 1 });
});

it("SQL records ranking changes, retains personal bests, and denies client tampering", async () => {
  const db = new PGlite();
  const a = "00000000-0000-0000-0000-000000000001", b = "00000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select '${a}'::uuid $$;
      create table profiles(id uuid primary key, name text, department text, role text);
      create table posts(id integer primary key, difficulty integer);
      create table portfolio_cards(id integer primary key, student_id uuid, post_id integer, rating integer);
      insert into profiles values ('${a}', 'A', '디자인', 'student'), ('${b}', 'B', '개발', 'student');
      insert into posts values (1, 2);
      insert into portfolio_cards values (1, '${a}', 1, 5);
      grant usage on schema public, auth to authenticated;`);
    await db.exec(readFileSync(path.resolve(__dirname, "../supabase/migrations/0015_personal_rankings.sql"), "utf8"));
    let rows = (await db.query<{ current_rank: number; best_rank: number }>("select * from personal_rankings($1)", [b])).rows;
    expect(rows[0]).toMatchObject({ current_rank: 2, best_rank: 2 });
    await db.exec(`insert into portfolio_cards values (2, '${b}', 1, 5), (3, '${b}', 1, 5);`);
    rows = (await db.query<{ current_rank: number; best_rank: number }>("select * from personal_rankings($1)", [b])).rows;
    expect(rows[0]).toMatchObject({ current_rank: 1, best_rank: 1 });
    await db.exec("delete from portfolio_cards where id in (2, 3)");
    await db.exec("set role authenticated");
    rows = (await db.query<{ current_rank: number; best_rank: number }>("select * from personal_rankings($1)", [b])).rows;
    expect(rows[0]).toMatchObject({ current_rank: 2, best_rank: 1 });
    await expect(db.exec("update personal_best_ranks set best_rank = 1")).rejects.toThrow(/permission denied/);
    await expect(db.exec("select * from compute_individual_rankings()")).rejects.toThrow(/permission denied/);
  } finally { await db.close(); }
});
