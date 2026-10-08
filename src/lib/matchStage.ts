// 지원서(채팅방) 하나가 지금 어느 단계인지. 채팅 목록 표시와 기록 탭 '진행 중인 작업'이 같은 기준을 쓴다.
//   지원     : 지원만 한 상태 (대화는 사장님이 선정한 뒤부터)
//   매칭 대기: 사장님이 선정 → 대화하며 계약서를 쓰는 중 (선정 취소되면 '선정 취소')
//   매칭됨  : 계약서를 양쪽이 확인해 확정 = 선정 확정, 그 뒤 아직 대화 없음
//   진행 중 : 확정 뒤 대화가 오가거나, 제출·보완 단계에 들어감
//   완료 / 취소됨 / 거절됨: 프로젝트 승인 / 합의 취소 / 선정되지 않음
import type { Application, ProjectStatus } from "@/types";

export type MatchStage = "APPLIED" | "SHORTLIST_CANCELLED" | "WAITING" | "MATCHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "REJECTED";
export const MATCH_STAGE_LABEL: Record<MatchStage, string> = {
  APPLIED: "지원", SHORTLIST_CANCELLED: "선정 취소", WAITING: "매칭 대기", MATCHED: "매칭됨", IN_PROGRESS: "진행 중", COMPLETED: "완료", CANCELLED: "취소됨", REJECTED: "거절됨",
};
/** 아직 손이 가는 단계 (기록 탭 '진행 중인 작업'에 보이는 것) */
export const ACTIVE_STAGES: MatchStage[] = ["WAITING", "MATCHED", "IN_PROGRESS"];

export interface StageInput {
  applicationStatus: Application["status"];
  shortlisted?: boolean;                    // 사장님이 선정했는가 (매칭 대기)
  shortlistCancelled?: boolean;             // 선정이 취소됐는가
  projectStatus?: ProjectStatus;            // 이 학생이 들어간 프로젝트 (선정된 뒤에만 있다)
  agreementFinalizedAt?: string | null;     // 계약서 최종 확정 시각
  lastMessageAt?: string;                   // 가장 최근 대화 시각
}

export function matchStage(i: StageInput): MatchStage {
  if (i.projectStatus === "COMPLETED") return "COMPLETED";
  if (i.projectStatus === "CANCELLED") return "CANCELLED";
  if (i.applicationStatus === "rejected") return "REJECTED";
  // 제출·보완 단계면 계약서와 상관없이 이미 작업이 진행 중이다 (예전 프로젝트 포함)
  if (i.projectStatus === "REVIEW_PENDING" || i.projectStatus === "REVISION_REQUESTED") return "IN_PROGRESS";
  if (!i.agreementFinalizedAt) return i.shortlisted ? "WAITING" : i.applicationStatus === "accepted" ? "WAITING" : i.shortlistCancelled ? "SHORTLIST_CANCELLED" : "APPLIED";
  return i.lastMessageAt && i.lastMessageAt > i.agreementFinalizedAt ? "IN_PROGRESS" : "MATCHED";
}
