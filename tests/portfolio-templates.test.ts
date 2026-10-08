// 모든 포트폴리오 템플릿이 포트폴리오 내용 전체를 담는지, 잠긴 원본은 편집 칸 없이 그대로인지 확인한다.
// 템플릿을 새로 추가하면 TEMPLATES 에 들어가므로 이 테스트를 자동으로 받는다.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TEMPLATES, templateFor } from "@/templates/portfolio";
import { DEFAULT_TEMPLATE, TEMPLATE_META, templateIdOf } from "@/templates/portfolio/meta";
import { pageBlocks, type PortfolioPage } from "@/lib/portfolio/page";
import { sanitizeContent } from "@/lib/workflow/engine";
import { CLAIM_LABEL } from "@shared/portfolio/document";
import { outcomeLine } from "@shared/portfolio/narrative";
import type { PortfolioContent } from "@/types";

const content: PortfolioContent = {
  title: "외국인 손님을 위한 한식당 영문 메뉴판",
  summary: "번역기 없이 고를 수 있는 A4 영문 메뉴판을 만들었습니다.",
  sections: [
    { key: "problem", title: "문제", body: "메뉴 24개가 한글로만 적혀 있었습니다.\n점심시간에 외국인 손님 5팀 중 4팀이 번역기를 썼습니다.", evidenceIds: ["ev-before"] },
    { key: "decisions", title: "디자인 결정", body: "메뉴를 두 구역으로 줄이고 재료와 맵기를 적었습니다.", evidenceIds: [] },
    { key: "process", title: "과정", body: "스케치 → 시안 2종 → 맵기 표시 추가 → 최종본 순서로 진행했습니다.", evidenceIds: ["ev-process"] },
    { key: "reflection", title: "회고", body: "다음에는 시안 전에 사용자에게 먼저 묻겠습니다.", evidenceIds: [] },
    { key: "legacyKey", title: "예전 섹션", body: "템플릿 밖의 예전 섹션도 잃지 않습니다.", evidenceIds: [] },
  ],
  skills: ["정보 구조 설계", "편집 디자인"],
  tools: [{ name: "Figma", why: "점주님과 시안을 함께 보려고" }, { name: "Procreate", why: "" }],
  templateId: "basic",
};
const page: PortfolioPage = {
  projectId: "p1", studentId: "s1", domain: "DESIGN",
  edit: { id: "e1", draftId: "d1", projectId: "p1", studentId: "s1", version: 3, content, createdAt: "2026-10-05T00:00:00Z" },
  info: { period: "2026.09.15 ~ 2026.10.03", roleLabel: "기획, 최종 디자인", clientName: "월계 한상", clientType: "상인", approvedVersion: 2 },
  verification: { projectId: "p1", submissionVersionId: "v2", verifierId: "r1", note: "테이블 10곳에 놓았어요", createdAt: "2026-10-03T00:00:00Z",
    workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true },
  review: { projectId: "p1", reviewerId: "r1", satisfaction: 5, deadline: 5, communication: 4, handoff: 5, deliverableQuality: 5, comment: "이제 외국인 손님이 메뉴판만 보고 바로 주문해요.",
    createdAt: "2026-10-03T00:00:00Z", status: "NORMAL", reviewerReliability: 1, evidenceConsistency: 1, adjustedRating: 5, anomalyReasons: [], policyVersion: "t" },
  evidence: [
    { id: "ev-before", projectId: "p1", authorId: "s1", type: "BEFORE_IMAGE", description: "작업 전 한글 메뉴판", url: "https://example.com/before.png", fileName: "before.png", mimeType: "image/png", source: "STUDENT_UPLOAD", createdAt: "2026-09-16T00:00:00Z" },
    { id: "ev-process", projectId: "p1", authorId: "s1", type: "PROCESS_IMAGE", description: "정보 구조 손스케치", url: "https://example.com/sketch.png", fileName: "sketch.png", mimeType: "image/png", source: "STUDENT_UPLOAD", createdAt: "2026-09-20T00:00:00Z" },
    { id: "ev-pdf", projectId: "p1", authorId: "s1", type: "DELIVERABLE_FILE", description: "A4 인쇄용 PDF", url: "https://example.com/menu.pdf", fileName: "menu.pdf", mimeType: "application/pdf", source: "STUDENT_UPLOAD", createdAt: "2026-10-01T00:00:00Z" },
    { id: "ev-client", projectId: "p1", authorId: "r1", type: "USAGE_PROOF", description: "테이블에 놓인 메뉴판 (의뢰인 사진)", url: "https://example.com/table.jpg", fileName: "table.jpg", mimeType: "image/jpeg", source: "CLIENT", createdAt: "2026-10-03T00:00:00Z" },
  ],
  outcomes: [
    { id: "o1", projectId: "p1", authorId: "s1", metricName: "메뉴 설명 요청", measured: true, value: 3, unit: "회/일", baseline: 12, measurementPeriod: "게시 후 2주", source: "점주 기록", qualitativeDescription: "", verified: true, verifiedBy: "r1", verifiedAt: "2026-10-03T00:00:00Z", createdAt: "2026-10-02T00:00:00Z" },
    { id: "o2", projectId: "p1", authorId: "s1", metricName: "주문 시간", measured: false, value: null, unit: "", baseline: null, measurementPeriod: "", source: "", qualitativeDescription: "외국인 손님이 덜 망설였어요", verified: false, createdAt: "2026-10-02T00:00:00Z" },
  ],
};

const render = (id: string, editing = false, c = content) => {
  const tpl = TEMPLATES.find((t) => t.id === id)!;
  return renderToStaticMarkup(createElement(tpl.Component, { page, content: c, blocks: pageBlocks(page, c, editing), editing, onChange: () => {} }));
};
/** HTML 에서 태그를 지운 글 (React 가 넣은 주석·이스케이프 정리) */
const text = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** data-locked 가 붙은 div 들의 안쪽 HTML (중첩 div 깊이를 세어 끝을 찾는다) */
function lockedParts(html: string): string[] {
  const out: string[] = [];
  const re = /<div[^>]*data-locked="[^"]+"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let depth = 1, i = m.index + m[0].length;
    const tag = /<\/?div\b[^>]*>/g; tag.lastIndex = i;
    let t: RegExpExecArray | null;
    while (depth > 0 && (t = tag.exec(html))) { depth += t[0].startsWith("</") ? -1 : 1; i = t.index; }
    out.push(html.slice(m.index + m[0].length, i));
  }
  return out;
}

/** 포트폴리오에 들어가야 하는 모든 글 */
const EXPECTED = [
  content.title, content.summary,
  ...content.sections.flatMap((s) => s.body.split("\n")),
  ...content.skills, ...content.tools.map((t) => t.name), "점주님과 시안을 함께 보려고",
  page.review!.comment, "만족도 5/5", "소통 4/5",
  ...Object.values(CLAIM_LABEL),
  ...page.evidence.map((e) => e.description),
  ...page.outcomes.map(outcomeLine),
  page.info.period, page.info.roleLabel, page.info.clientName,
];

describe("템플릿 목록", () => {
  it("기능 확인용 템플릿이 1개 이상이고, id 가 메타 목록과 같다", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(1);
    expect(TEMPLATES.map((t) => t.id)).toEqual(TEMPLATE_META.map((t) => t.id));
  });
  it("모르는 템플릿 id 는 기본 템플릿으로", () => {
    expect(templateIdOf("없는-템플릿")).toBe(DEFAULT_TEMPLATE);
    expect(templateIdOf(undefined)).toBe(DEFAULT_TEMPLATE);
    expect(templateFor(42).id).toBe(DEFAULT_TEMPLATE);
  });
  it("저장 전 정리: 템플릿만 바꿔도 글은 그대로, 모르는 값은 기본으로", () => {
    const swapped = sanitizeContent({ ...content, templateId: "editorial" });
    expect(swapped.templateId).toBe("editorial");
    expect({ ...swapped, templateId: undefined }).toEqual({ ...sanitizeContent(content), templateId: undefined });
    expect(sanitizeContent({ ...content, templateId: "<script>" }).templateId).toBe(DEFAULT_TEMPLATE);
    expect(sanitizeContent({ ...content, templateId: undefined }).templateId).toBe(DEFAULT_TEMPLATE);
  });
});

describe.each(TEMPLATES.map((t) => [t.id]))("템플릿 %s", (id) => {
  it("포트폴리오 내용 전체를 담는다 (글 + 잠긴 원본 + 예전 섹션)", () => {
    const all = text(render(id));
    for (const s of EXPECTED) expect(all, `빠진 내용: ${s}`).toContain(s);
  });
  it("증빙 링크가 모두 있다", () => {
    const html = render(id);
    for (const e of page.evidence) expect(html, e.id).toContain(e.url);
  });
  it("보기 모드에는 입력칸이 없다", () => {
    expect(render(id)).not.toMatch(/<textarea|<input/);
  });
  it("편집 모드: 글은 같은 자리의 입력칸, 잠긴 원본은 입력칸 없이 '잠김' 표시", () => {
    const html = render(id, true);
    for (const label of ["제목", "한 줄 요약", "문제", "디자인 결정", "과정", "회고"]) expect(html, label).toContain(`data-editable="${label}"`);
    expect(html).toContain("도구 이름");
    const locked = lockedParts(html);
    expect(locked.length).toBeGreaterThanOrEqual(4);
    for (const part of locked) expect(part).not.toMatch(/<textarea|<input/);
    const lockedText = text(locked.join(" "));
    expect(lockedText).toContain(page.review!.comment);
    expect(lockedText).toContain(CLAIM_LABEL.actuallyUsed);
    for (const e of page.evidence) expect(lockedText, e.id).toContain(e.description);
    expect(text(html)).toContain("잠김 · 의뢰인 원본");
  });
  it("편집 중 글을 다 지운 섹션도 자리가 남는다", () => {
    const cleared = { ...content, sections: content.sections.map((s) => (s.key === "decisions" ? { ...s, body: "" } : s)) };
    expect(render(id, true, cleared)).toContain('data-editable="디자인 결정"');
    expect(render(id, false, cleared)).not.toContain("디자인 결정</");   // 보기 모드에서는 빈 섹션을 숨긴다
  });
});
