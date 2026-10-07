import type { Badge, ClientReview, TeamPeerReview, TierScoreEvent, TrustSummary } from "@/types";
import { temperatureFor, tierForTemperature } from "@shared/portfolio/policy";

/** 티어는 협업 온도, 온도는 의뢰인 평가와 팀원 상호평가, 뱃지는 실제 활동 기록으로 계산한다. */
export function summarizeTrust(events: TierScoreEvent[], reviews: Pick<ClientReview, "deadline" | "communication" | "handoff">[], badges: Badge[], peerReviews: TeamPeerReview[] = []): TrustSummary {
  const verifiedCount = events.filter((e) => e.kind === "PROJECT_VERIFIED").length;
  const temperature = temperatureFor(reviews, peerReviews);
  const t = tierForTemperature(temperature);
  return {
    verifiedCount,
    points: events.reduce((a, e) => a + e.points, 0),
    temperature,
    tier: { key: t.key, label: t.label },
    badges,
    events,
  };
}
