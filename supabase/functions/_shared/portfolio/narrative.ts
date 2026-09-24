// Portfolio Narrative Engine.
// 스냅샷(PortfolioSource) → 분야별 템플릿의 섹션 계획 → (AI 또는 템플릿) 초안 → 사실 검사(guard) → PortfolioContent.
// 서사 구조: Problem → Decision → Action → Evidence → Result → Reflection
// 원칙: 스냅샷에 없는 사실(숫자·성과·도구·인과)은 쓰지 않는다. 재료가 없는 섹션은 만들지 않는다.
import { DOMAINS } from "./domains.ts";
import type {
  GuardReport, NarrativeRole, PortfolioContent, PortfolioSection, PortfolioSource, SectionDef, SourceEvidence, SourceField, SourceOutcome,
} from "./types.ts";

export interface SectionPlan { def: SectionDef; fields: SourceField[]; evidence: SourceEvidence[]; outcomes: SourceOutcome[]; usageVerified: boolean }

const ROLE_ORDER: NarrativeRole[] = ["overview", "context", "problem", "decision", "action", "evidence", "result", "reflection"];
export const ROLE_LABEL: Record<NarrativeRole, string> = {
  overview: "개요", context: "배경", problem: "문제", decision: "판단", action: "실행", evidence: "증빙", result: "결과", reflection: "회고",
};

/** 재료가 있는 섹션만 고른다. 잠긴 섹션(의뢰인 평가 원문)은 AI·템플릿이 쓰지 않으므로 제외 */
export function planSections(src: PortfolioSource): SectionPlan[] {
  const plans: SectionPlan[] = [];
  for (const def of DOMAINS[src.domain].sections) {
    if (def.locked) continue;
    const fields = src.fields.filter((f) => def.fields.includes(f.field));
    const evidence = src.evidence.filter((e) => (def.evidenceTypes ?? []).includes(e.type) || (e.linkedField !== undefined && def.fields.includes(e.linkedField)));
    const outcomes = def.usesOutcomes ? src.outcomes : [];
    const usageVerified = !!(def.usesUsageClaim && src.verification?.actuallyUsed);
    const hasMaterial = def.role === "overview" || fields.length > 0 || evidence.length > 0 || outcomes.length > 0 || usageVerified;
    if (hasMaterial) plans.push({ def, fields, evidence, outcomes, usageVerified });
  }
  return plans;
}

// ── 공통 문장 도우미 ─────────────────────────────────────────────────────────
export const answerText = (f: SourceField) => [...f.choices, f.answer].map((s) => s.trim()).filter(Boolean).filter((s, i, a) => a.indexOf(s) === i).join(", ");
const sentence = (t: string) => { const s = t.trim(); return !s ? "" : /[.!?。]$/.test(s) ? s : `${s}.`; };
const fmtNum = (n: number) => n.toLocaleString("ko-KR");
export function outcomeLine(o: SourceOutcome): string {
  if (!o.measured || o.value === null) return `${o.metricName}: 측정되지 않음${o.qualitativeDescription ? ` — ${o.qualitativeDescription}` : ""}`;
  const v = `${fmtNum(o.value)}${o.unit}`;
  const change = o.baseline !== null ? `${fmtNum(o.baseline)}${o.unit} → ${v}` : v;
  const meta = [o.measurementPeriod, o.source && `출처: ${o.source}`].filter(Boolean).join(", ");
  return `${o.metricName}: ${change}${meta ? ` (${meta})` : ""} · ${o.verified ? "의뢰인 확인" : "학생 기록, 의뢰인 미확인"}`;
}

// ── 템플릿 초안 (AI 실패·미설정 시). 화면에는 "Template-generated draft" 로 표시한다 ──────
function templateBody(p: SectionPlan, src: PortfolioSource, plans: SectionPlan[]): string {
  const lines: string[] = [];
  let fields = p.fields;
  if (p.def.role === "overview") {
    lines.push(`${src.listing.clientName}(${src.listing.clientType})의 의뢰로 진행한 ${DOMAINS[src.domain].label} 프로젝트입니다.`);
    if (src.listing.problem) lines.push(`의뢰 내용: ${sentence(src.listing.problem)}`);
    // 다른 섹션에서 다룰 답은 개요에서 반복하지 않는다
    const elsewhere = new Set(plans.filter((x) => x !== p).flatMap((x) => x.fields.map((f) => f.field)));
    fields = fields.filter((f) => !elsewhere.has(f.field));
  }
  for (const f of fields) {
    lines.push(`${f.label}: ${sentence(answerText(f))}`);
    for (const fu of f.followUps) lines.push(`${fu.question} ${sentence(fu.answer)}`);
  }
  if (p.def.role !== "overview") {
    for (const e of p.evidence) if (e.description) lines.push(`증빙 — ${sentence(e.description)}`);
  }
  for (const o of p.outcomes) lines.push(outcomeLine(o));
  if (p.usageVerified) lines.push("의뢰인이 결과물을 실제로 사용하고 있음을 확인했습니다.");
  return lines.join("\n");
}

export function templateDraft(src: PortfolioSource, plans = planSections(src)): PortfolioContent {
  const tools = src.fields.find((f) => f.field === "tools");
  const role = src.fields.find((f) => f.field === "role");
  return {
    title: `${src.listing.clientName} · ${src.listing.title}`,
    summary: `${src.listing.clientName}의 의뢰로 ${src.member.roleLabel || DOMAINS[src.domain].label} 역할을 맡아 수행한 프로젝트입니다.`,
    sections: plans.map((p) => ({ key: p.def.key, title: p.def.title, body: templateBody(p, src, plans), evidenceIds: p.evidence.map((e) => e.id) })),
    skills: role ? role.choices : [],
    tools: tools ? splitList(answerText(tools)).map((name) => ({ name, why: "" })) : [],
  };
}
const splitList = (s: string) => s.split(/[,，/·]/).map((x) => x.trim()).filter(Boolean);

// ── AI 지시문 ────────────────────────────────────────────────────────────────
export const NARRATIVE_SYSTEM = `너는 대학생 포트폴리오 편집자다. 학생이 지역 주민·상인의 실제 문제를 해결한 기록을, 채용 담당자가 읽는 Case Study 로 바꾼다.

서사 구조: 문제(Problem) → 판단(Decision) → 실행(Action) → 증빙(Evidence) → 결과(Result) → 회고(Reflection)
- 무슨 문제가 있었는지, 왜 그 선택을 했는지, 실제로 무엇을 했는지, 무엇으로 증명되는지, 무엇이 달라졌는지, 무엇을 배웠는지를 잇는다.
- 필드를 나열하거나 요약하지 말고, 판단의 이유와 행동의 연결이 보이게 문단으로 쓴다. 섹션마다 2~4문장, "~했습니다" 체.

절대 규칙 (어기면 결과를 버린다):
1. SOURCE 에 없는 사실을 쓰지 않는다. 특히 숫자, 매출·조회수·방문자 변화, 고객 반응, 사용한 기술·도구, 인과관계를 지어내지 않는다.
2. SOURCE 에 있는 숫자만, 적힌 그대로 쓴다. 성과가 없거나 "측정되지 않음"이면 성과를 암시하지 않는다.
3. OMITTED 목록의 항목(학생이 건너뛰었거나 해당 없음)은 추측해서 채우지 않는다.
4. 의뢰인 확인(verification)이 true 인 항목만 "의뢰인이 확인했다"고 쓸 수 있다.
5. sections 에는 SECTIONS 에 있는 key 만, 재료가 있는 만큼만 쓴다. 증빙을 언급하면 evidenceIds 에 그 id 를 넣는다.
6. tools 는 SOURCE 의 도구 답변에 있는 것만. why 는 SOURCE 에 이유가 있을 때만, 없으면 빈 문자열.`;

export function narrativeUserPrompt(src: PortfolioSource, plans: SectionPlan[]): string {
  const facts = {
    domain: DOMAINS[src.domain].label,
    listing: { title: src.listing.title, problem: src.listing.problem, expectedDeliverables: src.listing.expectedDeliverables, completionCriteria: src.listing.completionCriteria, client: `${src.listing.clientName}(${src.listing.clientType})` },
    student: { roleLabel: src.member.roleLabel, department: src.member.department },
    answers: src.fields.map((f) => ({ field: f.field, label: f.label, question: f.question, answer: answerText(f), followUps: f.followUps })),
    activityLogs: src.activityLogs.map((l) => l.note),
    evidence: src.evidence.map((e) => ({ id: e.id, type: e.type, description: e.description, linkedField: e.linkedField, linkedClaim: e.linkedClaim })),
    submission: { approvedVersion: src.submission.approvedVersion, versionCount: src.submission.versionCount },
    verification: src.verification && { workPerformed: src.verification.workPerformed, roleConfirmed: src.verification.roleConfirmed, deliverableReceived: src.verification.deliverableReceived, completionCriteriaMet: src.verification.completionCriteriaMet, actuallyUsed: src.verification.actuallyUsed },
    outcomes: src.outcomes.map(outcomeLine),
  };
  const sections = plans.map((p) => ({ key: p.def.key, title: p.def.title, role: ROLE_LABEL[p.def.role], material: [...p.fields.map((f) => f.field), ...p.evidence.map((e) => `evidence:${e.id}`), ...(p.outcomes.length ? ["outcomes"] : []), ...(p.usageVerified ? ["verification.actuallyUsed"] : [])] }));
  return `SOURCE:\n${JSON.stringify(facts, null, 1)}\n\nOMITTED:\n${JSON.stringify(src.omitted.map((o) => o.label))}\n\nSECTIONS (이 순서, 이 key 만):\n${JSON.stringify(sections, null, 1)}`;
}

/** Gemini responseSchema */
export function narrativeSchema(plans: SectionPlan[]) {
  return {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      summary: { type: "STRING" },
      sections: { type: "ARRAY", items: { type: "OBJECT", properties: { key: { type: "STRING", enum: plans.map((p) => p.def.key) }, body: { type: "STRING" }, evidenceIds: { type: "ARRAY", items: { type: "STRING" } } }, required: ["key", "body", "evidenceIds"] } },
      skills: { type: "ARRAY", items: { type: "STRING" } },
      tools: { type: "ARRAY", items: { type: "OBJECT", properties: { name: { type: "STRING" }, why: { type: "STRING" } }, required: ["name", "why"] } },
    },
    required: ["title", "summary", "sections", "skills", "tools"],
  };
}

// ── 사실 검사 (hallucination guard) ─────────────────────────────────────────
/** AI 가 근거로 쓸 수 있는 텍스트 전체 (id·URL·시각 제외) */
export function sourceCorpus(src: PortfolioSource): string {
  return [
    src.listing.title, src.listing.problem, src.listing.completionCriteria, ...src.listing.expectedDeliverables, src.listing.clientName, src.listing.clientType,
    src.member.roleLabel, src.member.department,
    ...src.fields.flatMap((f) => [f.answer, ...f.choices, ...f.followUps.map((x) => x.answer)]),
    ...src.activityLogs.map((l) => l.note), ...src.evidence.map((e) => `${e.description} ${e.linkedClaim ?? ""}`), src.submission.note,
    ...src.outcomes.flatMap((o) => [outcomeLine(o), o.metricName, o.qualitativeDescription, String(o.value ?? ""), String(o.baseline ?? "")]),
  ].join("\n");
}
const numbersIn = (t: string) => (t.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""));
/** 성과·인과를 주장하는 단어. SOURCE 에 그 단어가 없으면 그 문장은 근거 없는 주장으로 본다 */
const CLAIM_WORDS = ["매출", "증가", "상승", "늘었", "늘어", "향상", "조회수", "팔로워", "방문자", "재방문", "만족도", "호평", "반응이 좋"];
const splitSentences = (t: string) => t.split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

export interface GuardResult { content: PortfolioContent; report: GuardReport }

export function guardNarrative(raw: unknown, src: PortfolioSource, plans = planSections(src)): GuardResult {
  const report: GuardReport = { droppedSections: [], droppedSentences: [], droppedTools: [], droppedEvidenceIds: [], filledFromTemplate: [] };
  const corpus = sourceCorpus(src);
  const lowerCorpus = corpus.toLowerCase();
  const allowedNums = new Set(numbersIn(corpus));
  const evidenceIds = new Set(src.evidence.map((e) => e.id));
  const template = templateDraft(src, plans);
  const ai = (raw && typeof raw === "object" ? raw : {}) as Partial<{ title: unknown; summary: unknown; sections: unknown; skills: unknown; tools: unknown }>;

  const check = (text: string, section: string): string => {
    const kept: string[] = [];
    for (const s of splitSentences(text)) {
      const badNum = numbersIn(s).find((n) => !allowedNums.has(n));
      if (badNum) { report.droppedSentences.push({ section, sentence: s, reason: `근거 없는 숫자 ${badNum}` }); continue; }
      const badClaim = CLAIM_WORDS.find((w) => s.includes(w) && !corpus.includes(w));
      if (badClaim) { report.droppedSentences.push({ section, sentence: s, reason: `근거 없는 성과 주장(${badClaim})` }); continue; }
      kept.push(s);
    }
    return kept.join(" ");
  };

  const planned = new Map(plans.map((p) => [p.def.key, p]));
  const aiSections = Array.isArray(ai.sections) ? (ai.sections as { key?: unknown; body?: unknown; evidenceIds?: unknown }[]) : [];
  const byKey = new Map<string, PortfolioSection>();
  for (const s of aiSections) {
    const key = typeof s?.key === "string" ? s.key : "";
    if (!planned.has(key)) { if (key) report.droppedSections.push(key); continue; }
    if (byKey.has(key)) continue;
    const body = check(typeof s.body === "string" ? s.body : "", key);
    const ids = (Array.isArray(s.evidenceIds) ? s.evidenceIds : []).filter((x): x is string => typeof x === "string");
    const okIds = ids.filter((id) => evidenceIds.has(id));
    report.droppedEvidenceIds.push(...ids.filter((id) => !evidenceIds.has(id)));
    byKey.set(key, { key, title: planned.get(key)!.def.title, body, evidenceIds: okIds });
  }
  const sections = plans.map((p) => {
    const got = byKey.get(p.def.key);
    const fallback = template.sections.find((t) => t.key === p.def.key)!;
    if (!got || !got.body) { report.filledFromTemplate.push(p.def.key); return fallback; }
    // 섹션 재료로 계획된 증빙은 AI 가 빠뜨려도 붙여 둔다 (증빙 연결 유지)
    return { ...got, evidenceIds: [...new Set([...got.evidenceIds, ...fallback.evidenceIds])] };
  });

  const title = check(typeof ai.title === "string" ? ai.title : "", "title") || template.title;
  const summary = check(typeof ai.summary === "string" ? ai.summary : "", "summary") || template.summary;
  const rawTools = Array.isArray(ai.tools) ? (ai.tools as { name?: unknown; why?: unknown }[]) : [];
  const tools: PortfolioContent["tools"] = [];
  for (const t of rawTools) {
    const name = typeof t?.name === "string" ? t.name.trim() : "";
    if (!name) continue;
    if (!lowerCorpus.includes(name.toLowerCase())) { report.droppedTools.push(name); continue; }
    tools.push({ name, why: check(typeof t.why === "string" ? t.why : "", `tool:${name}`) });
  }
  const skills = (Array.isArray(ai.skills) ? ai.skills : []).filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 30).slice(0, 8);
  return { content: { title, summary, sections, skills, tools: tools.length ? tools : template.tools }, report };
}

export const roleOrder = (r: NarrativeRole) => ROLE_ORDER.indexOf(r);
