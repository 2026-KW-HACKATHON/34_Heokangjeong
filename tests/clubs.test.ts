// 단체(동아리·학회·학생회) 규칙 검증. 단체가 맡은 서비스는 단체 안에서 담당자를 바로 넘길 수 있다.
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
  admin: "00000000-0000-0000-0000-0000000000b0",
  owner: "00000000-0000-0000-0000-0000000000b1",
  leader: "00000000-0000-0000-0000-0000000000b2",   // 단체 대표
  member: "00000000-0000-0000-0000-0000000000b3",   // 같은 단체 소속
  outsider: "00000000-0000-0000-0000-0000000000b4", // 소속 없음
};
let db: PGlite;
const snapshot = JSON.stringify({ domain: "DEVELOPMENT", version: 1, questions: [], takenAt: "2026-10-07T00:00:00Z" });

async function as<T = Record<string, unknown>>(uid: string, q: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false);`);
  return (await db.query<T>(q, params)).rows;
}
const ops = async (projectId: string) =>
  (await db.query<{ status: string; maintainer_id: string; club_id: string | null }>("select * from operations where project_id = $1", [projectId])).rows[0];

/** 단체 이름으로 지원해서 완료까지 간 프로젝트 */
async function clubProject(clubId: string | null, student = U.leader) {
  const [post] = await as<{ id: string }>(U.owner,
    `insert into posts (title, category, description, author_id, lat, lng, domain, ongoing, prefer_club)
     values ('가게 웹사이트','웹/앱','만들어 주세요',$1,37.6,127.0,'DEVELOPMENT',true,$2) returning id`, [U.owner, clubId !== null]);
  const [app] = await as<{ id: string }>(student,
    `insert into applications (post_id, student_id, message, club_id) values ($1,$2,'지원',$3) returning id`, [post.id, student, clubId]);
  const [r] = await as<{ select_applicant: string }>(U.owner, "select select_applicant($1,$2::jsonb)", [app.id, snapshot]);
  const projectId = r.select_applicant;
  // 제출·승인 과정은 다른 테스트에서 검증하므로 여기서는 상태만 완료로 바꾼다
  await as(U.owner, "update projects set status = 'COMPLETED', completed_at = now() where id = $1", [projectId]);
  return projectId;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const f of FILES) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  for (const id of Object.values(U)) await db.query("insert into auth.users(id) values ($1)", [id]);
  await db.query("insert into profiles(id, role, name, lat, lng) values ($1,'admin','관리자',37.6,127.0)", [U.admin]);
  await db.query("insert into profiles(id, role, name, kind, lat, lng) values ($1,'resident','월계 커피','상인',37.6,127.0)", [U.owner]);
  for (const [id, name] of [[U.leader, "대표"], [U.member, "부원"], [U.outsider, "외부"]] as const)
    await db.query("insert into profiles(id, role, name, department, college, lat, lng) values ($1,'student',$2,'소프트웨어학부','AI',37.6,127.0)", [id, name]);
});

/** 단체 등록 신청 → 관리자 승인까지 */
const makeClub = async (uid = U.leader, kind = "CENTRAL", other: string | null = null, approve = true) => {
  const id = (await as<{ create_club: string }>(uid, "select create_club($1,$2,$3,$4,$5)", ["광운 웹스튜디오", kind, "웹사이트를 만들어요", "AI", other]))[0].create_club;
  if (approve) await as(U.admin, "select review_club($1, true, null)", [id]);
  return id;
};
/** 가입 신청 → 대표 수락까지 */
const joinClub = async (club: string, uid: string) => {
  await as(uid, "select join_club($1)", [club]);
  await as(U.leader, "select review_member($1,$2,true)", [club, uid]);
};

describe("단체 만들기·가입", () => {
  it("만든 사람이 대표가 된다", async () => {
    const club = await makeClub();
    const m = (await db.query<{ role: string }>("select * from club_members where club_id = $1 and student_id = $2", [club, U.leader])).rows[0];
    expect(m.role).toBe("LEADER");
  });

  it("기타 유형이면 직접 적은 이름이 저장된다", async () => {
    const club = await makeClub(U.leader, "OTHER", "교내 방송국");
    const c = (await db.query<{ kind: string; kind_other: string }>("select * from clubs where id = $1", [club])).rows[0];
    expect(c.kind).toBe("OTHER");
    expect(c.kind_other).toBe("교내 방송국");
  });

  it("정해진 유형을 고르면 직접 입력은 무시된다", async () => {
    const club = await makeClub(U.leader, "CENTRAL", "교내 방송국");
    const c = (await db.query<{ kind_other: string | null }>("select * from clubs where id = $1", [club])).rows[0];
    expect(c.kind_other).toBeNull();
  });

  it("사장님(주민·상인)은 단체를 만들 수 없다", async () => {
    await expect(as(U.owner, "select create_club('가게 모임','OTHER','',null,null)")).rejects.toThrow(/FORBIDDEN/);
  });

  it("가입은 신청 후 대표가 수락해야 소속이 된다", async () => {
    const club = await makeClub();
    await as(U.member, "select join_club($1)", [club]);
    let m = (await db.query<{ status: string }>("select * from club_members where club_id = $1 and student_id = $2", [club, U.member])).rows[0];
    expect(m.status).toBe("PENDING");

    await as(U.leader, "select review_member($1,$2,true)", [club, U.member]);
    m = (await db.query<{ status: string }>("select * from club_members where club_id = $1 and student_id = $2", [club, U.member])).rows[0];
    expect(m.status).toBe("ACTIVE");
  });

  it("대표가 아니면 가입을 수락할 수 없다", async () => {
    const club = await makeClub();
    await as(U.member, "select join_club($1)", [club]);
    await expect(as(U.outsider, "select review_member($1,$2,true)", [club, U.member])).rejects.toThrow(/FORBIDDEN/);
  });

  it("관리자 승인 전에는 가입 신청도 안 된다", async () => {
    const club = await makeClub(U.leader, "CENTRAL", null, false);
    await expect(as(U.member, "select join_club($1)", [club])).rejects.toThrow(/NOT_APPROVED/);
  });

  it("관리자가 아니면 단체를 승인할 수 없다", async () => {
    const club = await makeClub(U.leader, "CENTRAL", null, false);
    await expect(as(U.leader, "select review_club($1, true, null)", [club])).rejects.toThrow(/FORBIDDEN/);
  });

  it("거절되면 사유가 남고 목록에 뜨지 않는다", async () => {
    const club = await makeClub(U.leader, "CENTRAL", null, false);
    await as(U.admin, "select review_club($1, false, '실제 단체인지 확인이 어려워요')", [club]);
    const c = (await db.query<{ status: string; reject_reason: string }>("select * from clubs where id = $1", [club])).rows[0];
    expect(c.status).toBe("REJECTED");
    expect(c.reject_reason).toContain("확인");
  });
});

describe("공고 삭제", () => {
  const newPost = async () => (await as<{ id: string }>(U.owner,
    `insert into posts (title, category, description, author_id, lat, lng, domain) values ('지울 공고','웹/앱','x',$1,37.6,127.0,'DEVELOPMENT') returning id`, [U.owner]))[0].id;

  it("작성자는 자기 공고를 지운다", async () => {
    const id = await newPost();
    await as(U.owner, "select delete_post($1)", [id]);
    const n = (await db.query<{ n: number }>("select count(*)::int n from posts where id = $1", [id])).rows[0].n;
    expect(n).toBe(0);
  });

  it("남의 공고는 지울 수 없다", async () => {
    const id = await newPost();
    await expect(as(U.leader, "select delete_post($1)", [id])).rejects.toThrow(/FORBIDDEN/);
  });

  it("학생이 선정된 뒤에는 지울 수 없다 (활동 기록 보호)", async () => {
    const id = await newPost();
    const [app] = await as<{ id: string }>(U.leader, "insert into applications (post_id, student_id, message) values ($1,$2,'지원') returning id", [id, U.leader]);
    await as(U.owner, "select select_applicant($1,$2::jsonb)", [app.id, snapshot]);
    await expect(as(U.owner, "select delete_post($1)", [id])).rejects.toThrow(/HAS_PROJECT/);
  });

  it("지우면 받은 지원도 같이 사라진다", async () => {
    const id = await newPost();
    await as(U.leader, "insert into applications (post_id, student_id, message) values ($1,$2,'지원')", [id, U.leader]);
    await as(U.owner, "select delete_post($1)", [id]);
    const n = (await db.query<{ n: number }>("select count(*)::int n from applications where post_id = $1", [id])).rows[0].n;
    expect(n).toBe(0);
  });
});

describe("지원 대상 (개인만 / 단체만)", () => {
  const post = async (scope: string) => (await as<{ id: string }>(U.owner,
    `insert into posts (title, category, description, author_id, lat, lng, domain, applicant_scope)
     values ('공고','웹/앱','x',$1,37.6,127.0,'DEVELOPMENT',$2) returning id`, [U.owner, scope]))[0].id;
  const applyAs = (postId: string, uid: string, club: string | null) =>
    as(uid, "insert into applications (post_id, student_id, message, club_id) values ($1,$2,'지원',$3)", [postId, uid, club]);

  it("단체만 공고에는 개인으로 지원할 수 없다", async () => {
    const p = await post("CLUB");
    await expect(applyAs(p, U.leader, null)).rejects.toThrow(/CLUB_ONLY/);
  });

  it("단체만 공고에 단체 이름으로는 지원된다", async () => {
    const club = await makeClub();
    const p = await post("CLUB");
    await applyAs(p, U.leader, club);
    const n = (await db.query<{ n: number }>("select count(*)::int n from applications where post_id = $1", [p])).rows[0].n;
    expect(n).toBe(1);
  });

  it("개인만 공고에는 단체 이름으로 지원할 수 없다", async () => {
    const club = await makeClub();
    const p = await post("INDIVIDUAL");
    await expect(applyAs(p, U.leader, club)).rejects.toThrow(/INDIVIDUAL_ONLY/);
  });

  it("둘 다 받는 공고는 개인도 단체도 지원된다", async () => {
    const club = await makeClub();
    const p = await post("ANY");
    await applyAs(p, U.leader, club);
    await applyAs(p, U.outsider, null);
    const n = (await db.query<{ n: number }>("select count(*)::int n from applications where post_id = $1", [p])).rows[0].n;
    expect(n).toBe(2);
  });

  it("한 학생이 여러 단체에 소속될 수 있다", async () => {
    const a = await makeClub();
    const b = (await as<{ create_club: string }>(U.member, "select create_club($1,$2,$3,$4,$5)", ["광운 사진부", "CENTRAL", "사진 찍어요", "HSS", null]))[0].create_club;
    await as(U.admin, "select review_club($1, true, null)", [b]);
    await joinClub(a, U.member);                                   // 대표가 수락
    const mine = (await db.query<{ club_id: string }>("select * from club_members where student_id = $1 and status = 'ACTIVE'", [U.member])).rows;
    expect(mine.map((m) => m.club_id).sort()).toEqual([a, b].sort());
  });
});

describe("단체가 맡은 서비스", () => {
  it("부원은 단체 이름으로 지원할 수 없다 (대표만 가능)", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);                        // 소속은 확정됐지만 부원
    const [post] = await as<{ id: string }>(U.owner,
      `insert into posts (title, category, description, author_id, lat, lng, domain) values ('공고','웹/앱','x',$1,37.6,127.0,'DEVELOPMENT') returning id`, [U.owner]);
    await expect(as(U.member, "insert into applications (post_id, student_id, message, club_id) values ($1,$2,'지원',$3)", [post.id, U.member, club])).rejects.toThrow(/LEADER_ONLY/);
    await as(U.leader, "insert into applications (post_id, student_id, message, club_id) values ($1,$2,'지원',$3)", [post.id, U.leader, club]);
  });

  it("단체 이름으로 지원하면 운영에도 단체가 기록된다", async () => {
    const club = await makeClub();
    const projectId = await clubProject(club);
    const o = await ops(projectId);
    expect(o.club_id).toBe(club);
    expect(o.maintainer_id).toBe(U.leader);
  });

  it("같은 단체 부원에게는 사장님 승인 없이 담당자를 넘긴다", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);
    const projectId = await clubProject(club);

    await as(U.leader, "select assign_maintainer($1,$2)", [projectId, U.member]);
    const o = await ops(projectId);
    expect(o.maintainer_id).toBe(U.member);

    const h = (await db.query<{ student_id: string; ended_on: string | null }>("select * from maintainer_history where project_id = $1 order by started_on", [projectId])).rows;
    expect(h).toHaveLength(2);
    expect(h.find((x) => x.student_id === U.leader)?.ended_on).not.toBeNull();
  });

  it("단체 밖 학생에게는 넘길 수 없다 (이어받기 공고를 써야 한다)", async () => {
    const club = await makeClub();
    const projectId = await clubProject(club);
    await expect(as(U.leader, "select assign_maintainer($1,$2)", [projectId, U.outsider])).rejects.toThrow(/NOT_MEMBER/);
  });

  it("개인이 맡은 프로젝트는 내부 교체를 쓸 수 없다", async () => {
    const projectId = await clubProject(null);
    await expect(as(U.leader, "select assign_maintainer($1,$2)", [projectId, U.member])).rejects.toThrow(/NO_CLUB/);
  });

  it("담당자도 대표도 아니면 담당자를 바꿀 수 없다", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);
    const projectId = await clubProject(club);
    await expect(as(U.member, "select assign_maintainer($1,$2)", [projectId, U.member])).rejects.toThrow(/FORBIDDEN/);
  });

  it("맡은 서비스가 있으면 단체를 바로 탈퇴할 수 없다", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);
    const projectId = await clubProject(club);
    await expect(as(U.leader, "select leave_club($1)", [club])).rejects.toThrow(/HAS_DUTY/);

    await as(U.leader, "select assign_maintainer($1,$2)", [projectId, U.member]);   // 담당자를 넘기고
    await expect(as(U.leader, "select leave_club($1)", [club])).rejects.toThrow(/LAST_LEADER/);  // 대표도 넘겨야 한다
    await as(U.leader, "select transfer_leader($1,$2)", [club, U.member]);
    await as(U.leader, "select leave_club($1)", [club]);
    const n = (await db.query<{ n: number }>("select count(*)::int n from club_members where club_id = $1", [club])).rows[0].n;
    expect(n).toBe(1);
  });

  it("대표를 부원에게 넘길 수 있다", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);
    await as(U.leader, "select transfer_leader($1,$2)", [club, U.member]);
    const rows = (await db.query<{ student_id: string; role: string }>("select * from club_members where club_id = $1", [club])).rows;
    expect(rows.find((r) => r.student_id === U.member)?.role).toBe("LEADER");
    expect(rows.find((r) => r.student_id === U.leader)?.role).toBe("MEMBER");
  });

  it("대표가 아니면 대표를 넘길 수 없다", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);
    await expect(as(U.member, "select transfer_leader($1,$2)", [club, U.member])).rejects.toThrow(/FORBIDDEN/);
  });

  it("대표가 실제 작업한 부원을 참여자로 추가하면 그 부원에게도 기록이 남는다", async () => {
    const club = await makeClub();
    await joinClub(club, U.member);
    const projectId = await clubProject(club);
    await as(U.leader, "select add_club_worker($1,$2,$3)", [projectId, U.member, "디자인"]);
    const rows = (await db.query<{ student_id: string; role_label: string }>("select * from project_members where project_id = $1", [projectId])).rows;
    expect(rows.map((r) => r.student_id).sort()).toEqual([U.leader, U.member].sort());
    expect(rows.find((r) => r.student_id === U.member)?.role_label).toBe("디자인");
  });

  it("단체 밖 학생은 참여자로 추가할 수 없다", async () => {
    const club = await makeClub();
    const projectId = await clubProject(club);
    await expect(as(U.leader, "select add_club_worker($1,$2,null)", [projectId, U.outsider])).rejects.toThrow(/NOT_MEMBER/);
  });
});
