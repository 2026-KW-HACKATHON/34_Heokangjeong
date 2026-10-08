// 포트폴리오 AI (Supabase Edge Function, Deno). Gemini 키는 서버에만 둔다.
//  action "followup"  : 짧은 답 → 구체화 후속 질문 1~2개 (Layer B)
//  action "narrative" : 완료된 프로젝트 → 원본 스냅샷 → AI 초안 → 사실 검사 → 저장. AI 가 실패하면 템플릿 초안(TEMPLATE 으로 표시)
// 모든 DB 접근은 요청자의 JWT 로 한다 → RLS 가 "선정된 학생·완료된 프로젝트·본인" 을 검사한다.
// 배포: npx supabase functions deploy portfolio-ai
import { cors, HttpError, json, ok, userClient } from "../_shared/http.ts";
import { AiUnavailable, geminiJson } from "../_shared/gemini.ts";
import { DOMAINS } from "../_shared/portfolio/domains.ts";
import { buildSource, sourceHash } from "../_shared/portfolio/snapshot.ts";
import { guardNarrative, NARRATIVE_SYSTEM, narrativeSchema, narrativeUserPrompt, planSections, templateDraft } from "../_shared/portfolio/narrative.ts";
import { FOLLOWUP_PROMPT, MAX_FOLLOW_UPS } from "../_shared/portfolio/followup.ts";
import {
  rowToAnswer, rowToEvidence, rowToLog, rowToMember, rowToOutcome, rowToProject, rowToReview, rowToVerification, rowToVersion,
} from "../_shared/portfolio/rows.ts";
import type { DomainKey, ProjectAnswer, ProjectMember } from "../_shared/portfolio/types.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { db, userId } = await userClient(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === "followup") return json(await followup(body));
    if (body.action === "narrative") return json(await narrative(db, userId, String(body.projectId ?? ""), !!body.regenerate));
    throw new HttpError(400, "알 수 없는 요청이에요");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("portfolio-ai", e);
    return json({ error: "처리하지 못했어요. 잠시 후 다시 시도해 주세요" }, 500);
  }
});

async function followup(b: { question?: string; answer?: string; domain?: string }) {
  const question = String(b.question ?? "").slice(0, 200), answer = String(b.answer ?? "").slice(0, 1000);
  if (!question || !answer.trim()) throw new HttpError(400, "질문과 답이 필요해요");
  const domain = (b.domain && b.domain in DOMAINS ? b.domain : "GENERAL") as DomainKey;
  const schema = { type: "OBJECT", properties: { questions: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, example: { type: "STRING" } }, required: ["question", "example"] } } }, required: ["questions"] };
  try {
    const { data } = await geminiJson(FOLLOWUP_PROMPT, `분야: ${DOMAINS[domain].label}\n질문: ${question}\n학생 답: ${answer}`, schema, 25_000, { thinking: "minimal", perModelMs: 12_000 });
    const qs = ((data as { questions?: unknown }).questions ?? []) as { question?: unknown; example?: unknown }[];
    const items = qs
      .filter((q) => typeof q?.question === "string" && q.question.trim().length > 3)
      .map((q) => { const t = String(q.question).trim().slice(0, 80); return { question: /[?？]$/.test(t) ? t : `${t}?`, example: typeof q.example === "string" ? q.example.trim().slice(0, 80) : "" }; })
      .slice(0, MAX_FOLLOW_UPS);
    return { questions: items.map((x) => x.question), examples: items.map((x) => x.example), source: "AI" };
  } catch (e) {
    if (e instanceof AiUnavailable) return { questions: [], source: "UNAVAILABLE", error: e.message };
    throw e;
  }
}

async function narrative(db: Awaited<ReturnType<typeof userClient>>["db"], userId: string, projectId: string, regenerate: boolean) {
  const p = ok(await db.from("projects").select("*, post:posts(*)").eq("id", projectId).maybeSingle());
  const project = rowToProject(p);
  const members: ProjectMember[] = ok(await db.from("project_members").select("*").eq("project_id", projectId)).map(rowToMember);
  const member = members.find((m) => m.studentId === userId);
  if (!member) throw new HttpError(403, "선정된 학생만 포트폴리오를 만들 수 있어요");
  if (project.status !== "COMPLETED") throw new HttpError(409, "의뢰인 승인·검증이 끝난 뒤에 포트폴리오를 만들 수 있어요");
  if (project.mode === "TEAM") {
    const verified = await db.from("member_verifications").select("verified").eq("project_id", projectId).eq("student_id", userId).maybeSingle();
    if (verified.error || !verified.data?.verified) throw new HttpError(403, "의뢰인이 실제 참여를 확인한 팀원만 포트폴리오를 만들 수 있어요");
  }

  const by = (t: string) => db.from(t).select("*").eq("project_id", projectId);
  const [answers, logs, evidence, versions, verification, review, outcomes, profiles] = await Promise.all([
    by("project_answers"), by("activity_logs"), by("evidence"), by("submission_versions"),
    db.from("client_verifications").select("*").eq("project_id", projectId).maybeSingle(), db.from("client_reviews").select("*").eq("project_id", projectId).maybeSingle(),
    by("outcomes"), db.from("profiles").select("*").in("id", [project.ownerId, userId]),
  ]);
  const client = ok(profiles).find((x: { id: string }) => x.id === project.ownerId);
  const student = ok(profiles).find((x: { id: string }) => x.id === userId);
  const post = p.post;
  const answerRows: ProjectAnswer[] = ok(answers).map(rowToAnswer);
  const role = answerRows.find((a) => a.authorId === userId && a.field === "role" && a.origin === "SCHEMA" && a.status === "ANSWERED");
  const memberProject = member.questionSnapshot ? { ...project, domain: member.domain ?? project.domain, questionSnapshot: member.questionSnapshot } : project;
  const src = buildSource({
    project: memberProject,
    listing: {
      title: post.title, problem: post.problem || post.description, category: post.category, expectedDeliverables: post.expected_deliverables ?? [],
      completionCriteria: post.completion_criteria ?? "", compensationType: post.compensation_type ?? "VOLUNTEER",
    },
    client: { name: client?.name ?? "의뢰인", kind: client?.kind ?? "주민" },
    member: { studentId: userId, name: student?.name ?? "", department: student?.department ?? "", roleLabel: (role ? [...role.choices, role.value].filter(Boolean).join(", ") : "") || member.roleLabel },
    answers: answerRows, logs: ok(logs).map(rowToLog), evidence: ok(evidence).map(rowToEvidence), versions: ok(versions).map(rowToVersion),
    verification: verification.data ? rowToVerification(verification.data) : null, review: review.data ? rowToReview(review.data) : null,
    outcomes: ok(outcomes).map(rowToOutcome), now: new Date().toISOString(),
  });
  const hash = sourceHash(src);

  // 같은 자료 = 같은 스냅샷 (unique 제약), 같은 스냅샷의 초안이 있으면 재사용 (중복 생성 방지)
  const ins = await db.from("portfolio_snapshots").upsert({ project_id: projectId, student_id: userId, hash, data: src }, { onConflict: "project_id,student_id,hash", ignoreDuplicates: true });
  if (ins.error) throw new HttpError(400, ins.error.message);
  const snap = ok(await db.from("portfolio_snapshots").select("id, data").eq("project_id", projectId).eq("student_id", userId).eq("hash", hash).single());
  const prev = await db.from("portfolio_drafts").select("*").eq("snapshot_id", snap.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (prev.data && !regenerate) return { draft: prev.data, reused: true };

  const plans = planSections(snap.data);
  let content, report = null, generator = "AI", model: string | null = null, aiError: string | undefined;
  try {
    const r = await geminiJson(NARRATIVE_SYSTEM, narrativeUserPrompt(snap.data, plans), narrativeSchema(plans), 90_000, { thinking: "low", perModelMs: 40_000 });
    const g = guardNarrative(r.data, snap.data, plans);
    content = g.content; report = g.report; model = r.model;
  } catch (e) {
    if (!(e instanceof AiUnavailable) && !(e instanceof SyntaxError)) console.error("narrative", e);
    content = templateDraft(snap.data, plans); generator = "TEMPLATE";
    aiError = e instanceof AiUnavailable ? e.message : "AI 답변을 읽지 못했어요";
  }
  const draft = ok(await db.from("portfolio_drafts").insert({ snapshot_id: snap.id, project_id: projectId, student_id: userId, generator, model, content, guard_report: report }).select().single());
  return { draft, reused: false, aiError };
}
