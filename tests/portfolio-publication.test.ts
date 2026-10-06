import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

it("only owners can publish or withdraw; private edits remain private", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub')::uuid $$;
      create table public.profiles (id uuid primary key);
      create table public.portfolio_edits (student_id uuid, content text);
      alter table public.portfolio_edits enable row level security;
      create policy "편집본은 공개 포트폴리오" on public.portfolio_edits for select to authenticated using (true);
      grant usage on schema auth to authenticated;
      grant select on public.portfolio_edits to authenticated;
      insert into public.profiles values ('${owner}'), ('${other}');
      insert into public.portfolio_edits values ('${owner}', 'private draft');`);
    await db.exec(readFileSync(path.resolve(__dirname, "../supabase/migrations/0014_portfolio_publications.sql"), "utf8"));
    const as = async (id: string) => db.exec(`reset role; select set_config('request.jwt.claim.sub', '${id}', false); set role authenticated;`);
    await as(other);
    expect((await db.query("select * from portfolio_edits")).rows).toEqual([]);
    expect((await db.query("select * from portfolio_publications")).rows).toEqual([]);
    await expect(db.query("insert into portfolio_publications (student_id, source_kind, source_id, title) values ($1, 'project', 'p1', 'unauthorized')", [owner])).rejects.toThrow();
    await as(owner);
    expect((await db.query("select * from portfolio_edits")).rows).toHaveLength(1);
    await db.query("insert into portfolio_publications (student_id, source_kind, source_id, title) values ($1, 'project', 'p1', 'published title')", [owner]);
    await as(other);
    expect((await db.query("select title from portfolio_publications")).rows).toEqual([{ title: "published title" }]);
    expect((await db.query("delete from portfolio_publications returning *")).rows).toEqual([]);
    expect((await db.query("update portfolio_publications set title = 'hacked' returning *")).rows).toEqual([]);
    await as(owner);
    await db.exec("delete from portfolio_publications");
    await as(other);
    expect((await db.query("select * from portfolio_publications")).rows).toEqual([]);
  } finally { await db.close(); }
});
