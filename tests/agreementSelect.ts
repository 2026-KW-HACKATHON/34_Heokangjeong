// DB 테스트 공용: 0037 이후 '선정 확정'은 약속서를 양쪽이 확정해야 된다.
// 사장님 선정(shortlist) → 학생이 약속서 저장·확인 → 사장님 확인(질문 목록과 함께) = 선정 확정 → 프로젝트 id
type As = <T = Record<string, unknown>>(uid: string, q: string, params?: unknown[]) => Promise<T[]>;

export const AGREEMENT_TERMS = { startDate: "2026-10-07", endDate: "2026-10-20", scope: "디자인", deliverables: "PDF", acceptance: "점주 확인", coupon: "음료 쿠폰", handoff: "파일 전달", exclusions: "", revisions: 2 };

export async function selectWithAgreement(as: As, ownerId: string, studentId: string, applicationId: string, snapshot: string): Promise<string> {
  await as(ownerId, "select * from public.shortlist_applicant($1)", [applicationId]);
  await as(studentId, "select * from public.save_chat_agreement($1, 0, $2::jsonb)", [applicationId, JSON.stringify(AGREEMENT_TERMS)]);
  await as(studentId, "select * from public.confirm_chat_agreement($1, 1, null)", [applicationId]);
  await as(ownerId, "select * from public.confirm_chat_agreement($1, 1, $2::jsonb)", [applicationId, snapshot]);
  const [m] = await as<{ project_id: string }>(ownerId, "select project_id from public.project_members where application_id = $1", [applicationId]);
  return m.project_id;
}
