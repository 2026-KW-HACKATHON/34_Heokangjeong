// DB 행(snake_case) → 엔티티. 서버 함수가 스냅샷·Notion 문서를 만들 때 쓴다.
import type { ActivityLog, ClientReview, ClientVerification, Evidence, Outcome, Project, ProjectAnswer, ProjectMember, SubmissionVersion } from "./types.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const u = <T,>(v: T | null | undefined) => v ?? undefined;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const rowToProject = (r: Row): Project => ({
  id: r.id, postId: r.post_id, ownerId: r.owner_id, domain: r.domain, mode: r.mode, status: r.status, questionSnapshot: r.question_snapshot,
  approvedVersionId: u(r.approved_version_id), createdAt: r.created_at, completedAt: u(r.completed_at),
});
export const rowToMember = (r: Row): ProjectMember => ({
  projectId: r.project_id, studentId: r.student_id, roleLabel: r.role_label, roleId: u(r.role_id), domain: u(r.domain),
  questionSnapshot: u(r.question_snapshot), isLead: r.is_lead ?? false, readyAt: u(r.ready_at), applicationId: u(r.application_id), joinedAt: r.joined_at,
});
export const rowToAnswer = (r: Row): ProjectAnswer => ({
  projectId: r.project_id, authorId: r.author_id, questionId: r.question_id, field: r.field, stage: r.stage, status: r.status, value: r.value,
  choices: r.choices ?? [], origin: r.origin, parentQuestionId: u(r.parent_question_id), prompt: u(r.prompt), updatedAt: r.updated_at,
});
export const rowToLog = (r: Row): ActivityLog => ({ id: r.id, projectId: r.project_id, authorId: r.author_id, stage: r.stage, note: r.note, createdAt: r.created_at });
export const rowToEvidence = (r: Row): Evidence => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id, type: r.type, description: r.description, url: u(r.url), fileName: u(r.file_name),
  mimeType: u(r.mime_type), linkedField: u(r.linked_field), linkedClaim: u(r.linked_claim), source: r.source, createdAt: r.created_at,
});
export const rowToVersion = (r: Row): SubmissionVersion => ({
  id: r.id, projectId: r.project_id, version: r.version, note: r.note, evidenceIds: r.evidence_ids ?? [], status: r.status, submittedBy: r.submitted_by,
  createdAt: r.created_at, reviewComment: u(r.review_comment), reviewedAt: u(r.reviewed_at), reviewedBy: u(r.reviewed_by),
});
export const rowToVerification = (r: Row): ClientVerification => ({
  projectId: r.project_id, submissionVersionId: r.submission_version_id, verifierId: r.verifier_id, note: r.note, createdAt: r.created_at,
  workPerformed: r.work_performed, roleConfirmed: r.role_confirmed, deliverableReceived: r.deliverable_received, completionCriteriaMet: r.completion_criteria_met, actuallyUsed: r.actually_used,
});
export const rowToReview = (r: Row): ClientReview => ({ projectId: r.project_id, reviewerId: r.reviewer_id, satisfaction: r.satisfaction, deadline: r.deadline, communication: r.communication, handoff: r.handoff, comment: r.comment, createdAt: r.created_at });
export const rowToOutcome = (r: Row): Outcome => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id, metricName: r.metric_name, measured: r.measured, value: num(r.value), unit: r.unit, baseline: num(r.baseline),
  measurementPeriod: r.measurement_period, source: r.source, evidenceId: u(r.evidence_id), qualitativeDescription: r.qualitative_description,
  verified: r.verified, verifiedBy: u(r.verified_by), verifiedAt: u(r.verified_at), createdAt: r.created_at,
});
