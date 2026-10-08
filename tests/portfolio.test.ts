import { describe, expect, it } from "vitest";
import { computeReadiness } from "@shared/portfolio/readiness";
import { guardNarrative, planSections, templateDraft } from "@shared/portfolio/narrative";
import { needsFollowUp } from "@shared/portfolio/followup";
import { DOMAINS } from "@shared/portfolio/domains";
import type { PortfolioSource } from "@shared/portfolio/types";

const A = (field: string, status: "ANSWERED" | "SKIPPED" | "NOT_APPLICABLE", value = "x") => ({ field, status, value: status === "ANSWERED" ? value : "", choices: [], origin: "SCHEMA" as const });

describe("포트폴리오 자료 준비도", () => {
  it("아무것도 없으면 0, 필수만 채우면 70 + (NA 반영)", () => {
    expect(computeReadiness({ domain: "DESIGN", answers: [], evidenceTypes: [], outcomeCount: 0 }).percent).toBe(0);
    const req = [A("existingProblem", "ANSWERED"), A("role", "ANSWERED"), A("deliverable", "ANSWERED"), A("designDecision", "ANSWERED")];
    const r = computeReadiness({ domain: "DESIGN", answers: req, evidenceTypes: [], outcomeCount: 0 });
    expect(r.percent).toBe(70);
    expect(r.missingRequired).toHaveLength(0);
  });
  it("SKIPPED 는 미완료, NOT_APPLICABLE 은 분모에서 제외", () => {
    const base = [A("existingProblem", "ANSWERED"), A("role", "ANSWERED"), A("deliverable", "ANSWERED"), A("designDecision", "ANSWERED"), A("targetUser", "ANSWERED"),
      A("alternatives", "ANSWERED"), A("validation", "ANSWERED")];
    const skipped = computeReadiness({ domain: "DESIGN", answers: [...base, A("constraints", "SKIPPED")], evidenceTypes: ["BEFORE_IMAGE", "AFTER_IMAGE"], outcomeCount: 0 });
    const na = computeReadiness({ domain: "DESIGN", answers: [...base, A("constraints", "NOT_APPLICABLE")], evidenceTypes: ["BEFORE_IMAGE", "AFTER_IMAGE"], outcomeCount: 0 });
    expect(skipped.items.find((i) => i.key === "constraints")?.state).toBe("SKIPPED");
    expect(skipped.percent).toBe(91);                                                     // 권장 6개 중 5개: 70 + 25×5/6 = 90.8 → 91
    expect(na.percent).toBe(95);                                                          // 70 + 25
  });
  it("결정적이다 (같은 입력 → 같은 값)", () => {
    const input = { domain: "MARKETING" as const, answers: [A("businessProblem", "ANSWERED")], evidenceTypes: [], outcomeCount: 1 };
    expect(computeReadiness(input)).toEqual(computeReadiness(input));
  });
  it("모든 분야 모듈의 준비도 questionId 는 실제 질문을 가리킨다", () => {
    for (const d of Object.values(DOMAINS)) {
      const ids = new Set(d.questions.map((q) => q.id));
      const fields = new Set(d.fields.map((f) => f.key));
      for (const it of d.readiness) if (it.questionId) expect(ids.has(it.questionId), `${d.key}:${it.questionId}`).toBe(true);
      for (const q of d.questions) expect(fields.has(q.field), `${d.key}:${q.field}`).toBe(true);
      for (const s of d.sections) for (const f of s.fields) expect(fields.has(f), `${d.key}:${s.key}:${f}`).toBe(true);
      expect(new Set(d.questions.map((q) => q.id)).size).toBe(d.questions.length);
    }
  });
});

function source(): PortfolioSource {
  return {
    schema: 1, projectId: "p", studentId: "s", domain: "DESIGN", builtAt: "2026-09-20T00:00:00Z",
    listing: { title: "메뉴판 개선", problem: "메뉴판이 복잡함", category: "디자인", expectedDeliverables: ["A3 메뉴판"], completionCriteria: "", clientName: "행복분식", clientType: "상인", compensationType: "VOLUNTEER", projectMode: "INDIVIDUAL" },
    period: { start: "2026-09-01", end: "2026-09-20" },
    member: { name: "김하늘", department: "디자인학과", roleLabel: "시안 디자인" },
    fields: [
      { field: "existingProblem", label: "기존 문제", question: "q", answer: "메뉴가 너무 복잡함", choices: [], followUps: [] },
      { field: "designDecision", label: "핵심 디자인 결정", question: "q", answer: "카테고리 4개로 나눔", choices: [], followUps: [{ question: "기준?", answer: "손님이 자주 찾는 순서" }] },
      { field: "tools", label: "사용 도구", question: "q", answer: "", choices: ["Figma"], followUps: [] },
    ],
    omitted: [{ field: "constraints", label: "제약 조건", status: "SKIPPED" }],
    activityLogs: [], evidence: [{ id: "ev1", type: "AFTER_IMAGE", description: "완성된 메뉴판", url: "https://x/y.png", source: "STUDENT_UPLOAD" }],
    submission: { approvedVersion: 2, versionCount: 2, note: "" },
    verification: { workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true, verifiedAt: "", submissionVersionId: "v2" },
    review: { satisfaction: 5, deadline: 5, communication: 5, handoff: 5, comment: "좋아요" },
    outcomes: [],
  };
}

describe("Narrative Engine", () => {
  it("재료 없는 섹션은 계획에서 빠지고 잠긴 섹션은 AI 대상이 아니다", () => {
    const keys = planSections(source()).map((p) => p.def.key);
    expect(keys).toContain("problem");
    expect(keys).toContain("decisions");
    expect(keys).toContain("usage");          // 의뢰인의 실제 사용 확인이 재료
    expect(keys).not.toContain("constraints"); // 건너뛴 필드
    expect(keys).not.toContain("feedback");    // 의뢰인 평가 원문은 잠김
  });
  it("템플릿 초안은 건너뛴 답을 쓰지 않는다", () => {
    const t = templateDraft(source());
    const all = JSON.stringify(t);
    expect(all).toContain("카테고리 4개로 나눔");
    expect(t.sections.find((s) => s.key === "constraints")).toBeUndefined();
    expect(t.tools.map((x) => x.name)).toEqual(["Figma"]);
  });
  it("guard: 근거 없는 숫자·성과·도구·섹션·증빙 id 를 걸러낸다", () => {
    const src = source();
    const ai = {
      title: "행복분식 메뉴판 리디자인",
      summary: "메뉴 정보 구조를 다시 설계했습니다. 매출이 30% 증가했습니다.",
      sections: [
        { key: "problem", body: "기존 메뉴판은 메뉴가 섞여 있어 찾기 어려웠습니다. 손님 대기 시간이 5분에 달했습니다.", evidenceIds: [] },
        { key: "decisions", body: "시각 스타일보다 정보 구조를 먼저 정리했습니다. 메뉴를 4개 카테고리로 재구성했습니다.", evidenceIds: ["ev1", "fake"] },
        { key: "constraints", body: "예산은 10만원이었습니다.", evidenceIds: [] },
        { key: "usage", body: "완성된 메뉴판은 점주의 확인을 거쳐 실제 매장에서 사용되었습니다. 이후 방문자가 늘었습니다.", evidenceIds: [] },
      ],
      skills: ["정보 구조 설계"],
      tools: [{ name: "Figma", why: "" }, { name: "Photoshop", why: "" }],
    };
    const { content, report } = guardNarrative(ai, src);
    const text = JSON.stringify(content);
    expect(text).not.toContain("30%");
    expect(text).not.toContain("5분");
    expect(text).not.toContain("방문자");
    expect(text).toContain("4개 카테고리");
    expect(content.sections.find((s) => s.key === "constraints")).toBeUndefined();
    expect(report.droppedSections).toContain("constraints");
    expect(content.tools.map((t) => t.name)).toEqual(["Figma"]);
    expect(report.droppedTools).toEqual(["Photoshop"]);
    expect(content.sections.find((s) => s.key === "decisions")?.evidenceIds).toEqual(["ev1"]);
    expect(report.droppedEvidenceIds).toEqual(["fake"]);
    expect(report.droppedSentences.length).toBe(3);
  });
  it("guard: AI 가 빠뜨리거나 전부 걸러진 섹션은 템플릿으로 채우고 보고한다", () => {
    const { content, report } = guardNarrative({ title: "", summary: "", sections: [], skills: [], tools: [] }, source());
    expect(report.filledFromTemplate.length).toBe(planSections(source()).length);
    expect(content.title).toContain("행복분식");
  });
  it("guard: 잘못된 형식의 AI 응답에도 죽지 않는다", () => {
    expect(() => guardNarrative(null, source())).not.toThrow();
    expect(() => guardNarrative({ sections: "oops", tools: [1, null] }, source())).not.toThrow();
  });
});

describe("후속 질문 판단", () => {
  it("짧거나 이유가 없을 때만 제안", () => {
    const q = DOMAINS.DEVELOPMENT.questions.find((x) => x.id === "v_tech")!;
    expect(needsFollowUp(q, "React를 사용했습니다.").needed).toBe(true);
    expect(needsFollowUp(q, "점주가 코드 없이 메뉴를 직접 고칠 수 있도록 하기 위해 구글 시트를 데이터 저장소로 사용했습니다.").needed).toBe(false);
    expect(needsFollowUp(q, "").needed).toBe(false);
  });
});
