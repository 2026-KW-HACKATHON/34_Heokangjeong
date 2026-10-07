/** 평판 정책은 이 파일에서만 조정한다. AI가 값을 변경하지 않는다. */
export const REPUTATION_POLICY = {
  version: "2026-10-evidence-v1",
  bayesianPriorMean: 4.2,
  bayesianPriorWeight: 5,
  reviewerReliabilityMin: 0.5,
  reviewerReliabilityMax: 1.2,
  reviewerDefaultReliability: 1,
  reviewerHistoryWeight: 5,
  evidenceConsistencyMin: 0.3,
  anomalyZThreshold: 2.5,
  minimumSpread: 0.6,
  singleReviewMaxImpact: 0.1,
  partialValidityWeight: 0.5,
  robustTrimMinimumReviews: 20,
  robustTrimRatio: 0.05,
  reputationWeights: { review: 0.4, completion: 0.25, deadline: 0.15, handover: 0.1, communication: 0.1 },
} as const;
