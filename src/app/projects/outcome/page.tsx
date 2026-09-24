"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, Field, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { useBundle } from "@/lib/useBundle";
import { EVIDENCE_LABEL } from "@shared/portfolio/document";

/** 성과(Outcome) 기록. 결과물(Deliverable)과 다르다: "릴스 5개 제작" 이 아니라 "2주 후 평균 조회수 420 → 1,100" */
export default function OutcomePage() {
  return <Suspense fallback={<TopBar title="성과 추가" back />}><AddOutcome /></Suspense>;
}

function AddOutcome() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { user } = useSession();
  const { bundle: b } = useBundle(id);
  const [f, setF] = useState({ metricName: "", measured: true, value: "", unit: "", baseline: "", measurementPeriod: "", source: "", evidenceId: "", qualitativeDescription: "" });
  const act = useAction();
  if (!b || !user) return <><TopBar title="성과 추가" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(/,/g, "")));

  async function save() {
    await act.run(async () => {
      const value = toNum(f.value), baseline = toNum(f.baseline);
      if (f.measured && (value === null || Number.isNaN(value))) throw new Error("측정값을 숫자로 적어 주세요. 측정하지 않았다면 ‘미측정’을 골라 주세요");
      if (baseline !== null && Number.isNaN(baseline)) throw new Error("기존 값은 숫자로 적어 주세요");
      await repo.addOutcome({ projectId: id, actorId: user!.id, metricName: f.metricName, measured: f.measured, value: f.measured ? value : null, unit: f.unit, baseline, measurementPeriod: f.measurementPeriod, source: f.source, evidenceId: f.evidenceId || undefined, qualitativeDescription: f.qualitativeDescription });
      router.replace(`/projects/detail?id=${id}`);
    });
  }
  return (
    <>
      <TopBar title="성과 추가" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card flex flex-col gap-3">
          <Field label="무엇을 쟀나요?"><input className={inputCls} placeholder="예: 릴스 평균 조회수" value={f.metricName} onChange={(e) => setF({ ...f, metricName: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="측정 여부">
            <button role="radio" aria-checked={f.measured} onClick={() => setF({ ...f, measured: true })} className={`btn ${f.measured ? "btn-primary" : "btn-ghost"}`}>측정함</button>
            <button role="radio" aria-checked={!f.measured} onClick={() => setF({ ...f, measured: false, value: "" })} className={`btn ${!f.measured ? "btn-primary" : "btn-ghost"}`}>미측정</button>
          </div>
          <p className="sub text-xs">‘미측정’과 ‘0’은 달라요. 재 보지 않았다면 미측정을 고르세요. 포트폴리오에는 “측정되지 않음”으로 표시돼요.</p>
          {f.measured && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="기존 값"><input inputMode="decimal" className={inputCls} placeholder="420" value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} /></Field>
              <Field label="측정값"><input inputMode="decimal" className={inputCls} placeholder="1100" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
              <Field label="단위"><input className={inputCls} placeholder="회" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
            </div>
          )}
          <Field label="측정 기간"><input className={inputCls} placeholder="예: 게시 후 2주" value={f.measurementPeriod} onChange={(e) => setF({ ...f, measurementPeriod: e.target.value })} /></Field>
          <Field label="출처"><input className={inputCls} placeholder="예: 인스타그램 인사이트" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></Field>
          <Field label="증빙 연결 (선택)">
            <select className={inputCls} value={f.evidenceId} onChange={(e) => setF({ ...f, evidenceId: e.target.value })}>
              <option value="">없음</option>
              {b.evidence.map((e) => <option key={e.id} value={e.id}>{EVIDENCE_LABEL[e.type]} · {e.description || e.fileName || "증빙"}</option>)}
            </select>
          </Field>
          <Field label="정성적 변화 (선택)"><textarea className={`${inputCls} h-20`} placeholder="예: 점주님이 문의 전화가 늘었다고 말씀하심 (수치 없음)" value={f.qualitativeDescription} onChange={(e) => setF({ ...f, qualitativeDescription: e.target.value })} /></Field>
          <p className="sub text-xs">등록한 수치는 의뢰인이 ‘수치 확인’을 눌러야 포트폴리오에 “의뢰인 확인”으로 표시돼요.</p>
        </div>
        <ErrorText text={act.error} />
        <button disabled={act.busy || !f.metricName.trim()} onClick={save} className="btn btn-primary w-full disabled:opacity-40">성과 저장</button>
      </section>
    </>
  );
}
