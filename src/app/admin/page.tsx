"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { ErrorText, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { clubKindLabel } from "@/lib/clubs";
import { collegeLabel } from "@/lib/colleges";
import type { Club } from "@/types";

/**
 * 관리자 화면 (role = admin 만 볼 수 있다).
 * 지금은 단체(동아리·학회) 등록 심사만 한다. 승인해야 목록에 뜨고 학생이 가입할 수 있다.
 * 운영 모니터링(멈춘 사이트·보증 만료)은 repo.adminOverview() 로 준비돼 있어 나중에 붙이면 된다.
 */
export default function Admin() {
  const { user, loading } = useSession();
  const [pending, setPending] = useState<Club[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [history, setHistory] = useState<Club[]>([]);
  const act = useAction();

  const reload = () => {
    repo.listPendingClubs().then(setPending);
    if (tab !== "PENDING") repo.listClubsByStatus(tab).then(setHistory);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.role === "admin") reload(); }, [user, tab]);

  if (loading) return <><TopBar title="관리자" /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (user?.role !== "admin") return <><TopBar title="관리자" /><p className="card mx-4 text-sm">관리자 계정으로 로그인해야 볼 수 있어요.</p></>;

  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); reload(); });

  return (
    <>
      <TopBar title="관리자" />
      <section className="flex flex-col gap-3 px-4">
        {/* 1. 지금 처리할 일 */}
        <div className="card flex flex-col gap-3">
          <h3 className="font-bold">단체 등록 심사 {pending.length > 0 && <span className="text-[var(--red)]">{pending.length}</span>}</h3>
          <div className="flex gap-2">
            {([["PENDING", `대기 ${pending.length}`], ["APPROVED", "승인됨"], ["REJECTED", "거절됨"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={tab === v} onClick={() => setTab(v)} className={`chip ${tab === v ? "chip-on" : ""}`}>{label}</button>
            ))}
          </div>

          {tab !== "PENDING" && (
            <>
              {history.length === 0 && <p className="sub text-sm">{tab === "APPROVED" ? "승인한 단체가 없어요." : "거절한 신청이 없어요."}</p>}
              {history.map((c) => (
                <div key={c.id} className="flex flex-col gap-1 rounded-xl bg-[var(--line)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><b>{c.name}</b><span className="chip bg-white">{clubKindLabel(c)}</span></div>
                  {c.college && <p className="sub text-xs">{collegeLabel(c.college)}</p>}
                  <p className="sub text-xs">{c.description || "소개 없음"}</p>
                  {c.status === "REJECTED" && <p className="text-xs text-[var(--red)]">거절 사유: {c.rejectReason || "없음"}</p>}
                  <button onClick={() => run(() => repo.reviewClub(c.id, c.status !== "APPROVED", undefined, user.id))} className="mt-1 self-start text-xs text-[var(--primary)] underline">
                    {c.status === "APPROVED" ? "승인 취소하고 거절로 바꾸기" : "다시 승인하기"}
                  </button>
                </div>
              ))}
            </>
          )}

          {tab === "PENDING" && pending.length === 0 && <p className="sub text-sm">심사할 신청이 없어요.</p>}
          {tab === "PENDING" && pending.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-xl bg-[var(--line)] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <b>{c.name}</b><span className="chip bg-white">{clubKindLabel(c)}</span>
              </div>
              {c.college && <p className="sub text-xs">{collegeLabel(c.college)}</p>}
              <p>{c.description || <span className="sub">소개 없음</span>}</p>
              <input className={`${inputCls} bg-white`} placeholder="거절 사유 (거절할 때만)" value={reason[c.id] ?? ""} onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => run(() => repo.reviewClub(c.id, true, undefined, user.id))} className="btn btn-primary py-2 text-sm">승인</button>
                <button onClick={() => run(() => repo.reviewClub(c.id, false, reason[c.id] || "확인이 어려워요", user.id))} className="btn bg-white py-2 text-sm">거절</button>
              </div>
            </div>
          ))}
          <ErrorText text={act.error} />
        </div>

        <Link href="/clubs" className="btn btn-ghost w-full">단체 목록 보기</Link>
      </section>
    </>
  );
}
