import type { PortfolioPage } from "../portfolio/page";
import type {
  ActivityLog, Application, ChatMessage, ChatRoom, Evidence, Notification, Outcome, PortfolioCard, PortfolioContent, PortfolioDoc, PortfolioDraft,
  Club, ClubInput, ClubMember, HandoverDoc, HandoverInput, MaintenanceTicket, Operations, OperationsBundle, PortfolioEditedVersion, Post, Project, ProjectAnswer, ProjectBundle, PublishedPortfolio, Review, SubmissionVersion, TeamPeerReview, TicketKind, ProjectCancellation, TrustSummary, User, VerificationClaims,
} from "@/types";
import type { AnswerInput, EvidenceInput, OutcomeInput, ReviewInput } from "../workflow/engine";
import type { AgreementTerms, WorkAgreement } from "../agreement";

export type { AnswerInput, EvidenceInput, OutcomeInput, ReviewInput };
export interface GenerateResult { draft: PortfolioDraft; reused: boolean; aiError?: string }
export interface UploadedFile { url: string; fileName: string; mimeType: string }
/** 관리자 화면 요약 */
export interface AdminOverview {
  pendingClubs: number; students: number; residents: number; posts: number; urgentOpen: number;
  operating: number; handoverOpen: number; warrantyEndingSoon: { projectId: string; title: string; until: string }[];
  downSites: { projectId: string; title: string }[]; openTickets: number;
}

/**
 * 데이터 접근 계층(Repository). 화면은 이 인터페이스만 사용한다.
 * mock(메모리+localStorage) 과 Supabase 두 구현이 있고, 화면 코드는 둘을 구분하지 않는다.
 * actorId 는 mock 에서 권한 검사에 쓰고, Supabase 에서는 로그인 계정(auth.uid)이 대신한다.
 */
export interface Repo {
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  updatePortfolioProfile(studentId: string, data: { about: string; avatarUrl?: string; department?: string; nickname?: string; skills?: string[]; interests?: import("@/types").Category[] }): Promise<void>;
  uploadPortfolioImage(studentId: string, file: File): Promise<string>;
  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(p: Omit<Post, "id" | "createdAt" | "status">): Promise<Post>;
  updatePostStatus(id: string, status: Post["status"]): Promise<void>;
  deletePost(postId: string, actorId: string): Promise<void>;   // 작성자만, 선정 전에만
  // ── 합의 취소 (진행 중 프로젝트를 양쪽 합의로 끝낸다) ─────────────────────
  getCancellation(projectId: string): Promise<ProjectCancellation | null>;   // 가장 최근 요청 (기한 지난 건 거절로 정리된다)
  requestCancellation(projectId: string, reason: string, actorId: string): Promise<void>;
  respondCancellation(cancellationId: string, accept: boolean, actorId: string): Promise<void>;
  listApplications(postId?: string): Promise<Application[]>;
  apply(postId: string, studentId: string, message: string, roleId?: string, clubId?: string): Promise<Application>;
  getApplication(id: string): Promise<Application | undefined>;
  updateApplicationStatus(id: string, status: Application["status"]): Promise<void>; // 공고 작성자의 거절 (수락은 selectApplicant)
  // 채팅: 지원서 하나가 채팅방 하나 (공고 작성자 ↔ 지원 학생)
  listChatRooms(userId: string): Promise<ChatRoom[]>;
  getAgreement(applicationId: string, actorId: string): Promise<WorkAgreement | null>;
  saveAgreement(applicationId: string, actorId: string, expectedVersion: number, terms: AgreementTerms): Promise<WorkAgreement>;
  /** 양쪽이 확인하면 확정 = 선정 확정 (프로젝트가 만들어진다) */
  confirmAgreement(applicationId: string, actorId: string, version: number): Promise<WorkAgreement>;
  /** 확정 뒤 수정 제안 / 답하기 (수락 = 새 내용으로 다시 확정, 거절·철회 = 기존 유지) */
  proposeAgreementChange(applicationId: string, actorId: string, terms: AgreementTerms): Promise<WorkAgreement>;
  respondAgreementChange(applicationId: string, actorId: string, accept: boolean): Promise<WorkAgreement>;
  /** 사장님 '선정' = 매칭 대기 시작 (대화·계약서가 열린다). 개인 공고는 한 명씩 */
  shortlistApplicant(applicationId: string, actorId: string): Promise<void>;
  /** 선정 취소 (확정 전에만, 사장님·학생 모두) */
  cancelShortlist(applicationId: string, actorId: string): Promise<void>;
  readChatMessageIds(userId: string, roomId: string): Promise<string[]>;
  markChatRead(userId: string, roomId: string, messageIds: string[]): Promise<void>;
  listMessages(applicationId: string): Promise<ChatMessage[]>;
  sendMessage(applicationId: string, senderId: string, body: string): Promise<ChatMessage>;
  onMessage(applicationId: string, cb: (m: ChatMessage) => void): () => void; // 새 메시지 구독, 반환값으로 해제
  listReviews(studentId?: string): Promise<Review[]>;
  listPortfolio(studentId: string): Promise<PortfolioCard[]>;
  createPortfolioFeed(actorId: string, item: PublishedPortfolio): Promise<void>;
  updatePublishedPortfolio(actorId: string, item: PublishedPortfolio): Promise<void>;
  listPublishedPortfolio(studentId: string, includeHidden?: boolean): Promise<PublishedPortfolio[]>;
  publishPortfolio(studentId: string, sourceId: string, sourceKind: PublishedPortfolio["sourceKind"], coverUrl?: string): Promise<void>;
  unpublishPortfolio(studentId: string, sourceId: string, sourceKind: PublishedPortfolio["sourceKind"]): Promise<void>;
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  onNotification(userId: string, cb: (notification: Notification) => void): () => void;

  // ── 검증형 포트폴리오 파이프라인 ───────────────────────────────────────────
  /** 점주가 지원자를 선정 → 프로젝트 생성(또는 팀원 추가) */
  selectApplicant(applicationId: string, actorId: string): Promise<Project>;
  startTeamProject(projectId: string, actorId: string, leaderId: string): Promise<Project>;
  getProjectByPost(postId: string): Promise<Project | undefined>;
  /** 내가 학생으로 참여하거나 의뢰인인 프로젝트 */
  listMyProjects(userId: string): Promise<{ project: Project; post: Post }[]>;
  getBundle(projectId: string): Promise<ProjectBundle>;
  saveAnswer(a: AnswerInput): Promise<ProjectAnswer>;
  addLog(a: { projectId: string; actorId: string; stage: ActivityLog["stage"]; note: string }): Promise<ActivityLog>;
  /** 파일을 공개 URL 로 올린다 (Supabase Storage). mock 은 data: URL */
  uploadEvidenceFile(projectId: string, file: File, publicConsent?: boolean): Promise<UploadedFile>;
  addEvidence(a: EvidenceInput): Promise<Evidence>;
  submitVersion(a: { projectId: string; actorId: string; note: string; evidenceIds: string[] }): Promise<SubmissionVersion["id"]>;
  requestRevision(versionId: string, actorId: string, comment: string): Promise<void>;
  /** 승인 + Claim 단위 검증 + 평가를 한 번에 */
  approveVersion(a: { versionId: string; actorId: string; claims: VerificationClaims; note?: string; review: ReviewInput; verifiedMemberIds?: string[] }): Promise<void>;
  savePeerReview(a: { projectId: string; reviewerId: string; revieweeId: string; communication: number; collaboration: number; responsibility: number; comment: string }): Promise<TeamPeerReview>;
  addOutcome(a: OutcomeInput): Promise<Outcome>;
  verifyOutcome(outcomeId: string, actorId: string): Promise<void>;
  /** 스냅샷 → 초안. 같은 자료로는 기존 초안을 돌려준다(regenerate 면 새 초안). 학생 편집본은 건드리지 않는다 */
  generatePortfolio(projectId: string, actorId: string, opts?: { regenerate?: boolean }): Promise<GenerateResult>;
  savePortfolioEdit(draftId: string, actorId: string, content: PortfolioContent): Promise<PortfolioEditedVersion>;
  /** 학생의 프로젝트별 최신 편집본 */
  listPortfolioDocs(studentId: string): Promise<{ edit: PortfolioEditedVersion; post: Post; project: Project }[]>;
  getPortfolioDoc(projectId: string, studentId: string): Promise<PortfolioDoc | undefined>;
  /** 다른 사람의 공개 포트폴리오 한 건 (피드에 공개 중일 때만, 읽기 전용). 공개되지 않았으면 undefined */
  getPublicPortfolio(projectId: string, studentId: string): Promise<PortfolioPage | undefined>;
  trustSummary(studentId: string): Promise<TrustSummary>;

  // ── 유지보수·인수인계 (계속 운영되는 결과물) ──────────────────────────────
  getOperations(projectId: string): Promise<OperationsBundle | null>;
  saveHandover(projectId: string, actorId: string, data: HandoverInput): Promise<void>;
  generateHandoverDoc(projectId: string, actorId: string): Promise<HandoverDoc>;
  openHandover(projectId: string, actorId: string): Promise<void>;          // 담당 학생이 인계 요청
  takeOver(projectId: string, actorId: string): Promise<void>;              // 다른 학생이 이어받기
  listHandoverOpenings(): Promise<{ operations: Operations; post: Post; project: Project }[]>;
  createTicket(projectId: string, actorId: string, kind: TicketKind, body: string): Promise<MaintenanceTicket>;
  closeTicket(ticketId: string, actorId: string): Promise<void>;
  recordUptime(projectId: string, ok: boolean): Promise<void>;              // '지금 점검하기'
  // ── 단체(동아리·학회·학생회) ───────────────────────────────────────────────
  listClubs(): Promise<Club[]>;
  myClubs(studentId: string): Promise<{ club: Club; role: ClubMember["role"] }[]>;
  listClubMembers(clubId: string): Promise<ClubMember[]>;
  createClub(actorId: string, input: ClubInput): Promise<Club>;
  joinClub(clubId: string, actorId: string): Promise<void>;                  // 가입 신청 (대표 수락 필요)
  reviewMember(clubId: string, studentId: string, approve: boolean, actorId: string): Promise<void>;   // 대표의 수락·거절
  transferLeader(clubId: string, studentId: string, actorId: string): Promise<void>;                  // 대표 넘기기
  addClubWorker(projectId: string, studentId: string, roleLabel: string, actorId: string): Promise<void>; // 실제 작업한 부원 기록
  listClubProjects(clubId: string): Promise<{ project: Project; post: Post }[]>;                      // 단체 활동 기록
  leaveClub(clubId: string, actorId: string): Promise<void>;
  assignMaintainer(projectId: string, studentId: string, actorId: string): Promise<void>; // 단체 안에서 담당자 넘기기
  // ── 관리자 ────────────────────────────────────────────────────────────────
  listPendingClubs(): Promise<Club[]>;
  listClubsByStatus(status: Club["status"]): Promise<Club[]>;   // 관리자 심사 내역 (대기·승인·거절)
  reviewClub(clubId: string, approve: boolean, reason: string | undefined, actorId: string): Promise<void>;
  adminOverview(): Promise<AdminOverview>;
  listOperatingProjects(userId: string): Promise<{ operations: Operations; post: Post; project: Project }[]>;
  disputeReview(projectId: string, studentId: string, reason: string): Promise<void>;
  /** mock 전용: 데모 데이터 초기화 */
  resetDemo?(): Promise<void>;
}

import { mockRepo } from "./mock";
import { supabaseRepo } from "./supabase";
import { supabase } from "../supabase";

// .env 에 Supabase 주소·키가 있으면 실제 DB, 비어 있으면 가짜 데이터(계정 전환으로 화면 확인)
export const repo: Repo = supabase ? supabaseRepo(supabase) : mockRepo; // ← 백엔드 교체 지점
