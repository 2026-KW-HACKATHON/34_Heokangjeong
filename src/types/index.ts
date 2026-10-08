// 도메인 타입 — 화면과 데이터 계층이 공유하는 계약. 백엔드를 붙일 때도 이 타입은 유지한다.
// 프로젝트·증빙·검증·포트폴리오 타입은 서버 함수와 함께 쓰려고 supabase/functions/_shared/portfolio/types.ts 에 있고 여기서 다시 내보낸다.
import type {
  ActivityLog, Badge, ClientReview, ClientVerification, CompensationType, DomainKey, Evidence, MemberVerification, Outcome, PortfolioDraft,
  PortfolioEditedVersion, PortfolioSourceSnapshot, Project, ProjectAnswer, ProjectMember, ProjectMode, SubmissionVersion, TierScoreEvent,
} from "@shared/portfolio/types";
export type * from "@shared/portfolio/types";
export type Role = "student" | "resident" | "admin";

export type Category =
  | "디자인" | "영상" | "사진" | "SNS홍보" | "웹/앱" | "디지털도움" | "기타";

export type PostStatus = "open" | "in_progress" | "done"; // 🔴 모집 중 / 🟡 진행 중 / 🟢 해결 완료

export interface GeoPoint { lat: number; lng: number }

export interface Student {
  id: string;
  role: "student";
  name: string;
  department: string;        // 학과
  skills: string[];          // 보유 기술
  interests: Category[];     // 관심 카테고리
  availableHours: string;    // 활동 가능 시간 (예: "평일 저녁, 주말")
  maxDistanceM: number;      // 활동 가능 거리(m)
  location: GeoPoint;        // 기준 위치(집/학교)
  school?: string;
  college?: string;          // 단과대학 key (src/lib/colleges.ts). 긴급 공고 알림 대상 선정에 쓴다
  age?: number;
  phone?: string;
  about?: string;
  avatarUrl?: string;
}

export interface Resident {
  id: string;
  role: "resident";
  name: string;              // 상호 또는 이름
  kind: "상인" | "주민";
  location: GeoPoint;
  address: string;
}

/** 앱 관리자 (단체 등록 심사 등). 화면은 /admin 하나만 쓴다 */
export interface Admin { id: string; role: "admin"; name: string; location: GeoPoint }

export type User = Student | Resident | Admin;

export interface RoleSlot {
  id?: string;
  label?: string;
  category: Category;
  domain?: DomainKey;
  count: number;
  filled: string[];
  filledCount?: number;
}

export interface Post {
  id: string;
  title: string;
  category: Category;
  description: string;
  authorId: string;          // Resident id
  location: GeoPoint;
  address: string;
  status: PostStatus;
  reward?: string;           // 쿠폰 제공 내용 (기존 공고는 다른 보상 기록이 남아 있을 수 있음)
  durationDays: number;      // 예상 기간
  difficulty: 1 | 2 | 3;     // 활동 난이도
  isTeam: boolean;
  teamSlots?: RoleSlot[];    // isTeam 일 때
  createdAt: string;         // ISO
  urgent?: boolean;          // 긴급 공고. 올리는 즉시 아래 단과대학 학생에게 알림이 간다
  urgentColleges?: string[]; // 단과대학 key 목록 (비어 있으면 전체 학생)
  // 유지보수: 만들고 끝나는 일인지, 계속 운영되는 결과물인지
  ongoing?: boolean;                 // 웹사이트·예약 시스템처럼 완료 후에도 운영이 필요한가
  warrantyRequestDays?: number;      // 점주 요청(내용 수정) 무상 기간
  warrantyRequestCount?: number;     // 그 기간의 무상 횟수
  warrantyDefectDays?: number;       // 학생 작업 하자(버그) 무상 기간
  clientOwnedBilling?: boolean;      // 도메인·호스팅 명의와 결제를 점주가 보유
  handoverOfProject?: string;        // 이어받기 공고면 원래 프로젝트 id (담당 학생이 빠져 다음 담당자를 모집)
  applicantScope?: "ANY" | "INDIVIDUAL" | "CLUB";  // 누가 지원할 수 있나 (둘 다 / 개인만 / 단체만)
  preferClub?: boolean;              // (이전 버전) 단체 권장 표시
  // ── 구조화된 공고 정보 (검증형 포트폴리오 파이프라인). 예전 공고에는 없을 수 있어 listingOf() 로 기본값을 채운다
  problem?: string;                  // 의뢰인이 겪는 문제
  domain?: DomainKey;                // 분야 모듈. 없으면 category 로 정한다
  expectedDeliverables?: string[];   // 기대 결과물 (deliverableCount = 길이)
  completionCriteria?: string;       // 완료 기준
  deadline?: string;                 // YYYY-MM-DD
  revisionLimit?: number;            // 보완 요청 가능 횟수
  compensationType?: CompensationType;
  compensationDescription?: string;
  paidAmount?: number;               // 기존 유료 공고와의 호환용
  minimumTier?: "SEED" | "TRUST" | "RECOMMENDED"; // 기존 공고 데이터와의 호환용
}

export interface Application {
  id: string;
  postId: string;
  studentId: string;
  clubId?: string;           // 단체 이름으로 지원했으면 그 단체
  message: string;
  roleId?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface Review {                 // 주민·상인의 인증·평가
  postId: string;
  studentId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  verified: boolean;
}

export interface PortfolioCard {          // 프로젝트 완료 시 자동 생성되는 활동 카드
  id: string;
  studentId: string;
  postId: string;
  title: string;
  roleLabel: string;
  tasks: string[];
  durationDays: number;
  rating: number;
  verified: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  postId?: string;
  kind?: string;
  href?: string;
  text: string;
  distanceM?: number;
  read: boolean;
  createdAt: string;
}

export interface PublishedPortfolio {
  visible?: boolean;
  studentId: string;
  sourceId: string;
  sourceKind: "project" | "card";
  title: string;
  summary: string;
  category: string;
  sections: { title: string; body: string }[];
  publishedAt: string;
  coverUrl?: string;
}

export interface ChatMessage {           // 채팅 메시지. 채팅방 = 지원서 하나 (공고 작성자 ↔ 지원 학생)
  id: string;
  applicationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ChatRoom { application: Application; post: Post; other: User | undefined; last?: ChatMessage }

// ── 검증형 포트폴리오 파이프라인 ─────────────────────────────────────────────
export interface Listing {
  problem: string; domain: DomainKey; expectedDeliverables: string[]; deliverableCount: number; completionCriteria: string;
  deadline?: string; revisionLimit: number; compensationType: CompensationType; compensationDescription: string; paidAmount?: number; projectMode: ProjectMode;
}
/** 프로젝트 화면이 한 번에 읽는 묶음 */
export interface ProjectBundle {
  project: Project;
  post: Post;
  members: ProjectMember[];
  answers: ProjectAnswer[];
  logs: ActivityLog[];
  evidence: Evidence[];
  versions: SubmissionVersion[];
  verification: ClientVerification | null;
  memberVerifications: MemberVerification[];
  review: ClientReview | null;
  outcomes: Outcome[];
  snapshots: PortfolioSourceSnapshot[];
  drafts: PortfolioDraft[];
  edits: PortfolioEditedVersion[];
  peerReviews: TeamPeerReview[];
}
export interface TeamPeerReview {
  id: string;
  projectId: string;
  reviewerId: string;
  revieweeId: string;
  communication: number;
  collaboration: number;
  responsibility: number;
  comment: string;
  createdAt: string;
}
export interface TrustSummary { verifiedCount: number; points: number; temperature: number; reputationScore: number; completionRate: number; deadlineReliability: number; handoverReliability: number; communicationScore: number; normalizedRating: number | null; rawRating: number | null; reviewCount: number; heldReviewCount: number; anomalyCount: number; tier: { key: string; label: string }; badges: Badge[]; events: TierScoreEvent[] }
/** 공개 포트폴리오 한 건: 최신 편집본 + 잠긴 원본(검증·평가·증빙) */
export interface PortfolioDoc { edit: PortfolioEditedVersion; bundle: ProjectBundle }

// ── 유지보수·인수인계 (계속 운영되는 결과물: 웹사이트, 예약 시스템 등) ────────────
export type OperationStatus = "WARRANTY" | "OPERATING" | "HANDOVER_OPEN" | "ARCHIVED";
export type TicketKind = "BUG" | "CONTENT" | "FEATURE" | "OTHER";
export type TicketCoverage = "FREE_DEFECT" | "FREE_REQUEST" | "NEW_POST" | "EXPIRED";

/** 완료된 프로젝트의 운영 상태 + 인수인계 정보 */
export interface Operations {
  projectId: string;
  status: OperationStatus;
  maintainerId?: string;           // 현재 담당 학생 (바뀐다)
  repoUrl?: string;
  deployUrl?: string;
  adminHanded: boolean;            // 관리자 계정 전달 완료
  envList?: string;                // 외부 서비스·환경값
  monthlyCost?: string;            // 월 비용·결제일
  billingOwner?: "CLIENT" | "STUDENT";
  expiresOn?: string;              // 가장 먼저 만료되는 날 (도메인·인증서·키)
  backupNote?: string;
  knownIssues?: string;
  clubId?: string;                 // 이 서비스를 맡은 단체 (있으면 단체 안에서 담당자를 바로 넘길 수 있다)
  warrantyRequestUntil?: string;   // 점주 요청 무상 기간
  warrantyDefectUntil?: string;    // 하자(버그) 무상 기간
  requestUsed: number;
  lastCheckAt?: string;
  lastCheckOk?: boolean;
}

export interface MaintainerTerm { id: string; projectId: string; studentId: string; startedOn: string; endedOn?: string; ticketsClosed: number }
export interface MaintenanceTicket {
  id: string; projectId: string; authorId: string; kind: TicketKind; body: string;
  coverage: TicketCoverage; assigneeId?: string; status: "OPEN" | "DONE"; createdAt: string; closedAt?: string;
}
export interface HandoverDoc { id: string; projectId: string; markdown: string; model?: string; generatedAt: string }
/** 운영 화면이 한 번에 받는 묶음 */
export interface OperationsBundle { operations: Operations; history: MaintainerTerm[]; tickets: MaintenanceTicket[]; doc: HandoverDoc | null }
export interface HandoverInput {
  repoUrl?: string; deployUrl?: string; adminHanded?: boolean; envList?: string;
  monthlyCost?: string; billingOwner?: "CLIENT" | "STUDENT"; expiresOn?: string; backupNote?: string; knownIssues?: string;
}

// ── 단체(동아리·학회·학생회 등). 로그인은 개인 학생 계정이고, 소속만 단체에 둔다 ──
export type ClubKind = "CENTRAL" | "DEPARTMENT" | "COUNCIL" | "VOLUNTEER" | "OTHER";
export interface Club {
  id: string;
  name: string;
  kind: ClubKind;
  kindOther?: string;        // 기타일 때 직접 적은 유형 (예: 교내 방송국)
  description: string;
  college?: string;          // 주로 활동하는 단과대학 key
  createdBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";   // 관리자 심사
  rejectReason?: string;
  memberCount?: number;
}
export interface ClubMember { clubId: string; studentId: string; role: "LEADER" | "MEMBER"; status: "PENDING" | "ACTIVE"; joinedAt: string }
export interface ClubInput { name: string; kind: ClubKind; kindOther?: string; description: string; college?: string }

// ── 합의 취소 (진행 중 프로젝트를 양쪽 합의로 끝낸다. 기록은 지우지 않는다) ──
export interface ProjectCancellation {
  id: string;
  projectId: string;
  requestedBy: string;
  responderId: string;        // 수락·거절 권한을 가진 한 명
  reason: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  expiresAt: string;          // 이때까지 응답이 없으면 거절로 처리
  createdAt: string;
  respondedAt?: string;
}
