import type { PortfolioSource, ProjectBundle, User } from "@/types";
import { buildSource } from "@shared/portfolio/snapshot";
import { listingOf } from "../listing";

/** 프로젝트 묶음 → 포트폴리오 원본(스냅샷 데이터). mock 과 Supabase 대체 경로가 같이 쓴다 */
export function sourceFromBundle(b: ProjectBundle, client: User | undefined, student: User | undefined, studentId: string, now: string): PortfolioSource {
  const listing = listingOf(b.post);
  const member = b.members.find((m) => m.studentId === studentId);
  return buildSource({
    project: b.project,
    listing: { title: b.post.title, problem: listing.problem, category: b.post.category, expectedDeliverables: listing.expectedDeliverables, completionCriteria: listing.completionCriteria, compensationType: listing.compensationType },
    client: { name: client?.name ?? "의뢰인", kind: client?.role === "resident" ? client.kind : "주민" },
    member: { studentId, name: student?.name ?? "", department: student?.role === "student" ? student.department : "", roleLabel: roleLabelOf(b, studentId, member?.roleLabel ?? "") },
    answers: b.answers, logs: b.logs, evidence: b.evidence, versions: b.versions, verification: b.verification, review: b.review, outcomes: b.outcomes, now,
  });
}

/** 역할 라벨: 학생이 고른 역할 답변이 있으면 그것, 없으면 선정 시 라벨 */
export function roleLabelOf(b: Pick<ProjectBundle, "answers">, studentId: string, fallback: string) {
  const a = b.answers.find((x) => x.authorId === studentId && x.field === "role" && x.origin === "SCHEMA" && x.status === "ANSWERED");
  const label = a ? [...a.choices, a.value].filter(Boolean).join(", ") : "";
  return label || fallback;
}

