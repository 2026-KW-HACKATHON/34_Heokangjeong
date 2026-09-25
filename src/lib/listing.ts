import type { Listing, Post } from "@/types";
import { domainForCategory } from "@shared/portfolio/domains";

export const DEFAULT_REVISION_LIMIT = 2;
export const MAX_PAID_AMOUNT = 2_147_483_647;

/** 금액 입력에 쉼표·공백·원 기호가 섞여도 DB에 저장할 정수 금액으로 바꾼다. */
export function parsePaidAmount(value: string): number | undefined {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_PAID_AMOUNT ? amount : undefined;
}

export function formatPaidAmount(value: string): string {
  const amount = parsePaidAmount(value);
  return amount === undefined ? "" : amount.toLocaleString("ko-KR");
}

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

export const COMPENSATION_LABEL = { VOLUNTEER: "자원봉사", NON_MONETARY: "비금전 보상", PAID: "유료" } as const;
