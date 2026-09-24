"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { BottomCTA, ErrorText, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { STAGES, myAnswers, pendingQuestions, schemaAnswer, useBundle } from "@/lib/useBundle";
import { suggestFollowUps, type FollowUpSuggestion } from "@/lib/ai/followup";
import { EVIDENCE_LABEL } from "@shared/portfolio/document";
import type { AnswerStatus, EvidenceType, ProjectBundle, QuestionDefinition, Stage } from "@/types";

/**
 * 분야별 Guided Activity Logging.
 * 한 화면에 질문 하나, 한 번에 1~3개. 위치(q)와 묶음(set)은 URL 에 있어서 새로고침·뒤로 가기에도 답과 위치가 유지된다.
 * 답은 입력하는 동안 자동 저장된다. 건너뛰기(SKIPPED)와 해당 없음(NOT_APPLICABLE)은 서로 다른 상태로 저장된다.
 */
export default function LogPage() {
  return <Suspense fallback={<TopBar title="활동 기록" back />}><Log /></Suspense>;
}

const SESSION_SIZE = 3;
const STAGE_EVIDENCE: Record<Stage, EvidenceType[]> = {
  START: ["BEFORE_IMAGE"],
  PROGRESS: ["PROCESS_IMAGE", "DOCUMENT"],
  FINISH: ["AFTER_IMAGE", "DELIVERABLE_FILE", "DELIVERABLE_URL", "USAGE_PROOF"],
};

function Log() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get("id") ?? "";
  const q = sp.get("q");
  const set = useMemo(() => (sp.get("set") ?? "").split(",").filter(Boolean), [sp]);
  const back = sp.get("back");
  const done = sp.get("done") === "1";
  const { user } = useSession();
  const { bundle: b, error, reload } = useBundle(id);
  const question = b && q ? b.project.questionSnapshot.questions.find((x) => x.id === q) : undefined;
  const stage = (question?.stage ?? (sp.get("stage") as Stage | null) ?? "START") as Stage;
  const base = `/projects/log?id=${id}`;

  // 질문 없이 들어오면: 이 단계의 남은 질문 1~3개로 묶음을 만들어 첫 질문으로
  useEffect(() => {
    if (!b || !user || q || done) return;
    const pend = pendingQuestions(b, user.id, stage).slice(0, SESSION_SIZE).map((x) => x.id);
    if (pend.length) router.replace(`${base}&stage=${stage}&q=${pend[0]}&set=${pend.join(",")}`);
  }, [b, user, q, done, stage, base, router]);

  if (error) return <><TopBar title="활동 기록" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (!b || !user) return <><TopBar title="활동 기록" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (!b.members.some((m) => m.studentId === user.id)) return <><TopBar title="활동 기록" back /><p className="sub p-6 text-center text-sm">선정된 학생만 기록할 수 있어요.</p></>;

  if (question) {
    const idx = Math.max(0, set.indexOf(question.id));
    const goNext = () => {
      const next = set[idx + 1];
      if (next) router.push(`${base}&stage=${stage}&q=${next}&set=${set.join(",")}${back ? `&back=${encodeURIComponent(back)}` : ""}`);
      else router.push(back ?? `${base}&stage=${stage}&done=1`);
    };
    return (
      <>
        <TopBar title={`${STAGES.find((s) => s.key === stage)?.label} 기록`} back right={<span className="sub text-xs">{set.length > 1 ? `${idx + 1} / ${set.length}` : ""}</span>} />
        <QuestionStep key={question.id} bundle={b} q={question} userId={user.id} onDone={async () => { await reload(); goNext(); }} />
      </>
    );
  }
  return <StageSummary b={b} userId={user.id} stage={stage} base={base} onLogged={reload} />;
}

// ── 질문 한 개 ─────────────────────────────────────────────────────────────
function QuestionStep({ bundle, q, userId, onDone }: { bundle: ProjectBundle; q: QuestionDefinition; userId: string; onDone: () => Promise<void> }) {
  const mine = myAnswers(bundle, userId);
  const prev = schemaAnswer(mine, q.id);
  const [value, setValue] = useState(prev?.status === "ANSWERED" || prev?.status === "UNANSWERED" ? prev.value : "");
  const [choices, setChoices] = useState<string[]>(prev?.status === "ANSWERED" ? prev.choices : []);
  const [saved, setSaved] = useState<"" | "saving" | "saved">(prev ? "saved" : "");
  const [fu, setFu] = useState<FollowUpSuggestion | null>(null);
  const [fuAnswers, setFuAnswers] = useState<string[]>([]);
  const act = useAction();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ value, choices });
  latest.current = { value, choices };

  const save = useCallback(async (status: AnswerStatus, v = latest.current) => {
    setSaved("saving");
    await repo.saveAnswer({ projectId: bundle.project.id, actorId: userId, questionId: q.id, status, value: v.value, choices: v.choices });
    setSaved("saved");
  }, [bundle.project.id, userId, q.id]);

  // 자동 저장 (입력 멈추고 0.7초 뒤)
  const touch = (v: string, c: string[]) => {
    setValue(v); setChoices(c); setSaved("");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { save("ANSWERED", { value: v, choices: c }).catch(() => setSaved("")); }, 700);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const opts = q.input.options ?? [];
  const toggle = (o: string) => {
    const next = choices.includes(o) ? choices.filter((x) => x !== o) : q.input.multi ? [...choices, o] : [o];
    touch(value, next);
  };
  const hasAnswer = value.trim().length > 0 || choices.length > 0;
  const labelId = `q-${q.id}`;

  async function next() {
    clearTimeout(timer.current);
    await act.run(async () => {
      if (!fu) {
        await save("ANSWERED");
        const s = await suggestFollowUps(q, [...choices, value].filter(Boolean).join(", "), bundle.project.domain);
        if (s.questions.length) {
          const prevFu = s.questions.map((_, i) => mine.find((a) => a.questionId === `${q.id}:fu${i}`)?.value ?? "");
          setFu(s); setFuAnswers(prevFu); return;
        }
      } else {
        // 후속 질문은 선택. 답한 것만 저장한다
        await Promise.all(fu.questions.map((text, i) => fuAnswers[i]?.trim() && repo.saveAnswer({
          projectId: bundle.project.id, actorId: userId, questionId: `${q.id}:fu${i}`, status: "ANSWERED", value: fuAnswers[i],
          origin: fu.source === "AI" ? "AI_FOLLOWUP" : "RULE_FOLLOWUP", parentQuestionId: q.id, prompt: text,
        })));
      }
      await onDone();
    });
  }
  async function mark(status: "SKIPPED" | "NOT_APPLICABLE") {
    clearTimeout(timer.current);
    await act.run(async () => { await save(status, { value: "", choices: [] }); await onDone(); });
  }

  return (
    <section className="flex min-h-[calc(100vh-7rem)] flex-col px-4">
      <div className="flex-1 pt-2">
        <h2 id={labelId} className="text-[22px] font-bold leading-snug">{q.title}</h2>
        {q.help && <p className="sub mt-2 text-sm">{q.help}</p>}
        {prev && prev.status !== "ANSWERED" && prev.status !== "UNANSWERED" && <p className="mt-2 text-xs font-semibold text-[#c2410c]">이전에 {prev.status === "SKIPPED" ? "건너뛴" : "해당 없음으로 표시한"} 질문이에요. 답하면 바뀌어요.</p>}

        <div className="mt-6 flex flex-col gap-3" role="group" aria-labelledby={labelId}>
          {(q.input.kind === "choice" || q.input.kind === "tools") && opts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {opts.map((o) => (
                <button key={o} type="button" aria-pressed={choices.includes(o)} onClick={() => toggle(o)}
                  className={`chip px-4 py-2.5 text-[15px] focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${choices.includes(o) ? "chip-on font-semibold" : ""}`}>{choices.includes(o) ? "✓ " : ""}{o}</button>
              ))}
            </div>
          )}
          {q.input.kind === "long" ? (
            <textarea aria-labelledby={labelId} className={`${inputCls} h-32`} placeholder={q.input.placeholder ?? "짧게 적어도 괜찮아요"} value={value} onChange={(e) => touch(e.target.value, choices)} />
          ) : (q.input.kind === "short" || q.input.allowOther) && (
            <input aria-labelledby={labelId} aria-label={q.input.kind === "short" ? undefined : "직접 입력"} className={inputCls}
              placeholder={q.input.placeholder ?? (q.input.kind === "short" ? "짧게 적어 주세요" : "직접 입력 (선택)")} value={value} onChange={(e) => touch(e.target.value, choices)} />
          )}
          <p className="sub h-4 text-xs" aria-live="polite">{saved === "saving" ? "저장 중…" : saved === "saved" && hasAnswer ? "자동 저장됨 ✓" : ""}</p>
        </div>

        {fu && (
          <div className="mt-4 rounded-2xl bg-[var(--primary-weak)] p-4">
            <p className="text-xs font-bold text-[var(--primary)]">{fu.source === "AI" ? "✨ AI 추천 질문" : "추천 질문"} · 답하지 않아도 넘어갈 수 있어요</p>
            {fu.questions.map((text, i) => (
              <label key={i} className="mt-3 block">
                <span className="block text-[15px] font-semibold">{text}</span>
                <textarea className={`${inputCls} mt-1 h-20 bg-white`} value={fuAnswers[i] ?? ""} onChange={(e) => setFuAnswers(fuAnswers.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
            ))}
          </div>
        )}
        <div className="mt-3"><ErrorText text={act.error} /></div>
      </div>

      <BottomCTA>
        {!fu && <button type="button" disabled={act.busy} onClick={() => mark("SKIPPED")} className="btn btn-ghost px-4">건너뛰기</button>}
        {!fu && q.allowNA && <button type="button" disabled={act.busy} onClick={() => mark("NOT_APPLICABLE")} className="btn btn-ghost px-3">해당 없음</button>}
        <button type="button" disabled={act.busy || (!hasAnswer && !fu)} onClick={next} className="btn btn-primary flex-1 disabled:opacity-40">
          {act.busy ? "저장 중…" : fu ? (fuAnswers.some((a) => a.trim()) ? "저장하고 다음" : "넘어가기") : "다음"}
        </button>
      </BottomCTA>
    </section>
  );
}

// ── 단계 요약: 답 목록 + 중간 기록 + 증빙 제안 ───────────────────────────────────
function StageSummary({ b, userId, stage, base, onLogged }: { b: ProjectBundle; userId: string; stage: Stage; base: string; onLogged: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const act = useAction();
  const mine = myAnswers(b, userId);
  const qs = b.project.questionSnapshot.questions.filter((q) => q.stage === stage);
  const left = pendingQuestions(b, userId, stage).length;
  const stageIdx = STAGES.findIndex((s) => s.key === stage);
  const nextStage = STAGES[stageIdx + 1];
  const here = `${base}&stage=${stage}&done=1`;
  const logs = b.logs.filter((l) => l.stage === stage && l.authorId === userId);

  return (
    <>
      <TopBar title={`${STAGES[stageIdx].label} 기록`} back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card">
          <p className="text-lg font-bold">{left ? `${STAGES[stageIdx].label} 질문이 ${left}개 남았어요` : `${STAGES[stageIdx].label} 기록을 마쳤어요 👏`}</p>
          {left > 0 && <Link href={`${base}&stage=${stage}`} className="btn btn-primary mt-3 w-full">이어서 답하기</Link>}
        </div>

        <div className="card">
          <h3 className="mb-2 font-bold">내 답변</h3>
          <ul className="flex flex-col divide-y divide-[var(--line)] text-sm">
            {qs.map((q) => {
              const a = schemaAnswer(mine, q.id);
              const st = a?.status ?? "UNANSWERED";
              const text = a && st === "ANSWERED" ? [...a.choices, a.value].filter(Boolean).join(", ") : st === "SKIPPED" ? "건너뜀" : st === "NOT_APPLICABLE" ? "해당 없음" : "아직 안 함";
              return (
                <li key={q.id}>
                  <Link href={`${base}&q=${q.id}&set=${q.id}&back=${encodeURIComponent(here)}`} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0"><span className="block font-semibold">{q.title}</span><span className={`block truncate ${st === "ANSWERED" ? "" : "sub"}`}>{text}</span></span>
                    <span className="sub shrink-0 text-xs">고치기 ›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <h3 className="mb-1 font-bold">중간 기록 남기기</h3>
          <p className="sub mb-2 text-xs">오늘 한 일, 점주님과 나눈 이야기, 바꾼 점을 한두 줄로요.</p>
          {logs.length > 0 && <ul className="mb-2 flex flex-col gap-1 text-sm">{logs.map((l) => <li key={l.id} className="rounded-lg bg-[var(--line)] px-3 py-2">{l.note}</li>)}</ul>}
          <label className="sr-only" htmlFor="log-note">중간 기록</label>
          <textarea id="log-note" className={`${inputCls} h-20`} placeholder="예: 점주님과 시안 2개 중 B안으로 결정, 가격 표기를 크게 하기로 함" value={note} onChange={(e) => setNote(e.target.value)} />
          <ErrorText text={act.error} />
          <button disabled={act.busy || !note.trim()} onClick={() => act.run(async () => { await repo.addLog({ projectId: b.project.id, actorId: userId, stage, note }); setNote(""); await onLogged(); })} className="btn btn-ghost mt-2 w-full disabled:opacity-40">기록 저장</button>
        </div>

        <div className="card">
          <h3 className="mb-2 font-bold">이 단계에 어울리는 증빙</h3>
          <div className="flex flex-wrap gap-2">
            {STAGE_EVIDENCE[stage].map((t) => (
              <Link key={t} href={`/projects/evidence?id=${b.project.id}&type=${t}&back=${encodeURIComponent(here)}`} className={`chip ${b.evidence.some((e) => e.type === t) ? "chip-on" : ""}`}>{b.evidence.some((e) => e.type === t) ? "✓ " : "+ "}{EVIDENCE_LABEL[t]}</Link>
            ))}
          </div>
        </div>

        {nextStage ? <Link href={`${base}&stage=${nextStage.key}`} className="btn btn-primary w-full">{nextStage.label} 기록으로</Link>
          : <Link href={`/projects/submit?id=${b.project.id}`} className="btn btn-primary w-full">결과물 제출하러 가기</Link>}
        <Link href={`/projects/detail?id=${b.project.id}`} className="btn btn-ghost w-full">프로젝트로 돌아가기</Link>
      </section>
    </>
  );
}
