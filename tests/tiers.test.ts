import { expect, it } from "vitest";
import { TIERS, tierForTemperature } from "../supabase/functions/_shared/portfolio/policy";

it("starts at seed and promotes from collaboration temperature", () => {
  expect(tierForTemperature(36.5).key).toBe("SEED");
  expect(TIERS).toHaveLength(3);
  TIERS.forEach((tier, index) => {
    expect(tierForTemperature(tier.minTemperature).key).toBe(tier.key);
    if (index > 0) expect(tierForTemperature(tier.minTemperature - 0.1).key).toBe(TIERS[index - 1].key);
  });
  expect(tierForTemperature(99).key).toBe("RECOMMENDED");
});
