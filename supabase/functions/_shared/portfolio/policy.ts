// 정책 값. 준비도 가중치·티어 기준·점수는 여기서만 바꾼다.
import type { ReadinessLevel } from "./types.ts";

/** 포트폴리오 자료 준비도 가중치 (합 100). 실력 점수가 아니라 "자료가 얼마나 갖춰졌나" 이다. */
export const READINESS_WEIGHTS: Record<ReadinessLevel, number> = { REQUIRED: 70, RECOMMENDED: 25, OPTIONAL: 5 };

/** 협업 온도 기준 티어. 유료 공고 자격은 별도의 검증 활동 조건을 쓴다. */
export const TIERS = [
  { key: "SEED", label: "새싹", minTemperature: 30 },
  { key: "TRUST", label: "신뢰", minTemperature: 40 },
  { key: "RECOMMENDED", label: "추천", minTemperature: 50 },
] as const;
export const MIN_VERIFIED_FOR_PAID = 1;

export type ApplicationTier = "SEED" | "TRUST" | "RECOMMENDED";
/** Demo reward floors per listing, not market rates. */
export const MIN_TIER_REWARD: Record<ApplicationTier, number> = { SEED: 0, TRUST: 30000, RECOMMENDED: 50000 };
export function applicationTierFor(temperature: number, rank: number | null) {
  return rank !== null && rank > 0 && rank <= 5 ? TIERS[2] : tierForTemperature(temperature);
}
export function meetsApplicationTier(actual: ApplicationTier, required: ApplicationTier) {
  return TIERS.findIndex(t => t.key === actual) >= TIERS.findIndex(t => t.key === required);
}
export function validateTierReward(tier: ApplicationTier, compensation: string, amount?: number) {
  if (!(tier in MIN_TIER_REWARD)) throw new Error("최소 지원 등급을 확인해 주세요.");
  const floor = MIN_TIER_REWARD[tier];
  if (floor > 0 && (compensation !== "PAID" || !Number.isFinite(amount) || !Number.isInteger(amount) || amount! < floor)) {
    throw new Error(`${TIERS.find(t => t.key === tier)!.label} 이상 공고는 사례비 ${floor.toLocaleString()}원 이상이 필요해요.`);
  }
}

/** 승인 시 한 번만 지급되는 점수 (학생·프로젝트·종류별 유일). SQL approve_version 과 같은 값 */
export const POINTS = {
  projectVerified: (difficulty: number) => 10 + difficulty * 3,
  clientUsed: 5,
};

/** 협업 온도: 의뢰인 평가와 팀원 상호평가를 프로젝트별 평균으로 반영한다. */
export const TEMPERATURE = { base: 36.5, perPointAboveThree: 0.8, min: 30, max: 99 };

export const tierForTemperature = (temperature: number) => [...TIERS].reverse().find((t) => temperature >= t.minTemperature)!;
export function temperatureFor(
  reviews: { deadline: number; communication: number; handoff: number }[],
  peerReviews: { projectId: string; communication: number; collaboration: number; responsibility: number }[] = [],
) {
  let t = TEMPERATURE.base;
  for (const r of reviews) t += ((r.deadline + r.communication + r.handoff) / 3 - 3) * TEMPERATURE.perPointAboveThree;
  const byProject = new Map<string, number[]>();
  for (const r of peerReviews) {
    const scores = byProject.get(r.projectId) ?? [];
    scores.push((r.communication + r.collaboration + r.responsibility) / 3);
    byProject.set(r.projectId, scores);
  }
  for (const scores of byProject.values()) {
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    t += (average - 3) * TEMPERATURE.perPointAboveThree;
  }
  return Math.round(Math.min(TEMPERATURE.max, Math.max(TEMPERATURE.min, t)) * 10) / 10;
}
