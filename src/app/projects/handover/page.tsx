"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { HANDOVER_FIELDS, handoverReadiness } from "@/lib/maintenance";
import type { HandoverInput, OperationsBundle } from "@/types";

/**
 * 인수인계 정보 작성 (/projects/handover?id=프로젝트id).
 * 담당 학생이 다음 사람이 이어받는 데 필요한 것만 짧게 채운다. 긴 보고서를 쓰게 하지 않는다.
 * 다 채우면 AI 가 인수인계서를 만들어 준다.
 */
export default function HandoverPage() {
  return <Suspense fallback={<TopBar title="인수인계" back />}><Handover /></Suspense>;
}

function Handover() {
  const id = useSearchParams().get("id") ?? "";
  const { user } = useSession();
  const [b, setB] = useState<OperationsBundle | null | undefined>(undefined);
  const [f, setF] = useState<HandoverInput>({});
  const act = useAction();
  const gen = useAction();

  const reload = () => repo.getOperations(id).then((v) => {
    setB(v);
    if (v) setF({
      repoUrl: v.operations.repoUrl ?? "", deployUrl: v.operations.deployUrl ?? "", adminHanded: v.operations.adminHanded,
      envList: v.operations.envList ?? "", monthlyCost: v.operations.monthlyCost ?? "", billingOwner: v.operations.billingOwner ?? "CLIENT",
      expiresOn: v.operations.expiresOn ?? "", backupNote: v.operations.backupNote ?? "", knownIssues: v.operations.knownIssues ?? "",
    });
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [id]);

  if (b === undefined) return <><TopBar title="인수인계" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (!b) return <><TopBar title="인수인계" back /><p className="card mx-4 text-sm">아직 운영이 시작되지 않은 프로젝트예요.</p></>;

  const isMaintainer = user?.id === b.operations.maintainerId;
  const preview = handoverReadiness({ ...b.operations, ...f } as typeof b.operations);
  const hint = (key: string) => HANDOVER_FIELDS.find((x) => x.key === key)!;
  const Label = ({ k }: { k: keyof HandoverInput }) => {
    const h = hint(k);
    return <><span className="text-sm font-medium">{h.label}{h.required && <span className="text-[var(--red)]"> *</span>}</span><span className="sub block text-xs">{h.hint}</span></>;
  };

  return (
    <>
      <TopBar title="인수인계" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card">
          <div className="mb-1 flex items-center justify-between text-sm"><span className="sub">준비도</span><b>{preview.percent}%</b></div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${preview.percent}%` }} /></div>
          <p className="sub mt-2 text-xs">다음 담당자가 이어받을 수 있도록 남기는 정보예요. 필수 항목을 모두 채우면 인계를 요청할 수 있어요.</p>
        </div>

        {isMaintainer ? (
          <div className="card flex flex-col gap-3">
            <label><Label k="repoUrl" /><input className={`${inputCls} mt-1`} placeholder="https://github.com/..." value={f.repoUrl ?? ""} onChange={(e) => setF({ ...f, repoUrl: e.target.value })} /></label>
            <label><Label k="deployUrl" /><input className={`${inputCls} mt-1`} placeholder="https://..." value={f.deployUrl ?? ""} onChange={(e) => setF({ ...f, deployUrl: e.target.value })} /></label>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={!!f.adminHanded} onChange={(e) => setF({ ...f, adminHanded: e.target.checked })} /><span><Label k="adminHanded" /></span></label>
            <label><Label k="monthlyCost" /><input className={`${inputCls} mt-1`} placeholder="예: 도메인 연 22,000원 (매년 3월 2일), 호스팅 무료" value={f.monthlyCost ?? ""} onChange={(e) => setF({ ...f, monthlyCost: e.target.value })} /></label>
            <div><Label k="billingOwner" />
              <div className="mt-1 flex gap-2">
                {([["CLIENT", "사장님 명의"], ["STUDENT", "학생 명의 (이관 필요)"]] as const).map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={f.billingOwner === v} onClick={() => setF({ ...f, billingOwner: v })} className={`chip ${f.billingOwner === v ? "chip-on" : ""}`}>{label}</button>
                ))}
              </div>
              {f.billingOwner === "STUDENT" && <p className="mt-1 text-xs text-[var(--red)]">학생 명의면 졸업 후 결제가 끊겨 사이트가 사라질 수 있어요. 사장님 명의로 옮겨 주세요.</p>}
            </div>
            <label><Label k="envList" /><textarea className={`${inputCls} mt-1 h-16`} placeholder="예: Supabase(DB), 카카오 지도 키" value={f.envList ?? ""} onChange={(e) => setF({ ...f, envList: e.target.value })} /></label>
            <label><Label k="expiresOn" /><input type="date" className={`${inputCls} mt-1`} value={f.expiresOn ?? ""} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} /></label>
            <label><Label k="backupNote" /><input className={`${inputCls} mt-1`} placeholder="예: Supabase 자동 백업 7일" value={f.backupNote ?? ""} onChange={(e) => setF({ ...f, backupNote: e.target.value })} /></label>
            <label><Label k="knownIssues" /><textarea className={`${inputCls} mt-1 h-20`} placeholder="예: 사파리에서 사진 업로드가 가끔 실패해요" value={f.knownIssues ?? ""} onChange={(e) => setF({ ...f, knownIssues: e.target.value })} /></label>
            <ErrorText text={act.error} />
            <button onClick={() => act.run(async () => { await repo.saveHandover(id, user!.id, f); await reload(); })} disabled={act.busy} className="btn btn-primary w-full">저장하기</button>
          </div>
        ) : (
          <div className="card text-sm">
            <h3 className="mb-2 font-bold">인수인계 정보</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5">
              {HANDOVER_FIELDS.map((x) => {
                const v = b.operations[x.key];
                return <div key={String(x.key)} className="contents"><dt className="sub">{x.label}</dt>
                  <dd className="break-words">{typeof v === "boolean" ? (v ? "완료" : "미완료") : (v as string) || <span className="sub">미입력</span>}</dd></div>;
              })}
            </dl>
          </div>
        )}

        {/* AI 인수인계서 */}
        <div className="card flex flex-col gap-2">
          <h3 className="font-bold">📄 인수인계서</h3>
          <p className="sub text-xs">입력한 정보와 활동 기록만으로 만들어요. 없는 내용은 지어내지 않아요.</p>
          {b.doc ? (
            <article className="whitespace-pre-line rounded-xl bg-[var(--line)] p-3 text-sm leading-6">{b.doc.markdown}</article>
          ) : <p className="sub text-sm">아직 만들지 않았어요.</p>}
          <ErrorText text={gen.error} />
          {isMaintainer && (
            <button onClick={() => gen.run(async () => { await repo.generateHandoverDoc(id, user!.id); await reload(); })} disabled={gen.busy} className="btn btn-ghost w-full">
              {gen.busy ? "만드는 중… (20초 정도)" : b.doc ? "다시 만들기" : "인수인계서 만들기"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
