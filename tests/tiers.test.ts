import { expect, it } from "vitest";
import { TIERS, tierFor } from "../supabase/functions/_shared/portfolio/policy";

it("starts unranked and promotes at every verified-activity threshold", () => {
  expect(tierFor(0).key).toBe("UNRANKED");
  expect(TIERS).toHaveLength(10);
  TIERS.forEach((tier, index) => {
    expect(tierFor(tier.minVerified).key).toBe(tier.key);
    if (index > 0) expect(tierFor(tier.minVerified - 1).key).toBe(TIERS[index - 1].key);
  });
  expect(tierFor(1000).key).toBe("CHALLENGER");
});
