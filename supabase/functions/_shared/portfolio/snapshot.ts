// 포트폴리오 원본 스냅샷 만들기. 생성 당시 AI 가 볼 수 있었던 자료를 그대로 고정한다.
// 들어가는 것: 학생 답변(ANSWERED 만), 공고, 증빙, 제출, 의뢰인 검증·평가, 성과. 그 밖의 정보는 넣지 않는다.
import { fieldLabel } from "./domains.ts";
import { hasContent } from "./readiness.ts";
import type {
  ActivityLog, ClientReview, ClientVerification, CompensationType, Evidence, Outcome, PortfolioSource, Project,
  ProjectAnswer, SubmissionVersion,
} from "./types.ts";

export interface SnapshotInput {
  project: Project;
  listing: { title: string; problem: string; category: string; expectedDeliverables: string[]; completionCriteria: string; compensationType: CompensationType };
  client: { name: string; kind: string };
  member: { studentId: string; name: string; department: string; roleLabel: string };
  answers: ProjectAnswer[];
  logs: ActivityLog[];
  evidence: Evidence[];
  versions: SubmissionVersion[];
  verification: ClientVerification | null;
  review: ClientReview | null;
  outcomes: Outcome[];
  now: string;
}

export function buildSource(i: SnapshotInput): PortfolioSource {
  const sid = i.member.studentId;
  const mine = i.answers.filter((a) => a.authorId === sid);
  const questions = i.project.questionSnapshot.questions;
  const fields: PortfolioSource["fields"] = [];
  const omitted: PortfolioSource["omitted"] = [];
  for (const q of questions) {
    const a = mine.find((x) => x.questionId === q.id && x.origin === "SCHEMA");
    const label = fieldLabel(i.project.domain, q.field);
    if (!a || a.status !== "ANSWERED" || !hasContent(a)) {
      omitted.push({ field: q.field, label, status: a && a.status !== "ANSWERED" ? a.status : "UNANSWERED" });
      continue;
    }
    const followUps = mine
      .filter((x) => x.parentQuestionId === q.id && x.origin !== "SCHEMA" && x.status === "ANSWERED" && x.value.trim())
      .map((x) => ({ question: x.prompt ?? "", answer: x.value.trim() }));
    fields.push({ field: q.field, label, question: q.title, answer: a.value.trim(), choices: a.choices, followUps });
  }
  const approved = i.versions.find((v) => v.id === i.project.approvedVersionId);
  const inApproved = new Set(approved?.evidenceIds ?? []);
  const evidence = i.evidence
    .filter((e) => e.authorId === sid || inApproved.has(e.id) || e.source === "CLIENT")
    .map((e) => ({ id: e.id, type: e.type, description: e.description, url: e.url, fileName: e.fileName, linkedField: e.linkedField, linkedClaim: e.linkedClaim, source: e.source }));
  return {
    schema: 1,
    projectId: i.project.id,
    studentId: sid,
    domain: i.project.domain,
    builtAt: i.now,
    listing: { ...i.listing, clientName: i.client.name, clientType: i.client.kind, projectMode: i.project.mode },
    period: { start: i.project.startedAt ?? i.project.createdAt, end: i.project.completedAt ?? null },
    member: { name: i.member.name, department: i.member.department, roleLabel: i.member.roleLabel },
    fields,
    omitted,
    activityLogs: i.logs.filter((l) => l.authorId === sid).map((l) => ({ stage: l.stage, note: l.note, at: l.createdAt })),
    evidence,
    submission: { approvedVersion: approved?.version ?? null, versionCount: i.versions.length, note: approved?.note ?? "" },
    verification: i.verification ? {
      workPerformed: i.verification.workPerformed, roleConfirmed: i.verification.roleConfirmed, deliverableReceived: i.verification.deliverableReceived,
      completionCriteriaMet: i.verification.completionCriteriaMet, actuallyUsed: i.verification.actuallyUsed,
      verifiedAt: i.verification.createdAt, submissionVersionId: i.verification.submissionVersionId,
    } : null,
    review: i.review ? { satisfaction: i.review.satisfaction, deadline: i.review.deadline, communication: i.review.communication, handoff: i.review.handoff, comment: i.review.comment } : null,
    outcomes: i.outcomes.filter((o) => o.authorId === sid).map((o) => ({
      id: o.id, metricName: o.metricName, measured: o.measured, value: o.value, unit: o.unit, baseline: o.baseline,
      measurementPeriod: o.measurementPeriod, source: o.source, evidenceId: o.evidenceId, qualitativeDescription: o.qualitativeDescription, verified: o.verified,
    })),
  };
}

/** 키 순서와 무관한 JSON 직렬화 */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}
/** 같은 자료면 같은 값 (중복 생성 방지용). 생성 시각은 제외한다. cyrb53 (53bit) */
export function sourceHash(s: PortfolioSource): string {
  const text = stableStringify({ ...s, builtAt: undefined });
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
