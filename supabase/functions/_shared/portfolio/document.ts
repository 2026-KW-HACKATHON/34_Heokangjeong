// 포트폴리오 문서 구조. 화면(포트폴리오 상세)과 Notion 저장이 같은 순서·같은 내용을 쓰도록 여기서 한 번만 정한다.
// 학생 편집본(content) + 잠긴 원본(의뢰인 검증·평가 원문·증빙·성과)을 분야 템플릿 순서대로 배치한다.
import { DOMAINS } from "./domains.ts";
import { outcomeLine } from "./narrative.ts";
import type { ClaimKey, ClientReview, ClientVerification, DomainKey, Evidence, Outcome, PortfolioContent, PortfolioSection } from "./types.ts";

export const CLAIM_LABEL: Record<ClaimKey, string> = {
  workPerformed: "학생이 실제로 작업함",
  roleConfirmed: "기록된 역할이 맞음",
  deliverableReceived: "결과물을 전달받음",
  completionCriteriaMet: "완료 기준을 충족함",
  actuallyUsed: "실제로 사용되고 있음",
};
export const CLAIM_KEYS = Object.keys(CLAIM_LABEL) as ClaimKey[];

export const EVIDENCE_LABEL: Record<Evidence["type"], string> = {
  BEFORE_IMAGE: "Before 이미지", AFTER_IMAGE: "After 이미지", DELIVERABLE_FILE: "결과물 파일", DELIVERABLE_URL: "결과물 링크", PROCESS_IMAGE: "과정 이미지",
  DOCUMENT: "문서", VIDEO: "영상", TEST_RECORD: "테스트 기록", METRIC: "측정 자료", CLIENT_FEEDBACK: "의뢰인 피드백", USAGE_PROOF: "사용 증빙",
};

export interface DocInput {
  domain: DomainKey;
  content: PortfolioContent;
  info: { period: string; roleLabel: string; clientName: string; clientType: string; approvedVersion: number | null };
  verification: ClientVerification | null;
  review: ClientReview | null;
  evidence: Evidence[];
  outcomes: Outcome[];
}
export type DocBlock =
  | { kind: "info"; rows: [string, string][] }
  | { kind: "section"; section: PortfolioSection; evidence: Evidence[] }
  | { kind: "feedback"; review: ClientReview }
  | { kind: "tools"; tools: PortfolioContent["tools"]; skills: string[] }
  | { kind: "outcomes"; lines: { text: string; verified: boolean; measured: boolean }[] }
  | { kind: "verification"; verification: ClientVerification | null; outcomeVerified: number; outcomeTotal: number; approvedVersion: number | null }
  | { kind: "evidenceList"; evidence: Evidence[] };

export function buildDocument(i: DocInput): DocBlock[] {
  const blocks: DocBlock[] = [];
  const byId = new Map(i.evidence.map((e) => [e.id, e]));
  blocks.push({ kind: "info", rows: [
    ["기간", i.info.period], ["분야", DOMAINS[i.domain].label], ["역할", i.info.roleLabel || "-"], ["의뢰인", `${i.info.clientName} (${i.info.clientType})`],
  ] });
  const used = new Set<string>();
  const section = (s: PortfolioSection) => {
    used.add(s.key);
    blocks.push({ kind: "section", section: s, evidence: s.evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => !!e) });
  };
  for (const def of DOMAINS[i.domain].sections) {
    if (def.locked === "clientFeedback") { if (i.review?.comment) blocks.push({ kind: "feedback", review: i.review }); continue; }
    const s = i.content.sections.find((x) => x.key === def.key);
    if (s && s.body.trim()) section({ ...s, title: def.title }); // 제목은 항상 현재 템플릿 기준 (옛 편집본의 영어 제목 대신)
  }
  for (const s of i.content.sections) if (!used.has(s.key) && s.body.trim()) section(s); // 템플릿 밖 섹션(예전 버전)도 잃지 않는다
  if (i.content.tools.length || i.content.skills.length) blocks.push({ kind: "tools", tools: i.content.tools, skills: i.content.skills });
  if (i.outcomes.length) blocks.push({ kind: "outcomes", lines: i.outcomes.map((o) => ({ text: outcomeLine(o), verified: o.verified, measured: o.measured })) });
  blocks.push({ kind: "verification", verification: i.verification, outcomeVerified: i.outcomes.filter((o) => o.verified).length, outcomeTotal: i.outcomes.filter((o) => o.measured).length, approvedVersion: i.info.approvedVersion });
  if (i.evidence.length) blocks.push({ kind: "evidenceList", evidence: i.evidence });
  return blocks;
}

export const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, ".") : "");
export const periodText = (start: string, end?: string | null) => `${fmtDate(start)} ~ ${end ? fmtDate(end) : "진행 중"}`;
