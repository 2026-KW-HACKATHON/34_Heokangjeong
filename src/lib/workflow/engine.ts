// 프로젝트 워크플로 엔진 (순수 로직). mock 저장소가 이 엔진으로 동작하고, 단위 테스트가 이 엔진을 검증한다.
// Supabase 에서는 같은 규칙을 DB 함수(supabase/migrations/0005_verified_portfolio.sql)가 서버에서 강제한다.
import type {
  ActivityLog, Application, Badge, ClientReview, ClientVerification, Evidence, EvidenceSource, EvidenceType, MemberVerification, Outcome, PortfolioCard,
  PortfolioContent, PortfolioDraft, PortfolioEditedVersion, PortfolioSourceSnapshot, Post, Project, ProjectAnswer, ProjectBundle,
  ProjectMember, Review, Stage, SubmissionVersion, TeamPeerReview, TierScoreEvent, User, VerificationClaims, AnswerStatus, AnswerOrigin, DraftGenerator, GuardReport, HandoverDoc, MaintainerTerm, MaintenanceTicket, Operations, Club, ClubMember, ProjectCancellation,
} from "@/types";
import { DOMAINS, QUESTION_SET_VERSION } from "@shared/portfolio/domains";
import { nextStatus, WorkflowError } from "@shared/portfolio/stateMachine";
import { sourceHash } from "@shared/portfolio/snapshot";
import { POINTS } from "@shared/portfolio/policy";
import { listingOf } from "../listing";
import { sourceFromBundle } from "../portfolio/source";
import { assessReview } from "@shared/portfolio/reputation";
export { roleLabelOf } from "../portfolio/source";

export { WorkflowError };

export interface WorkflowDB {
  users: User[];
  posts: Post[];
  applications: Application[];
  projects: Project[];
  members: ProjectMember[];
  answers: ProjectAnswer[];
  logs: ActivityLog[];
  evidence: Evidence[];
  versions: SubmissionVersion[];
  verifications: ClientVerification[];
  memberVerifications: MemberVerification[];
  reviews: ClientReview[];
  outcomes: Outcome[];
  snapshots: PortfolioSourceSnapshot[];
  drafts: PortfolioDraft[];
  edits: PortfolioEditedVersion[];
  tierEvents: TierScoreEvent[];
  badges: Badge[];
  cancellations: ProjectCancellation[];
  clubs: Club[];
  clubMembers: ClubMember[];
  operations: Operations[];
  terms: MaintainerTerm[];
  tickets: MaintenanceTicket[];
  handoverDocs: HandoverDoc[];
  peerReviews: TeamPeerReview[];
  legacyReviews: Review[];      // 예전 화면(랭킹·포트폴리오 카드)이 읽는 테이블
  legacyCards: PortfolioCard[];
}
export const emptyDB = (): WorkflowDB => ({
  users: [], posts: [], applications: [], projects: [], members: [], answers: [], logs: [], evidence: [], versions: [], verifications: [], memberVerifications: [],
  reviews: [], outcomes: [], snapshots: [], drafts: [], edits: [], tierEvents: [], badges: [], peerReviews: [], legacyReviews: [], legacyCards: [],
  cancellations: [], clubs: [], clubMembers: [], operations: [], terms: [], tickets: [], handoverDocs: [],
});
export interface Ctx { now: () => string; id: () => string }
export const defaultCtx: Ctx = {
  now: () => new Date().toISOString(),
  id: () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id${Date.now()}${Math.random().toString(36).slice(2, 8)}`),
};

const fail = (code: string, msg: string): never => { throw new WorkflowError(code, msg); };
const must = <T,>(v: T | undefined, what: string): T => v ?? fail("NOT_FOUND", `${what}을(를) 찾을 수 없어요`);

// ── 조회 ────────────────────────────────────────────────────────────────────
export function getProject(db: WorkflowDB, projectId: string) { return must(db.projects.find((p) => p.id === projectId), "프로젝트"); }
const isMember = (db: WorkflowDB, projectId: string, userId: string) => db.members.some((m) => m.projectId === projectId && m.studentId === userId);
function assertMember(db: WorkflowDB, projectId: string, actorId: string) {
  if (!isMember(db, projectId, actorId)) fail("FORBIDDEN", "선정된 학생만 할 수 있어요");
}
function assertOwner(db: WorkflowDB, project: Project, actorId: string) {
  if (project.ownerId !== actorId) fail("FORBIDDEN", "이 공고를 올린 의뢰인만 할 수 있어요");
}
export const verifiedCount = (db: WorkflowDB, studentId: string) => db.tierEvents.filter((e) => e.studentId === studentId && e.kind === "PROJECT_VERIFIED").length;

export function getBundle(db: WorkflowDB, projectId: string): ProjectBundle {
  const project = getProject(db, projectId);
  const by = <T extends { projectId: string }>(xs: T[]) => xs.filter((x) => x.projectId === projectId);
  return {
    project,
    post: must(db.posts.find((p) => p.id === project.postId), "공고"),
    members: by(db.members),
    answers: by(db.answers),
    logs: by(db.logs).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    evidence: by(db.evidence).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    versions: by(db.versions).sort((a, b) => a.version - b.version),
    verification: db.verifications.find((v) => v.projectId === projectId) ?? null,
    memberVerifications: by(db.memberVerifications),
    review: db.reviews.find((r) => r.projectId === projectId) ?? null,
    outcomes: by(db.outcomes),
    snapshots: by(db.snapshots),
    drafts: by(db.drafts).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    edits: by(db.edits).sort((a, b) => a.version - b.version),
    peerReviews: by(db.peerReviews),
  };
}

export function savePeerReview(db: WorkflowDB, a: { projectId: string; reviewerId: string; revieweeId: string; communication: number; collaboration: number; responsibility: number; comment: string }, ctx: Ctx = defaultCtx): TeamPeerReview {
  const project = getProject(db, a.projectId);
  if (project.mode !== "TEAM" || project.status !== "COMPLETED") fail("INVALID_STATE", "완료된 팀 프로젝트에서만 상호평가할 수 있어요");
  if (a.reviewerId === a.revieweeId) fail("SELF_REVIEW", "자신은 평가할 수 없어요");
  const verified = (studentId: string) => db.memberVerifications.some((v) => v.projectId === a.projectId && v.studentId === studentId && v.verified);
  if (!verified(a.reviewerId) || !verified(a.revieweeId)) fail("FORBIDDEN", "실제 참여가 확인된 팀원끼리만 평가할 수 있어요");
  const score = (value: number) => Number.isInteger(value) && value >= 1 && value <= 5 ? value : fail("INVALID_INPUT", "평가는 1점부터 5점까지 선택해 주세요");
  const previous = db.peerReviews.find((r) => r.projectId === a.projectId && r.reviewerId === a.reviewerId && r.revieweeId === a.revieweeId);
  const review: TeamPeerReview = { id: previous?.id ?? ctx.id(), projectId: a.projectId, reviewerId: a.reviewerId, revieweeId: a.revieweeId, communication: score(a.communication), collaboration: score(a.collaboration), responsibility: score(a.responsibility), comment: a.comment.trim().slice(0, 1000), createdAt: previous?.createdAt ?? ctx.now() };
  if (previous) Object.assign(previous, review); else db.peerReviews.push(review);
  return review;
}

// ── 지원 ────────────────────────────────────────────────────────────────────
export function apply(db: WorkflowDB, a: { postId: string; studentId: string; message: string; roleId?: string; clubId?: string }, ctx: Ctx = defaultCtx): Application {
  const post = must(db.posts.find((p) => p.id === a.postId), "공고");
  const student = db.users.find((u) => u.id === a.studentId);
  if (student?.role !== "student") fail("FORBIDDEN", "학생만 지원할 수 있어요");
  if (!(post.status === "open" || (post.isTeam && post.status === "in_progress"))) fail("INVALID_STATE", "모집이 끝난 공고예요"); // 팀 공고는 진행 중에도 추가 모집
  if (db.applications.some((x) => x.postId === a.postId && x.studentId === a.studentId)) fail("DUPLICATE", "이미 지원했어요");
  const role = post.teamSlots?.find((slot) => slot.id === a.roleId);
  if (post.isTeam && !role) fail("ROLE_REQUIRED", "지원할 역할을 선택해 주세요");
  if (!post.isTeam && a.roleId) fail("INVALID_ROLE", "개인 프로젝트에는 역할을 선택할 수 없어요");
  // 지원 대상 (개인만 / 단체만)
  const scope = post.applicantScope ?? "ANY";
  if (scope === "CLUB" && !a.clubId) fail("CLUB_ONLY", "단체 이름으로만 지원할 수 있는 공고예요");
  if (scope === "INDIVIDUAL" && a.clubId) fail("INDIVIDUAL_ONLY", "개인으로만 지원할 수 있는 공고예요");
  const app: Application = { id: ctx.id(), postId: a.postId, studentId: a.studentId, message: a.message, roleId: a.roleId, status: "pending", createdAt: ctx.now() };
  db.applications.push(app);
  return app;
}

/** 점주가 학생을 선정 → 프로젝트 생성(또는 팀원 추가), 질문 목록을 이 시점 버전으로 고정 */
export function selectApplicant(db: WorkflowDB, a: { applicationId: string; actorId: string }, ctx: Ctx = defaultCtx): Project {
  const app = must(db.applications.find((x) => x.id === a.applicationId), "지원서");
  const post = must(db.posts.find((p) => p.id === app.postId), "공고");
  if (post.authorId !== a.actorId) fail("FORBIDDEN", "이 공고를 올린 의뢰인만 선정할 수 있어요");
  if (app.status === "rejected") fail("INVALID_STATE", "거절한 지원서예요");
  const listing = listingOf(post);
  const role = post.isTeam ? post.teamSlots?.find((slot) => slot.id === app.roleId) : undefined;
  if (post.isTeam && !role) fail("INVALID_ROLE", "지원 역할을 찾을 수 없어요");
  let project = db.projects.find((p) => p.postId === post.id);
  if (project && isMember(db, project.id, app.studentId)) return project; // 이미 선정됨 (중복 클릭)
  const now = ctx.now();
  if (!project) {
    project = {
      id: ctx.id(), postId: post.id, ownerId: post.authorId, domain: listing.domain, mode: listing.projectMode, status: "RECRUITING",
      questionSnapshot: { domain: listing.domain, version: QUESTION_SET_VERSION, questions: DOMAINS[listing.domain].questions, takenAt: now },
      createdAt: now,
    };
    db.projects.push(project);
  }
  if (role && db.members.filter((m) => m.projectId === project!.id && m.roleId === role.id).length >= role.count)
    fail("ROLE_FULL", "이 역할의 모집 인원이 이미 찼어요");
  project.status = nextStatus(project.status, "SELECT", project.mode);
  if (project.status === "IN_PROGRESS" && !project.startedAt) project.startedAt = now;
  const memberDomain = role?.domain ?? listing.domain;
  db.members.push({
    projectId: project.id, studentId: app.studentId, roleId: role?.id,
    roleLabel: role?.label ?? role?.category ?? DOMAINS[project.domain].label,
    domain: memberDomain,
    questionSnapshot: { domain: memberDomain, version: QUESTION_SET_VERSION, questions: DOMAINS[memberDomain].questions, takenAt: now },
    isLead: false, applicationId: app.id, joinedAt: now,
  });
  if (role) { role.filled.push(app.studentId); role.filledCount = role.filled.length; }
  app.status = "accepted";
  if (!post.isTeam) {
    post.status = "in_progress";
    db.applications
      .filter((candidate) => candidate.postId === post.id && candidate.id !== app.id && candidate.status === "pending")
      .forEach((candidate) => { candidate.status = "rejected"; });
  }
  return project;
}

export function startTeamProject(db: WorkflowDB, a: { projectId: string; actorId: string; leaderId: string }, ctx: Ctx = defaultCtx): Project {
  const project = getProject(db, a.projectId);
  assertOwner(db, project, a.actorId);
  if (project.mode !== "TEAM") fail("INVALID_STATE", "팀 프로젝트가 아니에요");
  const post = must(db.posts.find((p) => p.id === project.postId), "공고");
  const members = db.members.filter((m) => m.projectId === project.id);
  const missing = (post.teamSlots ?? []).filter((slot) => members.filter((m) => m.roleId === slot.id).length < slot.count);
  if (missing.length) fail("TEAM_INCOMPLETE", `아직 인원이 부족한 역할이 있어요: ${missing.map((s) => s.label ?? s.category).join(", ")}`);
  if (!members.some((m) => m.studentId === a.leaderId)) fail("INVALID_LEADER", "선발된 팀원 중에서 팀장을 선택해 주세요");
  project.status = nextStatus(project.status, "START", project.mode);
  project.startedAt ??= ctx.now();
  members.forEach((m) => { m.isLead = m.studentId === a.leaderId; });
  post.status = "in_progress";
  return project;
}

// ── 활동 기록 ────────────────────────────────────────────────────────────────
export interface AnswerInput {
  projectId: string; actorId: string; questionId: string; status: AnswerStatus; value?: string; choices?: string[];
  origin?: AnswerOrigin; parentQuestionId?: string; prompt?: string;
}
export function saveAnswer(db: WorkflowDB, a: AnswerInput, ctx: Ctx = defaultCtx): ProjectAnswer {
  const project = getProject(db, a.projectId);
  assertMember(db, project.id, a.actorId);
  const member = must(db.members.find((m) => m.projectId === project.id && m.studentId === a.actorId), "팀원");
  const questionSnapshot = member.questionSnapshot ?? project.questionSnapshot;
  const origin = a.origin ?? "SCHEMA";
  const qid = origin === "SCHEMA" ? a.questionId : a.parentQuestionId;
  const q = questionSnapshot.questions.find((x) => x.id === qid) ?? fail("NOT_FOUND", "내 역할에 해당하는 질문을 찾을 수 없어요");
  if (origin !== "SCHEMA" && !a.questionId.startsWith(`${q.id}:fu`)) fail("INVALID_INPUT", "후속 질문 id 형식이 잘못됐어요");
  const value = (a.value ?? "").slice(0, 4000);
  const choices = (a.choices ?? []).slice(0, 20);
  // 내용 없이 ANSWERED 로 저장하면 미답으로 본다 (건너뜀·해당 없음은 값을 비운다)
  const status: AnswerStatus = a.status === "ANSWERED" && !value.trim() && choices.length === 0 ? "UNANSWERED" : a.status;
  const keep = status === "ANSWERED" || status === "UNANSWERED";
  const row: ProjectAnswer = {
    projectId: project.id, authorId: a.actorId, questionId: a.questionId, field: q.field, stage: q.stage, status,
    value: keep ? value : "", choices: keep ? choices : [], origin, parentQuestionId: origin === "SCHEMA" ? undefined : q.id,
    prompt: origin === "SCHEMA" ? undefined : a.prompt, updatedAt: ctx.now(),
  };
  const i = db.answers.findIndex((x) => x.projectId === project.id && x.authorId === a.actorId && x.questionId === a.questionId);
  if (i >= 0) db.answers[i] = row; else db.answers.push(row);
  return row;
}

export function addLog(db: WorkflowDB, a: { projectId: string; actorId: string; stage: Stage; note: string }, ctx: Ctx = defaultCtx): ActivityLog {
  assertMember(db, getProject(db, a.projectId).id, a.actorId);
  if (!a.note.trim()) fail("INVALID_INPUT", "기록할 내용을 적어 주세요");
  const log: ActivityLog = { id: ctx.id(), projectId: a.projectId, authorId: a.actorId, stage: a.stage, note: a.note.trim().slice(0, 2000), createdAt: ctx.now() };
  db.logs.push(log);
  return log;
}

export interface EvidenceInput {
  projectId: string; actorId: string; type: EvidenceType; description: string; url?: string; fileName?: string; mimeType?: string;
  linkedField?: string; linkedClaim?: string; source?: EvidenceSource;
}
export function addEvidence(db: WorkflowDB, a: EvidenceInput, ctx: Ctx = defaultCtx): Evidence {
  const project = getProject(db, a.projectId);
  const client = project.ownerId === a.actorId;
  if (!client) assertMember(db, project.id, a.actorId);
  if (a.url && !/^(https?:|data:)/.test(a.url)) fail("INVALID_INPUT", "http(s) 주소나 업로드한 파일만 증빙으로 쓸 수 있어요");
  if (!a.url && !a.description.trim()) fail("INVALID_INPUT", "파일·링크 또는 설명 중 하나는 있어야 해요");
  const ev: Evidence = {
    id: ctx.id(), projectId: project.id, authorId: a.actorId, type: a.type, description: a.description.trim().slice(0, 1000), url: a.url,
    fileName: a.fileName, mimeType: a.mimeType, linkedField: a.linkedField || undefined, linkedClaim: a.linkedClaim || undefined,
    source: client ? "CLIENT" : a.source ?? (a.url ? (a.url.startsWith("data:") ? "STUDENT_UPLOAD" : "STUDENT_LINK") : "STUDENT_NOTE"),
    createdAt: ctx.now(),
  };
  db.evidence.push(ev);
  return ev;
}

// ── 제출·검토 ────────────────────────────────────────────────────────────────
const latestVersion = (db: WorkflowDB, projectId: string) => db.versions.filter((v) => v.projectId === projectId).sort((a, b) => b.version - a.version)[0];

export function submitVersion(db: WorkflowDB, a: { projectId: string; actorId: string; note: string; evidenceIds: string[] }, ctx: Ctx = defaultCtx): SubmissionVersion {
  const project = getProject(db, a.projectId);
  assertMember(db, project.id, a.actorId);
  if (project.mode === "TEAM" && !db.members.some((m) => m.projectId === project.id && m.studentId === a.actorId && m.isLead))
    fail("LEADER_ONLY", "팀장만 팀의 최종 결과물을 제출할 수 있어요");
  const event = project.status === "REVISION_REQUESTED" ? "RESUBMIT" : "SUBMIT";
  const next = nextStatus(project.status, event, project.mode);
  const ids = [...new Set(a.evidenceIds)];
  if (ids.length === 0) fail("INVALID_INPUT", "제출할 결과물 증빙을 하나 이상 골라 주세요");
  if (ids.some((id) => !db.evidence.some((e) => e.id === id && e.projectId === project.id))) fail("INVALID_INPUT", "이 프로젝트의 증빙만 제출할 수 있어요");
  const v: SubmissionVersion = {
    id: ctx.id(), projectId: project.id, version: (latestVersion(db, project.id)?.version ?? 0) + 1, note: a.note.trim().slice(0, 2000),
    evidenceIds: ids, status: "PENDING", submittedBy: a.actorId, createdAt: ctx.now(),
  };
  db.versions.push(v);
  project.status = next;
  return v;
}

/** 점주가 검토할 수 있는 버전인지: 최신 버전이고 검토 대기 중이어야 한다 (이전 버전 승인 방지) */
function reviewable(db: WorkflowDB, versionId: string, actorId: string) {
  const v = must(db.versions.find((x) => x.id === versionId), "제출 버전");
  const project = getProject(db, v.projectId);
  assertOwner(db, project, actorId);
  if (project.status === "COMPLETED") fail("ALREADY_APPROVED", "이미 승인된 프로젝트예요");
  if (latestVersion(db, project.id)?.id !== v.id) fail("STALE_VERSION", `v${v.version} 은 최신 제출이 아니에요. 최신 버전을 검토해 주세요`);
  if (v.status !== "PENDING") fail("INVALID_STATE", "검토 대기 중인 제출이 아니에요");
  return { v, project };
}

export function requestRevision(db: WorkflowDB, a: { versionId: string; actorId: string; comment: string }, ctx: Ctx = defaultCtx): SubmissionVersion {
  const { v, project } = reviewable(db, a.versionId, a.actorId);
  if (!a.comment.trim()) fail("INVALID_INPUT", "무엇을 보완하면 좋을지 적어 주세요");
  const used = db.versions.filter((x) => x.projectId === project.id && x.status === "REVISION_REQUESTED").length;
  const limit = listingOf(must(db.posts.find((p) => p.id === project.postId), "공고")).revisionLimit;
  if (used >= limit) fail("REVISION_LIMIT", `보완 요청은 ${limit}번까지 할 수 있어요`);
  project.status = nextStatus(project.status, "REQUEST_REVISION", project.mode);
  Object.assign(v, { status: "REVISION_REQUESTED", reviewComment: a.comment.trim(), reviewedAt: ctx.now(), reviewedBy: a.actorId });
  return v;
}

export interface ReviewInput { satisfaction: number; deadline: number; communication: number; handoff: number; deliverableQuality: number; comment: string }
const rating = (n: number, what: string) => (Number.isInteger(n) && n >= 1 && n <= 5 ? n : fail("INVALID_INPUT", `${what}은(는) 1~5 로 골라 주세요`));

/** 승인 = 제출 버전 승인 + Claim 단위 검증 + 평가를 한 번에 (원자적으로) 기록 */
export function approveVersion(db: WorkflowDB, a: { versionId: string; actorId: string; claims: VerificationClaims; note?: string; review: ReviewInput; verifiedMemberIds?: string[] }, ctx: Ctx = defaultCtx) {
  const { v, project } = reviewable(db, a.versionId, a.actorId);
  if (!a.claims.workPerformed) fail("INVALID_INPUT", "학생이 실제로 작업했음을 확인해야 승인할 수 있어요");
  const r = a.review;
  const values = { satisfaction: rating(r.satisfaction, "만족도"), deadline: rating(r.deadline, "기한 준수"), communication: rating(r.communication, "소통"), handoff: rating(r.handoff, "인계"), deliverableQuality: rating(r.deliverableQuality, "결과물 품질") };
  const deadline = listingOf(must(db.posts.find((p) => p.id === project.postId), "공고")).deadline;
  const evidence = { submissionExists: true, approvedSubmissionVersion: true, deadlineMet: deadline ? ctx.now().slice(0, 10) <= deadline : null, revisionCount: db.versions.filter(v => v.projectId === project.id && v.status === "REVISION_REQUESTED").length, handoverCompleted: !!a.claims.deliverableReceived, deliverableReceived: !!a.claims.deliverableReceived, completionCriteriaMet: !!a.claims.completionCriteriaMet, actuallyUsed: !!a.claims.actuallyUsed };
  const assessment = assessReview(values, a.actorId, evidence, db.reviews.map(row => ({ reviewerId: row.reviewerId, values: [row.satisfaction, row.deadline, row.communication, row.handoff, row.deliverableQuality], status: row.status, evidenceConsistency: row.evidenceConsistency, reviewerReliability: row.reviewerReliability })));
  const review: ClientReview = { projectId: project.id, reviewerId: a.actorId, ...values, comment: r.comment.trim().slice(0, 1000), createdAt: ctx.now(), ...assessment };
  const status = nextStatus(project.status, "APPROVE", project.mode);
  const now = ctx.now();
  Object.assign(v, { status: "APPROVED", reviewedAt: now, reviewedBy: a.actorId });
  Object.assign(project, { status, approvedVersionId: v.id, completedAt: now });
  const verification: ClientVerification = {
    projectId: project.id, submissionVersionId: v.id, verifierId: a.actorId, note: (a.note ?? "").trim(), createdAt: now,
    workPerformed: !!a.claims.workPerformed, roleConfirmed: !!a.claims.roleConfirmed, deliverableReceived: !!a.claims.deliverableReceived,
    completionCriteriaMet: !!a.claims.completionCriteriaMet, actuallyUsed: !!a.claims.actuallyUsed,
  };
  db.verifications.push(verification);
  db.reviews.push(review);
  const post = must(db.posts.find((p) => p.id === project.postId), "공고");
  post.status = "done";
  const members = db.members.filter((x) => x.projectId === project.id);
  // 계속 운영되는 결과물(웹사이트 등)이면 완료와 동시에 운영·보증이 시작된다 (DB 0018 의 start_operations 와 같은 규칙)
  if (post.ongoing && !db.operations.some((o) => o.projectId === project.id)) {
    const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const maintainer = members[0]?.studentId;
    // 단체 이름으로 지원했으면 그 단체가 운영을 맡는다 (DB 0022 와 같은 규칙)
    const clubId = members.map((m) => db.applications.find((a) => a.id === m.applicationId)?.clubId).find(Boolean);
    db.operations.push({
      projectId: project.id, status: "WARRANTY", maintainerId: maintainer, clubId, adminHanded: false, requestUsed: 0,
      warrantyRequestUntil: day(post.warrantyRequestDays ?? 30), warrantyDefectUntil: day(post.warrantyDefectDays ?? 90),
    });
    if (maintainer) db.terms.push({ id: ctx.id(), projectId: project.id, studentId: maintainer, startedOn: now.slice(0, 10), ticketsClosed: 0 });
  }
  const verifiedIds = project.mode === "TEAM" ? new Set(a.verifiedMemberIds ?? []) : new Set(members.map((m) => m.studentId));
  if (verifiedIds.size === 0) fail("INVALID_INPUT", "실제 참여를 확인한 팀원을 한 명 이상 선택해 주세요");
  for (const m of members) {
    const verified = verifiedIds.has(m.studentId);
    db.memberVerifications.push({ projectId: project.id, studentId: m.studentId, verifierId: a.actorId, verified, note: verified ? "실제 참여 확인" : "참여 확인 안 됨", createdAt: now });
    if (!verified) continue;
    const hadVerified = verifiedCount(db, m.studentId) > 0;
    grantPoints(db, { studentId: m.studentId, projectId: project.id, kind: "PROJECT_VERIFIED", points: POINTS.projectVerified(post.difficulty) }, ctx);
    if (verification.actuallyUsed) grantPoints(db, { studentId: m.studentId, projectId: project.id, kind: "CLIENT_USED", points: POINTS.clientUsed }, ctx);
    if (!hadVerified) grantBadge(db, { studentId: m.studentId, code: "FIRST_VERIFIED", label: "첫 검증 프로젝트", projectId: project.id }, ctx);
    if (verification.actuallyUsed) grantBadge(db, { studentId: m.studentId, code: "USED_IN_FIELD", label: "현장에서 쓰인 결과물", projectId: project.id }, ctx);
    const memberDomain = m.domain ?? project.domain;
    grantBadge(db, { studentId: m.studentId, code: `DOMAIN_${memberDomain}`, label: `${DOMAINS[memberDomain].label} 검증 경험`, projectId: project.id }, ctx);
    // 예전 화면(랭킹·카드)이 읽는 기록도 남긴다
    if (!db.legacyReviews.some((x) => x.postId === post.id && x.studentId === m.studentId))
      db.legacyReviews.push({ postId: post.id, studentId: m.studentId, rating: review.satisfaction as Review["rating"], comment: review.comment, verified: true });
    if (!db.legacyCards.some((x) => x.postId === post.id && x.studentId === m.studentId))
      db.legacyCards.push({ id: ctx.id(), studentId: m.studentId, postId: post.id, title: post.title, roleLabel: m.roleLabel, tasks: [], durationDays: post.durationDays, rating: review.satisfaction, verified: true });
  }
  return { version: v, verification, review };
}
/** 점수는 (학생, 프로젝트, 종류) 당 한 번만 — 중복 승인·재시도에도 중복 지급 없음 */
function grantPoints(db: WorkflowDB, e: Omit<TierScoreEvent, "id" | "createdAt">, ctx: Ctx) {
  if (db.tierEvents.some((x) => x.studentId === e.studentId && x.projectId === e.projectId && x.kind === e.kind)) return;
  db.tierEvents.push({ ...e, id: ctx.id(), createdAt: ctx.now() });
}
function grantBadge(db: WorkflowDB, b: Omit<Badge, "createdAt">, ctx: Ctx) {
  if (db.badges.some((x) => x.studentId === b.studentId && x.code === b.code)) return;
  db.badges.push({ ...b, createdAt: ctx.now() });
}

// ── 성과 ────────────────────────────────────────────────────────────────────
export type OutcomeInput = Omit<Outcome, "id" | "verified" | "verifiedBy" | "verifiedAt" | "createdAt" | "authorId"> & { actorId: string };
export function addOutcome(db: WorkflowDB, a: OutcomeInput, ctx: Ctx = defaultCtx): Outcome {
  assertMember(db, getProject(db, a.projectId).id, a.actorId);
  if (!a.metricName.trim()) fail("INVALID_INPUT", "무엇을 쟀는지(지표 이름)를 적어 주세요");
  if (a.measured && (a.value === null || !Number.isFinite(a.value))) fail("INVALID_INPUT", "측정한 값을 숫자로 적어 주세요. 측정하지 않았다면 '미측정'을 골라 주세요");
  if (a.evidenceId && !db.evidence.some((e) => e.id === a.evidenceId && e.projectId === a.projectId)) fail("INVALID_INPUT", "이 프로젝트의 증빙만 연결할 수 있어요");
  const { actorId, ...rest } = a;
  const o: Outcome = { ...rest, value: a.measured ? a.value : null, baseline: a.baseline ?? null, authorId: actorId, verified: false, id: ctx.id(), createdAt: ctx.now() };
  db.outcomes.push(o);
  return o;
}
export function verifyOutcome(db: WorkflowDB, a: { outcomeId: string; actorId: string }, ctx: Ctx = defaultCtx): Outcome {
  const o = must(db.outcomes.find((x) => x.id === a.outcomeId), "성과");
  assertOwner(db, getProject(db, o.projectId), a.actorId);
  if (!o.measured) fail("INVALID_STATE", "측정되지 않은 성과는 확인할 수 없어요");
  Object.assign(o, { verified: true, verifiedBy: a.actorId, verifiedAt: ctx.now() });
  return o;
}

// ── 포트폴리오: 스냅샷 → 초안 → 학생 편집본 ────────────────────────────────────
export function createSnapshot(db: WorkflowDB, a: { projectId: string; actorId: string }, ctx: Ctx = defaultCtx): PortfolioSourceSnapshot {
  const b = getBundle(db, a.projectId);
  assertMember(db, b.project.id, a.actorId);
  if (b.project.status !== "COMPLETED") fail("INVALID_STATE", "의뢰인 승인·검증이 끝난 뒤에 포트폴리오를 만들 수 있어요");
  if (b.project.mode === "TEAM" && !b.memberVerifications.some((v) => v.studentId === a.actorId && v.verified))
    fail("NOT_VERIFIED", "의뢰인이 실제 참여를 확인한 팀원만 포트폴리오를 만들 수 있어요");
  const data = sourceFromBundle(b, db.users.find((u) => u.id === b.project.ownerId), db.users.find((u) => u.id === a.actorId), a.actorId, ctx.now());
  const hash = sourceHash(data);
  const existing = db.snapshots.find((s) => s.projectId === a.projectId && s.studentId === a.actorId && s.hash === hash);
  if (existing) return existing;
  const snap: PortfolioSourceSnapshot = { id: ctx.id(), projectId: a.projectId, studentId: a.actorId, hash, data, createdAt: ctx.now() };
  db.snapshots.push(snap);
  return snap;
}
/** 초안 저장. 같은 스냅샷에서 이미 초안이 있으면 그대로 돌려준다(중복 생성 방지). regenerate 면 새 초안 */
export function addDraft(db: WorkflowDB, a: { snapshotId: string; actorId: string; generator: DraftGenerator; model?: string; content: PortfolioContent; guardReport?: GuardReport; regenerate?: boolean }, ctx: Ctx = defaultCtx) {
  const snap = must(db.snapshots.find((s) => s.id === a.snapshotId), "스냅샷");
  if (snap.studentId !== a.actorId) fail("FORBIDDEN", "본인 포트폴리오만 만들 수 있어요");
  const prev = db.drafts.filter((d) => d.snapshotId === snap.id).at(-1);
  if (prev && !a.regenerate) return { draft: prev, reused: true };
  const draft: PortfolioDraft = { id: ctx.id(), snapshotId: snap.id, projectId: snap.projectId, studentId: snap.studentId, generator: a.generator, model: a.model, content: a.content, guardReport: a.guardReport, createdAt: ctx.now() };
  db.drafts.push(draft);
  return { draft, reused: false };
}

/** 학생 편집본 저장: 항상 새 버전으로 쌓는다 (이전 편집본·초안은 덮어쓰지 않음) */
export function saveEdit(db: WorkflowDB, a: { draftId: string; actorId: string; content: PortfolioContent }, ctx: Ctx = defaultCtx): PortfolioEditedVersion {
  const d = must(db.drafts.find((x) => x.id === a.draftId), "초안");
  if (d.studentId !== a.actorId) fail("FORBIDDEN", "본인 포트폴리오만 고칠 수 있어요");
  const content = sanitizeContent(a.content);
  if (!content.title) fail("INVALID_INPUT", "제목을 적어 주세요");
  const version = Math.max(0, ...db.edits.filter((e) => e.projectId === d.projectId && e.studentId === a.actorId).map((e) => e.version)) + 1;
  const edit: PortfolioEditedVersion = { id: ctx.id(), draftId: d.id, projectId: d.projectId, studentId: a.actorId, version, content, createdAt: ctx.now() };
  db.edits.push(edit);
  return edit;
}
/** 학생이 편집할 수 있는 것은 본문뿐. 검증·평가·증빙 원본은 본문에 들어올 수 없다 */
export function sanitizeContent(c: PortfolioContent): PortfolioContent {
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  return {
    title: s(c.title, 120),
    summary: s(c.summary, 300),
    sections: (c.sections ?? []).slice(0, 20).map((x) => ({ key: s(x.key, 40), title: s(x.title, 60), body: s(x.body, 4000), evidenceIds: (x.evidenceIds ?? []).filter((i) => typeof i === "string").slice(0, 20) })).filter((x) => x.key),
    skills: (c.skills ?? []).map((x) => s(x, 30)).filter(Boolean).slice(0, 12),
    tools: (c.tools ?? []).map((t) => ({ name: s(t.name, 40), why: s(t.why, 300) })).filter((t) => t.name).slice(0, 12),
  };
}
