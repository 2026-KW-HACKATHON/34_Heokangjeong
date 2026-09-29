"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, Rating, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { useBundle } from "@/lib/useBundle";

export default function PeerReviewPage() {
  return <Suspense fallback={<TopBar title="팀원 상호평가" back />}><PeerReview /></Suspense>;
}

function PeerReview() {
  const id = useSearchParams().get("id") ?? "";
  const { user, users } = useSession();
  const { bundle, error, reload } = useBundle(id);
  if (error) return <><TopBar title="팀원 상호평가" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (!bundle || !user) return <><TopBar title="팀원 상호평가" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const verifiedIds = new Set(bundle.memberVerifications.filter((v) => v.verified).map((v) => v.studentId));
  const peers = bundle.members.filter((m) => m.studentId !== user.id && verifiedIds.has(m.studentId));
  const allowed = bundle.project.mode === "TEAM" && bundle.project.status === "COMPLETED" && verifiedIds.has(user.id);
  return <>
    <TopBar title="팀원 상호평가" back />
    <main className="flex flex-col gap-3 px-4">
      <section className="card text-sm"><h2 className="font-bold">함께 일한 팀원을 평가해 주세요</h2><p className="sub mt-1 text-xs">본인은 평가할 수 없으며, 여러 팀원이 남긴 점수는 프로젝트별 평균으로 협업 온도에 반영됩니다.</p></section>
      {!allowed && <p className="card text-sm">완료 후 실제 참여가 확인된 팀원만 상호평가할 수 있어요.</p>}
      {allowed && peers.length === 0 && <p className="card text-sm">평가할 다른 검증 팀원이 없어요.</p>}
      {allowed && peers.map((peer) => <PeerCard key={peer.studentId} projectId={id} reviewerId={user.id} revieweeId={peer.studentId} name={users.find((u) => u.id === peer.studentId)?.name ?? "팀원"} role={peer.roleLabel} saved={bundle.peerReviews.find((r) => r.reviewerId === user.id && r.revieweeId === peer.studentId)} onSaved={reload} />)}
    </main>
  </>;
}

function PeerCard({ projectId, reviewerId, revieweeId, name, role, saved, onSaved }: { projectId: string; reviewerId: string; revieweeId: string; name: string; role: string; saved?: { communication: number; collaboration: number; responsibility: number; comment: string }; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ communication: saved?.communication ?? 0, collaboration: saved?.collaboration ?? 0, responsibility: saved?.responsibility ?? 0, comment: saved?.comment ?? "" });
  const act = useAction();
  const complete = form.communication > 0 && form.collaboration > 0 && form.responsibility > 0;
  return <section className="card flex flex-col gap-3">
    <div><h3 className="font-bold">{name}</h3><p className="sub text-xs">{role}</p></div>
    <Rating label="소통" value={form.communication} onChange={(communication) => setForm({ ...form, communication })} />
    <Rating label="협력" value={form.collaboration} onChange={(collaboration) => setForm({ ...form, collaboration })} />
    <Rating label="책임감" value={form.responsibility} onChange={(responsibility) => setForm({ ...form, responsibility })} />
    <textarea className={`${inputCls} h-20`} aria-label={`${name} 평가 한마디`} placeholder="함께한 경험을 간단히 남겨 주세요 (선택)" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
    <ErrorText text={act.error} />
    <button disabled={!complete || act.busy} onClick={() => act.run(async () => { await repo.savePeerReview({ projectId, reviewerId, revieweeId, ...form }); await onSaved(); })} className="btn btn-primary w-full disabled:opacity-40">{act.busy ? "저장 중…" : saved ? "평가 수정" : "평가 저장"}</button>
  </section>;
}
