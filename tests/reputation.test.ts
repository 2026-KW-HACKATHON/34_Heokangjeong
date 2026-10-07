import { describe, expect, it } from "vitest";
import { robustRating, type RatingObservation } from "../supabase/functions/_shared/portfolio/reputation";

const observation = (reviewerId: string, score: number): RatingObservation => ({ reviewerId, values: [score, score, score, score] });

describe("평가 테러 완화", () => {
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
});
