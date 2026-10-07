import { expect, it } from "vitest";
import { workFieldSummary } from "../src/lib/workFields";
import type { PortfolioCard, Post } from "../src/types";

it("검증된 작업만 분야별로 묶고 별점은 평가가 있는 작업만 평균낸다", () => {
  const posts = [
    { id: "p1", category: "디자인" }, { id: "p2", category: "사진" },
    { id: "p3", category: "디자인" }, { id: "p4", category: "디자인" },
  ] as Post[];
  const cards = [
    { id: "1", postId: "p1", rating: 5, verified: true },
    { id: "2", postId: "p2", rating: 3, verified: true },
    { id: "3", postId: "p3", rating: 4, verified: true },
    { id: "4", postId: "p4", rating: 5, verified: false },
  ] as PortfolioCard[];
  const summary = workFieldSummary(cards, posts);
  expect(summary.total).toBe(3);
  expect(summary.mostFrequent).toEqual(["디자인"]);
  expect(summary.averageRating).toBe(4);
  expect(summary.byField.map(f => [f.category, f.count, f.averageRating])).toEqual([["디자인", 2, 4.5], ["사진", 1, 3]]);
});
