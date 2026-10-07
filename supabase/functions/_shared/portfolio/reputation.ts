export interface RatingObservation {
  reviewerId: string;
  values: number[];
}

export interface RobustRating {
  score: number | null;
  rawAverage: number | null;
  reviewCount: number;
  anomalyCount: number;
  confidence: number;
}

export const REPUTATION_POLICY = {
  priorMean: 3.8,
  priorWeight: 4,
  reviewerBaseWeight: 0.35,
  reviewerHistoryWeight: 4,
  reviewerBiasWeight: 5,
  anomalyZ: 2.5,
  anomalyMinimumWeight: 0.2,
  minimumSpread: 0.6,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const scoreOf = (observation: RatingObservation) => mean(observation.values.map(value => clamp(value, 1, 5)));

/**
 * Bayesian Average에 평가자별 이력 신뢰도와 MAD 이상치 감쇠를 결합한다.
 * 원점수는 보존하며, 공개 종합 점수와 협업 온도 계산에서만 보정값을 사용한다.
 */
export function robustRating(target: RatingObservation[], history: RatingObservation[] = target): RobustRating {
  if (!target.length) return { score: null, rawAverage: null, reviewCount: 0, anomalyCount: 0, confidence: 0 };
  const population = history.length ? history : target;
  const populationScores = population.map(scoreOf);
  const populationMedian = median(populationScores);
  const centerConfidence = populationScores.length / (populationScores.length + 10);
  const center = REPUTATION_POLICY.priorMean * (1 - centerConfidence) + populationMedian * centerConfidence;
  const mad = median(populationScores.map(score => Math.abs(score - populationMedian)));
  const spread = Math.max(REPUTATION_POLICY.minimumSpread, mad * 1.4826);
  const byReviewer = new Map<string, number[]>();
  for (const observation of population) {
    const scores = byReviewer.get(observation.reviewerId) ?? [];
    scores.push(scoreOf(observation));
    byReviewer.set(observation.reviewerId, scores);
  }

  let weightedTotal = 0;
  let totalWeight = 0;
  let anomalyCount = 0;
  for (const observation of target) {
    const raw = scoreOf(observation);
    const reviewerScores = byReviewer.get(observation.reviewerId) ?? [raw];
    const count = reviewerScores.length;
    const historyConfidence = count / (count + REPUTATION_POLICY.reviewerHistoryWeight);
    const reliability = REPUTATION_POLICY.reviewerBaseWeight + (1 - REPUTATION_POLICY.reviewerBaseWeight) * historyConfidence;
    const biasConfidence = count / (count + REPUTATION_POLICY.reviewerBiasWeight);
    const corrected = clamp(raw - (mean(reviewerScores) - center) * biasConfidence, 1, 5);
    const robustZ = Math.abs(raw - populationMedian) / spread;
    const anomalyWeight = robustZ <= REPUTATION_POLICY.anomalyZ
      ? 1
      : Math.max(REPUTATION_POLICY.anomalyMinimumWeight, REPUTATION_POLICY.anomalyZ / robustZ);
    if (anomalyWeight < 1) anomalyCount += 1;
    const weight = reliability * anomalyWeight;
    weightedTotal += corrected * weight;
    totalWeight += weight;
  }

  const score = (REPUTATION_POLICY.priorMean * REPUTATION_POLICY.priorWeight + weightedTotal)
    / (REPUTATION_POLICY.priorWeight + totalWeight);
  return {
    score: Math.round(score * 10) / 10,
    rawAverage: Math.round(mean(target.map(scoreOf)) * 10) / 10,
    reviewCount: target.length,
    anomalyCount,
    confidence: Math.round(totalWeight / (REPUTATION_POLICY.priorWeight + totalWeight) * 100) / 100,
  };
}
