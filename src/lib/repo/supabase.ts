import type { SupabaseClient } from "@supabase/supabase-js";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type {
  ActivityLog, Application, Badge, ChatMessage, ChatRoom, ClientReview, ClientVerification, Evidence, Notification, Outcome, PortfolioCard,
  PortfolioDraft, PortfolioEditedVersion, PortfolioSourceSnapshot, Post, Project, ProjectAnswer, ProjectBundle, ProjectMember, RankRow, Review,
  SubmissionVersion, TierScoreEvent, User,
} from "@/types";
import type { GenerateResult, Repo } from "./index";
import { DOMAINS, QUESTION_SET_VERSION } from "@shared/portfolio/domains";
import { templateDraft } from "@shared/portfolio/narrative";
import { sourceHash } from "@shared/portfolio/snapshot";
import { listingOf } from "../listing";
import { sourceFromBundle } from "../portfolio/source";
import { sanitizeContent } from "../workflow/engine";
import { summarizeTrust } from "../trust";

// ── DB 행(snake_case) ↔ 도메인 타입(camelCase) 변환 ────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const u = <T,>(v: T | null | undefined) => v ?? undefined;

export const toUser = (r: Row): User => r.role === "student"
  ? { id: r.id, role: "student", name: r.name, department: r.department ?? "", skills: r.skills ?? [], interests: r.interests ?? [], availableHours: r.available_hours ?? "", maxDistanceM: r.max_distance_m, location: { lat: r.lat, lng: r.lng } }
  : { id: r.id, role: "resident", name: r.name, kind: r.kind ?? "주민", address: r.address ?? "", location: { lat: r.lat, lng: r.lng } };

const toPost = (r: Row): Post => ({
  id: r.id, title: r.title, category: r.category, description: r.description, authorId: r.author_id,
  location: { lat: r.lat, lng: r.lng }, address: r.address, status: r.status, reward: r.reward ?? undefined,
  durationDays: r.duration_days, difficulty: r.difficulty, isTeam: r.is_team, teamSlots: r.team_slots ?? undefined, createdAt: r.created_at,
  problem: r.problem ?? "", domain: u(r.domain), expectedDeliverables: r.expected_deliverables ?? [], completionCriteria: r.completion_criteria ?? "",
  deadline: u(r.deadline), revisionLimit: r.revision_limit ?? 2, compensationType: r.compensation_type ?? "VOLUNTEER",
  compensationDescription: r.compensation_description ?? "", paidAmount: u(r.paid_amount),
});
const toApp = (r: Row): Application => ({ id: r.id, postId: r.post_id, studentId: r.student_id, message: r.message, status: r.status, createdAt: r.created_at });
const toMsg = (r: Row): ChatMessage => ({ id: r.id, applicationId: r.application_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at });
const toProject = (r: Row): Project => ({
  id: r.id, postId: r.post_id, ownerId: r.owner_id, domain: r.domain, mode: r.mode, status: r.status, questionSnapshot: r.question_snapshot,
  approvedVersionId: u(r.approved_version_id), createdAt: r.created_at, completedAt: u(r.completed_at),
});
const toMember = (r: Row): ProjectMember => ({ projectId: r.project_id, studentId: r.student_id, roleLabel: r.role_label, applicationId: u(r.application_id), joinedAt: r.joined_at });
const toAnswer = (r: Row): ProjectAnswer => ({
  projectId: r.project_id, authorId: r.author_id, questionId: r.question_id, field: r.field, stage: r.stage, status: r.status, value: r.value,
  choices: r.choices ?? [], origin: r.origin, parentQuestionId: u(r.parent_question_id), prompt: u(r.prompt), updatedAt: r.updated_at,
});
const toLog = (r: Row): ActivityLog => ({ id: r.id, projectId: r.project_id, authorId: r.author_id, stage: r.stage, note: r.note, createdAt: r.created_at });
const toEvidence = (r: Row): Evidence => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id, type: r.type, description: r.description, url: u(r.url), fileName: u(r.file_name),
  mimeType: u(r.mime_type), linkedField: u(r.linked_field), linkedClaim: u(r.linked_claim), source: r.source, createdAt: r.created_at,
});
const toVersion = (r: Row): SubmissionVersion => ({
  id: r.id, projectId: r.project_id, version: r.version, note: r.note, evidenceIds: r.evidence_ids ?? [], status: r.status, submittedBy: r.submitted_by,
  createdAt: r.created_at, reviewComment: u(r.review_comment), reviewedAt: u(r.reviewed_at), reviewedBy: u(r.reviewed_by),
});
const toVerification = (r: Row): ClientVerification => ({
  projectId: r.project_id, submissionVersionId: r.submission_version_id, verifierId: r.verifier_id, note: r.note, createdAt: r.created_at,
  workPerformed: r.work_performed, roleConfirmed: r.role_confirmed, deliverableReceived: r.deliverable_received, completionCriteriaMet: r.completion_criteria_met, actuallyUsed: r.actually_used,
});
const toReview = (r: Row): ClientReview => ({ projectId: r.project_id, reviewerId: r.reviewer_id, satisfaction: r.satisfaction, deadline: r.deadline, communication: r.communication, handoff: r.handoff, comment: r.comment, createdAt: r.created_at });
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toOutcome = (r: Row): Outcome => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id, metricName: r.metric_name, measured: r.measured, value: num(r.value), unit: r.unit, baseline: num(r.baseline),
  measurementPeriod: r.measurement_period, source: r.source, evidenceId: u(r.evidence_id), qualitativeDescription: r.qualitative_description,
  verified: r.verified, verifiedBy: u(r.verified_by), verifiedAt: u(r.verified_at), createdAt: r.created_at,
});
const toSnapshot = (r: Row): PortfolioSourceSnapshot => ({ id: r.id, projectId: r.project_id, studentId: r.student_id, hash: r.hash, data: r.data, createdAt: r.created_at });
const toDraft = (r: Row): PortfolioDraft => ({
  id: r.id, snapshotId: r.snapshot_id, projectId: r.project_id, studentId: r.student_id, generator: r.generator, model: u(r.model), content: r.content, guardReport: u(r.guard_report), createdAt: r.created_at,
});
const toEdit = (r: Row): PortfolioEditedVersion => ({ id: r.id, draftId: r.draft_id, projectId: r.project_id, studentId: r.student_id, version: r.version, content: r.content, createdAt: r.created_at });
const toEvent = (r: Row): TierScoreEvent => ({ id: r.id, studentId: r.student_id, projectId: r.project_id, kind: r.kind, points: r.points, createdAt: r.created_at });
const toBadge = (r: Row): Badge => ({ studentId: r.student_id, code: r.code, label: r.label, projectId: r.project_id, createdAt: r.created_at });

/** DB 에러 → 화면용 문장. DB 함수는 'CODE: 설명' 으로 던진다 */
export function friendly(message: string) {
  if (/row-level security/i.test(message)) return "권한이 없어요 (선정된 학생 또는 해당 의뢰인만 할 수 있어요)";
  return message.replace(/^[A-Z_]+: /, "");
}
/** 에러는 그대로 던져서 화면에서 알 수 있게 한다 */
// 타입 없는 클라이언트라 결과는 Row(any)로 받고, 위의 to* 함수가 도메인 타입으로 바꾼다
function ok({ data, error }: { data: any; error: { message: string } | null }): any {
  if (error || data === null) throw new Error(friendly(error?.message ?? "데이터가 없습니다"));
  return data;
}
/** 결과 없이 쓰기만 하는 요청(update 등) */
function done({ error }: { error: { message: string } | null }) { if (error) throw new Error(friendly(error.message)); }
/** 없을 수도 있는 한 건(maybeSingle) */
function maybe({ data, error }: { data: any; error: { message: string } | null }): Row | null {
  if (error) throw new Error(friendly(error.message));
  return data;
}

export function supabaseRepo(db: SupabaseClient): Repo {
  const repo: Repo = {
    async listUsers() { return ok(await db.from("profiles").select("*")).map(toUser); },
    async getUser(id) { const r = maybe(await db.from("profiles").select("*").eq("id", id).maybeSingle()); return r ? toUser(r) : undefined; },
    async listPosts() { return ok(await db.from("posts").select("*").order("created_at", { ascending: false })).map(toPost); },
    async getPost(id) { const r = maybe(await db.from("posts").select("*").eq("id", id).maybeSingle()); return r ? toPost(r) : undefined; },
    async createPost(p) {
      const r = ok(await db.from("posts").insert({
        title: p.title, category: p.category, description: p.description, author_id: p.authorId, lat: p.location.lat, lng: p.location.lng,
        address: p.address, reward: p.reward || null, duration_days: p.durationDays, difficulty: p.difficulty, is_team: p.isTeam, team_slots: p.teamSlots ?? null,
        problem: p.problem ?? "", domain: p.domain ?? null, expected_deliverables: p.expectedDeliverables ?? [], completion_criteria: p.completionCriteria ?? "",
        deadline: p.deadline || null, revision_limit: p.revisionLimit ?? 2, compensation_type: p.compensationType ?? "VOLUNTEER",
        compensation_description: p.compensationDescription ?? "", paid_amount: p.compensationType === "PAID" ? p.paidAmount ?? null : null,
      }).select().single());
      return toPost(r);
    },
    async updatePostStatus(id, status) { done(await db.from("posts").update({ status }).eq("id", id)); },
    async listApplications(postId) {
      let q = db.from("applications").select("*").order("created_at");
      if (postId) q = q.eq("post_id", postId);
      return ok(await q).map(toApp);
    },
    async apply(postId, studentId, message) { return toApp(ok(await db.from("applications").insert({ post_id: postId, student_id: studentId, message }).select().single())); },
    async getApplication(id) { const r = maybe(await db.from("applications").select("*").eq("id", id).maybeSingle()); return r ? toApp(r) : undefined; },
    async updateApplicationStatus(id, status) { done(await db.from("applications").update({ status }).eq("id", id)); },

    async listChatRooms(userId) {
      // RLS 덕분에 내가 당사자인 지원서만 온다
      const rows = ok(await db.from("applications").select("*, post:posts(*), student:profiles(*), messages(id, application_id, sender_id, body, created_at)")
        .order("created_at", { referencedTable: "messages", ascending: false }).limit(1, { referencedTable: "messages" }));
      const rooms: ChatRoom[] = [];
      for (const r of rows) {
        const post = toPost(r.post);
        const other = r.student_id === userId ? await repo.getUser(post.authorId) : toUser(r.student);
        rooms.push({ application: toApp(r), post, other, last: r.messages?.[0] ? toMsg(r.messages[0]) : undefined });
      }
      const at = (x: ChatRoom) => x.last?.createdAt ?? x.application.createdAt;
      return rooms.sort((a, b) => at(b).localeCompare(at(a)));
    },
    async listMessages(applicationId) { return ok(await db.from("messages").select("*").eq("application_id", applicationId).order("created_at")).map(toMsg); },
    async sendMessage(applicationId, senderId, body) { return toMsg(ok(await db.from("messages").insert({ application_id: applicationId, sender_id: senderId, body }).select().single())); },
    onMessage(applicationId, cb) {
      const ch = db.channel(`messages:${applicationId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `application_id=eq.${applicationId}` }, (e) => cb(toMsg(e.new)))
        // 연결까지 몇 초 걸린다. 그 사이 온 메시지를 놓치지 않게 연결되면 한 번 다시 불러온다 (화면에서 id 로 중복 제거)
        .subscribe((status) => { if (status === "SUBSCRIBED") repo.listMessages(applicationId).then((ms) => ms.forEach(cb)); });
      return () => { db.removeChannel(ch); };
    },

    async listReviews(studentId) {
      let q = db.from("reviews").select("*");
      if (studentId) q = q.eq("student_id", studentId);
      return ok(await q).map((r: Row): Review => ({ postId: r.post_id, studentId: r.student_id, rating: r.rating, comment: r.comment, verified: r.verified }));
    },
    async listPortfolio(studentId) {
      return ok(await db.from("portfolio_cards").select("*").eq("student_id", studentId)).map((r: Row): PortfolioCard => ({
        id: r.id, studentId: r.student_id, postId: r.post_id, title: r.title, roleLabel: r.role_label, tasks: r.tasks, durationDays: r.duration_days, rating: r.rating, verified: r.verified,
      }));
    },
    async listNotifications(userId) {
      return ok(await db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false })).map((r: Row): Notification => ({
        id: r.id, userId: r.user_id, postId: r.post_id ?? undefined, text: r.text, distanceM: r.distance_m ?? undefined, read: r.read, createdAt: r.created_at,
      }));
    },
    async ranking(kind) {
      // mock 과 같은 임시 공식: 해결 수×10 + 평가 평균×4 + 난이도 합×3
      const [users, cards, posts] = await Promise.all([repo.listUsers(), db.from("portfolio_cards").select("*").then(ok), repo.listPosts()]);
      const rows: RankRow[] = users.filter((u) => u.role === "student").map((s) => {
        const mine = (cards as Row[]).filter((c) => c.student_id === s.id);
        const avg = mine.length ? mine.reduce((a, c) => a + c.rating, 0) / mine.length : 0;
        const diff = mine.reduce((a, c) => a + (posts.find((p) => p.id === c.post_id)?.difficulty ?? 0), 0);
        return { id: s.id, label: s.name, sub: s.role === "student" ? s.department : "", solved: mine.length, score: mine.length * 10 + Math.round(avg * 4) + diff * 3 };
      });
      if (kind === "department") {
        const by: Record<string, RankRow> = {};
        for (const r of rows) { by[r.sub] ??= { id: r.sub, label: r.sub, sub: "학과", score: 0, solved: 0 }; by[r.sub].score += r.score; by[r.sub].solved += r.solved; }
        return Object.values(by).sort((a, b) => b.score - a.score);
      }
      if (kind === "team") return []; // 팀 랭킹은 팀 확정 기능 이후
      return rows.sort((a, b) => b.score - a.score);
    },

    // ── 검증형 포트폴리오 파이프라인 (규칙은 DB 함수가 강제: supabase/migrations/0002) ──────
    async selectApplicant(applicationId) {
      const app = await repo.getApplication(applicationId);
      const post = app && await repo.getPost(app.postId);
      if (!post) throw new Error("지원서를 찾을 수 없어요");
      const domain = listingOf(post).domain;
      const snapshot = { domain, version: QUESTION_SET_VERSION, questions: DOMAINS[domain].questions, takenAt: new Date().toISOString() };
      const id: string = ok(await db.rpc("select_applicant", { p_application: applicationId, p_question_snapshot: snapshot }));
      return toProject(ok(await db.from("projects").select("*").eq("id", id).single()));
    },
    async getProjectByPost(postId) { const r = maybe(await db.from("projects").select("*").eq("post_id", postId).maybeSingle()); return r ? toProject(r) : undefined; },
    async listMyProjects(userId) {
      const memberOf = ok(await db.from("project_members").select("project_id").eq("student_id", userId)).map((r: Row) => r.project_id);
      let q = db.from("projects").select("*, post:posts(*)").order("created_at", { ascending: false });
      q = memberOf.length ? q.or(`owner_id.eq.${userId},id.in.(${memberOf.join(",")})`) : q.eq("owner_id", userId);
      return ok(await q).map((r: Row) => ({ project: toProject(r), post: toPost(r.post) }));
    },
    async getBundle(projectId) {
      const p = ok(await db.from("projects").select("*, post:posts(*)").eq("id", projectId).single());
      const by = (t: string, order = "created_at") => db.from(t).select("*").eq("project_id", projectId).order(order);
      const [members, answers, logs, evidence, versions, verification, review, outcomes, snapshots, drafts, edits] = await Promise.all([
        by("project_members", "joined_at"), by("project_answers", "updated_at"), by("activity_logs"), by("evidence"), by("submission_versions", "version"),
        db.from("client_verifications").select("*").eq("project_id", projectId).maybeSingle(), db.from("client_reviews").select("*").eq("project_id", projectId).maybeSingle(),
        by("outcomes"), by("portfolio_snapshots"), by("portfolio_drafts"), by("portfolio_edits", "version"),
      ]);
      const bundle: ProjectBundle = {
        project: toProject(p), post: toPost(p.post),
        members: ok(members).map(toMember), answers: ok(answers).map(toAnswer), logs: ok(logs).map(toLog), evidence: ok(evidence).map(toEvidence),
        versions: ok(versions).map(toVersion), verification: maybe(verification) && toVerification(maybe(verification)!), review: maybe(review) && toReview(maybe(review)!),
        outcomes: ok(outcomes).map(toOutcome), snapshots: ok(snapshots).map(toSnapshot), drafts: ok(drafts).map(toDraft), edits: ok(edits).map(toEdit),
      };
      return bundle;
    },
    async saveAnswer(a) {
      const origin = a.origin ?? "SCHEMA";
      const b = ok(await db.from("projects").select("question_snapshot").eq("id", a.projectId).single());
      const q = (b.question_snapshot.questions as { id: string; field: string; stage: string }[]).find((x) => x.id === (origin === "SCHEMA" ? a.questionId : a.parentQuestionId));
      if (!q) throw new Error("질문을 찾을 수 없어요");
      const value = (a.value ?? "").slice(0, 4000), choices = (a.choices ?? []).slice(0, 20);
      const status = a.status === "ANSWERED" && !value.trim() && choices.length === 0 ? "UNANSWERED" : a.status;
      const keep = status === "ANSWERED" || status === "UNANSWERED";
      const r = ok(await db.from("project_answers").upsert({
        project_id: a.projectId, author_id: a.actorId, question_id: a.questionId, field: q.field, stage: q.stage, status,
        value: keep ? value : "", choices: keep ? choices : [], origin, parent_question_id: origin === "SCHEMA" ? null : q.id,
        prompt: origin === "SCHEMA" ? null : a.prompt ?? null, updated_at: new Date().toISOString(),
      }).select().single());
      return toAnswer(r);
    },
    async addLog(a) { return toLog(ok(await db.from("activity_logs").insert({ project_id: a.projectId, author_id: a.actorId, stage: a.stage, note: a.note.trim() }).select().single())); },
    async uploadEvidenceFile(projectId, file) {
      if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하 파일만 올릴 수 있어요");
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      done(await db.storage.from("evidence").upload(path, file, { contentType: file.type || undefined, upsert: false }));
      return { url: db.storage.from("evidence").getPublicUrl(path).data.publicUrl, fileName: file.name, mimeType: file.type };
    },
    async addEvidence(a) {
      const project = ok(await db.from("projects").select("owner_id").eq("id", a.projectId).single());
      const client = project.owner_id === a.actorId;
      return toEvidence(ok(await db.from("evidence").insert({
        project_id: a.projectId, author_id: a.actorId, type: a.type, description: a.description.trim(), url: a.url ?? null, file_name: a.fileName ?? null,
        mime_type: a.mimeType ?? null, linked_field: a.linkedField || null, linked_claim: a.linkedClaim || null,
        source: client ? "CLIENT" : a.source ?? (a.url ? "STUDENT_LINK" : "STUDENT_NOTE"),
      }).select().single()));
    },
    async submitVersion(a) { return ok(await db.rpc("submit_version", { p_project: a.projectId, p_note: a.note, p_evidence_ids: a.evidenceIds })); },
    async requestRevision(versionId, _actorId, comment) { done(await db.rpc("request_revision", { p_version: versionId, p_comment: comment })); },
    async approveVersion(a) { done(await db.rpc("approve_version", { p_version: a.versionId, p_claims: a.claims, p_review: a.review, p_note: a.note ?? "" })); },
    async addOutcome(a) {
      return toOutcome(ok(await db.from("outcomes").insert({
        project_id: a.projectId, author_id: a.actorId, metric_name: a.metricName.trim(), measured: a.measured, value: a.measured ? a.value : null, unit: a.unit,
        baseline: a.baseline, measurement_period: a.measurementPeriod, source: a.source, evidence_id: a.evidenceId || null, qualitative_description: a.qualitativeDescription,
      }).select().single()));
    },
    async verifyOutcome(outcomeId) { done(await db.rpc("verify_outcome", { p_outcome: outcomeId })); },

    async generatePortfolio(projectId, actorId, opts) {
      const { data, error } = await db.functions.invoke<{ draft: Row; reused: boolean; aiError?: string }>("portfolio-ai", { body: { action: "narrative", projectId, regenerate: !!opts?.regenerate } });
      if (!error && data) return { draft: toDraft(data.draft), reused: data.reused, aiError: data.aiError };
      // 함수가 규칙 위반(예: 승인 전)을 알려 준 경우는 그대로 보여 준다
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => ({}));
        if (body?.error && error.context.status < 500) throw new Error(body.error);
      }
      // 함수에 닿지 못함(미배포·네트워크) → 템플릿 초안. 화면에는 "Template-generated draft" 로 표시된다
      return templateFallback(projectId, actorId, !!opts?.regenerate, "AI 서버에 연결하지 못해 템플릿으로 만들었어요");
    },
    async savePortfolioEdit(draftId, _actorId, content) {
      const id: string = ok(await db.rpc("save_portfolio_edit", { p_draft: draftId, p_content: sanitizeContent(content) }));
      return toEdit(ok(await db.from("portfolio_edits").select("*").eq("id", id).single()));
    },
    async listPortfolioDocs(studentId) {
      const rows = ok(await db.from("portfolio_edits").select("*, project:projects(*, post:posts(*))").eq("student_id", studentId).order("version", { ascending: false }));
      const seen = new Set<string>();
      return rows.filter((r: Row) => r.project && !seen.has(r.project_id) && seen.add(r.project_id))
        .map((r: Row) => ({ edit: toEdit(r), project: toProject(r.project), post: toPost(r.project.post) }));
    },
    async getPortfolioDoc(projectId, studentId) {
      const r = maybe(await db.from("portfolio_edits").select("*").eq("project_id", projectId).eq("student_id", studentId).order("version", { ascending: false }).limit(1).maybeSingle());
      return r ? { edit: toEdit(r), bundle: await repo.getBundle(projectId) } : undefined;
    },
    async trustSummary(studentId) {
      const [events, badges] = await Promise.all([
        db.from("tier_score_events").select("*").eq("student_id", studentId).then(ok),
        db.from("badges").select("*").eq("student_id", studentId).then(ok),
      ]);
      const ids = [...new Set((events as Row[]).map((e) => e.project_id))];
      const reviews = ids.length ? ok(await db.from("client_reviews").select("*").in("project_id", ids)).map(toReview) : [];
      return summarizeTrust(events.map(toEvent), reviews, badges.map(toBadge));
    },
  };

  /** Edge Function 에 닿지 못했을 때: 같은 규칙으로 스냅샷을 만들고 템플릿 초안을 저장한다 (RLS 가 완료·본인 여부를 검사) */
  async function templateFallback(projectId: string, actorId: string, regenerate: boolean, aiError: string): Promise<GenerateResult> {
    const b = await repo.getBundle(projectId);
    const [client, student] = await Promise.all([repo.getUser(b.project.ownerId), repo.getUser(actorId)]);
    const data = sourceFromBundle(b, client, student, actorId, new Date().toISOString());
    const hash = sourceHash(data);
    done(await db.from("portfolio_snapshots").upsert({ project_id: projectId, student_id: actorId, hash, data }, { onConflict: "project_id,student_id,hash", ignoreDuplicates: true }));
    const snap = ok(await db.from("portfolio_snapshots").select("*").eq("project_id", projectId).eq("student_id", actorId).eq("hash", hash).single());
    const prev = maybe(await db.from("portfolio_drafts").select("*").eq("snapshot_id", snap.id).order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (prev && !regenerate) return { draft: toDraft(prev), reused: true };
    const d = ok(await db.from("portfolio_drafts").insert({ snapshot_id: snap.id, project_id: projectId, student_id: actorId, generator: "TEMPLATE", content: templateDraft(snap.data) }).select().single());
    return { draft: toDraft(d), reused: false, aiError };
  }
  return repo;
}
