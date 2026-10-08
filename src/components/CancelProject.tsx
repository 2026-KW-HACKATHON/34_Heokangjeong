"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { ErrorText, useAction } from "@/components/ui";
import type { ProjectBundle, ProjectCancellation } from "@/types";

/**
 * 합의 취소. 진행 중인 프로젝트를 한쪽이 마음대로 끝낼 수 없게, 요청 → 상대 1명의 수락으로 끝낸다.
 *   요청자: 의뢰인 또는 학생 쪽 대표(팀이면 팀장)
 *   3일 안에 응답이 없으면 거절로 처리되고, 프로젝트는 계속 진행된다.
 */
export default function CancelProject({ bundle, onChange }: { bundle: ProjectBundle; onChange: () => void }) {
  const { user, users } = useSession();
  const [c, setC] = useState<ProjectCancellation | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const act = useAction();
  const projectId = bundle.project.id;

  const reload = () => repo.getCancellation(projectId).then(setC);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [projectId]);

  if (!user || c === undefined) return null;
  const status = bundle.project.status;
  if (status === "COMPLETED") return null;

  const isOwner = user.id === bundle.project.ownerId;
  const lead = bundle.members.find((m) => m.isLead)?.studentId ?? bundle.members[0]?.studentId;
  const canRequest = (isOwner || user.id === lead) && status !== "CANCELLED";
  const name = (id?: string) => users.find((u) => u.id === id)?.name ?? "상대방";
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await reload(); onChange(); });

  // 이미 취소된 프로젝트
  if (status === "CANCELLED") return (
    <section className="card text-sm">
      <h3 className="font-bold">합의 취소된 프로젝트예요</h3>
      <p className="sub mt-1">기록은 그대로 남아 있지만 포트폴리오에는 올라가지 않아요.</p>
      {c?.reason && <p className="mt-2 rounded-xl bg-[var(--line)] px-3 py-2">사유: {c.reason}</p>}
    </section>
  );

  const pending = c?.status === "PENDING";
  const iAmResponder = pending && c!.responderId === user.id;
  const daysLeft = pending ? Math.max(0, Math.ceil((new Date(c!.expiresAt).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <section className="card flex flex-col gap-2 text-sm">
      {/* 대기 중인 요청 */}
      {pending && (
        <>
          <h3 className="font-bold">취소 요청이 있어요 <span className="sub font-normal">· 남은 기한 {daysLeft}일</span></h3>
          <p className="sub">{name(c!.requestedBy)} 님이 보냈어요. 3일 안에 응답하지 않으면 거절한 것으로 처리돼요.</p>
          <p className="rounded-xl bg-[var(--line)] px-3 py-2">사유: {c!.reason}</p>
          {iAmResponder ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { if (confirm("취소에 동의할까요? 프로젝트가 종료돼요. (기록은 남아요)")) run(() => repo.respondCancellation(c!.id, true, user.id)); }}
                disabled={act.busy} className="btn btn-primary py-2">취소에 동의</button>
              <button onClick={() => run(() => repo.respondCancellation(c!.id, false, user.id))} disabled={act.busy} className="btn btn-ghost py-2">거절</button>
            </div>
          ) : <p className="sub text-xs">{name(c!.responderId)} 님의 응답을 기다리고 있어요.</p>}
        </>
      )}

      {/* 직전 요청이 거절·만료된 경우 안내 */}
      {!pending && (c?.status === "REJECTED" || c?.status === "EXPIRED") && c.requestedBy === user.id && (
        <div className="rounded-xl bg-[var(--line)] px-3 py-2">
          <p className="font-semibold">취소 요청이 거절됐어요. 채팅으로 상대방과 합의해 주세요.</p>
          <Link href="/chats" className="mt-1 inline-block text-xs text-[var(--primary)]">채팅으로 이동 ›</Link>
        </div>
      )}

      {/* 새 요청 */}
      {!pending && canRequest && (
        open ? (
          <>
            <h3 className="font-bold">프로젝트 취소 요청</h3>
            <p className="sub text-xs">상대방이 동의해야 끝나요. 활동 기록과 대화는 지워지지 않아요.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="왜 취소하려는지 10자 이상 적어 주세요"
              className="h-20 w-full rounded-xl bg-[var(--line)] p-3 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => run(async () => { await repo.requestCancellation(projectId, reason, user.id); setReason(""); setOpen(false); })}
                disabled={act.busy} className="btn btn-primary py-2">요청 보내기</button>
              <button onClick={() => setOpen(false)} className="btn btn-ghost py-2">그만두기</button>
            </div>
          </>
        ) : <button onClick={() => setOpen(true)} className="self-start text-xs text-[var(--sub)] underline">프로젝트 취소 요청하기</button>
      )}
      <ErrorText text={act.error} />
    </section>
  );
}
