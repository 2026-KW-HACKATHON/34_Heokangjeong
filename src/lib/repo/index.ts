import type {
  ActivityLog, Application, ChatMessage, ChatRoom, Evidence, Notification, Outcome, PortfolioCard, PortfolioContent, PortfolioDoc, PortfolioDraft,
  PortfolioEditedVersion, Post, Project, ProjectAnswer, ProjectBundle, PublishedPortfolio, Review, SubmissionVersion, TeamPeerReview, TrustSummary, User, VerificationClaims,
} from "@/types";
import type { AnswerInput, EvidenceInput, OutcomeInput, ReviewInput } from "../workflow/engine";

export type { AnswerInput, EvidenceInput, OutcomeInput, ReviewInput };
export interface GenerateResult { draft: PortfolioDraft; reused: boolean; aiError?: string }
export interface UploadedFile { url: string; fileName: string; mimeType: string }

/**
 * 데이터 접근 계층(Repository). 화면은 이 인터페이스만 사용한다.
 * mock(메모리+localStorage) 과 Supabase 두 구현이 있고, 화면 코드는 둘을 구분하지 않는다.
 * actorId 는 mock 에서 권한 검사에 쓰고, Supabase 에서는 로그인 계정(auth.uid)이 대신한다.
 */
export interface Repo {
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  updatePortfolioProfile(studentId: string, data: { about: string; avatarUrl?: string }): Promise<void>;
  uploadPortfolioImage(studentId: string, file: File): Promise<string>;
  listPosts(): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(p: Omit<Post, "id" | "createdAt" | "status">): Promise<Post>;
  updatePostStatus(id: string, status: Post["status"]): Promise<void>;
  listApplications(postId?: string): Promise<Application[]>;
  apply(postId: string, studentId: string, message: string, roleId?: string): Promise<Application>;
  getApplication(id: string): Promise<Application | undefined>;
  updateApplicationStatus(id: string, status: Application["status"]): Promise<void>; // 공고 작성자의 거절 (수락은 selectApplicant)
  // 채팅: 지원서 하나가 채팅방 하나 (공고 작성자 ↔ 지원 학생)
  listChatRooms(userId: string): Promise<ChatRoom[]>;
  readChatMessageIds(userId: string, roomId: string): Promise<string[]>;
  markChatRead(userId: string, roomId: string, messageIds: string[]): Promise<void>;
  listMessages(applicationId: string): Promise<ChatMessage[]>;
  sendMessage(applicationId: string, senderId: string, body: string): Promise<ChatMessage>;
  onMessage(applicationId: string, cb: (m: ChatMessage) => void): () => void; // 새 메시지 구독, 반환값으로 해제
  listReviews(studentId?: string): Promise<Review[]>;
  listPortfolio(studentId: string): Promise<PortfolioCard[]>;
  listPublishedPortfolio(studentId: string): Promise<PublishedPortfolio[]>;
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
  trustSummary(studentId: string): Promise<TrustSummary>;
  /** mock 전용: 데모 데이터 초기화 */
  resetDemo?(): Promise<void>;
}

import { mockRepo } from "./mock";
import { supabaseRepo } from "./supabase";
import { supabase } from "../supabase";

// .env 에 Supabase 주소·키가 있으면 실제 DB, 비어 있으면 가짜 데이터(계정 전환으로 화면 확인)
export const repo: Repo = supabase ? supabaseRepo(supabase) : mockRepo; // ← 백엔드 교체 지점
