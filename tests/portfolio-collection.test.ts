import { expect, it } from "vitest";
import { feedCollection, withFeedCollection } from "@/lib/portfolio/collection";
import type { PublishedPortfolio } from "@/types";

it("직접 작성한 기록은 경험과 작업으로 분류하지 않는다", () => {
  const manual: PublishedPortfolio = {
    studentId: "s1", sourceId: "m1", sourceKind: "manual", title: "개인 작업", summary: "소개", category: "개인 작업",
    sections: [{ title: "작업 이야기", body: "내용" }], publishedAt: "2026-10-08T00:00:00Z", visible: true,
  };
  expect(feedCollection(manual)).toBe("archive");
  expect(feedCollection(withFeedCollection(manual, "experience"))).toBe("archive");
});
