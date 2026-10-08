// 데모 모드: 김하늘의 피드 5개는 모두 의뢰인이 승인·검증한 완료 프로젝트이고, HTML 포트폴리오는 메뉴판 1개만 있다.
import { describe, expect, it } from "vitest";
import * as wf from "@/lib/workflow/engine";
import { users } from "@/lib/repo/mock";
import { DEMO_STUDENT, demoInProgressChats, demoProjectPublications, seedDemoProjects } from "@/lib/portfolio/demoProjects";
import { matchStage } from "@/lib/matchStage";

const fresh = () => ({ ...wf.emptyDB(), users: structuredClone(users) });

describe("데모 완료 프로젝트", () => {
  it("완료 5개는 검증·평가가 있고, 편집본(HTML 포트폴리오)은 1개만", () => {
    const db = fresh();
    expect(seedDemoProjects(db)).toBe(true);
    const all = db.projects.filter((p) => db.members.some((m) => m.projectId === p.id && m.studentId === DEMO_STUDENT));
    expect(all).toHaveLength(6);
    const mine = all.filter((p) => p.status === "COMPLETED");
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
    expect(db.projects).toHaveLength(6);
  });
  it("데모 버전이 바뀌면 데모 것만 다시 만들고 사용자 데이터는 남긴다", () => {
    const db = fresh();
    seedDemoProjects(db);
    db.posts.push({ ...db.posts[0], id: "user-post", title: "사용자가 만든 공고" });
    (db as { demoSeedVersion?: number }).demoSeedVersion = 1;            // 예전 브라우저 저장소
    db.evidence.find((e) => e.type === "BEFORE_IMAGE")!.url = "/portfolio-samples/menu.png";
    expect(seedDemoProjects(db)).toBe(true);
    expect(db.projects).toHaveLength(6);
    expect(db.posts.some((p) => p.id === "user-post")).toBe(true);
    expect(db.evidence.find((e) => e.type === "BEFORE_IMAGE")?.url).toBeUndefined();   // 작업 전 증빙에 완성본 사진을 쓰지 않는다
  });
  it("피드 게시물은 프로젝트 작업 5개, 김하늘에게는 예전 샘플 카드가 겹치지 않는다", () => {
    const db = fresh();
    seedDemoProjects(db);
    const pubs = demoProjectPublications(db, DEMO_STUDENT);
    expect(pubs).toHaveLength(5);
    expect(pubs.every((p) => p.sourceKind === "project" && db.projects.some((x) => x.id === p.sourceId))).toBe(true);
    expect(pubs.every((p) => p.coverUrl?.startsWith("/portfolio-samples/"))).toBe(true);
    expect(demoProjectPublications(db, "s2")).toEqual([]);           // 김하늘 외 계정은 피드 없음
  });
  it("진행 중 데모 1개: 계약서 확정 뒤 대화가 있어 '진행 중', 피드에는 안 올라간다", () => {
    const db = fresh();
    seedDemoProjects(db);
    const p = db.projects.find((x) => x.status === "IN_PROGRESS")!;
    expect(p).toBeTruthy();
    expect(db.logs.some((l) => l.projectId === p.id)).toBe(true);                       // 중간 기록
    expect(db.answers.some((a) => a.projectId === p.id && a.stage === "PROGRESS")).toBe(true);
    const { agreements, messages } = demoInProgressChats(db);
    const app = db.applications.find((a) => a.postId === p.postId)!;
    const ag = agreements.find((a) => a.applicationId === app.id)!;
    expect(ag.finalizedAt).toBeTruthy();
    const last = messages.filter((m) => m.applicationId === app.id).at(-1)!;
    expect(matchStage({ applicationStatus: app.status, projectStatus: p.status, agreementFinalizedAt: ag.finalizedAt, lastMessageAt: last.createdAt })).toBe("IN_PROGRESS");
    expect(demoProjectPublications(db, DEMO_STUDENT).some((x) => x.sourceId === p.id)).toBe(false);
  });
});
