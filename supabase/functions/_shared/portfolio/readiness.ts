// 포트폴리오 자료 준비도. 결정적(deterministic) 계산 — AI 는 이 점수를 만들지 않는다.
// SKIPPED 는 미완료로 센다. NOT_APPLICABLE 은 해당 항목을 계산에서 뺀다.
import { DOMAINS } from "./domains.ts";
import { READINESS_WEIGHTS } from "./policy.ts";
import type { AnswerStatus, DomainKey, EvidenceType, ProjectAnswer, ReadinessCheck, ReadinessLevel } from "./types.ts";

export type ItemState = "DONE" | "MISSING" | "SKIPPED" | "NOT_APPLICABLE";
export interface ReadinessItem { key: string; label: string; level: ReadinessLevel; state: ItemState; questionId?: string }
export interface ReadinessResult {
  percent: number;                                      // 0~100 정수
  levels: Record<ReadinessLevel, { done: number; applicable: number; total: number }>;
  items: ReadinessItem[];
  missingRequired: ReadinessItem[];
}
export type AnswerLike = Pick<ProjectAnswer, "field" | "status" | "value" | "choices" | "origin">;
export interface ReadinessInput { domain: DomainKey; answers: AnswerLike[]; evidenceTypes: EvidenceType[]; outcomeCount: number }

export const hasContent = (a: { value: string; choices: string[] }) => a.value.trim().length > 0 || a.choices.length > 0;

/** 한 필드의 상태: 내용 있는 답 > 해당 없음 > 건너뜀 > 미답. 후속 질문 답은 필드 상태에 영향 없음 */
export function fieldStatus(answers: AnswerLike[], field: string): AnswerStatus {
  const mine = answers.filter((a) => a.field === field && a.origin === "SCHEMA");
  if (mine.some((a) => a.status === "ANSWERED" && hasContent(a))) return "ANSWERED";
  if (mine.some((a) => a.status === "NOT_APPLICABLE")) return "NOT_APPLICABLE";
  if (mine.some((a) => a.status === "SKIPPED")) return "SKIPPED";
  return "UNANSWERED";
}

function evaluate(check: ReadinessCheck, input: ReadinessInput): ItemState {
  switch (check.kind) {
    case "field": {
      const s = fieldStatus(input.answers, check.field);
      return s === "ANSWERED" ? "DONE" : s === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : s === "SKIPPED" ? "SKIPPED" : "MISSING";
    }
    case "evidence": return input.evidenceTypes.some((t) => check.types.includes(t)) ? "DONE" : "MISSING";
    case "outcome": return input.outcomeCount > 0 ? "DONE" : "MISSING";
    case "any": {
      const states = check.of.map((c) => evaluate(c, input));
      if (states.includes("DONE")) return "DONE";
      if (states.includes("NOT_APPLICABLE")) return "NOT_APPLICABLE";
      if (states.includes("SKIPPED")) return "SKIPPED";
      return "MISSING";
    }
  }
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const items: ReadinessItem[] = DOMAINS[input.domain].readiness.map((d) => ({ key: d.key, label: d.label, level: d.level, questionId: d.questionId, state: evaluate(d.check, input) }));
  const levels: ReadinessResult["levels"] = { REQUIRED: { done: 0, applicable: 0, total: 0 }, RECOMMENDED: { done: 0, applicable: 0, total: 0 }, OPTIONAL: { done: 0, applicable: 0, total: 0 } };
  for (const it of items) {
    const l = levels[it.level];
    l.total++;
    if (it.state !== "NOT_APPLICABLE") l.applicable++;
    if (it.state === "DONE") l.done++;
  }
  let score = 0;
  for (const k of Object.keys(levels) as ReadinessLevel[]) {
    const l = levels[k];
    score += READINESS_WEIGHTS[k] * (l.applicable === 0 ? 1 : l.done / l.applicable);
  }
  return { percent: Math.round(score), levels, items, missingRequired: items.filter((i) => i.level === "REQUIRED" && (i.state === "MISSING" || i.state === "SKIPPED")) };
}
