import { describe, expect, it } from "vitest";
import { webPortfolioHtml } from "../src/lib/portfolio/webHtml";
import { menuEditorialHtml } from "../src/lib/portfolio/menuEditorialHtml";
import type { PortfolioPage } from "../src/lib/portfolio/page";
import type { PortfolioContent } from "../src/types";
import type { DocBlock } from "@shared/portfolio/document";

describe("웹 포트폴리오 HTML", () => {
  it("프로젝트 내용과 검증을 독립 실행형 문서에 포함하고 스크립트는 넣지 않는다", () => {
    const content: PortfolioContent = { title: "온기반찬 <스티커>", summary: "실제 사용된 디자인", sections: [], skills: ["기획"], tools: [{ name: "Figma", why: "시안" }] };
    const verification = { projectId: "p1", submissionVersionId: "v1", verifierId: "r1", note: "", createdAt: "2026-09-24", workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true };
    const page = { projectId: "p1", studentId: "s1", edit: { version: 2 }, evidence: [], outcomes: [] } as unknown as PortfolioPage;
    const blocks: DocBlock[] = [
      { kind: "info", rows: [["분야", "디자인"]] },
      { kind: "section", section: { key: "problem", title: "문제", body: "포장에 상호가 없었어요.", evidenceIds: [] }, evidence: [] },
      { kind: "verification", verification, outcomeVerified: 0, outcomeTotal: 0, approvedVersion: 1 },
    ];
    const html = webPortfolioHtml(page, content, blocks);
    expect(html).toContain("온기반찬 &lt;스티커&gt;");
    expect(html).toContain("포장에 상호가 없었어요.");
    expect(html).toContain("학생이 실제로 작업함");
    expect(html).toContain("@media print");
    expect(html).not.toContain("<script");
  });
  it("김하늘 데모는 앱 기록을 Editorial 문서에 배치하고 내려받기용 이미지를 포함한다", () => {
    const content: PortfolioContent = {
      title: "영문 <메뉴판>", summary: "번역기 없이 고르는 메뉴판",
      sections: [{ key: "problem", title: "문제", body: "재료와 맵기를 알 수 없었어요.", evidenceIds: [] }],
      skills: ["정보 구조"], tools: [{ name: "Figma", why: "시안 비교" }],
    };
    const page = {
      projectId: "demo-menu-2", info: { roleLabel: "디자인", clientName: "행복분식", period: "2026.09.15 ~ 2026.09.17" },
      evidence: [{ id: "e1", type: "DELIVERABLE_FILE", url: "/portfolio-samples/menu.png", mimeType: "image/png", description: "메뉴판 시안" }],
      edit: { version: 1 }, outcomes: [],
    } as unknown as PortfolioPage;
    const html = webPortfolioHtml(page, content, []);
    expect(html).toContain("김하늘");
    expect(html).toContain("재료와 맵기를 알 수 없었어요.");
    expect(html).toContain("영문 &lt;메뉴판&gt;");
    expect(html).toContain('data-pf-edit="title"');
    expect(html).toContain('data-pf-edit="section:problem"');
    expect(html).toContain("PROJECT INDEX");
    expect(html).not.toContain("<script");
    const portable = menuEditorialHtml(page, content, { "/portfolio-samples/menu.png": "data:image/png;base64,YWJj" });
    expect(portable).toContain('src="data:image/png;base64,YWJj"');
    expect(portable).not.toContain('src="/portfolio-samples/menu.png"');
  });
  it("학생이 바꾼 사진을 표시하면서 검증 원본 링크를 보존한다", () => {
    const content: PortfolioContent = {
      title: "메뉴판", summary: "시안", skills: [], tools: [],
      sections: [{ key: "beforeAfter", title: "작업 전후", body: "비교", evidenceIds: [] }],
      imageOverrides: { e1: { url: "https://example.com/replacement.png", caption: "새 시안" } },
    };
    const page = {
      projectId: "demo-menu-2", info: { roleLabel: "디자인", clientName: "행복분식", period: "2026" },
      evidence: [{ id: "e1", type: "DELIVERABLE_FILE", url: "/portfolio-samples/menu.png", mimeType: "image/png", description: "원본" }],
      edit: { version: 1 }, outcomes: [],
    } as unknown as PortfolioPage;
    const html = menuEditorialHtml(page, content);
    expect(html).toContain('src="https://example.com/replacement.png"');
    expect(html).toContain('href="/portfolio-samples/menu.png"');
    expect(html).toContain("새 시안");
  });
});
