// 데모 모드: 김하늘의 피드 5개는 모두 의뢰인이 승인·검증한 완료 프로젝트이고, HTML 포트폴리오는 메뉴판 1개만 있다.
import { describe, expect, it } from "vitest";
import * as wf from "@/lib/workflow/engine";
import { users } from "@/lib/repo/mock";
import { DEMO_STUDENT, demoProjectPublications, seedDemoProjects } from "@/lib/portfolio/demoProjects";
import { demoPortfolio } from "@/lib/portfolio/demo";

const fresh = () => ({ ...wf.emptyDB(), users: structuredClone(users) });

describe("데모 완료 프로젝트", () => {
  it("5개 모두 완료·검증·평가가 있고, 편집본(HTML 포트폴리오)은 1개만", () => {
    const db = fresh();
    expect(seedDemoProjects(db)).toBe(true);
    const mine = db.projects.filter((p) => db.members.some((m) => m.projectId === p.id && m.studentId === DEMO_STUDENT));
    expect(mine).toHaveLength(5);
    for (const p of mine) {
      expect(p.status).toBe("COMPLETED");
      expect(db.verifications.find((v) => v.projectId === p.id)?.workPerformed).toBe(true);
      expect(db.reviews.find((r) => r.projectId === p.id)?.comment).toBeTruthy();
    }
    const withPage = mine.filter((p) => db.edits.some((e) => e.projectId === p.id));
    expect(withPage).toHaveLength(1);
    const edit = db.edits.find((e) => e.projectId === withPage[0].id)!;
    expect(edit.content.title).toContain("메뉴판");
    expect(edit.content.templateId).toBe("editorial");
    expect(edit.content.sections.some((s) => s.evidenceIds.length > 0)).toBe(true);   // 증빙이 섹션에 붙어 있다
  });
  it("두 번 실행해도 한 번만 들어간다 (기존 브라우저 저장소에 추가해도 안전)", () => {
    const db = fresh();
    seedDemoProjects(db);
    expect(seedDemoProjects(db)).toBe(false);
    expect(db.projects).toHaveLength(5);
  });
  it("데모 버전이 바뀌면 데모 것만 다시 만들고 사용자 데이터는 남긴다", () => {
    const db = fresh();
    seedDemoProjects(db);
    db.posts.push({ ...db.posts[0], id: "user-post", title: "사용자가 만든 공고" });
    (db as { demoSeedVersion?: number }).demoSeedVersion = 1;            // 예전 브라우저 저장소
    db.evidence.find((e) => e.type === "BEFORE_IMAGE")!.url = "/portfolio-samples/menu.png";
    expect(seedDemoProjects(db)).toBe(true);
    expect(db.projects).toHaveLength(5);
    expect(db.posts.some((p) => p.id === "user-post")).toBe(true);
    expect(db.evidence.find((e) => e.type === "BEFORE_IMAGE")?.url).toBe("/portfolio-samples/menu-before.png");   // 작업 전 증빙은 완성본이 아닌 작업 전 사진
  });
  it("메뉴판 HTML 포트폴리오의 작업 전·후 섹션에 작업 전 사진이 붙는다", () => {
    const db = fresh();
    seedDemoProjects(db);
    const edit = db.edits.find((e) => e.content.title.includes("메뉴판"))!;
    const ids = edit.content.sections.find((s) => s.key === "beforeAfter")!.evidenceIds;
    expect(ids.map((id) => db.evidence.find((e) => e.id === id)?.url)).toEqual(["/portfolio-samples/menu-before.png"]);
  });
  it("피드 게시물은 프로젝트 작업 5개, 김하늘에게는 예전 샘플 카드가 겹치지 않는다", () => {
    const db = fresh();
    seedDemoProjects(db);
    const pubs = demoProjectPublications(db, DEMO_STUDENT);
    expect(pubs).toHaveLength(5);
    expect(pubs.every((p) => p.sourceKind === "project" && db.projects.some((x) => x.id === p.sourceId))).toBe(true);
    expect(pubs.every((p) => p.coverUrl?.startsWith("/portfolio-samples/"))).toBe(true);
    expect(demoPortfolio(DEMO_STUDENT)).toEqual([]);
    expect(demoProjectPublications(db, "s2")).toEqual([]);
    expect(demoPortfolio("s2")).toHaveLength(5);                     // 다른 학생은 예전 샘플 그대로
  });
});
