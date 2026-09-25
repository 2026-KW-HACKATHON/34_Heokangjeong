// 정책 값. 준비도 가중치·티어 기준·점수는 여기서만 바꾼다.
import type { ReadinessLevel } from "./types.ts";

/** 포트폴리오 자료 준비도 가중치 (합 100). 실력 점수가 아니라 "자료가 얼마나 갖춰졌나" 이다. */
export const READINESS_WEIGHTS: Record<ReadinessLevel, number> = { REQUIRED: 70, RECOMMENDED: 25, OPTIONAL: 5 };

/** 검증된 프로젝트 수 기준 티어. 유료 공고는 MIN_VERIFIED_FOR_PAID 이상만 지원할 수 있다. */
export const TIERS = [
  { key: "UNRANKED", label: "언랭크", minVerified: 0 },
  { key: "BRONZE", label: "브론즈", minVerified: 1 },
  { key: "SILVER", label: "실버", minVerified: 3 },
  { key: "GOLD", label: "골드", minVerified: 6 },
  { key: "PLATINUM", label: "플래티넘", minVerified: 10 },
  { key: "EMERALD", label: "에메랄드", minVerified: 15 },
  { key: "DIAMOND", label: "다이아", minVerified: 22 },
  { key: "MASTER", label: "마스터", minVerified: 32 },
  { key: "GRANDMASTER", label: "그랜드 마스터", minVerified: 45 },
  { key: "CHALLENGER", label: "챌린저", minVerified: 60 },
] as const;
export const MIN_VERIFIED_FOR_PAID = 1;

/** 승인 시 한 번만 지급되는 점수 (학생·프로젝트·종류별 유일). SQL approve_version 과 같은 값 */
export const POINTS = {
  projectVerified: (difficulty: number) => 10 + difficulty * 3,
  clientUsed: 5,
};

/** 협업 온도: 36.5 에서 시작, 의뢰인 평가(기한·소통·인계, 1~5) 평균이 3 보다 높으면 오르고 낮으면 내린다 */
export const TEMPERATURE = { base: 36.5, perPointAboveThree: 0.8, min: 30, max: 99 };

export const tierFor = (verifiedCount: number) => [...TIERS].reverse().find((t) => verifiedCount >= t.minVerified)!;
export function temperatureFor(reviews: { deadline: number; communication: number; handoff: number }[]) {
  let t = TEMPERATURE.base;
  for (const r of reviews) t += ((r.deadline + r.communication + r.handoff) / 3 - 3) * TEMPERATURE.perPointAboveThree;
  return Math.round(Math.min(TEMPERATURE.max, Math.max(TEMPERATURE.min, t)) * 10) / 10;
}
