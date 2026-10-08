// 포트폴리오 페이지 한 장을 그리는 데 필요한 모든 것.
// 소유자는 프로젝트 묶음(bundle)에서, 다른 사람은 공개 함수(get_public_portfolio)에서 같은 모양으로 만든다.
// 템플릿은 이 데이터에서 나온 문서 블록만 받아 배치한다 → 어떤 템플릿이든 같은 내용을 담는다.
import { buildDocument, periodText, type DocBlock, type DocInput } from "@shared/portfolio/document";
import type { ClientReview, ClientVerification, DomainKey, Evidence, Outcome, PortfolioContent, PortfolioDraft, PortfolioEditedVersion, ProjectBundle, User } from "@/types";

export interface PortfolioPage {
  projectId: string;
  studentId: string;
  studentName?: string;
  edit: PortfolioEditedVersion;          // 학생 편집본 (글 + 고른 템플릿)
  domain: DomainKey;
  info: DocInput["info"];                // 기간·역할·의뢰인 (프로젝트 기록, 잠김)
  verification: ClientVerification | null;
  review: ClientReview | null;
  evidence: Evidence[];
  outcomes: Outcome[];
  /** 소유자만: 가장 최근 AI·템플릿 초안 (편집본보다 새로우면 "새 초안으로 다시 시작" 안내) */
  latestDraft?: PortfolioDraft;
}

const roleText = (a?: { value: string; choices: string[] }) => (a ? [...a.choices, a.value].filter(Boolean).join(", ") : "");

/** 소유자: 프로젝트 묶음에서 */
export function pageFromBundle(b: ProjectBundle, edit: PortfolioEditedVersion, studentId: string, users: User[]): PortfolioPage {
  // 이전 데모 저장본도 보기·디자인 선택·편집에서 같은 디자인을 사용한다.
  if (b.project.id === "demo-menu-2" && edit.version === 1 && edit.content.templateId === "editorial") {
    edit = { ...edit, content: { ...edit.content, templateId: "exhibition" } };
  }
  const client = users.find((u) => u.id === b.project.ownerId);
  const member = b.members.find((m) => m.studentId === studentId);
  const approved = b.versions.find((v) => v.id === b.project.approvedVersionId);
  const role = b.answers.find((a) => a.authorId === studentId && a.field === "role" && a.origin === "SCHEMA" && a.status === "ANSWERED");
  return {
    projectId: b.project.id, studentId, studentName: users.find(u => u.id === studentId)?.name, edit, domain: b.project.domain,   // 초안을 만든 분야와 같아야 섹션 순서가 맞는다
    info: {
      period: periodText(b.project.startedAt ?? b.project.createdAt, b.project.completedAt),
      roleLabel: roleText(role) || member?.roleLabel || "",
      clientName: client?.name ?? "의뢰인", clientType: client?.role === "resident" ? client.kind : "주민",
      approvedVersion: approved?.version ?? null,
    },
    verification: b.verification, review: b.review, evidence: b.evidence, outcomes: b.outcomes,
    latestDraft: b.drafts.filter((d) => d.studentId === studentId).at(-1),
  };
}

/** 페이지 → 문서 블록. 편집 중에는 고친 글(content)로 다시 만든다 */
export function pageBlocks(p: PortfolioPage, content: PortfolioContent = p.edit.content, editing = false): DocBlock[] {
  return buildDocument({ domain: p.domain, content, info: p.info, verification: p.verification, review: p.review, evidence: p.evidence, outcomes: p.outcomes, keepEmpty: editing });
}
