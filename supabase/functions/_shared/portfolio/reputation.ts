import { REPUTATION_POLICY } from "./reputationPolicy.ts";

export type ReviewStatus = "NORMAL" | "FLAGGED" | "DISPUTED" | "UNDER_REVIEW" | "VALID" | "PARTIALLY_VALID" | "INVALID";
export interface RatingObservation {
  reviewerId: string;
  values: number[];
  status?: ReviewStatus;
  evidenceConsistency?: number;
  reviewerReliability?: number;
}
export interface ReviewEvidence {
  submissionExists: boolean;
  approvedSubmissionVersion: boolean;
  deadlineMet: boolean | null;
  revisionCount: number;
  handoverCompleted: boolean;
  deliverableReceived: boolean;
  completionCriteriaMet: boolean;
  actuallyUsed: boolean;
}
export interface ReviewAssessment {
  status: ReviewStatus;
  normalizedRating: number;
  reviewerReliability: number;
  evidenceConsistency: number;
  adjustedRating: number;
  anomalyReasons: string[];
  policyVersion: string;
}
export interface RobustRating { score: number | null; rawAverage: number | null; reviewCount: number; heldCount: number; anomalyCount: number; confidence: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const m = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2; };
const scoreOf = (observation: RatingObservation) => mean(observation.values.map(value => clamp(value, 1, 5)));
const held = (status?: ReviewStatus) => status === "FLAGGED" || status === "DISPUTED" || status === "UNDER_REVIEW" || status === "INVALID";

export function reviewerReliability(reviewerId: string, history: RatingObservation[]) {
  const all = history.map(scoreOf);
  const mine = history.filter(row => row.reviewerId === reviewerId).map(scoreOf);
  if (!mine.length || !all.length) return REPUTATION_POLICY.reviewerDefaultReliability;
  const platformMean = mean(all);
  const bias = Math.abs(mean(mine) - platformMean);
  const historyConfidence = mine.length / (mine.length + REPUTATION_POLICY.reviewerHistoryWeight);
  const reliability = REPUTATION_POLICY.reviewerDefaultReliability + historyConfidence * (0.2 - bias * 0.22);
  return Math.round(clamp(reliability, REPUTATION_POLICY.reviewerReliabilityMin, REPUTATION_POLICY.reviewerReliabilityMax) * 100) / 100;
}

export function evidenceConsistency(values: { satisfaction: number; deadline: number; communication: number; handoff: number; deliverableQuality: number }, evidence: ReviewEvidence) {
  const expected = [
    evidence.approvedSubmissionVersion ? 5 : evidence.submissionExists ? 3 : 1,
    evidence.deadlineMet === null ? 3 : evidence.deadlineMet ? 5 : 1,
    evidence.handoverCompleted ? 5 : 1,
    evidence.deliverableReceived && evidence.completionCriteriaMet ? 5 : evidence.deliverableReceived ? 3 : 1,
  ];
  const reported = [values.satisfaction, values.deadline, values.handoff, values.deliverableQuality];
  const difference = mean(reported.map((score, index) => Math.abs(score - expected[index]))) / 4;
  return Math.round(clamp(1 - difference * 0.7, REPUTATION_POLICY.evidenceConsistencyMin, 1) * 100) / 100;
}

export function assessReview(values: { satisfaction: number; deadline: number; communication: number; handoff: number; deliverableQuality: number }, reviewerId: string, evidence: ReviewEvidence, history: RatingObservation[] = []): ReviewAssessment {
  const normalizedRating = mean([values.satisfaction, values.deadline, values.communication, values.handoff, values.deliverableQuality]);
  const reliability = reviewerReliability(reviewerId, history);
  const consistency = evidenceConsistency(values, evidence);
  const reasons: string[] = [];
  const supportiveFacts = [evidence.approvedSubmissionVersion, evidence.deadlineMet === true, evidence.handoverCompleted, evidence.deliverableReceived, evidence.completionCriteriaMet, evidence.actuallyUsed].filter(Boolean).length;
  if (values.satisfaction <= 2 && mean([values.deadline, values.communication, values.handoff, values.deliverableQuality]) >= 4.5) reasons.push("평가 항목 간 점수 불일치");
  if (normalizedRating <= 2 && supportiveFacts >= 5) reasons.push("검증된 프로젝트 기록과 낮은 평가가 불일치");
  if (reliability <= 0.65) reasons.push("평가자의 반복적인 극단 평가 패턴");
  if (consistency <= 0.5) reasons.push("프로젝트 증빙과 평가가 불일치");
  const status: ReviewStatus = reasons.length ? "FLAGGED" : "NORMAL";
  const adjustedRating = REPUTATION_POLICY.bayesianPriorMean + (normalizedRating - REPUTATION_POLICY.bayesianPriorMean) * reliability * consistency;
  return { status, normalizedRating: Math.round(normalizedRating * 10) / 10, reviewerReliability: reliability, evidenceConsistency: consistency, adjustedRating: Math.round(clamp(adjustedRating, 1, 5) * 10) / 10, anomalyReasons: reasons, policyVersion: REPUTATION_POLICY.version };
}

export function robustRating(target: RatingObservation[], history: RatingObservation[] = target): RobustRating {
  const eligible = target.filter(row => !held(row.status));
  if (!eligible.length) return { score: null, rawAverage: null, reviewCount: 0, heldCount: target.length, anomalyCount: target.filter(row => row.status === "FLAGGED").length, confidence: 0 };
  const population = history.filter(row => !held(row.status));
  const populationScores = (population.length ? population : eligible).map(scoreOf);
  const populationMedian = median(populationScores);
  const mad = median(populationScores.map(score => Math.abs(score - populationMedian)));
  const spread = Math.max(REPUTATION_POLICY.minimumSpread, mad * 1.4826);
  let weightedTotal = 0; let totalWeight = 0; let anomalyCount = 0;
  for (const observation of eligible) {
    const raw = scoreOf(observation);
    const robustZ = Math.abs(raw - populationMedian) / spread;
    const anomalyWeight = robustZ <= REPUTATION_POLICY.anomalyZThreshold ? 1 : Math.max(0.2, REPUTATION_POLICY.anomalyZThreshold / robustZ);
    if (anomalyWeight < 1) anomalyCount += 1;
    const validityWeight = observation.status === "PARTIALLY_VALID" ? REPUTATION_POLICY.partialValidityWeight : 1;
    const weight = (observation.reviewerReliability ?? reviewerReliability(observation.reviewerId, population)) * (observation.evidenceConsistency ?? 1) * anomalyWeight * validityWeight;
    weightedTotal += raw * weight; totalWeight += weight;
  }
  let score = (REPUTATION_POLICY.bayesianPriorMean * REPUTATION_POLICY.bayesianPriorWeight + weightedTotal) / (REPUTATION_POLICY.bayesianPriorWeight + totalWeight);
  if (eligible.length === 1) {
    const maxDelta = REPUTATION_POLICY.bayesianPriorMean * REPUTATION_POLICY.singleReviewMaxImpact;
    score = clamp(score, REPUTATION_POLICY.bayesianPriorMean - maxDelta, REPUTATION_POLICY.bayesianPriorMean + maxDelta);
  }
  return { score: Math.round(score * 10) / 10, rawAverage: Math.round(mean(eligible.map(scoreOf)) * 10) / 10, reviewCount: eligible.length, heldCount: target.length - eligible.length, anomalyCount, confidence: Math.round(totalWeight / (REPUTATION_POLICY.bayesianPriorWeight + totalWeight) * 100) / 100 };
}
