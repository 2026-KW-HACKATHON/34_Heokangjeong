// 도메인 타입 — 화면과 데이터 계층이 공유하는 계약. 백엔드를 붙일 때도 이 타입은 유지한다.
// 프로젝트·증빙·검증·포트폴리오 타입은 서버 함수와 함께 쓰려고 supabase/functions/_shared/portfolio/types.ts 에 있고 여기서 다시 내보낸다.
import type {
  ActivityLog, Badge, ClientReview, ClientVerification, CompensationType, DomainKey, Evidence, Outcome, PortfolioDraft,
  PortfolioEditedVersion, PortfolioSourceSnapshot, Project, ProjectAnswer, ProjectMember, ProjectMode, SubmissionVersion, TierScoreEvent,
} from "@shared/portfolio/types";
export type * from "@shared/portfolio/types";
export type Role = "student" | "resident";

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
}

export interface Resident {
  id: string;
  role: "resident";
  name: string;              // 상호 또는 이름
  kind: "상인" | "주민";
  location: GeoPoint;
  address: string;
}

export type User = Student | Resident;

export interface RoleSlot { category: Category; count: number; filled: string[] } // 팀 공고의 역할 자리

export interface Post {
  id: string;
  title: string;
  category: Category;
  description: string;
  authorId: string;          // Resident id
  location: GeoPoint;
  address: string;
  status: PostStatus;
  reward?: string;           // 보상(사례비·식사권 등, 선택)
  durationDays: number;      // 예상 기간
  difficulty: 1 | 2 | 3;     // 활동 난이도
  isTeam: boolean;
  teamSlots?: RoleSlot[];    // isTeam 일 때
  createdAt: string;         // ISO
  // ── 구조화된 공고 정보 (검증형 포트폴리오 파이프라인). 예전 공고에는 없을 수 있어 listingOf() 로 기본값을 채운다
  problem?: string;                  // 의뢰인이 겪는 문제
  domain?: DomainKey;                // 분야 모듈. 없으면 category 로 정한다
  expectedDeliverables?: string[];   // 기대 결과물 (deliverableCount = 길이)
  completionCriteria?: string;       // 완료 기준
  deadline?: string;                 // YYYY-MM-DD
  revisionLimit?: number;            // 보완 요청 가능 횟수
  compensationType?: CompensationType;
  compensationDescription?: string;
  paidAmount?: number;               // PAID 일 때 원
}

export interface Application {
  id: string;
  postId: string;
  studentId: string;
  message: string;
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
  text: string;
  distanceM?: number;
  read: boolean;
  createdAt: string;
}

export interface RankRow { id: string; label: string; sub: string; score: number; solved: number }

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
  review: ClientReview | null;
  outcomes: Outcome[];
  snapshots: PortfolioSourceSnapshot[];
  drafts: PortfolioDraft[];
  edits: PortfolioEditedVersion[];
}
export interface TrustSummary { verifiedCount: number; points: number; temperature: number; tier: { key: string; label: string }; paidEligible: boolean; badges: Badge[]; events: TierScoreEvent[] }
/** 공개 포트폴리오 한 건: 최신 편집본 + 잠긴 원본(검증·평가·증빙) */
export interface PortfolioDoc { edit: PortfolioEditedVersion; bundle: ProjectBundle }
