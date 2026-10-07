import { describe, expect, it } from "vitest";
import * as wf from "@/lib/workflow/engine";
import { nextStatus, canTransition } from "@shared/portfolio/stateMachine";
import { seed, ctx } from "./fixtures";

const claims = { workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true };
const review = { satisfaction: 5, deadline: 4, communication: 5, handoff: 4, comment: "손님들이 메뉴를 빨리 찾아요" };

function started() {
  const db = seed(); const c = ctx();
  const app = wf.apply(db, { postId: "post", studentId: "stu", message: "지원합니다" }, c);
  const project = wf.selectApplicant(db, { applicationId: app.id, actorId: "owner" }, c);
  return { db, c, app, project };
}
function submitted() {
  const s = started();
  const ev = wf.addEvidence(s.db, { projectId: s.project.id, actorId: "stu", type: "DELIVERABLE_FILE", description: "메뉴판 PDF", url: "https://example.com/menu.pdf" }, s.c);
  const v1 = wf.submitVersion(s.db, { projectId: s.project.id, actorId: "stu", note: "1차", evidenceIds: [ev.id] }, s.c);
  return { ...s, ev, v1 };
}

describe("상태 머신", () => {
  it("허용된 전이만 통과한다", () => {
    expect(nextStatus("RECRUITING", "SELECT")).toBe("IN_PROGRESS");
    expect(nextStatus("IN_PROGRESS", "SUBMIT")).toBe("REVIEW_PENDING");
    expect(nextStatus("REVIEW_PENDING", "REQUEST_REVISION")).toBe("REVISION_REQUESTED");
    expect(nextStatus("REVISION_REQUESTED", "RESUBMIT")).toBe("REVIEW_PENDING");
    expect(nextStatus("REVIEW_PENDING", "APPROVE")).toBe("COMPLETED");
    expect(canTransition("IN_PROGRESS", "APPROVE")).toBe(false);
    expect(canTransition("COMPLETED", "SUBMIT")).toBe(false);
    expect(canTransition("REVISION_REQUESTED", "APPROVE")).toBe(false);
    expect(canTransition("IN_PROGRESS", "SELECT", "INDIVIDUAL")).toBe(false);
    expect(nextStatus("RECRUITING", "SELECT", "TEAM")).toBe("RECRUITING");
    expect(nextStatus("RECRUITING", "START", "TEAM")).toBe("IN_PROGRESS");
    expect(canTransition("IN_PROGRESS", "SELECT", "TEAM")).toBe(false);
  });
});

describe("지원·선정", () => {
  it("선정하면 프로젝트가 생기고 질문 목록이 고정된다", () => {
    const { db, project } = started();
    expect(project.status).toBe("IN_PROGRESS");
    expect(project.startedAt).toBeTruthy();
    expect(project.questionSnapshot.questions.length).toBeGreaterThan(5);
    expect(db.posts[0].status).toBe("in_progress");
    expect(db.members).toHaveLength(1);
  });
  it("다른 점주는 선정할 수 없다", () => {
    const db = seed(); const c = ctx();
    const app = wf.apply(db, { postId: "post", studentId: "stu", message: "" }, c);
    expect(() => wf.selectApplicant(db, { applicationId: app.id, actorId: "owner2" }, c)).toThrow(/의뢰인만/);
  });
  it("중복 선정 클릭은 같은 프로젝트를 돌려준다", () => {
    const { db, c, app, project } = started();
    expect(wf.selectApplicant(db, { applicationId: app.id, actorId: "owner" }, c).id).toBe(project.id);
    expect(db.members).toHaveLength(1);
  });
  it("이전 유료 공고도 검증 이력 없이 지원할 수 있다", () => {
    const db = seed(); db.posts[0].compensationType = "PAID";
    expect(() => wf.apply(db, { postId: "post", studentId: "stu", message: "" }, ctx())).not.toThrow();
  });
});

describe("팀 구성", () => {
  const teamDB = () => {
    const db = seed();
    db.posts[0] = { ...db.posts[0], isTeam: true, teamSlots: [
      { id: "design", label: "디자이너", category: "디자인", domain: "DESIGN", count: 1, filled: [] },
      { id: "dev", label: "개발자", category: "웹/앱", domain: "DEVELOPMENT", count: 1, filled: [] },
    ] };
    return db;
  };
  it("지원 역할을 반드시 선택한다", () => {
    expect(() => wf.apply(teamDB(), { postId: "post", studentId: "stu", message: "" }, ctx())).toThrow(/역할/);
  });
  it("역할별 선발을 마친 뒤 팀장을 정해야 시작한다", () => {
    const db = teamDB(); const c = ctx();
    const a1 = wf.apply(db, { postId: "post", studentId: "stu", message: "", roleId: "design" }, c);
    const a2 = wf.apply(db, { postId: "post", studentId: "stu2", message: "", roleId: "dev" }, c);
    const project = wf.selectApplicant(db, { applicationId: a1.id, actorId: "owner" }, c);
    expect(project.status).toBe("RECRUITING");
    expect(project.startedAt).toBeUndefined();
    expect(() => wf.startTeamProject(db, { projectId: project.id, actorId: "owner", leaderId: "stu" })).toThrow(/인원이 부족/);
    wf.selectApplicant(db, { applicationId: a2.id, actorId: "owner" }, c);
    wf.startTeamProject(db, { projectId: project.id, actorId: "owner", leaderId: "stu" });
    expect(project.status).toBe("IN_PROGRESS");
    expect(project.startedAt).toBeTruthy();
    expect(db.posts[0].status).toBe("in_progress");
    expect(db.members.find((m) => m.studentId === "stu")?.isLead).toBe(true);
    expect(db.members.find((m) => m.studentId === "stu2")?.domain).toBe("DEVELOPMENT");
  });
  it("역할 정원을 넘겨 선발할 수 없다", () => {
    const db = teamDB(); const c = ctx();
    const a1 = wf.apply(db, { postId: "post", studentId: "stu", message: "", roleId: "design" }, c);
    const a2 = wf.apply(db, { postId: "post", studentId: "stu2", message: "", roleId: "design" }, c);
    wf.selectApplicant(db, { applicationId: a1.id, actorId: "owner" }, c);
    expect(() => wf.selectApplicant(db, { applicationId: a2.id, actorId: "owner" }, c)).toThrow(/이미 찼/);
  });
  it("팀장만 제출하고 검증된 팀원만 개인 포트폴리오를 만든다", () => {
    const db = teamDB(); const c = ctx();
    const a1 = wf.apply(db, { postId: "post", studentId: "stu", message: "", roleId: "design" }, c);
    const a2 = wf.apply(db, { postId: "post", studentId: "stu2", message: "", roleId: "dev" }, c);
    const project = wf.selectApplicant(db, { applicationId: a1.id, actorId: "owner" }, c);
    wf.selectApplicant(db, { applicationId: a2.id, actorId: "owner" }, c);
    wf.startTeamProject(db, { projectId: project.id, actorId: "owner", leaderId: "stu" });
    const ev = wf.addEvidence(db, { projectId: project.id, actorId: "stu", type: "DELIVERABLE_FILE", description: "최종 결과물" }, c);
    expect(() => wf.submitVersion(db, { projectId: project.id, actorId: "stu2", note: "", evidenceIds: [ev.id] }, c)).toThrow(/팀장만/);
    const version = wf.submitVersion(db, { projectId: project.id, actorId: "stu", note: "최종", evidenceIds: [ev.id] }, c);
    wf.approveVersion(db, { versionId: version.id, actorId: "owner", claims, review, verifiedMemberIds: ["stu"] }, c);
    expect(db.memberVerifications.find((v) => v.studentId === "stu")?.verified).toBe(true);
    expect(db.memberVerifications.find((v) => v.studentId === "stu2")?.verified).toBe(false);
    expect(() => wf.createSnapshot(db, { projectId: project.id, actorId: "stu2" }, c)).toThrow(/확인한 팀원/);
    expect(wf.createSnapshot(db, { projectId: project.id, actorId: "stu" }, c).studentId).toBe("stu");
  });
  it("검증된 팀원은 자신을 제외한 팀원을 평가한다", () => {
    const db = teamDB(); const c = ctx();
    const a1 = wf.apply(db, { postId: "post", studentId: "stu", message: "", roleId: "design" }, c);
    const a2 = wf.apply(db, { postId: "post", studentId: "stu2", message: "", roleId: "dev" }, c);
    const project = wf.selectApplicant(db, { applicationId: a1.id, actorId: "owner" }, c);
    wf.selectApplicant(db, { applicationId: a2.id, actorId: "owner" }, c);
    wf.startTeamProject(db, { projectId: project.id, actorId: "owner", leaderId: "stu" });
    const ev = wf.addEvidence(db, { projectId: project.id, actorId: "stu", type: "DELIVERABLE_FILE", description: "최종" }, c);
    const version = wf.submitVersion(db, { projectId: project.id, actorId: "stu", note: "", evidenceIds: [ev.id] }, c);
    wf.approveVersion(db, { versionId: version.id, actorId: "owner", claims, review, verifiedMemberIds: ["stu", "stu2"] }, c);
    expect(() => wf.savePeerReview(db, { projectId: project.id, reviewerId: "stu", revieweeId: "stu", communication: 5, collaboration: 5, responsibility: 5, comment: "" }, c)).toThrow(/자신/);
    expect(wf.savePeerReview(db, { projectId: project.id, reviewerId: "stu", revieweeId: "stu2", communication: 5, collaboration: 4, responsibility: 5, comment: "좋은 협업" }, c).revieweeId).toBe("stu2");
    expect(db.peerReviews).toHaveLength(1);
  });
});

describe("제출·검토", () => {
  it("선정되지 않은 학생은 제출할 수 없다", () => {
    const { db, c, project, ev } = submitted();
    expect(() => wf.submitVersion(db, { projectId: project.id, actorId: "stu2", note: "", evidenceIds: [ev.id] }, c)).toThrow(/선정된 학생만/);
  });
  it("검토 대기 중에는 다시 제출할 수 없다", () => {
    const { db, c, project, ev } = submitted();
    expect(() => wf.submitVersion(db, { projectId: project.id, actorId: "stu", note: "", evidenceIds: [ev.id] }, c)).toThrow(/할 수 없는 작업/);
  });
  it("보완 요청 → v2 → 이전 버전(v1) 승인은 막고 v2 승인", () => {
    const { db, c, project, ev, v1 } = submitted();
    wf.requestRevision(db, { versionId: v1.id, actorId: "owner", comment: "가격 글씨를 키워 주세요" }, c);
    expect(project.status).toBe("REVISION_REQUESTED");
    const v2 = wf.submitVersion(db, { projectId: project.id, actorId: "stu", note: "가격 글씨 확대", evidenceIds: [ev.id] }, c);
    expect(v2.version).toBe(2);
    expect(() => wf.approveVersion(db, { versionId: v1.id, actorId: "owner", claims, review }, c)).toThrow(/최신 제출이 아니/);
    wf.approveVersion(db, { versionId: v2.id, actorId: "owner", claims, review }, c);
    expect(project.status).toBe("COMPLETED");
    expect(project.approvedVersionId).toBe(v2.id);
    expect(db.verifications[0].submissionVersionId).toBe(v2.id);
  });
  it("다른 점주는 승인할 수 없다", () => {
    const { db, c, v1 } = submitted();
    expect(() => wf.approveVersion(db, { versionId: v1.id, actorId: "owner2", claims, review }, c)).toThrow(/의뢰인만/);
  });
  it("중복 승인은 막히고 점수·뱃지는 한 번만 지급된다", () => {
    const { db, c, v1 } = submitted();
    wf.approveVersion(db, { versionId: v1.id, actorId: "owner", claims, review }, c);
    expect(() => wf.approveVersion(db, { versionId: v1.id, actorId: "owner", claims, review }, c)).toThrow(/이미 승인/);
    expect(db.tierEvents.filter((e) => e.kind === "PROJECT_VERIFIED")).toHaveLength(1);
    expect(db.tierEvents.filter((e) => e.kind === "CLIENT_USED")).toHaveLength(1);
    expect(db.badges.map((b) => b.code).sort()).toEqual(["DOMAIN_DESIGN", "FIRST_VERIFIED", "USED_IN_FIELD"]);
    expect(db.legacyCards).toHaveLength(1);
  });
  it("보완 요청 횟수 제한", () => {
    const { db, c, project, ev, v1 } = submitted();
    db.posts[0].revisionLimit = 1;
    wf.requestRevision(db, { versionId: v1.id, actorId: "owner", comment: "a" }, c);
    const v2 = wf.submitVersion(db, { projectId: project.id, actorId: "stu", note: "", evidenceIds: [ev.id] }, c);
    expect(() => wf.requestRevision(db, { versionId: v2.id, actorId: "owner", comment: "b" }, c)).toThrow(/1번까지/);
  });
  it("실제 작업 확인 없이는 승인할 수 없다", () => {
    const { db, c, v1 } = submitted();
    expect(() => wf.approveVersion(db, { versionId: v1.id, actorId: "owner", claims: { ...claims, workPerformed: false }, review }, c)).toThrow(/실제로 작업/);
  });
});

describe("답변·성과", () => {
  it("건너뛰기·해당 없음은 값을 비우고 상태를 구분한다", () => {
    const { db, c, project } = started();
    const a = wf.saveAnswer(db, { projectId: project.id, actorId: "stu", questionId: "d_constraints", status: "SKIPPED", value: "무시될 값" }, c);
    expect(a.status).toBe("SKIPPED"); expect(a.value).toBe("");
    const b = wf.saveAnswer(db, { projectId: project.id, actorId: "stu", questionId: "d_before", status: "NOT_APPLICABLE" }, c);
    expect(b.status).toBe("NOT_APPLICABLE");
    const e = wf.saveAnswer(db, { projectId: project.id, actorId: "stu", questionId: "d_goal", status: "ANSWERED", value: "  " }, c);
    expect(e.status).toBe("UNANSWERED");
  });
  it("미측정과 0 을 구분한다", () => {
    const { db, c, project } = started();
    const none = wf.addOutcome(db, { projectId: project.id, actorId: "stu", metricName: "조회수", measured: false, value: 123, unit: "회", baseline: null, measurementPeriod: "", source: "", qualitativeDescription: "" }, c);
    expect(none.value).toBeNull();
    const zero = wf.addOutcome(db, { projectId: project.id, actorId: "stu", metricName: "문의", measured: true, value: 0, unit: "건", baseline: null, measurementPeriod: "", source: "", qualitativeDescription: "" }, c);
    expect(zero.value).toBe(0);
    expect(() => wf.verifyOutcome(db, { outcomeId: none.id, actorId: "owner" }, c)).toThrow(/측정되지 않은/);
    expect(() => wf.verifyOutcome(db, { outcomeId: zero.id, actorId: "stu" }, c)).toThrow(/의뢰인만/);
    expect(wf.verifyOutcome(db, { outcomeId: zero.id, actorId: "owner" }, c).verified).toBe(true);
  });
});

describe("포트폴리오 스냅샷·초안·편집", () => {
  function completed() {
    const s = submitted();
    wf.saveAnswer(s.db, { projectId: s.project.id, actorId: "stu", questionId: "d_problem", status: "ANSWERED", value: "메뉴가 너무 복잡함" }, s.c);
    wf.saveAnswer(s.db, { projectId: s.project.id, actorId: "stu", questionId: "d_constraints", status: "SKIPPED" }, s.c);
    wf.approveVersion(s.db, { versionId: s.v1.id, actorId: "owner", claims, review }, s.c);
    return s;
  }
  const content = { title: "t", summary: "", sections: [], skills: [], tools: [] };
  it("완료 전에는 스냅샷을 만들 수 없다", () => {
    const { db, c, project } = submitted();
    expect(() => wf.createSnapshot(db, { projectId: project.id, actorId: "stu" }, c)).toThrow(/승인·검증이 끝난/);
  });
  it("같은 자료는 같은 스냅샷·같은 초안 (중복 생성 방지)", () => {
    const { db, c, project } = completed();
    const s1 = wf.createSnapshot(db, { projectId: project.id, actorId: "stu" }, c);
    const s2 = wf.createSnapshot(db, { projectId: project.id, actorId: "stu" }, c);
    expect(s2.id).toBe(s1.id);
    const d1 = wf.addDraft(db, { snapshotId: s1.id, actorId: "stu", generator: "TEMPLATE", content }, c);
    const d2 = wf.addDraft(db, { snapshotId: s1.id, actorId: "stu", generator: "TEMPLATE", content }, c);
    expect(d2.reused).toBe(true); expect(d2.draft.id).toBe(d1.draft.id);
    const d3 = wf.addDraft(db, { snapshotId: s1.id, actorId: "stu", generator: "TEMPLATE", content, regenerate: true }, c);
    expect(d3.draft.id).not.toBe(d1.draft.id);
    expect(s1.data.omitted.find((o) => o.field === "constraints")?.status).toBe("SKIPPED");
    expect(s1.data.fields.find((f) => f.field === "constraints")).toBeUndefined();
  });
  it("재생성해도 학생 편집본은 그대로 남는다", () => {
    const { db, c, project } = completed();
    const s = wf.createSnapshot(db, { projectId: project.id, actorId: "stu" }, c);
    const d1 = wf.addDraft(db, { snapshotId: s.id, actorId: "stu", generator: "TEMPLATE", content }, c).draft;
    const e1 = wf.saveEdit(db, { draftId: d1.id, actorId: "stu", content: { ...content, title: "내가 고친 제목" } }, c);
    wf.addDraft(db, { snapshotId: s.id, actorId: "stu", generator: "AI", content: { ...content, title: "새 초안" }, regenerate: true }, c);
    expect(db.edits).toHaveLength(1);
    expect(db.edits[0].content.title).toBe("내가 고친 제목");
    const e2 = wf.saveEdit(db, { draftId: d1.id, actorId: "stu", content: { ...content, title: "두 번째" } }, c);
    expect(e2.version).toBe(e1.version + 1);
    expect(() => wf.saveEdit(db, { draftId: d1.id, actorId: "stu2", content }, c)).toThrow(/본인/);
  });
});
