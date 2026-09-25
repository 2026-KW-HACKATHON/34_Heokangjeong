import type { Badge, ClientReview, TierScoreEvent, TrustSummary } from "@/types";
import { MIN_VERIFIED_FOR_PAID, temperatureFor, tierFor } from "@shared/portfolio/policy";

/** 티어(검증된 활동 경험)·온도(협업 신뢰도)·뱃지(실제 활동 기록). 준비도나 답변량은 쓰지 않는다 */
export function summarizeTrust(events: TierScoreEvent[], reviews: Pick<ClientReview, "deadline" | "communication" | "handoff">[], badges: Badge[]): TrustSummary {
  const verifiedCount = events.filter((e) => e.kind === "PROJECT_VERIFIED").length;
  const t = tierFor(verifiedCount);
  return {
    verifiedCount,
    points: events.reduce((a, e) => a + e.points, 0),
    temperature: temperatureFor(reviews),
    tier: { key: t.key, label: t.label },
    paidEligible: verifiedCount >= MIN_VERIFIED_FOR_PAID,
    badges,
    events,
  };
}
