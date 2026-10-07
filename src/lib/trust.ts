import type { Badge, ClientReview, TeamPeerReview, TierScoreEvent, TrustSummary } from "@/types";
import { temperatureFor, tierForTemperature } from "@shared/portfolio/policy";
import { robustRating } from "@shared/portfolio/reputation";
import { REPUTATION_POLICY } from "@shared/portfolio/reputationPolicy";

/** 티어는 협업 온도, 온도는 의뢰인 평가와 팀원 상호평가, 뱃지는 실제 활동 기록으로 계산한다. */
export function summarizeTrust(events: TierScoreEvent[], reviews: ClientReview[], badges: Badge[], peerReviews: TeamPeerReview[] = [], allReviews: ClientReview[] = reviews, allPeerReviews: TeamPeerReview[] = peerReviews, projectCount = 0): TrustSummary {
  const verifiedCount = events.filter((e) => e.kind === "PROJECT_VERIFIED").length;
  const rating = robustRating(
    reviews.map(r => ({ reviewerId: r.reviewerId, values: [r.satisfaction, r.deadline, r.communication, r.handoff, r.deliverableQuality], status: r.status, reviewerReliability: r.reviewerReliability, evidenceConsistency: r.evidenceConsistency })),
    allReviews.map(r => ({ reviewerId: r.reviewerId, values: [r.satisfaction, r.deadline, r.communication, r.handoff, r.deliverableQuality], status: r.status, reviewerReliability: r.reviewerReliability, evidenceConsistency: r.evidenceConsistency })),
  );
  const temperature = temperatureFor(reviews, peerReviews, allReviews, allPeerReviews);
  const eligible = reviews.filter(r => r.status === "NORMAL" || r.status === "VALID" || r.status === "PARTIALLY_VALID");
  const averagePercent = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length / 5 * 100) : 0;
  const completionRate = projectCount ? Math.round(verifiedCount / projectCount * 100) : 0;
  const deadlineReliability = averagePercent(eligible.map(r => r.deadline));
  const handoverReliability = averagePercent(eligible.map(r => r.handoff));
  const communicationScore = averagePercent(eligible.map(r => r.communication));
  const reviewPercent = rating.score === null ? 0 : rating.score / 5 * 100;
  const w = REPUTATION_POLICY.reputationWeights;
  const reputationScore = Math.round(reviewPercent * w.review + completionRate * w.completion + deadlineReliability * w.deadline + handoverReliability * w.handover + communicationScore * w.communication);
  const t = tierForTemperature(temperature);
  return {
    verifiedCount,
    points: events.reduce((a, e) => a + e.points, 0),
    temperature,
    reputationScore,
    completionRate,
    deadlineReliability,
    handoverReliability,
    communicationScore,
    normalizedRating: rating.score,
    rawRating: rating.rawAverage,
    reviewCount: rating.reviewCount,
    heldReviewCount: rating.heldCount,
    anomalyCount: rating.anomalyCount,
    tier: { key: t.key, label: t.label },
    badges,
    events,
  };
}
