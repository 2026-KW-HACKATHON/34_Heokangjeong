import type { Operations, TicketCoverage, TicketKind } from "@/types";

/**
 * 인수인계 준비도: 다음 사람이 이어받는 데 필요한 정보가 얼마나 채워졌나.
 * 필수 항목이 다 차야 인계를 요청할 수 있고, 점주 화면에도 이 퍼센트가 보인다.
 */
export interface HandoverField { key: keyof Operations; label: string; hint: string; required: boolean }

export const HANDOVER_FIELDS: HandoverField[] = [
  { key: "repoUrl", label: "저장소 주소", hint: "GitHub 등. 코드가 내 PC 에만 있으면 아무도 이어받지 못해요", required: true },
  { key: "deployUrl", label: "배포 주소", hint: "손님이 실제로 보는 주소", required: true },
  { key: "adminHanded", label: "관리자 계정 전달", hint: "사장님께 전달했는지만 체크해요. 비밀번호는 저장하지 않아요", required: true },
  { key: "monthlyCost", label: "월 비용·결제일", hint: "예: 도메인 연 2만원(3월 2일), 호스팅 무료", required: true },
  { key: "billingOwner", label: "결제 명의", hint: "사장님 명의여야 담당자가 바뀌어도 끊기지 않아요", required: true },
  { key: "envList", label: "외부 서비스·환경값", hint: "예: Supabase, 카카오 지도 키 (값이 아니라 목록만)", required: false },
  { key: "expiresOn", label: "가장 먼저 만료되는 날", hint: "도메인·인증서·카드 중 가장 빠른 날. 30일 전에 알림이 가요", required: false },
  { key: "backupNote", label: "백업 방법", hint: "자동이면 어디에, 수동이면 누가 언제", required: false },
  { key: "knownIssues", label: "알려진 문제", hint: "다음 사람이 당황하지 않게 알려 주세요", required: false },
];

const filled = (o: Operations, f: HandoverField) => {
  const v = o[f.key];
  return typeof v === "boolean" ? v : typeof v === "string" ? v.trim().length > 0 : false;
};

/** 준비도(%) 와 빠진 항목 */
export function handoverReadiness(o: Operations | null) {
  if (!o) return { percent: 0, missingRequired: HANDOVER_FIELDS.filter((f) => f.required), done: [] as HandoverField[] };
  const done = HANDOVER_FIELDS.filter((f) => filled(o, f));
  const required = HANDOVER_FIELDS.filter((f) => f.required);
  // 필수 70% + 선택 30% 로 본다 (필수를 다 채우면 70%)
  const req = required.filter((f) => filled(o, f)).length / required.length;
  const opt = HANDOVER_FIELDS.filter((f) => !f.required);
  const optRatio = opt.filter((f) => filled(o, f)).length / opt.length;
  return {
    percent: Math.round(req * 70 + optRatio * 30),
    missingRequired: required.filter((f) => !filled(o, f)),
    done,
  };
}

export const canOpenHandover = (o: Operations | null) => !!o && handoverReadiness(o).missingRequired.length === 0;

export const OPERATION_LABEL = {
  WARRANTY: "보증 기간",
  OPERATING: "운영 중",
  HANDOVER_OPEN: "다음 담당자 모집 중",
  ARCHIVED: "운영 종료",
} as const;

export const TICKET_KIND_LABEL: Record<TicketKind, string> = {
  BUG: "기존 기능이 안 돼요",
  CONTENT: "내용을 바꾸고 싶어요",
  FEATURE: "기능을 추가하고 싶어요",
  OTHER: "기타",
};

export const COVERAGE_LABEL: Record<TicketCoverage, string> = {
  FREE_DEFECT: "무상 (하자 보증)",
  FREE_REQUEST: "무상 (요청 보증)",
  NEW_POST: "새 공고 필요 (추가 개발)",
  EXPIRED: "보증 기간 지남 · 새 공고 권장",
};

/** 남은 보증 일수. 지났으면 음수 */
export const daysLeft = (until?: string) =>
  until ? Math.ceil((new Date(until + "T23:59:59").getTime() - Date.now()) / 86400000) : null;

/** 화면에 쓰는 보증 요약 */
export function warrantySummary(o: Operations, requestCount = 3) {
  const req = daysLeft(o.warrantyRequestUntil);
  const def = daysLeft(o.warrantyDefectUntil);
  return {
    request: req === null ? null : { days: req, left: Math.max(0, requestCount - o.requestUsed), ok: req > 0 },
    defect: def === null ? null : { days: def, ok: def > 0 },
  };
}
