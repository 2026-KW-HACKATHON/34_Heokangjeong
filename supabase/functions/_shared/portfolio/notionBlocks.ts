// 포트폴리오 문서(DocBlock) → Notion 블록. 앱의 저장 미리보기와 서버 저장이 같은 함수를 쓴다.
// 첨부는 Notion 이 실제로 열 수 있는 공개 http(s) 주소만 쓴다. 로컬 경로·blob·data·localhost 는 "첨부 실패"로 기록한다.
import { CLAIM_KEYS, CLAIM_LABEL, EVIDENCE_LABEL, type DocBlock } from "./document.ts";
import type { Evidence } from "./types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type NotionBlock = Record<string, any>;
export interface FailedAttachment { evidenceId: string; reason: string }

const MAX_TEXT = 1900; // Notion rich_text 한 조각 2000자 제한
const rt = (text: string, opts: { bold?: boolean; link?: string; color?: string } = {}) => {
  const parts: NotionBlock[] = [];
  for (let i = 0; i < Math.max(1, text.length); i += MAX_TEXT) {
    parts.push({ type: "text", text: { content: text.slice(i, i + MAX_TEXT), ...(opts.link ? { link: { url: opts.link } } : {}) }, annotations: { bold: !!opts.bold, color: opts.color ?? "default" } });
  }
  return parts.slice(0, 100);
};
const para = (text: string, opts?: Parameters<typeof rt>[1]): NotionBlock => ({ object: "block", type: "paragraph", paragraph: { rich_text: rt(text, opts) } });
const h2 = (text: string): NotionBlock => ({ object: "block", type: "heading_2", heading_2: { rich_text: rt(text) } });
const bullet = (text: string, bold?: string): NotionBlock => ({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: bold ? [...rt(bold, { bold: true }), ...rt(` ${text}`)] : rt(text) } });

/** Notion 이 서버에서 가져올 수 있는 주소인지 */
export function publicUrlProblem(url?: string): string | null {
  if (!url) return "주소 없음";
  if (/^(data|blob|file):/i.test(url)) return "로컬·임시 주소라 Notion 에서 열 수 없음";
  if (/^[a-z]:\\/i.test(url)) return "로컬 파일 경로라 Notion 에서 열 수 없음";
  let u: URL;
  try { u = new URL(url); } catch { return "올바른 주소가 아님"; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "http(s) 주소가 아님";
  if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|\[::1\])/.test(u.hostname) || u.hostname.endsWith(".local")) return "내 컴퓨터(localhost) 주소라 Notion 에서 열 수 없음";
  if (url.length > 2000) return "주소가 너무 김";
  return null;
}
const isImageEvidence = (e: Evidence) => (e.mimeType?.startsWith("image/") ?? false) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(e.url ?? "");

/** 증빙 하나 → Notion 블록. imagesAsLinks 면 이미지도 링크로 (Notion 이 이미지를 거부했을 때 재시도용) */
function evidenceBlocks(e: Evidence, failed: FailedAttachment[], imagesAsLinks: boolean): NotionBlock[] {
  const label = `${EVIDENCE_LABEL[e.type]}${e.description ? ` — ${e.description}` : ""}`;
  if (!e.url) return [bullet(label)]; // 설명만 있는 증빙(메모)
  const problem = publicUrlProblem(e.url);
  if (problem) { failed.push({ evidenceId: e.id, reason: problem }); return [bullet(`${label} (첨부 실패: ${problem})`)]; }
  if (isImageEvidence(e) && !imagesAsLinks) {
    return [{ object: "block", type: "image", image: { type: "external", external: { url: e.url }, caption: rt(label) } }];
  }
  return [{ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: rt(label + " ", {}).concat(rt(e.fileName || "열기", { link: e.url })) } }];
}

export function toNotionBlocks(doc: DocBlock[], summary: string, opts: { imagesAsLinks?: boolean } = {}) {
  const failed: FailedAttachment[] = [];
  const shown = new Set<string>();
  const blocks: NotionBlock[] = [];
  if (summary) blocks.push({ object: "block", type: "callout", callout: { rich_text: rt(summary), icon: { type: "emoji", emoji: "📌" }, color: "blue_background" } });
  for (const b of doc) {
    switch (b.kind) {
      case "info":
        blocks.push(h2("프로젝트 정보"), ...b.rows.map(([k, v]) => bullet(v, k)));
        break;
      case "section":
        blocks.push(h2(b.section.title));
        for (const line of b.section.body.split(/\n+/).map((s) => s.trim()).filter(Boolean)) blocks.push(para(line));
        for (const e of b.evidence) { shown.add(e.id); blocks.push(...evidenceBlocks(e, failed, !!opts.imagesAsLinks)); }
        break;
      case "feedback":
        blocks.push(h2("의뢰인 평가 (원문)"), { object: "block", type: "quote", quote: { rich_text: rt(b.review.comment) } },
          para(`만족도 ${b.review.satisfaction}/5 · 기한 ${b.review.deadline}/5 · 소통 ${b.review.communication}/5 · 인계 ${b.review.handoff}/5`, { color: "gray" }));
        break;
      case "tools":
        blocks.push(h2("사용 도구와 이유"), ...b.tools.map((t) => bullet(t.why || "", t.name)));
        if (b.skills.length) blocks.push(para(`역량: ${b.skills.join(" · ")}`));
        break;
      case "outcomes":
        blocks.push(h2("성과"), ...b.lines.map((l) => bullet(l.text)));
        break;
      case "verification": {
        blocks.push(h2("의뢰인 검증"));
        if (!b.verification) { blocks.push(para("의뢰인 검증 전입니다.")); break; }
        for (const k of CLAIM_KEYS) blocks.push({ object: "block", type: "to_do", to_do: { rich_text: rt(CLAIM_LABEL[k]), checked: !!b.verification[k] } });
        blocks.push({ object: "block", type: "to_do", to_do: { rich_text: rt(b.outcomeTotal ? `성과 수치 확인 ${b.outcomeVerified}/${b.outcomeTotal}` : "성과 수치는 아직 확인되지 않음"), checked: b.outcomeTotal > 0 && b.outcomeVerified === b.outcomeTotal } });
        blocks.push(para(`의뢰인이 제출 v${b.approvedVersion ?? "?"} 을 승인하며 확인한 항목입니다. (월계 재능나눔 · ${b.verification.createdAt.slice(0, 10)})`, { color: "gray" }));
        break;
      }
      case "evidenceList": {
        const rest = b.evidence.filter((e) => !shown.has(e.id));
        if (!rest.length) break;
        blocks.push(h2("증빙·링크"));
        for (const e of rest) blocks.push(...evidenceBlocks(e, failed, !!opts.imagesAsLinks));
        break;
      }
    }
  }
  return { blocks, failed };
}
