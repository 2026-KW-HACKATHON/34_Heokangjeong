// 인수인계서 AI (Supabase Edge Function, Deno).
// 담당 학생이 남긴 운영 정보 + 프로젝트 기록으로 "다음 담당자가 읽을 문서"를 만든다.
// 입력에 없는 사실은 지어내지 않는다 (없으면 '확인 필요'로 남긴다). AI 가 실패하면 입력값만으로 된 표를 돌려준다.
// 배포: npx supabase functions deploy handover-ai
import { cors, HttpError, json, ok, userClient } from "../_shared/http.ts";
import { AiUnavailable, geminiJson } from "../_shared/gemini.ts";

const SYSTEM = `너는 지역 소상공인의 웹사이트·앱을 맡아 온 대학생이 다음 담당 학생에게 넘기는 인수인계서를 쓴다.
읽는 사람은 이 프로젝트를 처음 보는 학생이고, 한 시간 안에 파악해서 수정할 수 있어야 한다.

규칙
- 주어진 정보에 없는 사실(기술 스택, 비밀번호, 일정, 구조)은 절대 지어내지 않는다. 모르면 "확인 필요"라고 적는다.
- 존댓말, 짧은 문장. 각 항목은 1~3문장 또는 목록.
- 사장님(의뢰인)이 읽어도 이해할 수 있는 말로 쓴다. 전문 용어는 괄호로 풀어 쓴다.

sections 에는 아래 제목을 이 순서로 담는다.
1. 이 프로젝트는 무엇인가  2. 어디에 무엇이 있나 (저장소·배포·관리자)  3. 돈과 만료 (비용·결제 명의·만료일)
4. 자주 하게 될 수정  5. 주의할 점과 알려진 문제  6. 처음 맡으면 이 순서로 확인하세요`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    sections: { type: "ARRAY", items: { type: "OBJECT", properties: { heading: { type: "STRING" }, body: { type: "STRING" } }, required: ["heading", "body"] } },
    checks: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["summary", "sections", "checks"],
};

type Row = Record<string, unknown>;
const v = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : "확인 필요");

/** AI 없이도 쓰는 기본 문서 (입력값만 정리) */
function template(post: Row, o: Row) {
  return [
    `# ${post.title} 인수인계서`, "",
    "## 어디에 무엇이 있나",
    `- 저장소: ${v(o.repo_url)}`,
    `- 배포 주소: ${v(o.deploy_url)}`,
    `- 관리자 계정 전달: ${o.admin_handed ? "완료 (사장님 보관)" : "미완료"}`,
    `- 외부 서비스·환경값: ${v(o.env_list)}`, "",
    "## 돈과 만료",
    `- 월 비용·결제일: ${v(o.monthly_cost)}`,
    `- 결제 명의: ${o.billing_owner === "CLIENT" ? "사장님" : o.billing_owner === "STUDENT" ? "학생 (사장님 명의로 이관 필요)" : "확인 필요"}`,
    `- 가장 먼저 만료되는 날: ${v(o.expires_on)}`,
    `- 백업: ${v(o.backup_note)}`, "",
    "## 알려진 문제",
    typeof o.known_issues === "string" && o.known_issues.trim() ? o.known_issues : "기록된 문제 없음",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { db, userId } = await userClient(req);
    const projectId = String((await req.json().catch(() => ({}))).projectId ?? "");
    if (!projectId) throw new HttpError(400, "프로젝트를 찾을 수 없어요");

    const o = ok(await db.from("operations").select("*").eq("project_id", projectId).maybeSingle()) as Row | null;
    if (!o) throw new HttpError(404, "운영 중인 프로젝트가 아니에요");
    if (o.maintainer_id !== userId) throw new HttpError(403, "현재 담당자만 인수인계서를 만들 수 있어요");

    const project = ok(await db.from("projects").select("*, post:posts(*)").eq("id", projectId).single()) as Row;
    const post = project.post as Row;
    const [answers, evidence, logs] = await Promise.all([
      db.from("project_answers").select("question_title, answer").eq("project_id", projectId).limit(40).then((r) => (r.data ?? []) as Row[]),
      db.from("evidence").select("type, description, url").eq("project_id", projectId).limit(30).then((r) => (r.data ?? []) as Row[]),
      db.from("activity_logs").select("stage, note").eq("project_id", projectId).limit(30).then((r) => (r.data ?? []) as Row[]),
    ]);

    const input = [
      `공고 제목: ${post.title}`,
      `의뢰 내용: ${post.description ?? ""}`,
      `해결하려던 문제: ${post.problem ?? ""}`,
      `기대 결과물: ${(post.expected_deliverables as string[] | null)?.join(", ") ?? ""}`,
      "",
      "[운영 정보]",
      `저장소: ${v(o.repo_url)}`, `배포 주소: ${v(o.deploy_url)}`,
      `관리자 계정 전달: ${o.admin_handed ? "완료" : "미완료"}`,
      `외부 서비스·환경값: ${v(o.env_list)}`,
      `월 비용·결제일: ${v(o.monthly_cost)}`,
      `결제 명의: ${o.billing_owner === "CLIENT" ? "사장님" : o.billing_owner === "STUDENT" ? "학생" : "확인 필요"}`,
      `만료 예정일: ${v(o.expires_on)}`, `백업: ${v(o.backup_note)}`, `알려진 문제: ${v(o.known_issues)}`,
      "",
      "[학생이 남긴 활동 기록]",
      ...answers.map((a) => `- ${a.question_title}: ${a.answer}`),
      ...logs.map((l) => `- (${l.stage}) ${l.note}`),
      "",
      "[증빙]",
      ...evidence.map((e) => `- ${e.type}: ${e.description ?? ""} ${e.url ?? ""}`),
    ].join("\n").slice(0, 12000);

    let markdown = template(post, o);
    let model = "TEMPLATE";
    try {
      const { data, model: used } = await geminiJson(SYSTEM, input, SCHEMA, 40_000, { thinking: "low", perModelMs: 20_000 });
      const d = data as { summary: string; sections: { heading: string; body: string }[]; checks: string[] };
      markdown = [
        `# ${post.title} 인수인계서`, "", d.summary, "",
        ...d.sections.flatMap((s) => [`## ${s.heading}`, s.body, ""]),
        "## 처음 맡으면 확인할 것", ...d.checks.map((c) => `- [ ] ${c}`),
      ].join("\n");
      model = used;
    } catch (e) {
      if (!(e instanceof AiUnavailable)) throw e;   // AI 가 안 되면 기본 문서로 저장한다
      console.error("handover-ai fallback", (e as Error).message);
    }

    const saved = ok(await db.from("handover_docs").insert({ project_id: projectId, markdown, model }).select().single()) as Row;
    return json({ id: saved.id, projectId, markdown, model, generatedAt: saved.generated_at });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("handover-ai", e);
    return json({ error: "인수인계서를 만들지 못했어요. 잠시 후 다시 시도해 주세요" }, 500);
  }
});
