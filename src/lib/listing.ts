import type { Listing, Post } from "@/types";
import { domainForCategory } from "@shared/portfolio/domains";

export const DEFAULT_REVISION_LIMIT = 2;

/** 공고의 구조화된 정보. 예전 공고(새 필드 없음)도 기본값으로 채워 같은 흐름을 탄다 */
export function listingOf(p: Post): Listing {
  const expectedDeliverables = p.expectedDeliverables ?? [];
  return {
    problem: p.problem || p.description,
    domain: p.domain ?? domainForCategory(p.category),
    expectedDeliverables,
    deliverableCount: expectedDeliverables.length,
    completionCriteria: p.completionCriteria ?? "",
    deadline: p.deadline,
    revisionLimit: p.revisionLimit ?? DEFAULT_REVISION_LIMIT,
    compensationType: p.compensationType ?? (p.reward ? "NON_MONETARY" : "VOLUNTEER"),
    compensationDescription: p.compensationDescription ?? p.reward ?? "",
    paidAmount: p.paidAmount,
    projectMode: p.isTeam ? "TEAM" : "INDIVIDUAL",
  };
}
