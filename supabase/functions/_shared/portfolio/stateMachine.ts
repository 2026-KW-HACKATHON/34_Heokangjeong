// 프로젝트 상태 머신. SQL(supabase/migrations/0005) 의 project_next_status 와 같은 표를 쓴다.
import type { ProjectEvent, ProjectMode, ProjectStatus } from "./types.ts";

const TABLE: Record<ProjectStatus, Partial<Record<ProjectEvent, ProjectStatus>>> = {
  RECRUITING: { SELECT: "IN_PROGRESS", START: "IN_PROGRESS" },
  IN_PROGRESS: { SUBMIT: "REVIEW_PENDING" },   // IN_PROGRESS 의 SELECT 는 팀 공고의 추가 선정만
  REVIEW_PENDING: { REQUEST_REVISION: "REVISION_REQUESTED", APPROVE: "COMPLETED" },
  REVISION_REQUESTED: { RESUBMIT: "REVIEW_PENDING" },
  COMPLETED: {},
  CANCELLED: {},          // 합의 취소된 프로젝트에서는 더 진행할 수 없다
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  RECRUITING: "모집 중",
  IN_PROGRESS: "진행 중",
  REVIEW_PENDING: "검토 대기",
  REVISION_REQUESTED: "보완 요청됨",
  COMPLETED: "완료·검증됨",
  CANCELLED: "합의 취소됨",
};

export class WorkflowError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "WorkflowError"; }
}

export function nextStatus(current: ProjectStatus, event: ProjectEvent, mode: ProjectMode = "INDIVIDUAL"): ProjectStatus {
  if (event === "SELECT" && current === "RECRUITING" && mode === "TEAM") return "RECRUITING";
  if (event === "START" && mode !== "TEAM") throw new WorkflowError("INVALID_TRANSITION", "팀 프로젝트만 팀 확정 후 시작할 수 있어요");
  if (event === "SELECT" && current === "IN_PROGRESS" && mode !== "TEAM") throw new WorkflowError("INVALID_TRANSITION", "개인 프로젝트는 이미 학생이 선정되었어요");
  const next = TABLE[current]?.[event];
  if (!next) throw new WorkflowError("INVALID_TRANSITION", `${STATUS_LABEL[current]} 상태에서는 할 수 없는 작업이에요`);
  return next;
}
export const canTransition = (current: ProjectStatus, event: ProjectEvent, mode: ProjectMode = "INDIVIDUAL") => {
  try { nextStatus(current, event, mode); return true; } catch { return false; }
};
