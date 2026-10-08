import { describe, expect, it } from "vitest";
import { DOMAINS, exampleFor, hintExamplesFor } from "@shared/portfolio/domains";
import { ruleFollowUps } from "@shared/portfolio/followup";
import { computeReadiness } from "@shared/portfolio/readiness";
import { findGaps, MAX_GAPS, type GapAnswer, type GapInput } from "@shared/portfolio/gapcheck";
import { guardNarrative, NARRATIVE_SYSTEM } from "@shared/portfolio/narrative";
import type { DomainKey, PortfolioSource, QuestionDefinition } from "@shared/portfolio/types";

const KEYS = Object.keys(DOMAINS) as DomainKey[];

describe("모든 질문에 답변 예시", () => {
  it("모든 분야의 모든 질문에 예시가 있고, 후속 질문 예시 수가 질문 수와 같다", () => {
    for (const d of Object.values(DOMAINS)) {
      for (const q of d.questions) {
        expect(q.example?.trim(), `${d.key}:${q.id}`).toBeTruthy();
        if (q.followUp) expect(q.followUp.hintExamples?.length, `${d.key}:${q.id} hints`).toBe(q.followUp.hints.length);
      }
    }
  });
  it("예시가 없는 예전 스냅샷 질문은 현재 정의에서 예시를 찾아 보여 준다", () => {
    const cur = DOMAINS.DESIGN.questions.find((q) => q.id === "d_problem")!;
    const old: QuestionDefinition = { ...cur, example: undefined, followUp: { minChars: 20, hints: cur.followUp!.hints } };
    expect(exampleFor("DESIGN", old)).toBe(cur.example);
    expect(hintExamplesFor("DESIGN", old)).toEqual(cur.followUp!.hintExamples);
    // 질문 문구가 바뀐 예전 후속 질문에는 엉뚱한 예시를 붙이지 않는다
    expect(hintExamplesFor("DESIGN", { ...old, followUp: { hints: ["예전 질문?"] } })).toEqual([]);
  });
  it("규칙 기반 후속 질문은 예시를 함께 돌려준다", () => {
    const q = DOMAINS.DESIGN.questions.find((x) => x.id === "d_problem")!;
    const r = ruleFollowUps(q, "DESIGN");
    expect(r[0].question).toBe(q.followUp!.hints[0]);
    expect(r[0].example).toBe(q.followUp!.hintExamples![0]);
  });
});

describe("새 질문 3종 (다른 방법·확인 방법·피드백 반영)", () => {
  it("모든 분야에 있고, 개발은 '테스트' 질문이 확인 방법을 맡는다", () => {
    for (const k of KEYS) {
      const fields = DOMAINS[k].questions.map((q) => q.field);
      expect(fields, k).toContain("alternatives");
      expect(fields, k).toContain("feedbackChange");
      if (k === "DEVELOPMENT") expect(fields).toContain("testing");
      else expect(fields, k).toContain("validation");
      // 새 답은 포트폴리오 섹션 재료가 된다
      const used = DOMAINS[k].sections.flatMap((s) => s.fields);
      for (const f of ["alternatives", "feedbackChange"]) expect(used, `${k}:${f}`).toContain(f);
    }
  });
  it("새 질문은 모두 '해당 없음'을 고를 수 있다 (진행을 막지 않는다)", () => {
    for (const d of Object.values(DOMAINS)) for (const q of d.questions.filter((x) => ["alternatives", "validation", "feedbackChange"].includes(x.field))) expect(q.allowNA, q.id).toBe(true);
  });
  it("예전 스냅샷 프로젝트에는 새 질문 준비도 항목이 나오지 않는다", () => {
    const oldIds = DOMAINS.DESIGN.questions.filter((q) => !["alternatives", "validation", "feedbackChange"].includes(q.field)).map((q) => q.id);
    const old = computeReadiness({ domain: "DESIGN", questionIds: oldIds, answers: [], evidenceTypes: [], outcomeCount: 0 });
    expect(old.items.map((i) => i.key)).not.toContain("alternatives");
    const now = computeReadiness({ domain: "DESIGN", questionIds: DOMAINS.DESIGN.questions.map((q) => q.id), answers: [], evidenceTypes: [], outcomeCount: 0 });
    expect(now.items.map((i) => i.key)).toEqual(expect.arrayContaining(["alternatives", "validation", "feedbackChange"]));
  });
});

// ── 초안 전 점검 ──────────────────────────────────────────────────────────────
const S = (questionId: string, value: string, choices: string[] = []): GapAnswer => ({ questionId, status: "ANSWERED", value, choices, origin: "SCHEMA" });
const FU = (parent: string, value: string): GapAnswer => ({ questionId: `${parent}:fu0`, status: "ANSWERED", value, choices: [], origin: "RULE_FOLLOWUP", parentQuestionId: parent });
/** 근거가 다 있는 디자인 기록 → 점검 질문 0개 */
const goodDesign = (): GapAnswer[] => [
  S("d_problem", "점주님이 외국인 손님에게 번역기로 설명하신다고 말씀하셨어요. 점심에 지켜보니 5팀 중 4팀이 번역기를 썼어요"),
  S("d_role", "", ["기획", "최종 디자인"]),
  S("d_decision", "메뉴를 두 구역으로 줄이고 이름 아래 재료와 맵기를 적었어요"),
  S("d_rationale", "손님 질문이 대부분 재료와 맵기였기 때문이에요"),
  S("d_deliverable", "A4 인쇄용 PDF"),
  S("d_after", "메뉴가 24개에서 10개로 줄었어요"),
  S("d_usage", "", ["매장에 실제 게시됨"]),
];
const input = (over: Partial<GapInput> = {}): GapInput => ({
  domain: "DESIGN", questions: DOMAINS.DESIGN.questions, answers: goodDesign(), evidenceTypes: ["USAGE_PROOF"], outcomeCount: 0, revisionComments: [], ...over,
});
const keysOf = (i: GapInput) => findGaps(i).map((g) => g.key);
const without = (id: string) => goodDesign().filter((a) => a.questionId !== id);

describe("초안 전 점검 (규칙 6개)", () => {
  it("근거가 다 있으면 아무것도 묻지 않는다", () => {
    expect(findGaps(input())).toEqual([]);
  });
  it("1. 성과 단어가 있는데 숫자·성과·지표 증빙이 없으면 묻는다", () => {
    const answers = [...without("d_after"), S("d_after", "손님 반응이 좋아지고 주문이 늘었어요")];
    const g = findGaps(input({ answers }));
    expect(g[0]).toMatchObject({ key: "claimNoMetric", questionId: "d_after" });
    expect(g[0].title).toContain("숫자가 없다면");
    expect(keysOf(input({ answers, outcomeCount: 1 }))).not.toContain("claimNoMetric");     // 등록한 성과가 있음
    expect(keysOf(input({ answers, evidenceTypes: ["USAGE_PROOF", "METRIC"] }))).not.toContain("claimNoMetric");
    const withNum = [...without("d_after"), S("d_after", "하루 문의가 12회에서 3회로 줄고 주문이 늘었어요")];
    expect(keysOf(input({ answers: withNum }))).not.toContain("claimNoMetric");
  });
  it("2. 핵심 결정에 이유도 다른 방법도 없으면 묻고, 비어 있는 이유 질문에 답을 붙인다", () => {
    const answers = without("d_rationale").map((a) => (a.questionId === "d_decision" ? S("d_decision", "메뉴를 두 구역으로 줄였어요") : a));
    const g = findGaps(input({ answers }));
    expect(g[0]).toMatchObject({ key: "decisionNoWhy", questionId: "d_rationale" });
    expect(g[0].example).toBe(DOMAINS.DESIGN.questions.find((q) => q.id === "d_rationale")!.example);
    // 다른 방법을 '해당 없음'으로 표시했거나, 결정 답에 이유가 들어 있으면 묻지 않는다
    expect(keysOf(input({ answers: [...answers, { ...S("d_alternatives", ""), status: "NOT_APPLICABLE" }] }))).not.toContain("decisionNoWhy");
    expect(keysOf(input({ answers: [...answers.filter((a) => a.questionId !== "d_decision"), S("d_decision", "손님 질문이 많아서 두 구역으로 줄였어요")] }))).not.toContain("decisionNoWhy");
  });
  it("3. 문제를 어떻게 알았는지 없으면 묻고, 후속 답에 있으면 묻지 않는다", () => {
    const answers = [...without("d_problem"), S("d_problem", "메뉴판이 한글로만 되어 있어 외국인 손님이 불편했어요")];
    expect(findGaps(input({ answers }))[0]).toMatchObject({ key: "problemNoSource", questionId: "d_problem" });
    expect(keysOf(input({ answers: [...answers, FU("d_problem", "점심시간에 직접 지켜봤어요")] }))).not.toContain("problemNoSource");
  });
  it("4. 보완 요청을 받았는데 피드백 반영이 비어 있으면 요청 문구를 넣어 묻는다", () => {
    const g = findGaps(input({ revisionComments: ["", "매운 메뉴를 한눈에 알았으면 좋겠어요"] }));
    expect(g[0]).toMatchObject({ key: "feedbackMissing", questionId: "d_feedback" });
    expect(g[0].title).toContain("매운 메뉴를 한눈에 알았으면 좋겠어요");
    expect(keysOf(input({ revisionComments: ["x"], answers: [...goodDesign(), S("d_feedback", "맵기 표시를 넣었어요")] }))).toEqual([]);
    // 예전 스냅샷(피드백 질문 없음)이면 과정 질문의 후속 답으로 묻는다
    const oldQs = DOMAINS.DESIGN.questions.filter((q) => q.field !== "feedbackChange");
    expect(findGaps(input({ questions: oldQs, revisionComments: ["x"] }))[0]).toMatchObject({ key: "feedbackMissing", questionId: "d_process" });
  });
  it("5. 실제 게시됐다고 했는데 사용 증빙이 없으면 업로드를 권한다", () => {
    expect(findGaps(input({ evidenceTypes: [] }))[0]).toMatchObject({ key: "usageNoProof", action: "upload", evidenceType: "USAGE_PROOF" });
    const delivered = [...without("d_usage"), S("d_usage", "", ["전달만 완료"])];
    expect(keysOf(input({ evidenceTypes: [], answers: delivered }))).toEqual([]);
  });
  it("6. 필수 글 답이 20자 미만이면 다시 묻는다", () => {
    const answers = [...without("d_decision"), S("d_decision", "두 구역으로 나눔")];
    expect(findGaps(input({ answers }))).toEqual([expect.objectContaining({ key: "tooShort", questionId: "d_decision" })]);
  });
  it("최대 3개, 중요한 규칙부터, 같은 질문은 한 번만", () => {
    const answers = [
      S("d_problem", "메뉴판이 불편함"),                                  // 3·6 모두 해당하지만 같은 질문 → 한 번
      S("d_decision", "메뉴를 두 구역으로 정리했어요 정말로요"),
      S("d_after", "손님 반응이 좋아졌어요"),
      S("d_usage", "", ["매장에 실제 게시됨"]),
    ];
    const g = findGaps(input({ answers, evidenceTypes: [], revisionComments: ["맵기 표시"] }));
    expect(g).toHaveLength(MAX_GAPS);
    expect(g.map((x) => x.key)).toEqual(["claimNoMetric", "decisionNoWhy", "problemNoSource"]);
    expect(new Set(g.map((x) => x.questionId)).size).toBe(g.length);
  });
  it("모든 점검 질문에 예시가 있다", () => {
    const answers = [S("d_problem", "불편함"), S("d_decision", "두 구역"), S("d_after", "반응이 좋아짐"), S("d_usage", "", ["매장에 실제 게시됨"])];
    for (const domain of KEYS) {
      const gaps = findGaps({ domain, questions: DOMAINS[domain].questions, answers, evidenceTypes: [], outcomeCount: 0, revisionComments: ["요청"] });
      for (const g of gaps) expect(g.example.trim(), `${domain}:${g.key}`).toBeTruthy();
    }
  });
  it("결정적이다", () => {
    const i = input({ evidenceTypes: [], revisionComments: ["x"] });
    expect(findGaps(i)).toEqual(findGaps(i));
  });
});

// ── 초안 지시문·지어낸 행동 검사 ────────────────────────────────────────────────
function src(extra = ""): PortfolioSource {
  return {
    schema: 1, projectId: "p", studentId: "s", domain: "DESIGN", builtAt: "2026-10-08T00:00:00Z",
    listing: { title: "메뉴판 개선", problem: "메뉴판이 복잡함", category: "디자인", expectedDeliverables: ["A4 메뉴판"], completionCriteria: "", clientName: "월계 한상", clientType: "상인", compensationType: "VOLUNTEER", projectMode: "INDIVIDUAL" },
    period: { start: "2026-09-15", end: "2026-10-03" },
    member: { name: "김하늘", department: "디자인학과", roleLabel: "디자인" },
    fields: [
      { field: "existingProblem", label: "기존 문제", question: "q", answer: `외국인 손님이 번역기를 썼어요${extra}`, choices: [], followUps: [] },
      { field: "designDecision", label: "핵심 디자인 결정", question: "q", answer: "메뉴를 두 구역으로 줄였어요", choices: [], followUps: [] },
    ],
    omitted: [], activityLogs: [], evidence: [],
    submission: { approvedVersion: 1, versionCount: 1, note: "" }, verification: null, review: null, outcomes: [],
  };
}
const ai = (body: string) => ({ title: "영문 메뉴판", summary: "", sections: [{ key: "problem", body, evidenceIds: [] }], skills: [], tools: [] });

describe("지어낸 행동 검사", () => {
  it("기록에 없는 인터뷰·설문 문장은 뺀다", () => {
    const { content, report } = guardNarrative(ai("외국인 손님이 번역기를 썼습니다. 손님들을 인터뷰해 문제를 확인했습니다. 설문으로 선호를 조사했습니다."), src());
    const body = content.sections.find((s) => s.key === "problem")!.body;
    expect(body).toContain("번역기");
    expect(body).not.toContain("인터뷰");
    expect(body).not.toContain("설문");
    expect(report.droppedSentences.map((d) => d.reason)).toEqual(expect.arrayContaining([expect.stringContaining("기록에 없는 활동(인터뷰)")]));
  });
  it("학생이 같은 뜻으로 적었으면 남긴다 ('지켜보니' → 관찰)", () => {
    const { content } = guardNarrative(ai("점심시간 관찰로 문제를 확인했습니다."), src(". 점심시간에 지켜보니 그랬어요"));
    expect(content.sections.find((s) => s.key === "problem")!.body).toContain("관찰");
  });
  it("지시문에 지어낸 행동 금지 규칙과 예시 경고가 있다", () => {
    expect(NARRATIVE_SYSTEM).toContain("학생이 적지 않은 행동을 했다고 쓰지 않는다");
    expect(NARRATIVE_SYSTEM).toContain("예시의 가게·숫자·사실은 절대 쓰지 않는다");
  });
});
