import { describe, expect, it } from "vitest";
import { portfolioShareUrl, readPortfolioSnapshot } from "@/lib/portfolio/shareSnapshot";
import { pageFromBundle, pageBlocks } from "@/lib/portfolio/page";
import { seedDemoProjects } from "@/lib/portfolio/demoProjects";
import { users } from "@/lib/repo/mock";
import * as wf from "@/lib/workflow/engine";
import { webPortfolioHtml } from "@/lib/portfolio/webHtml";

describe("로그인 없는 기존 HTML 공유", () => {
  it("공유 시점의 편집과 원본 기록을 보존하고 비공개 최신 초안은 제외한다", async () => {
    const db = { ...wf.emptyDB(), users: structuredClone(users) }; seedDemoProjects(db);
    const edit = db.edits.find(e => e.projectId === "demo-menu-2")!;
    const page = pageFromBundle(wf.getBundle(db, edit.projectId), edit, "s1", users);
    const content = { ...edit.content, title: "공유한 메뉴판 <수정본>" };
    const url = await portfolioShareUrl(page, content, "https://wolgye-talent.vercel.app");
    expect(url).toContain("/portfolio/shared/#v1=");
    const restored = await readPortfolioSnapshot(new URL(url).hash);
    expect(restored.edit.content).toEqual(content);
    expect(restored.review).toEqual(page.review);
    expect(restored.latestDraft).toBeUndefined();
    expect(webPortfolioHtml(restored, content, pageBlocks(restored))).toEqual(webPortfolioHtml(page, content, pageBlocks(page, content)));
  });
  it("깨진 링크는 거부한다", async () => { await expect(readPortfolioSnapshot("#bad")).rejects.toThrow(); });
});

