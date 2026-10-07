// 정책 값. 준비도 가중치·티어 기준·점수는 여기서만 바꾼다.
import type { ReadinessLevel } from "./types.ts";
import { robustRating, type ReviewStatus } from "./reputation.ts";

/** 포트폴리오 자료 준비도 가중치 (합 100). 실력 점수가 아니라 "자료가 얼마나 갖춰졌나" 이다. */
export const READINESS_WEIGHTS: Record<ReadinessLevel, number> = { REQUIRED: 70, RECOMMENDED: 25, OPTIONAL: 5 };

/** 기존 협업 기록과 배지 데이터의 호환성에 필요한 온도 기준. 지원·보상에는 쓰지 않는다. */
export const TIERS = [
  { key: "SEED", label: "새싹", minTemperature: 30 },
  { key: "TRUST", label: "신뢰", minTemperature: 40 },
  { key: "RECOMMENDED", label: "추천", minTemperature: 50 },
] as const;
/** 승인 시 한 번만 지급되는 점수 (학생·프로젝트·종류별 유일). SQL approve_version 과 같은 값 */
export const POINTS = {
  projectVerified: (difficulty: number) => 10 + difficulty * 3,
  clientUsed: 5,
};

/** 협업 온도: 의뢰인 평가와 팀원 상호평가를 프로젝트별 평균으로 반영한다. */
export const TEMPERATURE = { base: 36.5, perPointAboveThree: 0.8, min: 30, max: 99 };

export const tierForTemperature = (temperature: number) => [...TIERS].reverse().find((t) => temperature >= t.minTemperature)!;
export function temperatureFor(
  reviews: { reviewerId?: string; deadline: number; communication: number; handoff: number; satisfaction?: number; status?: ReviewStatus; reviewerReliability?: number; evidenceConsistency?: number }[],
  peerReviews: { projectId: string; reviewerId?: string; communication: number; collaboration: number; responsibility: number }[] = [],
  allReviews = reviews,
  allPeerReviews = peerReviews,
) {
  let t = TEMPERATURE.base;
  const client = robustRating(
    reviews.map(r => ({ reviewerId: r.reviewerId ?? "unknown", values: [r.satisfaction ?? r.deadline, r.deadline, r.communication, r.handoff], status: r.status, reviewerReliability: r.reviewerReliability, evidenceConsistency: r.evidenceConsistency })),
    allReviews.map(r => ({ reviewerId: r.reviewerId ?? "unknown", values: [r.satisfaction ?? r.deadline, r.deadline, r.communication, r.handoff], status: r.status, reviewerReliability: r.reviewerReliability, evidenceConsistency: r.evidenceConsistency })),
  );
  if (client.score !== null) t += (client.score - 3) * TEMPERATURE.perPointAboveThree * client.reviewCount;
  const byProject = new Map<string, typeof peerReviews>();
  for (const r of peerReviews) {
    const rows = byProject.get(r.projectId) ?? [];
    rows.push(r);
    byProject.set(r.projectId, rows);
  }
  const peerHistory = allPeerReviews.map(r => ({ reviewerId: r.reviewerId ?? "unknown", values: [r.communication, r.collaboration, r.responsibility] }));
  for (const rows of byProject.values()) {
    const rating = robustRating(rows.map(r => ({ reviewerId: r.reviewerId ?? "unknown", values: [r.communication, r.collaboration, r.responsibility] })), peerHistory);
    if (rating.score !== null) t += (rating.score - 3) * TEMPERATURE.perPointAboveThree;
  }
  return Math.round(Math.min(TEMPERATURE.max, Math.max(TEMPERATURE.min, t)) * 10) / 10;
}
