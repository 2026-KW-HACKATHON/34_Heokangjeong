// 검증형 포트폴리오 파이프라인의 공통 타입.
// 앱(Next.js, `@shared/portfolio/types`)과 서버 함수(Deno, 상대 경로)가 함께 쓴다 → 순수 TS 만, 외부 import 금지.

export type DomainKey = "DESIGN" | "MARKETING" | "DEVELOPMENT" | "GENERAL";
export type Stage = "START" | "PROGRESS" | "FINISH";
export type AnswerStatus = "UNANSWERED" | "SKIPPED" | "NOT_APPLICABLE" | "ANSWERED";
export type AnswerOrigin = "SCHEMA" | "AI_FOLLOWUP" | "RULE_FOLLOWUP";

export type ProjectStatus = "RECRUITING" | "IN_PROGRESS" | "REVIEW_PENDING" | "REVISION_REQUESTED" | "COMPLETED";
export type ProjectEvent = "SELECT" | "SUBMIT" | "REQUEST_REVISION" | "RESUBMIT" | "APPROVE";

export type CompensationType = "VOLUNTEER" | "NON_MONETARY" | "PAID";
export type ProjectMode = "INDIVIDUAL" | "TEAM";

export type EvidenceType =
  | "BEFORE_IMAGE" | "AFTER_IMAGE" | "DELIVERABLE_FILE" | "DELIVERABLE_URL" | "PROCESS_IMAGE"
  | "DOCUMENT" | "VIDEO" | "TEST_RECORD" | "METRIC" | "CLIENT_FEEDBACK" | "USAGE_PROOF";
export type EvidenceSource = "STUDENT_UPLOAD" | "STUDENT_LINK" | "STUDENT_NOTE" | "CLIENT";

export type ReadinessLevel = "REQUIRED" | "RECOMMENDED" | "OPTIONAL";

/** 의뢰인이 확인하는 항목(Claim). 성과 수치는 Outcome.verified 로 따로 확인한다. */
export type ClaimKey = "workPerformed" | "roleConfirmed" | "deliverableReceived" | "completionCriteriaMet" | "actuallyUsed";
export type VerificationClaims = Record<ClaimKey, boolean>;

// ── 질문 정의 (Layer A: 스키마 고정 질문) ─────────────────────────────────────
export interface QuestionInput {
  kind: "choice" | "short" | "long" | "tools";
  options?: string[];        // choice / tools 의 선택지
  multi?: boolean;           // 여러 개 선택
  allowOther?: boolean;      // 선택지 + 직접 입력
  placeholder?: string;
}
export interface QuestionDefinition {
  id: string;                // 프로젝트 안에서 고유. 답변 키
  field: string;             // 연결된 데이터 필드 (도메인 모듈의 fields 중 하나)
  stage: Stage;
  title: string;             // 한 화면의 큰 질문
  help?: string;             // 짧은 설명
  input: QuestionInput;
  allowNA?: boolean;         // "해당 없음" 버튼 노출
  followUp?: {               // Layer B: 답이 짧거나 이유가 빠졌을 때만 후속 질문
    minChars?: number;       // 이보다 짧으면 후속 질문 후보
    askWhy?: boolean;        // 이유(왜)가 안 보이면 후속 질문 후보
    hints: string[];         // AI 가 없을 때 쓰는 규칙 기반 후속 질문
  };
}
/** 프로젝트 시작 시점의 질문 목록. 이후 설정이 바뀌어도 진행 중인 프로젝트는 이 목록을 쓴다. */
export interface ProjectQuestionSnapshot { domain: DomainKey; version: number; questions: QuestionDefinition[]; takenAt: string }

// ── 포트폴리오 템플릿 ─────────────────────────────────────────────────────────
/** 서사 구조에서 이 섹션이 맡는 역할: 문제 → 판단 → 실행 → 증빙 → 결과 → 회고 */
export type NarrativeRole = "overview" | "context" | "problem" | "decision" | "action" | "evidence" | "result" | "reflection";
export interface SectionDef {
  key: string;
  title: string;
  role: NarrativeRole;
  fields: string[];                  // 이 섹션의 재료가 되는 답변 필드
  evidenceTypes?: EvidenceType[];    // 이 섹션에 붙는 증빙 종류
  usesOutcomes?: boolean;            // 성과(Outcome)를 재료로 쓰는지
  usesUsageClaim?: boolean;          // 의뢰인의 "실제 사용" 확인을 재료로 쓰는지
  /** 학생·AI 가 쓰지 않고 원본 데이터를 그대로 보여 주는 섹션 (의뢰인 평가 원문 등) */
  locked?: "clientFeedback";
}
export type ReadinessCheck =
  | { kind: "field"; field: string }
  | { kind: "evidence"; types: EvidenceType[] }
  | { kind: "outcome" }
  | { kind: "any"; of: ReadinessCheck[] };
export interface ReadinessItemDef { key: string; label: string; level: ReadinessLevel; check: ReadinessCheck; questionId?: string }

export interface FieldDef { key: string; label: string; core?: CoreKey }
/** Common Core: 모든 분야가 공통으로 가지는 포트폴리오 구조 */
export type CoreKey = "problem" | "goal" | "role" | "process" | "deliverable" | "outcome" | "reflection" | "tools";

export interface DomainModule {
  key: DomainKey;
  label: string;
  fields: FieldDef[];
  questions: QuestionDefinition[];
  sections: SectionDef[];
  readiness: ReadinessItemDef[];
}

// ── 포트폴리오 원본 스냅샷 (AI 가 볼 수 있는 유일한 자료) ─────────────────────
export interface SourceField { field: string; label: string; question: string; answer: string; choices: string[]; followUps: { question: string; answer: string }[] }
export interface SourceEvidence { id: string; type: EvidenceType; description: string; url?: string; fileName?: string; linkedField?: string; linkedClaim?: string; source: EvidenceSource }
export interface SourceOutcome {
  id: string; metricName: string; measured: boolean; value: number | null; unit: string; baseline: number | null;
  measurementPeriod: string; source: string; evidenceId?: string; qualitativeDescription: string; verified: boolean;
}
export interface PortfolioSource {
  schema: 1;
  projectId: string;
  studentId: string;
  domain: DomainKey;
  builtAt: string;
  listing: {
    title: string; problem: string; category: string; expectedDeliverables: string[]; completionCriteria: string;
    clientName: string; clientType: string; compensationType: CompensationType; projectMode: ProjectMode;
  };
  period: { start: string; end: string | null };
  member: { name: string; department: string; roleLabel: string };
  fields: SourceField[];                                              // ANSWERED 만 들어간다
  omitted: { field: string; label: string; status: Exclude<AnswerStatus, "ANSWERED"> }[]; // AI 는 이 필드를 추측하면 안 된다
  activityLogs: { stage: Stage; note: string; at: string }[];
  evidence: SourceEvidence[];
  submission: { approvedVersion: number | null; versionCount: number; note: string };
  verification: (VerificationClaims & { verifiedAt: string; submissionVersionId: string }) | null;
  review: { satisfaction: number; deadline: number; communication: number; handoff: number; comment: string } | null;
  outcomes: SourceOutcome[];
}

// ── 포트폴리오 본문 ──────────────────────────────────────────────────────────
export interface PortfolioSection { key: string; title: string; body: string; evidenceIds: string[] }
export interface PortfolioContent {
  title: string;
  summary: string;
  sections: PortfolioSection[];
  skills: string[];
  tools: { name: string; why: string }[];
}
export type DraftGenerator = "AI" | "TEMPLATE";
export interface GuardReport {
  droppedSections: string[];
  droppedSentences: { section: string; sentence: string; reason: string }[];
  droppedTools: string[];
  droppedEvidenceIds: string[];
  filledFromTemplate: string[];
}

// ── 엔티티 (DB 행을 camelCase 로 옮긴 것) ─────────────────────────────────────
export interface Project {
  id: string;
  postId: string;
  ownerId: string;                       // 의뢰인(공고 작성자)
  domain: DomainKey;
  mode: ProjectMode;
  status: ProjectStatus;
  questionSnapshot: ProjectQuestionSnapshot;
  approvedVersionId?: string;            // 승인된 제출 버전 (정확한 id)
  createdAt: string;
  completedAt?: string;
}
export interface ProjectMember { projectId: string; studentId: string; roleLabel: string; applicationId?: string; joinedAt: string }
export interface ProjectAnswer {
  projectId: string;
  authorId: string;
  questionId: string;
  field: string;
  stage: Stage;
  status: AnswerStatus;
  value: string;
  choices: string[];
  origin: AnswerOrigin;
  parentQuestionId?: string;             // 후속 질문이면 원래 질문 id
  prompt?: string;                       // 후속 질문 문구 (스키마 질문은 정의에서 읽는다)
  updatedAt: string;
}
export interface ActivityLog { id: string; projectId: string; authorId: string; stage: Stage; note: string; createdAt: string }
export interface Evidence {
  id: string;
  projectId: string;
  authorId: string;
  type: EvidenceType;
  description: string;
  url?: string;                          // 공개 URL (Notion 에서도 열 수 있어야 한다). mock 에서는 data: URL 일 수 있다
  fileName?: string;
  mimeType?: string;
  linkedField?: string;                  // 어떤 답변 필드를 뒷받침하는지
  linkedClaim?: string;                  // 어떤 주장(문장)을 뒷받침하는지
  source: EvidenceSource;
  createdAt: string;
}
export type SubmissionStatus = "PENDING" | "REVISION_REQUESTED" | "APPROVED";
export interface SubmissionVersion {
  id: string;
  projectId: string;
  version: number;                       // 1, 2, 3 …
  note: string;
  evidenceIds: string[];                 // 이 버전에 포함된 결과물 증빙
  status: SubmissionStatus;
  submittedBy: string;
  createdAt: string;
  reviewComment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}
/** 제출 = 프로젝트의 버전 목록 (별도 테이블 없이 submission_versions 로 표현) */
export interface Submission { projectId: string; versions: SubmissionVersion[] }
export interface ClientVerification extends VerificationClaims { projectId: string; submissionVersionId: string; verifierId: string; note: string; createdAt: string }
export interface ClientReview { projectId: string; reviewerId: string; satisfaction: number; deadline: number; communication: number; handoff: number; comment: string; createdAt: string }
export interface Outcome {
  id: string;
  projectId: string;
  authorId: string;
  metricName: string;
  measured: boolean;                     // false = 미측정 (0 과 다르다)
  value: number | null;
  unit: string;
  baseline: number | null;
  measurementPeriod: string;
  source: string;
  evidenceId?: string;
  qualitativeDescription: string;
  verified: boolean;                     // 의뢰인이 수치를 확인했는지
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}
export interface PortfolioSourceSnapshot { id: string; projectId: string; studentId: string; hash: string; data: PortfolioSource; createdAt: string }
export interface PortfolioDraft {
  id: string; snapshotId: string; projectId: string; studentId: string;
  generator: DraftGenerator; model?: string; content: PortfolioContent; guardReport?: GuardReport; createdAt: string;
}
export interface PortfolioEditedVersion { id: string; draftId: string; projectId: string; studentId: string; version: number; content: PortfolioContent; createdAt: string }
export type TierEventKind = "PROJECT_VERIFIED" | "CLIENT_USED";
export interface TierScoreEvent { id: string; studentId: string; projectId: string; kind: TierEventKind; points: number; createdAt: string }
export interface Badge { studentId: string; code: string; label: string; projectId: string; createdAt: string }
export type NotionExportStatus = "PENDING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
export interface NotionExport {
  id: string; userId: string; portfolioVersionId: string; idempotencyKey: string; parentPageId?: string;
  notionPageId?: string; notionPageUrl?: string; status: NotionExportStatus;
  failedAttachments: { evidenceId: string; reason: string }[]; error?: string; createdAt: string;
}
