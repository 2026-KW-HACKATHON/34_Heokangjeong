import { expect, it } from "vitest";
import { TIERS, temperatureFor, tierForTemperature } from "../supabase/functions/_shared/portfolio/policy";

it("starts at seed and promotes from collaboration temperature", () => {
  expect(tierForTemperature(36.5).key).toBe("SEED");
  expect(TIERS).toHaveLength(3);
  TIERS.forEach((tier, index) => {
    expect(tierForTemperature(tier.minTemperature).key).toBe(tier.key);
    if (index > 0) expect(tierForTemperature(tier.minTemperature - 0.1).key).toBe(TIERS[index - 1].key);
  });
  expect(tierForTemperature(99).key).toBe("RECOMMENDED");
});

it("팀원 평가는 프로젝트별 평균으로 협업 온도에 반영한다", () => {
  const peer = [
    { projectId: "p1", communication: 5, collaboration: 5, responsibility: 5 },
    { projectId: "p1", communication: 3, collaboration: 3, responsibility: 3 },
  ];
  expect(temperatureFor([], peer)).toBe(37.3);
});
