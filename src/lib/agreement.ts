export interface AgreementTerms {
  startDate: string;
  endDate: string;
  scope: string;
  deliverables: string;
  acceptance: string;
  coupon: string;
  revisions: number;
  exclusions: string;
  handoff: string;
}
export interface WorkAgreement {
  applicationId: string;
  version: number;
  terms: AgreementTerms;
  studentConfirmedAt: string | null;
  ownerConfirmedAt: string | null;
  finalizedAt: string | null;
  updatedAt: string;
}
export const AGREEMENT_SUPPORT = "의뢰인이 완료를 확인한 날부터 1개월 동안 합의한 작업 범위 안에서 사용 안내와 가벼운 수정을 지원합니다. 기존 결과물이 약속한 기능대로 동작하지 않는 버그는 완료 확인일부터 3개월까지 요청할 수 있습니다. 새 기능, 디자인 전면 변경, 외부 서비스 변경은 추가 협의합니다. 버그를 접수하면 재현 여부와 수정 일정을 채팅으로 합의합니다.";
export const AGREEMENT_CHANGE = "최종 확정 전에는 양쪽 모두 수정할 수 있습니다. 수정하면 양쪽의 기존 확인은 취소됩니다. 같은 버전을 양쪽이 확인하면 최종 확정됩니다. 확정 후 변경·중단이 필요하면 채팅에서 작업 범위, 일정, 쿠폰 제공 조건을 다시 합의합니다.";
export const AGREEMENT_USAGE = "인도한 결과물은 의뢰인의 가게 운영·홍보 목적으로 사용할 수 있습니다. 제3자 이미지·폰트·소프트웨어는 해당 이용 조건을 따릅니다. 학생의 포트폴리오 공개 범위는 별도로 합의하며, 이 약속서 확인만으로 공개에 동의한 것으로 보지 않습니다.";
export function validateAgreement(terms: AgreementTerms) {
  for (const date of [terms.startDate, terms.endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("시작일과 완료 예정일을 선택해 주세요.");
  }
  if (terms.endDate < terms.startDate) throw new Error("완료 예정일은 시작일 이후여야 해요.");
  for (const key of ["scope", "deliverables", "acceptance", "coupon", "handoff"] as const) {
    if (!terms[key].trim()) throw new Error("작업 범위, 결과물, 완료 기준, 쿠폰, 인계 방법을 모두 적어 주세요.");
  }
  if (!Number.isInteger(terms.revisions) || terms.revisions < 0 || terms.revisions > 10) throw new Error("수정 횟수는 0~10회로 정해 주세요.");
  if (Object.values(terms).some(value => typeof value === "string" && value.length > 3000)) throw new Error("각 항목은 3,000자 이내로 적어 주세요.");
}
export function reviseAgreement(previous: WorkAgreement | null, applicationId: string, expectedVersion: number, terms: AgreementTerms): WorkAgreement {
  if (previous?.finalizedAt) throw new Error("이미 양쪽이 확인한 최종본이에요.");
  if ((previous?.version ?? 0) !== expectedVersion) throw new Error("상대방이 내용을 변경했어요. 최신 약속서를 다시 열어 주세요.");
  validateAgreement(terms);
  return { applicationId, version: expectedVersion + 1, terms: structuredClone(terms), studentConfirmedAt: null, ownerConfirmedAt: null, finalizedAt: null, updatedAt: new Date().toISOString() };
}
export function confirmAgreement(previous: WorkAgreement, version: number, side: "student" | "owner"): WorkAgreement {
  if (previous.version !== version) throw new Error("상대방이 내용을 변경했어요. 최신 약속서를 다시 열어 주세요.");
  if (previous.finalizedAt) return previous;
  const now = new Date().toISOString();
  const next = { ...previous, updatedAt: now, [side === "student" ? "studentConfirmedAt" : "ownerConfirmedAt"]: now };
  if (next.studentConfirmedAt && next.ownerConfirmedAt) next.finalizedAt = now;
  return next;
}
