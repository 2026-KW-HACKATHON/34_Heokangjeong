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

/** 승인 시 한 번만 지급되는 점수 (학생·프로젝트·종류별 유일). SQL approve_version 과 같은 값 */
export const POINTS = {
  projectVerified: (difficulty: number) => 10 + difficulty * 3,
  clientUsed: 5,
};

/** 협업 온도: 36.5 에서 시작, 의뢰인 평가(기한·소통·인계, 1~5) 평균이 3 보다 높으면 오르고 낮으면 내린다 */
export const TEMPERATURE = { base: 36.5, perPointAboveThree: 0.8, min: 30, max: 99 };

export const tierForTemperature = (temperature: number) => [...TIERS].reverse().find((t) => temperature >= t.minTemperature)!;
export function temperatureFor(reviews: { deadline: number; communication: number; handoff: number }[]) {
  let t = TEMPERATURE.base;
  for (const r of reviews) t += ((r.deadline + r.communication + r.handoff) / 3 - 3) * TEMPERATURE.perPointAboveThree;
  return Math.round(Math.min(TEMPERATURE.max, Math.max(TEMPERATURE.min, t)) * 10) / 10;
}
