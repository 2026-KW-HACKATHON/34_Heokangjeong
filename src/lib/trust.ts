import type { Badge, ClientReview, TeamPeerReview, TierScoreEvent, TrustSummary } from "@/types";
import { temperatureFor, tierForTemperature } from "@shared/portfolio/policy";
import { robustRating } from "@shared/portfolio/reputation";

/** 티어는 협업 온도, 온도는 의뢰인 평가와 팀원 상호평가, 뱃지는 실제 활동 기록으로 계산한다. */
export function summarizeTrust(events: TierScoreEvent[], reviews: ClientReview[], badges: Badge[], peerReviews: TeamPeerReview[] = [], allReviews: ClientReview[] = reviews, allPeerReviews: TeamPeerReview[] = peerReviews): TrustSummary {
  const verifiedCount = events.filter((e) => e.kind === "PROJECT_VERIFIED").length;
  const rating = robustRating(
    reviews.map(r => ({ reviewerId: r.reviewerId, values: [r.satisfaction, r.deadline, r.communication, r.handoff] })),
    allReviews.map(r => ({ reviewerId: r.reviewerId, values: [r.satisfaction, r.deadline, r.communication, r.handoff] })),
  );
  const temperature = temperatureFor(reviews, peerReviews, allReviews, allPeerReviews);
  const t = tierForTemperature(temperature);
  return {
    verifiedCount,
    points: events.reduce((a, e) => a + e.points, 0),
    temperature,
    normalizedRating: rating.score,
    rawRating: rating.rawAverage,
    reviewCount: rating.reviewCount,
    anomalyCount: rating.anomalyCount,
    tier: { key: t.key, label: t.label },
    badges,
    events,
  };
}
