import { describe, expect, it } from "vitest";
import { assessReview, reviewerReliability, robustRating, type RatingObservation, type ReviewEvidence } from "../supabase/functions/_shared/portfolio/reputation";

const observation = (reviewerId: string, score: number): RatingObservation => ({ reviewerId, values: [score, score, score, score] });

describe("평가 테러 완화", () => {
  const completed: ReviewEvidence = { submissionExists: true, approvedSubmissionVersion: true, deadlineMet: true, revisionCount: 0, handoverCompleted: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true };
  const failed: ReviewEvidence = { submissionExists: false, approvedSubmissionVersion: false, deadlineMet: false, revisionCount: 2, handoverCompleted: false, deliverableReceived: false, completionCriteriaMet: false, actuallyUsed: false };

  it("Case A: 증빙과 일치하는 좋은 리뷰는 정상 반영한다", () => {
    const result = assessReview({ satisfaction: 5, deadline: 5, communication: 5, handoff: 5, deliverableQuality: 5 }, "owner", completed);
    expect(result.status).toBe("NORMAL");
    expect(result.evidenceConsistency).toBe(1);
  });

  it("Case B: 실제 실패 기록과 일치하는 낮은 리뷰는 정상 반영한다", () => {
    const result = assessReview({ satisfaction: 1, deadline: 1, communication: 2, handoff: 1, deliverableQuality: 1 }, "owner", failed);
    expect(result.status).toBe("NORMAL");
    expect(result.adjustedRating).toBeLessThan(3);
  });

  it("Case C: 완료 증빙과 충돌하는 1점 리뷰는 보류한다", () => {
    const result = assessReview({ satisfaction: 1, deadline: 5, communication: 5, handoff: 5, deliverableQuality: 5 }, "owner", completed);
    expect(result.status).toBe("FLAGGED");
    expect(result.anomalyReasons.length).toBeGreaterThan(0);
  });

  it("Case D: 반복해서 극단 점수를 주는 평가자의 신뢰도를 낮춘다", () => {
    const history = [...Array.from({ length: 10 }, (_, i) => observation(`fair-${i}`, 4.5)), ...[1, 1, 1, 2, 1, 1].map(score => observation("harsh", score))];
    expect(reviewerReliability("harsh", history)).toBeLessThan(1);
  });

  it("평가가 적을 때 Bayesian 사전 평균으로 극단값의 영향을 제한한다", () => {
    const high = robustRating([observation("owner-new", 5)]);
    const low = robustRating([observation("owner-new", 1)]);
    expect(high.score).toBeLessThan(5);
    expect(low.score).toBeGreaterThan(3);
    expect(high.confidence).toBeLessThan(0.2);
  });

  it("반복해서 박한 평가자와 전체 분포의 이상치를 함께 완화한다", () => {
    const ordinary = Array.from({ length: 10 }, (_, index) => observation(`fair-${index}`, 4));
    const harshHistory = Array.from({ length: 4 }, () => observation("harsh-owner", 1));
    const attacked = harshHistory[0];
    const result = robustRating([attacked], [...ordinary, ...harshHistory]);
    expect(result.rawAverage).toBe(1);
    expect(result.score).toBeGreaterThan(3.5);
    expect(result.anomalyCount).toBe(1);
  });

  it("여러 평가자가 일관되게 낮게 평가하면 실제 신호는 반영한다", () => {
    const lowReviews = Array.from({ length: 8 }, (_, index) => observation(`owner-${index}`, 2));
    const result = robustRating(lowReviews, lowReviews);
    expect(result.score).toBeLessThan(3.5);
    expect(result.reviewCount).toBe(8);
  });

  it("Case F: 학생이 이의제기한 평가는 확정 전 집계에서 제외한다", () => {
    const disputed = { ...observation("owner", 1), status: "DISPUTED" as const };
    const result = robustRating([disputed], [disputed]);
    expect(result.score).toBeNull();
    expect(result.heldCount).toBe(1);
  });
});
