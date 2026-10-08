import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("데모 포트폴리오 공개 설정을 저장하고 다시 열어도 유지한다", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("sessionStorage", { getItem: () => "s1" });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  });

  let { mockRepo } = await import("@/lib/repo/mock");
  const [sample] = await mockRepo.listPublishedPortfolio("s1");
  expect(sample).toBeDefined();
  await mockRepo.unpublishPortfolio("s1", sample.sourceId, sample.sourceKind);
  expect((await mockRepo.listPublishedPortfolio("s1")).some(p => p.sourceId === sample.sourceId)).toBe(false);

  vi.resetModules();
  ({ mockRepo } = await import("@/lib/repo/mock"));
  const hidden = (await mockRepo.listPublishedPortfolio("s1", true)).find(p => p.sourceId === sample.sourceId);
  expect(hidden?.visible).toBe(false);
  await mockRepo.publishPortfolio("s1", sample.sourceId, sample.sourceKind);
  expect((await mockRepo.listPublishedPortfolio("s1")).some(p => p.sourceId === sample.sourceId)).toBe(true);
});
