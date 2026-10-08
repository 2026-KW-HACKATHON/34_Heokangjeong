import { DOMAINS } from "@shared/portfolio/domains";
import type { DocBlock } from "@shared/portfolio/document";
import type { PortfolioContent } from "@/types";
import type { PortfolioPage } from "./page";
import { exhibitionAssets } from "./exhibitionAssets";

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]!);
// 사용자 데이터는 실행 코드가 아니라 JSON으로만 전달한다.
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function exhibitionPortfolioHtml(page: PortfolioPage, content: PortfolioContent, blocks: DocBlock[], origin = "") {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const assetBase = `${base}/portfolio-exhibition`;
  const sections = blocks.filter((b): b is Extract<DocBlock, {kind:"section"}> => b.kind === "section");
  const evidence = page.evidence.map(e => {
    const override = content.imageOverrides?.[e.id];
    const url = override?.url || e.url;
    return {...e, url: url?.startsWith("/") ? `${base}${url}` : url};
  });
  const sample = {
    id: page.projectId, sample: false,
    author: {name: page.studentName || "프로젝트 포트폴리오", field: blocks.find(b => b.kind === "info")?.rows.find(([k]) => k === "분야")?.[1] || page.domain},
    displayTitle: content.title, domainLabel: page.domain,
    sectionRoles: Object.fromEntries(DOMAINS[page.domain].sections.map(s => [s.key, s.role])),
    content: {...content, sections: sections.map(b => ({...b.section, evidenceIds: b.evidence.map(e => e.id)}))},
    page: {projectId: page.projectId, info: page.info, review: page.review, verification: page.verification, outcomes: page.outcomes, evidence},
  };
  const nonce = "wolink-exhibition-runtime";
  const script = (s: string) => `<script nonce="${nonce}">${s.replace(/<\/script/gi, "<\\/script")}</script>`;
  const bootstrap = `window.WOLINK_ASSET_BASE=${json(assetBase)};window.WOLINK_SAMPLES={menu:${json(sample)}};`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(content.title)}</title><style>${exhibitionAssets.css}</style></head><body data-view="list" data-motion="on" data-font="brush">${exhibitionAssets.markup}${script(exhibitionAssets.gsap)}${script(exhibitionAssets.flip)}${script(bootstrap)}${script(exhibitionAssets.runtime)}</body></html>`;
}
