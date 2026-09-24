"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import EvidenceItem from "@/components/EvidenceItem";
import { ErrorText, Field, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { useBundle } from "@/lib/useBundle";
import { listingOf } from "@/lib/listing";
import { myAnswers } from "@/lib/useBundle";
import { computeReadiness } from "@shared/portfolio/readiness";
import MissingRequired from "@/components/MissingRequired";

/** 결과물 제출 (버전 관리: v1 → 보완 요청 → v2 …) */
export default function SubmitPage() {
  return <Suspense fallback={<TopBar title="결과물 제출" back />}><Submit /></Suspense>;
}

const DELIVERABLE = new Set(["DELIVERABLE_FILE", "DELIVERABLE_URL", "AFTER_IMAGE", "VIDEO"]);

function Submit() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { user } = useSession();
  const { bundle: b, error: loadError } = useBundle(id);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [note, setNote] = useState("");
  const act = useAction();
  if (loadError) return <><TopBar title="결과물 제출" back /><div className="px-4"><ErrorText text={loadError} /></div></>;
  if (!b || !user) return <><TopBar title="결과물 제출" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const status = b.project.status;
  const latest = b.versions.at(-1);
  const nextVersion = (latest?.version ?? 0) + 1;
  const sel = picked ?? b.evidence.filter((e) => DELIVERABLE.has(e.type)).map((e) => e.id);
  const listing = listingOf(b.post);
  const allowed = b.members.some((m) => m.studentId === user.id) && (status === "IN_PROGRESS" || status === "REVISION_REQUESTED");

  if (!allowed) return (
    <><TopBar title="결과물 제출" back />
      <div className="card mx-4 text-sm">{status === "REVIEW_PENDING" ? "의뢰인이 검토 중이에요. 보완 요청이 오면 다시 제출할 수 있어요." : status === "COMPLETED" ? "이미 승인된 프로젝트예요." : "선정된 학생만 제출할 수 있어요."}
        <Link href={`/projects/detail?id=${id}`} className="btn btn-ghost mt-3 w-full">프로젝트로</Link></div></>
  );
  return (
    <>
      <TopBar title={`v${nextVersion} 제출`} back />
      <section className="flex flex-col gap-3 px-4">
        {status === "REVISION_REQUESTED" && latest?.reviewComment && (
          <div className="card bg-orange-50 text-sm"><p className="font-bold">v{latest.version} 보완 요청</p><p className="mt-1">“{latest.reviewComment}”</p></div>
        )}
        <div className="card"><h3 className="font-bold">제출 전 확인</h3>
          <MissingRequired r={computeReadiness({ domain: b.project.domain, answers: myAnswers(b, user.id), evidenceTypes: b.evidence.map((e) => e.type), outcomeCount: b.outcomes.length })}
            href={(q) => `/projects/log?id=${id}&q=${q}&set=${q}&back=${encodeURIComponent(`/projects/submit?id=${id}`)}`} />
          <p className="sub mt-2 text-[11px]">비어 있어도 제출할 수 있어요. 다만 포트폴리오에서 그 부분은 빠져요.</p>
        </div>
        {listing.completionCriteria && <div className="card text-sm"><span className="sub">완료 기준</span><p className="font-semibold">{listing.completionCriteria}</p></div>}
        <div className="card">
          <div className="mb-2 flex items-center justify-between"><h3 className="font-bold">제출할 결과물</h3><Link href={`/projects/evidence?id=${id}&type=DELIVERABLE_FILE&back=${encodeURIComponent(`/projects/submit?id=${id}`)}`} className="text-sm font-semibold text-[var(--primary)]">+ 증빙 추가</Link></div>
          {b.evidence.length === 0 && <p className="sub text-sm">먼저 결과물 파일이나 링크를 증빙으로 올려 주세요.</p>}
          <ul className="flex flex-col gap-2">
            {b.evidence.map((e) => (
              <li key={e.id}>
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-3 h-5 w-5 accent-[var(--primary)]" checked={sel.includes(e.id)} onChange={(x) => setPicked(x.target.checked ? [...sel, e.id] : sel.filter((s) => s !== e.id))} />
                  <div className="flex-1"><EvidenceItem e={e} compact /></div>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <Field label={status === "REVISION_REQUESTED" ? "무엇을 보완했나요?" : "의뢰인에게 남길 말"}>
            <textarea className={`${inputCls} h-24`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === "REVISION_REQUESTED" ? "예: 가격 글씨를 14pt → 20pt 로 키웠어요" : "예: 인쇄용 PDF 와 원본 파일을 함께 올렸어요"} />
          </Field>
        </div>
        <ErrorText text={act.error} />
        <button disabled={act.busy || sel.length === 0} onClick={() => act.run(async () => { await repo.submitVersion({ projectId: id, actorId: user.id, note, evidenceIds: sel }); router.replace(`/projects/detail?id=${id}`); })}
          className="btn btn-primary w-full disabled:opacity-40">{act.busy ? "제출 중…" : `v${nextVersion} 제출하기`}</button>
        <p className="sub text-center text-xs">제출한 버전은 그대로 보존되고, 의뢰인이 어느 버전을 승인했는지 기록돼요.</p>
      </section>
    </>
  );
}
