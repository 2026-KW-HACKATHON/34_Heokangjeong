import type { SupabaseClient } from "@supabase/supabase-js";
import { chatReads } from "./chatReads";
import { FunctionsHttpError } from "@supabase/supabase-js";
import type {
  ActivityLog, Application, Badge, ChatMessage, ChatRoom, ClientReview, ClientVerification, Evidence, MemberVerification, Notification, Outcome, PortfolioCard,
  PortfolioDraft, PortfolioEditedVersion, PortfolioSourceSnapshot, Post, Project, ProjectAnswer, ProjectBundle, ProjectMember, Review, TeamPeerReview,
  SubmissionVersion, TierScoreEvent, User, HandoverDoc, MaintainerTerm, MaintenanceTicket, Operations, Club, ClubMember,
} from "@/types";
import type { GenerateResult, Repo } from "./index";
import { DOMAINS, QUESTION_SET_VERSION, domainForCategory } from "@shared/portfolio/domains";
import { templateDraft } from "@shared/portfolio/narrative";
import { sourceHash } from "@shared/portfolio/snapshot";
import { listingOf } from "../listing";
import { sourceFromBundle } from "../portfolio/source";
import { sanitizeContent } from "../workflow/engine";
import { summarizeTrust } from "../trust";
import { publicationFromSource } from "../portfolio/publication";
import { validateAgreement, type WorkAgreement } from "../agreement";

// ── DB 행(snake_case) ↔ 도메인 타입(camelCase) 변환 ────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const u = <T,>(v: T | null | undefined) => v ?? undefined;
const toAgreement = (r: Row): WorkAgreement => ({ applicationId: r.application_id, version: r.version, terms: r.terms, studentConfirmedAt: r.student_confirmed_at, ownerConfirmedAt: r.owner_confirmed_at, finalizedAt: r.finalized_at, updatedAt: r.updated_at });
let realtimeChannelSequence = 0;

export const toUser = (r: Row): User => r.role === "admin"
  ? { id: r.id, role: "admin", name: r.name, location: { lat: r.lat, lng: r.lng } }
  : r.role === "student"
  ? { id: r.id, role: "student", name: r.name, department: r.department ?? "", school: u(r.school), college: u(r.college), age: u(r.age), phone: u(r.phone), about: r.about ?? "", avatarUrl: u(r.avatar_url), skills: r.skills ?? [], interests: r.interests ?? [], availableHours: r.available_hours ?? "", maxDistanceM: r.max_distance_m, location: { lat: r.lat, lng: r.lng } }
  : { id: r.id, role: "resident", name: r.name, kind: r.kind ?? "주민", address: r.address ?? "", location: { lat: r.lat, lng: r.lng } };

const toPost = (r: Row): Post => ({
  id: r.id, title: r.title, category: r.category, description: r.description, authorId: r.author_id,
  location: { lat: r.lat, lng: r.lng }, address: r.address, status: r.status, reward: r.reward ?? undefined,
  durationDays: r.duration_days, difficulty: r.difficulty, isTeam: r.is_team,
  teamSlots: r.roles?.length ? r.roles.map((x: Row) => ({ id: x.id, label: x.label, category: x.category, domain: x.domain, count: x.capacity, filled: [], filledCount: x.filled_count })) : r.team_slots ?? undefined,
  createdAt: r.created_at,
  urgent: r.urgent ?? false, urgentColleges: r.urgent_colleges ?? [],
  ongoing: r.ongoing ?? false, warrantyRequestCount: r.warranty_request_count ?? 3, handoverOfProject: u(r.handover_of_project), preferClub: r.prefer_club ?? false, applicantScope: r.applicant_scope ?? "ANY",
  problem: r.problem ?? "", domain: u(r.domain), expectedDeliverables: r.expected_deliverables ?? [], completionCriteria: r.completion_criteria ?? "",
  deadline: u(r.deadline), revisionLimit: r.revision_limit ?? 2, compensationType: r.compensation_type ?? "VOLUNTEER",
  compensationDescription: r.compensation_description ?? "", paidAmount: u(r.paid_amount), minimumTier: r.minimum_tier ?? "SEED",
});
const toApp = (r: Row): Application => ({ id: r.id, postId: r.post_id, studentId: r.student_id, clubId: u(r.club_id), message: r.message, roleId: u(r.role_id), status: r.status, createdAt: r.created_at });
/** Edge Function 이 보낸 한국어 에러 메시지를 꺼낸다 */
const fnError = async (error: unknown) =>
  (await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined)) ?? (error as Error).message;

const toOperations = (r: Row): Operations => ({
  projectId: r.project_id, status: r.status, maintainerId: u(r.maintainer_id), repoUrl: u(r.repo_url), deployUrl: u(r.deploy_url),
  adminHanded: r.admin_handed, envList: u(r.env_list), monthlyCost: u(r.monthly_cost), billingOwner: u(r.billing_owner),
  expiresOn: u(r.expires_on), backupNote: u(r.backup_note), knownIssues: u(r.known_issues),
  clubId: u(r.club_id), warrantyRequestUntil: u(r.warranty_request_until), warrantyDefectUntil: u(r.warranty_defect_until), requestUsed: r.request_used ?? 0,
  lastCheckAt: u(r.last_check_at), lastCheckOk: u(r.last_check_ok),
});
const toTicket = (r: Row): MaintenanceTicket => ({
  id: r.id, projectId: r.project_id, authorId: r.author_id, kind: r.kind, body: r.body, coverage: r.coverage,
  assigneeId: u(r.assignee_id), status: r.status, createdAt: r.created_at, closedAt: u(r.closed_at),
});
const toTerm = (r: Row): MaintainerTerm => ({ id: r.id, projectId: r.project_id, studentId: r.student_id, startedOn: r.started_on, endedOn: u(r.ended_on), ticketsClosed: r.tickets_closed ?? 0 });
const toDoc = (r: Row): HandoverDoc => ({ id: r.id, projectId: r.project_id, markdown: r.markdown, model: u(r.model), generatedAt: r.generated_at });

/** AI 없이 쓰는 기본 인수인계서 (서버 함수 handover-ai 의 template 과 같은 내용) */
function templateHandover(title: string, o: Operations) {
  const v = (x?: string) => (x && x.trim() ? x : "확인 필요");
  return [
    `# ${title} 인수인계서`, "",
    "## 어디에 무엇이 있나",
    `- 저장소: ${v(o.repoUrl)}`, `- 배포 주소: ${v(o.deployUrl)}`,
    `- 관리자 계정 전달: ${o.adminHanded ? "완료 (사장님 보관)" : "미완료"}`,
    `- 외부 서비스·환경값: ${v(o.envList)}`, "",
    "## 돈과 만료",
    `- 월 비용·결제일: ${v(o.monthlyCost)}`,
    `- 결제 명의: ${o.billingOwner === "CLIENT" ? "사장님" : o.billingOwner === "STUDENT" ? "학생 (사장님 명의로 이관 필요)" : "확인 필요"}`,
    `- 가장 먼저 만료되는 날: ${v(o.expiresOn)}`, `- 백업: ${v(o.backupNote)}`, "",
    "## 알려진 문제", o.knownIssues?.trim() || "기록된 문제 없음",
  ].join("\n");
}

const toClub = (r: Row): Club => ({
  id: r.id, name: r.name, kind: r.kind, kindOther: u(r.kind_other), description: r.description ?? "",
  college: u(r.college), createdBy: r.created_by, status: r.status ?? "APPROVED", rejectReason: u(r.reject_reason), memberCount: r.club_members?.[0]?.count ?? r.member_count,
});

const toMsg = (r: Row): ChatMessage => ({ id: r.id, applicationId: r.application_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at });
const toProject = (r: Row): Project => ({
  id: r.id, postId: r.post_id, ownerId: r.owner_id, domain: r.domain, mode: r.mode, status: r.status, questionSnapshot: r.question_snapshot,
  approvedVersionId: u(r.approved_version_id), createdAt: r.created_at, startedAt: u(r.started_at), completedAt: u(r.completed_at),
});
const toMember = (r: Row): ProjectMember => ({
  projectId: r.project_id, studentId: r.student_id, roleLabel: r.role_label, roleId: u(r.role_id), domain: u(r.domain),
  questionSnapshot: u(r.question_snapshot), isLead: r.is_lead ?? false, readyAt: u(r.ready_at), applicationId: u(r.application_id), joinedAt: r.joined_at,
});
const toMemberVerification = (r: Row): MemberVerification => ({ projectId: r.project_id, studentId: r.student_id, verifierId: r.verifier_id, verified: r.verified, note: r.note, createdAt: r.created_at });
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
const toPeerReview = (r: Row): TeamPeerReview => ({ id: r.id, projectId: r.project_id, reviewerId: r.reviewer_id, revieweeId: r.reviewee_id, communication: r.communication, collaboration: r.collaboration, responsibility: r.responsibility, comment: r.comment, createdAt: r.created_at });
const toNotification = (r: Row): Notification => ({ id: r.id, userId: r.user_id, postId: u(r.post_id), kind: u(r.kind), href: u(r.href), text: r.text, distanceM: u(r.distance_m), read: r.read, createdAt: r.created_at });

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
  const postsWithRoles = async () => {
    const result = await db.from("posts").select("*, roles:post_roles(*)").order("created_at", { ascending: false });
    if (!result.error) return result.data;
    // 0007 적용 전의 팀 DB도 기존 team_slots로 계속 읽을 수 있게 한다.
    if (/post_roles|relationship/i.test(result.error.message)) return ok(await db.from("posts").select("*").order("created_at", { ascending: false }));
    throw new Error(friendly(result.error.message));
  };
  const postWithRoles = async (id: string) => {
    const result = await db.from("posts").select("*, roles:post_roles(*)").eq("id", id).maybeSingle();
    if (!result.error) return result.data;
    if (/post_roles|relationship/i.test(result.error.message)) return maybe(await db.from("posts").select("*").eq("id", id).maybeSingle());
    throw new Error(friendly(result.error.message));
  };
  const repo: Repo = {
    async getAgreement(applicationId) {
      const row = maybe(await db.from("chat_agreements").select("*").eq("application_id", applicationId).maybeSingle());
      return row ? toAgreement(row) : null;
    },
    async saveAgreement(applicationId, _actorId, version, terms) {
      validateAgreement(terms);
      const row = ok(await db.rpc("save_chat_agreement", { p_application: applicationId, p_version: version, p_terms: terms }));
      return toAgreement(Array.isArray(row) ? row[0] : row);
    },
    async confirmAgreement(applicationId, _actorId, version) {
      const row = ok(await db.rpc("confirm_chat_agreement", { p_application: applicationId, p_version: version }));
      return toAgreement(Array.isArray(row) ? row[0] : row);
    },
    ...chatReads(`supabase:${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`),
    async listUsers() { return ok(await db.from("profiles").select("*")).map(toUser); },
    async getUser(id) { const r = maybe(await db.from("profiles").select("*").eq("id", id).maybeSingle()); return r ? toUser(r) : undefined; },
    async updatePortfolioProfile(studentId, data) {
      const { data: auth } = await db.auth.getUser();
      if (auth.user?.id !== studentId) throw new Error("본인의 프로필만 수정할 수 있어요.");
      done(await db.from("profiles").update({ about: data.about, ...(data.avatarUrl ? { avatar_url: data.avatarUrl } : {}) }).eq("id", studentId));
    },
    async uploadPortfolioImage(studentId, file) {
      const { data: auth } = await db.auth.getUser();
      if (auth.user?.id !== studentId) throw new Error("본인의 이미지만 올릴 수 있어요.");
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) throw new Error("JPG, PNG, WebP 이미지를 5MB 이하로 올려 주세요.");
      const path = `${studentId}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
      done(await db.storage.from("portfolio-images").upload(path, file, { contentType: file.type, upsert: false }));
      return db.storage.from("portfolio-images").getPublicUrl(path).data.publicUrl;
    },
    async listPosts() { return (await postsWithRoles()).map(toPost); },
    async getPost(id) { const r = await postWithRoles(id); return r ? toPost(r) : undefined; },
    async createPost(p) {
      const row = {
        title: p.title, category: p.category, description: p.description, author_id: p.authorId, lat: p.location.lat, lng: p.location.lng,
        address: p.address, reward: p.reward || null, duration_days: p.durationDays, difficulty: p.difficulty, is_team: p.isTeam, team_slots: p.teamSlots ?? null,
        urgent: p.urgent ?? false, urgent_colleges: p.urgentColleges ?? [], applicant_scope: p.applicantScope ?? "ANY",
        problem: p.problem ?? "", domain: p.domain ?? null, expected_deliverables: p.expectedDeliverables ?? [], completion_criteria: p.completionCriteria ?? "",
        deadline: p.deadline || null, revision_limit: p.revisionLimit ?? 2, compensation_type: p.compensationType ?? "VOLUNTEER",
        compensation_description: p.compensationDescription ?? "",
        // 평소 공고는 가게 쿠폰(NON_MONETARY). 긴급 공고일 때만 현금 사례비를 받는다
        paid_amount: p.urgent && p.compensationType === "PAID" ? p.paidAmount ?? null : null,
        minimum_tier: "SEED",
      };
      // 새 컬럼이 아직 없는 DB 에서도 등록 자체는 되게 한다 (긴급·유지보수 기능만 빠진다)
      let res = await db.from("posts").insert(row).select().single();
      if (res.error && /urgent|applicant_scope|schema cache/i.test(res.error.message)) {
        const { urgent, urgent_colleges, applicant_scope, ...legacy } = row; void urgent; void urgent_colleges; void applicant_scope;
        res = await db.from("posts").insert(legacy).select().single();
      }
      const r = ok(res);
      if (p.isTeam && p.teamSlots?.length) {
        done(await db.from("post_roles").insert(p.teamSlots.map((slot, index) => ({
          post_id: r.id, label: slot.label?.trim() || slot.category, category: slot.category,
          domain: slot.domain ?? domainForCategory(slot.category), capacity: slot.count, sort_order: index,
        }))));
      }
      return (await repo.getPost(r.id)) ?? toPost(r);
    },
    async updatePostStatus(id, status) { done(await db.from("posts").update({ status }).eq("id", id)); },
    async deletePost(postId) { done(await db.rpc("delete_post", { p_post: postId })); },
    async listApplications(postId) {
      let q = db.from("applications").select("*").order("created_at");
      if (postId) q = q.eq("post_id", postId);
      return ok(await q).map(toApp);
    },
    async apply(postId, studentId, message, roleId, clubId) { return toApp(ok(await db.from("applications").insert({ post_id: postId, student_id: studentId, message, role_id: roleId ?? null, club_id: clubId ?? null }).select().single())); },
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
      // The room screen and the global unread counter can subscribe to the same
      // application at once. Supabase reuses channels by topic, so every local
      // subscriber needs its own topic before handlers are registered.
      const ch = db.channel(`messages:${applicationId}:${++realtimeChannelSequence}`)
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
    async updatePublishedPortfolio(actorId, item) {
      const { data, error } = await db.auth.getUser();
      if (error || data.user?.id !== actorId || actorId !== item.studentId) throw new Error("본인의 게시물만 수정할 수 있어요.");
      if (!item.title.trim()) throw new Error("제목을 입력해 주세요.");
      const result = await db.from("portfolio_publications").update({ title: item.title, summary: item.summary, sections: item.sections, cover_url: item.coverUrl ?? null }).eq("student_id", actorId).eq("source_id", item.sourceId).eq("source_kind", item.sourceKind).select("source_id");
      if (!ok(result).length) throw new Error("공개된 게시물을 찾을 수 없어요.");
    },
    async listPublishedPortfolio(studentId) {
      return ok(await db.from("portfolio_publications").select("*").eq("student_id", studentId).order("published_at", { ascending: false })).map((r: Row) => ({
        studentId: r.student_id, sourceId: r.source_id, sourceKind: r.source_kind, title: r.title, summary: r.summary, category: r.category, sections: r.sections, publishedAt: r.published_at, coverUrl: u(r.cover_url),
      }));
    },
    async publishPortfolio(studentId, sourceId, sourceKind, coverUrl) {
      const { data, error } = await db.auth.getUser();
      if (error || data.user?.id !== studentId) throw new Error("본인의 포트폴리오만 공개할 수 있어요.");
      const p = await publicationFromSource(repo, studentId, sourceId, sourceKind);
      const existing = maybe(await db.from("portfolio_publications").select("cover_url").eq("student_id", studentId).eq("source_kind", sourceKind).eq("source_id", sourceId).maybeSingle());
      done(await db.from("portfolio_publications").upsert({ student_id: studentId, source_id: sourceId, source_kind: sourceKind, title: p.title, summary: p.summary, category: p.category, sections: p.sections, published_at: p.publishedAt, cover_url: coverUrl ?? existing?.cover_url ?? null }, { onConflict: "student_id,source_kind,source_id" }));
    },
    async unpublishPortfolio(studentId, sourceId, sourceKind) {
      const { data, error } = await db.auth.getUser();
      if (error || data.user?.id !== studentId) throw new Error("본인의 공개 설정만 변경할 수 있어요.");
      done(await db.from("portfolio_publications").delete().eq("student_id", studentId).eq("source_id", sourceId).eq("source_kind", sourceKind));
    },
    async listNotifications(userId) {
      return ok(await db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false })).map(toNotification);
    },
    async markNotificationRead(id, userId) { done(await db.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId)); },
    onNotification(userId, cb) {
      const ch = db.channel(`notifications:${userId}:${++realtimeChannelSequence}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (e) => cb(toNotification(e.new)))
        .subscribe();
      return () => { db.removeChannel(ch); };
    },
    // ── 검증형 포트폴리오 파이프라인 (규칙은 DB 함수가 강제: supabase/migrations/0005) ──────
    async selectApplicant(applicationId) {
      const app = await repo.getApplication(applicationId);
      const post = app && await repo.getPost(app.postId);
      if (!post) throw new Error("지원서를 찾을 수 없어요");
      const domain = post.teamSlots?.find((role) => role.id === app?.roleId)?.domain ?? listingOf(post).domain;
      const snapshot = { domain, version: QUESTION_SET_VERSION, questions: DOMAINS[domain].questions, takenAt: new Date().toISOString() };
      const id: string = ok(await db.rpc("select_applicant", { p_application: applicationId, p_question_snapshot: snapshot }));
      return toProject(ok(await db.from("projects").select("*").eq("id", id).single()));
    },
    async startTeamProject(projectId, _actorId, leaderId) {
      const id: string = ok(await db.rpc("start_team_project", { p_project: projectId, p_leader: leaderId }));
      return toProject(ok(await db.from("projects").select("*").eq("id", id).single()));
    },
    async getProjectByPost(postId) { const r = maybe(await db.from("projects").select("*").eq("post_id", postId).maybeSingle()); return r ? toProject(r) : undefined; },
    async listMyProjects(userId) {
      const memberOf = ok(await db.from("project_members").select("project_id").eq("student_id", userId)).map((r: Row) => r.project_id);
      let q = db.from("projects").select("*, post:posts!projects_post_id_fkey(*, roles:post_roles(*))").order("created_at", { ascending: false });
      q = memberOf.length ? q.or(`owner_id.eq.${userId},id.in.(${memberOf.join(",")})`) : q.eq("owner_id", userId);
      return ok(await q).map((r: Row) => ({ project: toProject(r), post: toPost(r.post) }));
    },
    async getBundle(projectId) {
      const p = maybe(await db.from("projects").select("*, post:posts!projects_post_id_fkey(*, roles:post_roles(*))").eq("id", projectId).maybeSingle());
      if (!p) throw new Error("프로젝트를 찾을 수 없거나 볼 권한이 없어요 (선정된 학생과 의뢰인만 볼 수 있어요)");
      const by = (t: string, order = "created_at") => db.from(t).select("*").eq("project_id", projectId).order(order);
      const optionalMemberVerifications = async () => {
        const result = await db.from("member_verifications").select("*").eq("project_id", projectId).order("created_at");
        return result.error && /member_verifications|schema cache/i.test(result.error.message) ? { data: [], error: null } : result;
      };
      const optionalPeerReviews = async () => {
        const result = await db.from("team_peer_reviews").select("*").eq("project_id", projectId).order("created_at");
        return result.error && /team_peer_reviews|schema cache/i.test(result.error.message) ? { data: [], error: null } : result;
      };
      const [members, memberVerifications, answers, logs, evidence, versions, verification, review, outcomes, snapshots, drafts, edits, peerReviews] = await Promise.all([
        by("project_members", "joined_at"), optionalMemberVerifications(), by("project_answers", "updated_at"), by("activity_logs"), by("evidence"), by("submission_versions", "version"),
        db.from("client_verifications").select("*").eq("project_id", projectId).maybeSingle(), db.from("client_reviews").select("*").eq("project_id", projectId).maybeSingle(),
        by("outcomes"), by("portfolio_snapshots"), by("portfolio_drafts"), by("portfolio_edits", "version"), optionalPeerReviews(),
      ]);
      const bundle: ProjectBundle = {
        project: toProject(p), post: toPost(p.post),
        members: ok(members).map(toMember), memberVerifications: ok(memberVerifications).map(toMemberVerification), answers: ok(answers).map(toAnswer), logs: ok(logs).map(toLog), evidence: ok(evidence).map(toEvidence),
        versions: ok(versions).map(toVersion), verification: maybe(verification) && toVerification(maybe(verification)!), review: maybe(review) && toReview(maybe(review)!),
        outcomes: ok(outcomes).map(toOutcome), snapshots: ok(snapshots).map(toSnapshot), drafts: ok(drafts).map(toDraft), edits: ok(edits).map(toEdit), peerReviews: ok(peerReviews).map(toPeerReview),
      };
      return bundle;
    },
    async saveAnswer(a) {
      const origin = a.origin ?? "SCHEMA";
      const b = ok(await db.from("projects").select("question_snapshot, project_members!inner(question_snapshot, student_id)").eq("id", a.projectId).eq("project_members.student_id", a.actorId).single());
      const snapshot = b.project_members?.[0]?.question_snapshot ?? b.question_snapshot;
      const q = (snapshot.questions as { id: string; field: string; stage: string }[]).find((x) => x.id === (origin === "SCHEMA" ? a.questionId : a.parentQuestionId));
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
    async uploadEvidenceFile(projectId, file, publicConsent) {
      if (publicConsent !== true) throw new Error("이 파일을 공개 링크로 업로드하는 데 동의해야 해요. 비공개 자료는 올리지 마세요.");
      if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하 파일만 올릴 수 있어요");
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) throw new Error("로그인이 필요해요");
      const path = `${auth.user.id}/${projectId}/${crypto.randomUUID()}.${ext}`; // Storage 규칙: 내 id 폴더에만 올릴 수 있다
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
    async approveVersion(a) {
      const fn = a.verifiedMemberIds ? "approve_team_version" : "approve_version";
      const args: Row = { p_version: a.versionId, p_claims: a.claims, p_review: a.review, p_note: a.note ?? "" };
      if (a.verifiedMemberIds) args.p_verified_members = a.verifiedMemberIds;
      done(await db.rpc(fn, args));
    },
    async savePeerReview(a) {
      return toPeerReview(ok(await db.from("team_peer_reviews").upsert({
        project_id: a.projectId, reviewer_id: a.reviewerId, reviewee_id: a.revieweeId,
        communication: a.communication, collaboration: a.collaboration, responsibility: a.responsibility, comment: a.comment.trim(),
      }, { onConflict: "project_id,reviewer_id,reviewee_id" }).select().single()));
    },
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
      // 함수에 닿지 못함(미배포·네트워크) → 템플릿 초안. 화면에는 "템플릿 초안 · AI 미사용" 로 표시된다
      return templateFallback(projectId, actorId, !!opts?.regenerate, "AI 서버에 연결하지 못해 템플릿으로 만들었어요");
    },
    async savePortfolioEdit(draftId, _actorId, content) {
      const id: string = ok(await db.rpc("save_portfolio_edit", { p_draft: draftId, p_content: sanitizeContent(content) }));
      return toEdit(ok(await db.from("portfolio_edits").select("*").eq("id", id).single()));
    },
    async listPortfolioDocs(studentId) {
      const rows = ok(await db.from("portfolio_edits").select("*, project:projects(*, post:posts!projects_post_id_fkey(*))").eq("student_id", studentId).order("version", { ascending: false }));
      const seen = new Set<string>();
      return rows.filter((r: Row) => r.project && !seen.has(r.project_id) && seen.add(r.project_id))
        .map((r: Row) => ({ edit: toEdit(r), project: toProject(r.project), post: toPost(r.project.post) }));
    },
    async getPortfolioDoc(projectId, studentId) {
      const r = maybe(await db.from("portfolio_edits").select("*").eq("project_id", projectId).eq("student_id", studentId).order("version", { ascending: false }).limit(1).maybeSingle());
      return r ? { edit: toEdit(r), bundle: await repo.getBundle(projectId) } : undefined;
    },
    // ── 유지보수·인수인계 ─────────────────────────────────────────────────
    async getOperations(projectId) {
      const o = maybe(await db.from("operations").select("*").eq("project_id", projectId).maybeSingle());
      if (!o) return null;
      const [history, tickets, docs] = await Promise.all([
        db.from("maintainer_history").select("*").eq("project_id", projectId).order("started_on").then(ok),
        db.from("maintenance_tickets").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).then(ok),
        db.from("handover_docs").select("*").eq("project_id", projectId).order("generated_at", { ascending: false }).limit(1).then(ok),
      ]);
      return { operations: toOperations(o), history: (history as Row[]).map(toTerm), tickets: (tickets as Row[]).map(toTicket), doc: (docs as Row[])[0] ? toDoc((docs as Row[])[0]) : null };
    },
    async saveHandover(projectId, _actorId, data) { done(await db.rpc("save_handover", { p_project: projectId, p_data: data })); },
    async generateHandoverDoc(projectId) {
      const { data, error } = await db.functions.invoke<HandoverDoc>("handover-ai", { body: { projectId } });
      if (!error) return data!;
      // 서버 함수가 아직 배포되지 않았거나 AI 가 실패하면, 입력한 정보만으로 기본 문서를 만들어 저장한다
      const bundle = await repo.getOperations(projectId);
      if (!bundle) throw new Error(await fnError(error));
      const row = maybe(await db.from("projects").select("post:posts!projects_post_id_fkey(title)").eq("id", projectId).maybeSingle());
      const markdown = templateHandover(row?.post?.title ?? "프로젝트", bundle.operations);
      const saved = ok(await db.from("handover_docs").insert({ project_id: projectId, markdown, model: "TEMPLATE" }).select().single());
      return toDoc(saved);
    },
    async openHandover(projectId) { done(await db.rpc("open_handover", { p_project: projectId })); },
    async takeOver() { throw new Error("이어받기 공고에 지원하면 사장님이 선정해요"); },
    async listHandoverOpenings() {
      const rows = ok(await db.from("operations").select("*, project:projects(*, post:posts!projects_post_id_fkey(*))").eq("status", "HANDOVER_OPEN")) as Row[];
      return rows.filter((r) => r.project?.post).map((r) => ({ operations: toOperations(r), post: toPost(r.project.post), project: toProject(r.project) }));
    },
    async createTicket(projectId, _actorId, kind, body) {
      const id: string = ok(await db.rpc("create_ticket", { p_project: projectId, p_kind: kind, p_body: body }));
      return toTicket(ok(await db.from("maintenance_tickets").select("*").eq("id", id).single()));
    },
    async closeTicket(ticketId) { done(await db.rpc("close_ticket", { p_ticket: ticketId })); },
    async recordUptime(projectId, okFlag) { done(await db.rpc("record_uptime", { p_project: projectId, p_ok: okFlag })); },
    async listOperatingProjects(userId) {
      const rows = ok(await db.from("operations").select("*, project:projects(*, post:posts!projects_post_id_fkey(*))")) as Row[];
      return rows
        .filter((r) => r.project?.post && (r.maintainer_id === userId || r.project.owner_id === userId))
        .map((r) => ({ operations: toOperations(r), post: toPost(r.project.post), project: toProject(r.project) }));
    },

    // ── 단체 ──────────────────────────────────────────────────────────────
    async listClubs() {
      const rows = ok(await db.from("clubs").select("*, club_members(count)").eq("status", "APPROVED").order("name")) as Row[];
      return rows.map(toClub);
    },
    async myClubs(studentId) {
      const rows = ok(await db.from("club_members").select("role, club:clubs(*, club_members(count))").eq("student_id", studentId)) as Row[];
      return rows.filter((r) => r.club).map((r) => ({ club: toClub(r.club), role: r.role }));
    },
    async listClubMembers(clubId) {
      const rows = ok(await db.from("club_members").select("*").eq("club_id", clubId).order("joined_at")) as Row[];
      return rows.map((r): ClubMember => ({ clubId: r.club_id, studentId: r.student_id, role: r.role, status: r.status ?? "ACTIVE", joinedAt: r.joined_at }));
    },
    async createClub(_actorId, input) {
      const id: string = ok(await db.rpc("create_club", {
        p_name: input.name, p_kind: input.kind, p_description: input.description,
        p_college: input.college ?? null, p_kind_other: input.kindOther ?? null,
      }));
      return toClub(ok(await db.from("clubs").select("*").eq("id", id).single()));
    },
    async joinClub(clubId) { done(await db.rpc("join_club", { p_club: clubId })); },
    async reviewMember(clubId, studentId, approve) { done(await db.rpc("review_member", { p_club: clubId, p_student: studentId, p_approve: approve })); },
    async leaveClub(clubId) { done(await db.rpc("leave_club", { p_club: clubId })); },
    async assignMaintainer(projectId, studentId) { done(await db.rpc("assign_maintainer", { p_project: projectId, p_student: studentId })); },

    // ── 관리자 ────────────────────────────────────────────────────────────
    async listPendingClubs() { return (ok(await db.from("clubs").select("*").eq("status", "PENDING").order("created_at")) as Row[]).map(toClub); },
    async listClubsByStatus(status) { return (ok(await db.from("clubs").select("*, club_members(count)").eq("status", status).order("created_at", { ascending: false })) as Row[]).map(toClub); },
    async reviewClub(clubId, approve, reason) { done(await db.rpc("review_club", { p_club: clubId, p_approve: approve, p_reason: reason ?? null })); },
    async adminOverview() {
      const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const [profiles, posts, operations, tickets, pending] = await Promise.all([
        db.from("profiles").select("role").then(ok) as Promise<Row[]>,
        db.from("posts").select("id, title, status, urgent").then(ok) as Promise<Row[]>,
        db.from("operations").select("*, project:projects(post:posts!projects_post_id_fkey(title))").then(ok) as Promise<Row[]>,
        db.from("maintenance_tickets").select("status").eq("status", "OPEN").then(ok) as Promise<Row[]>,
        db.from("clubs").select("id").eq("status", "PENDING").then(ok) as Promise<Row[]>,
      ]);
      const title = (o: Row) => o.project?.post?.title ?? "프로젝트";
      return {
        pendingClubs: pending.length,
        students: profiles.filter((p) => p.role === "student").length,
        residents: profiles.filter((p) => p.role === "resident").length,
        posts: posts.length,
        urgentOpen: posts.filter((p) => p.urgent && p.status === "open").length,
        operating: operations.filter((o) => o.status === "WARRANTY" || o.status === "OPERATING").length,
        handoverOpen: operations.filter((o) => o.status === "HANDOVER_OPEN").length,
        warrantyEndingSoon: operations.filter((o) => o.warranty_defect_until && o.warranty_defect_until <= soon)
          .map((o) => ({ projectId: o.project_id, title: title(o), until: o.warranty_defect_until })),
        downSites: operations.filter((o) => o.last_check_ok === false).map((o) => ({ projectId: o.project_id, title: title(o) })),
        openTickets: tickets.length,
      };
    },

    async trustSummary(studentId) {
      const [events, badges, peerReviewsResult] = await Promise.all([
        db.from("tier_score_events").select("*").eq("student_id", studentId).then(ok),
        db.from("badges").select("*").eq("student_id", studentId).then(ok),
        db.from("team_peer_reviews").select("*").eq("reviewee_id", studentId),
      ]);
      const ids = [...new Set((events as Row[]).map((e) => e.project_id))];
      const reviews = ids.length ? ok(await db.from("client_reviews").select("*").in("project_id", ids)).map(toReview) : [];
      const peerReviews = peerReviewsResult.error && /team_peer_reviews|schema cache/i.test(peerReviewsResult.error.message) ? [] : ok(peerReviewsResult).map(toPeerReview);
      return summarizeTrust(events.map(toEvent), reviews, badges.map(toBadge), peerReviews);
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
