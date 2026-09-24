"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import EvidenceItem from "@/components/EvidenceItem";
import { ErrorText, Field, Rating, Toggle, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { useBundle } from "@/lib/useBundle";
import { listingOf } from "@/lib/listing";
import { CLAIM_KEYS, CLAIM_LABEL } from "@shared/portfolio/document";
import type { ClaimKey, VerificationClaims } from "@/types";

/** 의뢰인 검토: 최신 제출 버전을 보고 보완 요청 또는 승인(+ Claim 단위 검증 + 평가) */
export default function ReviewPage() {
  return <Suspense fallback={<TopBar title="검토" back />}><Review /></Suspense>;
}

const CLAIM_HINT: Record<ClaimKey, string> = {
  workPerformed: "승인하려면 꼭 확인해야 해요",
  roleConfirmed: "학생이 기록한 역할(예: 시안 디자인)이 실제와 같나요?",
  deliverableReceived: "파일·링크 등 결과물을 받았나요?",
  completionCriteriaMet: "공고에 적은 완료 기준을 채웠나요?",
  actuallyUsed: "매장·온라인에서 실제로 쓰고 있나요? 아직이면 끄세요",
};

function Review() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { user } = useSession();
  const { bundle: b, reload } = useBundle(id);
  const [mode, setMode] = useState<"approve" | "revise">("approve");
  const [comment, setComment] = useState("");
  const [claims, setClaims] = useState<VerificationClaims>({ workPerformed: false, roleConfirmed: false, deliverableReceived: false, completionCriteriaMet: false, actuallyUsed: false });
  const [review, setReview] = useState({ satisfaction: 0, deadline: 0, communication: 0, handoff: 0, comment: "" });
  const [note, setNote] = useState("");
  const act = useAction();
  if (!b || !user) return <><TopBar title="검토" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const v = b.versions.at(-1);
  const listing = listingOf(b.post);
  const usedRevisions = b.versions.filter((x) => x.status === "REVISION_REQUESTED").length;
  const left = listing.revisionLimit - usedRevisions;
  if (b.project.ownerId !== user.id) return <><TopBar title="검토" back /><p className="sub p-6 text-center text-sm">이 공고를 올린 의뢰인만 검토할 수 있어요.</p></>;
  if (!v || b.project.status !== "REVIEW_PENDING") return (
    <><TopBar title="검토" back /><div className="card mx-4 text-sm">{b.project.status === "COMPLETED" ? "이미 승인한 프로젝트예요." : "검토할 제출이 없어요."}<Link href={`/projects/detail?id=${id}`} className="btn btn-ghost mt-3 w-full">프로젝트로</Link></div></>
  );
  const ratingsDone = review.satisfaction && review.deadline && review.communication && review.handoff;

  async function submit() {
    await act.run(async () => {
      if (mode === "revise") await repo.requestRevision(v!.id, user!.id, comment);
      else {
        if (!claims.workPerformed) throw new Error("‘학생이 실제로 작업함’을 확인해야 승인할 수 있어요");
        if (!ratingsDone) throw new Error("평가 네 항목을 모두 골라 주세요");
        await repo.approveVersion({ versionId: v!.id, actorId: user!.id, claims, note, review });
      }
      await reload();
      router.replace(`/projects/detail?id=${id}`);
    });
  }

  return (
    <>
      <TopBar title={`v${v.version} 검토`} back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card">
          <h3 className="font-bold">{b.post.title} · 제출 v{v.version}</h3>
          {v.note && <p className="mt-1 text-sm">“{v.note}”</p>}
          {listing.completionCriteria && <p className="sub mt-2 text-xs">완료 기준: {listing.completionCriteria}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">{v.evidenceIds.map((eid) => b.evidence.find((e) => e.id === eid)).filter(Boolean).map((e) => <EvidenceItem key={e!.id} e={e!} compact />)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2" role="tablist">
          <button role="tab" aria-selected={mode === "approve"} onClick={() => setMode("approve")} className={`btn ${mode === "approve" ? "btn-primary" : "btn-ghost"}`}>승인·검증</button>
          <button role="tab" aria-selected={mode === "revise"} disabled={left <= 0} onClick={() => setMode("revise")} className={`btn ${mode === "revise" ? "btn-primary" : "btn-ghost"} disabled:opacity-40`}>보완 요청 ({Math.max(0, left)}번 남음)</button>
        </div>

        {mode === "revise" ? (
          <div className="card">
            <Field label="무엇을 보완하면 좋을까요?" hint="학생이 수정해서 새 버전으로 다시 제출해요. 이전 버전도 기록으로 남아요.">
              <textarea className={`${inputCls} h-28`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="예: 가격 글씨를 더 크게 해 주세요" />
            </Field>
          </div>
        ) : (
          <>
            <div className="card flex flex-col gap-2">
              <h3 className="font-bold">무엇을 확인하셨나요?</h3>
              <p className="sub text-xs">확인한 것만 켜 주세요. 항목별로 학생 포트폴리오에 “의뢰인 확인”으로 표시돼요.</p>
              {CLAIM_KEYS.map((k) => <Toggle key={k} checked={claims[k]} onChange={(val) => setClaims({ ...claims, [k]: val })} label={CLAIM_LABEL[k]} sub={CLAIM_HINT[k]} />)}
              <p className="sub text-xs">성과 수치(조회수 등)는 학생이 성과를 등록하면 따로 확인할 수 있어요.</p>
              <input className={inputCls} placeholder="확인 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="확인 메모" />
            </div>
            <div className="card flex flex-col gap-3">
              <h3 className="font-bold">함께해 보니 어땠나요?</h3>
              <Rating label="만족도" value={review.satisfaction} onChange={(n) => setReview({ ...review, satisfaction: n })} />
              <Rating label="기한 준수" value={review.deadline} onChange={(n) => setReview({ ...review, deadline: n })} />
              <Rating label="소통" value={review.communication} onChange={(n) => setReview({ ...review, communication: n })} />
              <Rating label="인계" value={review.handoff} onChange={(n) => setReview({ ...review, handoff: n })} />
              <Field label="한마디 (선택)" hint="원문 그대로 포트폴리오에 인용돼요. 학생이 고칠 수 없어요.">
                <textarea className={`${inputCls} h-20`} value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        <ErrorText text={act.error} />
        <button disabled={act.busy || (mode === "revise" && !comment.trim())} onClick={submit} className="btn btn-primary w-full disabled:opacity-40">
          {act.busy ? "처리 중…" : mode === "revise" ? "보완 요청 보내기" : `v${v.version} 승인하고 검증 남기기`}
        </button>
      </section>
    </>
  );
}
