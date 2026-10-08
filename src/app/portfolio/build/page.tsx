"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import Readiness from "@/components/Readiness";
import { ErrorText, Field, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { domainForMember, myAnswers, questionsForMember, schemaAnswer, useBundle } from "@/lib/useBundle";
import { computeReadiness, hasContent } from "@shared/portfolio/readiness";
import { findGaps, type GapQuestion } from "@shared/portfolio/gapcheck";
import AnswerExample from "@/components/AnswerExample";
import { DOMAINS } from "@shared/portfolio/domains";
import { answerText } from "@shared/portfolio/narrative";
import { CLAIM_KEYS, CLAIM_LABEL, EVIDENCE_LABEL } from "@shared/portfolio/document";
import type { PortfolioContent, PortfolioDraft, PortfolioSource, ProjectBundle } from "@/types";

/**
 * 포트폴리오 만들기: 준비도 확인 → 생성(AI 또는 템플릿) → "기록 → Case Study" 변환 보기 → 학생 편집 → 저장
 * 재생성은 새 초안을 만들 뿐, 저장된 편집본은 절대 덮어쓰지 않는다.
 */
export default function BuildPage() {
  return <Suspense fallback={<TopBar title="포트폴리오 만들기" back />}><Build /></Suspense>;
}

function Build() {
  const id = useSearchParams().get("id") ?? "";
  const { user } = useSession();
  const { bundle: b, error, reload } = useBundle(id);
  const gen = useAction();
  const [notice, setNotice] = useState("");
  const [gapOpen, setGapOpen] = useState(false);
  const [gapDone, setGapDone] = useState(false);
  if (error) return <><TopBar title="포트폴리오 만들기" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (!b || !user) return <><TopBar title="포트폴리오 만들기" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (!b.members.some((m) => m.studentId === user.id)) return <><TopBar title="포트폴리오 만들기" back /><p className="sub p-6 text-center text-sm">이 프로젝트의 학생만 만들 수 있어요.</p></>;
  if (b.project.status !== "COMPLETED") return (
    <><TopBar title="포트폴리오 만들기" back /><div className="card mx-4 text-sm">의뢰인이 결과물을 승인하고 검증하면 포트폴리오를 만들 수 있어요.<Link href={`/projects/detail?id=${id}`} className="btn btn-ghost mt-3 w-full">프로젝트로</Link></div></>
  );

  const domain = domainForMember(b, user.id);
  const questions = questionsForMember(b, user.id);
  const evidenceTypes = b.evidence.map((e) => e.type);
  const readiness = computeReadiness({ domain, questionIds: questions.map((q) => q.id), answers: myAnswers(b, user.id), evidenceTypes, outcomeCount: b.outcomes.length });
  const revisionComments = b.versions.filter((v) => v.reviewComment?.trim()).map((v) => v.reviewComment!);
  const gaps = findGaps({ domain, questions, answers: myAnswers(b, user.id), evidenceTypes, outcomeCount: b.outcomes.length, revisionComments });
  const drafts = b.drafts.filter((d) => d.studentId === user.id);
  const draft = drafts.at(-1);
  const snap = draft && b.snapshots.find((s) => s.id === draft.snapshotId);
  const here = `/portfolio/build?id=${id}`;

  async function generate(regenerate: boolean) {
    const r = await gen.run(() => repo.generatePortfolio(id, user!.id, { regenerate }));
    if (!r) return;
    setNotice(r.reused ? "기록이 바뀌지 않아 기존 초안을 그대로 보여 드려요. 새로 만들려면 ‘다시 생성’을 누르세요." : r.aiError ? `AI 대신 템플릿으로 만들었어요: ${r.aiError}` : "");
    await reload();
  }

  return (
    <>
      <TopBar title="포트폴리오 만들기" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card">
          <Readiness r={readiness} fixHref={(q) => `/projects/log?id=${id}&q=${q}&set=${q}&back=${encodeURIComponent(here)}`} />
          {readiness.missingRequired.length > 0 && <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs">필수 자료 {readiness.missingRequired.length}개가 비어 있어요. 채우면 더 설득력 있는 Case Study 가 돼요. 비워 둔 채로 만들어도 해당 섹션은 지어내지 않고 빠집니다.</p>}
          <button disabled={gen.busy || gapOpen} onClick={() => (gaps.length && !gapDone ? setGapOpen(true) : generate(false))} className="btn btn-primary mt-3 w-full disabled:opacity-50">
            {gen.busy ? "기록을 Case Study 로 바꾸는 중… (최대 1~2분)" : draft ? "기록이 바뀌었으면 새 초안 만들기" : "✨ 포트폴리오 초안 만들기"}
          </button>
          {draft && <button disabled={gen.busy} onClick={() => generate(true)} className="btn btn-ghost mt-2 w-full text-sm disabled:opacity-50">같은 기록으로 다시 생성 (편집본은 그대로 보존)</button>}
          {notice && <p className="mt-2 text-xs text-[var(--primary)]" role="status">{notice}</p>}
          <ErrorText text={gen.error} />
        </div>

        {gapOpen && (
          <GapCard key={gaps.map((g) => g.key).join()} b={b} userId={user.id} gaps={gaps} here={here} busy={gen.busy}
            onFinish={async (saved) => { setGapOpen(false); setGapDone(true); if (saved) await reload(); await generate(false); }} />
        )}

        {draft && snap && <Transform source={snap.data} draft={draft} />}
        {draft && <Editor key={draft.id} b={b} userId={user.id} latestDraft={draft} />}
      </section>
    </>
  );
}

/**
 * 초안 전 점검: 기록 전체에서 근거가 빠진 곳을 골라 최대 3개만 묻는다. 답하든 건너뛰든 초안은 만들어진다.
 * 답은 그 질문에 답이 없으면 답 자체로, 있으면 후속 답(`<질문>:fugap`)으로 저장해 초안 재료에 들어간다.
 */
function GapCard({ b, userId, gaps, here, busy, onFinish }: { b: ProjectBundle; userId: string; gaps: GapQuestion[]; here: string; busy: boolean; onFinish: (saved: boolean) => Promise<void> }) {
  const [answers, setAnswers] = useState<string[]>(gaps.map(() => ""));
  const act = useAction();
  const filled = answers.some((a, i) => gaps[i].action === "answer" && a.trim());

  async function save() {
    const ok = await act.run(async () => {
      const mine = myAnswers(b, userId);
      for (const [i, g] of gaps.entries()) {
        const text = answers[i].trim();
        if (g.action !== "answer" || !g.questionId || !text) continue;
        const prev = schemaAnswer(mine, g.questionId);
        if (!prev || prev.status !== "ANSWERED" || !hasContent(prev)) {
          await repo.saveAnswer({ projectId: b.project.id, actorId: userId, questionId: g.questionId, status: "ANSWERED", value: text, choices: [] });
        } else {
          await repo.saveAnswer({ projectId: b.project.id, actorId: userId, questionId: `${g.questionId}:fugap`, status: "ANSWERED", value: text,
            origin: "RULE_FOLLOWUP", parentQuestionId: g.questionId, prompt: g.title });
        }
      }
      return true;
    });
    if (ok) await onFinish(true);
  }

  return (
    <div className="card" role="region" aria-label="초안 전 점검">
      <p className="font-bold">초안 전에 {gaps.length}가지만 더 물어볼게요</p>
      <p className="sub mt-1 text-xs">답하면 포트폴리오가 더 구체적으로 써져요. 건너뛰어도 초안은 만들어지고, 빈 부분은 지어내지 않아요.</p>
      <ol className="mt-3 flex flex-col gap-4">
        {gaps.map((g, i) => (
          <li key={g.key}>
            <p className="text-[15px] font-semibold">{i + 1}. {g.title}</p>
            <AnswerExample text={g.example} className="mt-1" />
            {g.action === "answer" ? (
              <textarea aria-label={g.title} className={`${inputCls} mt-2 h-20`} value={answers[i]} onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))} />
            ) : (
              <Link href={`/projects/evidence?id=${b.project.id}&type=${g.evidenceType}&back=${encodeURIComponent(here)}`} className="btn btn-ghost mt-2 w-full text-sm">+ {EVIDENCE_LABEL[g.evidenceType!]} 올리러 가기</Link>
            )}
          </li>
        ))}
      </ol>
      <ErrorText text={act.error} />
      <button disabled={busy || act.busy || !filled} onClick={save} className="btn btn-primary mt-3 w-full disabled:opacity-40">{act.busy ? "저장 중…" : "저장하고 초안 만들기"}</button>
      <button disabled={busy || act.busy} onClick={() => onFinish(false)} className="btn btn-ghost mt-2 w-full text-sm">건너뛰고 초안 만들기</button>
    </div>
  );
}

/** 해커톤 데모 핵심 화면: 학생이 적은 짧은 기록 → 검증된 Case Study */
function Transform({ source, draft }: { source: PortfolioSource; draft: PortfolioDraft }) {
  const [showGuard, setShowGuard] = useState(false);
  const g = draft.guardReport;
  return (
    <div className="card">
      <h3 className="mb-3 font-bold">기록이 어떻게 바뀌었나</h3>
      <div className="rounded-2xl bg-[var(--line)] p-3">
        <p className="mb-2 text-xs font-bold text-[var(--sub)]">📝 내가 실제로 남긴 기록</p>
        <ul className="flex flex-col gap-1 text-sm">
          {source.fields.map((f) => <li key={f.field}><span className="sub">{f.label} · </span>{answerText(f)}{f.followUps.map((x, i) => <span key={i} className="sub"> / {x.answer}</span>)}</li>)}
          {source.evidence.length > 0 && <li><span className="sub">증빙 · </span>{source.evidence.map((e) => EVIDENCE_LABEL[e.type]).join(", ")}</li>}
          {source.verification && <li><span className="sub">의뢰인 확인 · </span>{CLAIM_KEYS.filter((k) => source.verification![k]).map((k) => CLAIM_LABEL[k]).join(", ")}</li>}
        </ul>
        {source.omitted.some((o) => o.status !== "UNANSWERED") && <p className="sub mt-2 text-[11px]">건너뜀·해당 없음: {source.omitted.filter((o) => o.status !== "UNANSWERED").map((o) => o.label).join(", ")} → 추측해서 채우지 않음</p>}
      </div>
      <p className="my-2 text-center text-xl text-[var(--primary)]" aria-hidden>↓</p>
      <div className="rounded-2xl border border-[var(--primary-weak)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-[var(--primary)]">📁 포트폴리오 초안</p>
          {draft.generator === "AI"
            ? <span className="rounded-full bg-[var(--primary-weak)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)]">AI 생성 초안 · 사실 검사 통과</span>
            : <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold text-[#b47a00]">템플릿 초안 · AI 미사용</span>}
        </div>
        <p className="font-bold">{draft.content.title}</p>
        <p className="sub mb-2 text-sm">{draft.content.summary}</p>
        {draft.content.sections.map((s) => (
          <div key={s.key} className="mb-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--sub)]">{DOMAINS[source.domain].sections.find((d) => d.key === s.key)?.title ?? s.title}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
        {draft.generator === "TEMPLATE" && <p className="sub text-[11px]">AI 를 쓰지 않고 기록을 정해진 틀에 넣은 초안이에요. 아래에서 문장을 다듬어 주세요.</p>}
        {g && (g.droppedSentences.length > 0 || g.droppedTools.length > 0 || g.droppedSections.length > 0) && (
          <div className="mt-2 rounded-xl bg-[var(--line)] p-2 text-xs">
            <button onClick={() => setShowGuard(!showGuard)} className="font-semibold" aria-expanded={showGuard}>🛡️ 근거 없는 내용 {g.droppedSentences.length + g.droppedTools.length + g.droppedSections.length}개를 뺐어요 {showGuard ? "▲" : "▼"}</button>
            {showGuard && (
              <ul className="sub mt-1 list-disc pl-4">
                {g.droppedSentences.map((d, i) => <li key={i}>“{d.sentence}” — {d.reason}</li>)}
                {g.droppedTools.map((t) => <li key={t}>도구 “{t}” — 기록에 없음</li>)}
                {g.droppedSections.map((s) => <li key={s}>섹션 {s} — 재료 없음</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 학생 편집. 검증·평가 원문·증빙은 편집 대상이 아니다 (문서에서 원본을 그대로 보여 준다) */
function Editor({ b, userId, latestDraft }: { b: ProjectBundle; userId: string; latestDraft: PortfolioDraft }) {
  const router = useRouter();
  const myEdits = b.edits.filter((e) => e.studentId === userId);
  const lastEdit = myEdits.at(-1);
  const storeKey = `wolgye-pf-edit:${b.project.id}:${userId}`;
  const [baseDraftId, setBaseDraftId] = useState(lastEdit?.draftId ?? latestDraft.id);
  const [form, setForm] = useState<PortfolioContent>(lastEdit?.content ?? latestDraft.content);
  const [restored, setRestored] = useState(false);
  const act = useAction();

  // 저장 전 편집 내용은 이 브라우저에만 임시 보관 (새로고침·뒤로 가기 대비)
  useEffect(() => {
    try {
      const s = localStorage.getItem(storeKey);
      if (s) { const d = JSON.parse(s); if (d.baseDraftId && d.form) { setBaseDraftId(d.baseDraftId); setForm(d.form); setRestored(true); } }
    } catch { /* 저장소를 못 쓰면 무시 */ }
  }, [storeKey]);
  const update = (f: PortfolioContent) => { setForm(f); try { localStorage.setItem(storeKey, JSON.stringify({ baseDraftId, form: f })); } catch { /* 무시 */ } };
  const newerDraft = lastEdit && latestDraft.createdAt > lastEdit.createdAt && latestDraft.id !== baseDraftId;

  async function save() {
    const edit = await act.run(() => repo.savePortfolioEdit(baseDraftId, userId, form));
    if (!edit) return;
    try { localStorage.removeItem(storeKey); } catch { /* 무시 */ }
    router.push(`/portfolio/view?id=${b.project.id}&s=${userId}`);
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between"><h3 className="font-bold">다듬기</h3>{lastEdit && <span className="sub text-xs">저장된 편집본 v{lastEdit.version}</span>}</div>
      {restored && <p className="rounded-xl bg-[var(--primary-weak)] px-3 py-2 text-xs">저장하지 않은 편집 내용을 불러왔어요. <button className="font-semibold underline" onClick={() => { try { localStorage.removeItem(storeKey); } catch { /* 무시 */ } setForm(lastEdit?.content ?? latestDraft.content); setBaseDraftId(lastEdit?.draftId ?? latestDraft.id); setRestored(false); }}>버리기</button></p>}
      {newerDraft && (
        <div className="rounded-xl bg-yellow-50 px-3 py-2 text-xs">
          새 초안이 있어요. 지금 편집본은 그대로 두고, 원하면 새 초안으로 다시 시작할 수 있어요.
          <button className="ml-1 font-semibold underline" onClick={() => { setBaseDraftId(latestDraft.id); update(latestDraft.content); }}>새 초안으로 편집 시작</button>
        </div>
      )}
      <Field label="제목"><input className={inputCls} value={form.title} onChange={(e) => update({ ...form, title: e.target.value })} /></Field>
      <Field label="한 줄 요약"><textarea className={`${inputCls} h-16`} value={form.summary} onChange={(e) => update({ ...form, summary: e.target.value })} /></Field>
      {form.sections.map((s, i) => (
        <Field key={s.key} label={DOMAINS[b.project.domain].sections.find((d) => d.key === s.key)?.title ?? s.title}>
          <textarea className={`${inputCls} h-32`} value={s.body} onChange={(e) => update({ ...form, sections: form.sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
        </Field>
      ))}
      <Field label="역량" hint="쉼표로 구분"><input className={inputCls} value={form.skills.join(", ")} onChange={(e) => update({ ...form, skills: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">사용 도구와 이유</legend>
        {form.tools.map((t, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label="도구" className={`${inputCls} w-28`} value={t.name} onChange={(e) => update({ ...form, tools: form.tools.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input aria-label="선택한 이유" className={inputCls} placeholder="왜 이 도구를 썼나요?" value={t.why} onChange={(e) => update({ ...form, tools: form.tools.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)) })} />
            <button aria-label="도구 삭제" onClick={() => update({ ...form, tools: form.tools.filter((_, j) => j !== i) })} className="sub px-1">✕</button>
          </div>
        ))}
        <button onClick={() => update({ ...form, tools: [...form.tools, { name: "", why: "" }] })} className="self-start text-sm font-semibold text-[var(--primary)]">+ 도구 추가</button>
      </fieldset>
      <p className="sub text-xs">의뢰인 검증·평가 원문·증빙은 여기서 고칠 수 없고, 포트폴리오에 원본 그대로 붙어요.</p>
      <ErrorText text={act.error} />
      <button disabled={act.busy} onClick={save} className="btn btn-primary w-full disabled:opacity-50">{act.busy ? "저장 중…" : lastEdit ? `편집본 v${lastEdit.version + 1} 로 저장` : "포트폴리오 저장"}</button>
    </div>
  );
}
