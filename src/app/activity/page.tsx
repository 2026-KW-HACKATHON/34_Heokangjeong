"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { MATCH_STAGE_LABEL, matchStage } from "@/lib/matchStage";
import type { ChatRoom } from "@/types";

/**
 * 기록: 지금 진행 중인 작업 (분야별 작업 기록은 내 프로필에 있다) + 내 포트폴리오로 가는 길.
 * 채팅 목록과 같은 기준(src/lib/matchStage.ts)에서 '진행 중' 단계만 보여 주고, 누르면 바로 활동 기록 화면으로 간다
 * (기록한 답·중간 기록·증빙이 포트폴리오 재료가 된다).
 */
export default function ActivityPage() {
  const { user } = useSession();
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  useEffect(() => { if (user?.role === "student") repo.listChatRooms(user.id).then(setRooms).catch(() => setRooms([])); }, [user]);
  const items = (rooms ?? [])
    .map((r) => ({ r, stage: matchStage({ applicationStatus: r.application.status, projectStatus: r.projectStatus, agreementFinalizedAt: r.agreementFinalizedAt, lastMessageAt: r.last?.createdAt }) }))
    .filter((x) => x.stage === "IN_PROGRESS");
  const next = (r: ChatRoom) =>
    r.projectStatus === "REVISION_REQUESTED" ? "보완 요청이 왔어요"
    : r.projectStatus === "REVIEW_PENDING" ? "의뢰인이 검토 중이에요"
    : "과정을 기록해요";
  // 활동 기록 화면 (남은 질문이 있는 단계부터). 선정 전이라 프로젝트가 없으면 대화로
  const href = (r: ChatRoom) => (r.projectId ? `/projects/log?id=${r.projectId}&stage=next` : `/chats/room?id=${r.application.id}`);
  return <>
    <TopBar title="작업 기록" />
    <section className="flex flex-col gap-4 px-4">
      {user?.role === "student" ? <>
        <section className="card" aria-label="진행 중인 작업">
          <h2 className="text-base font-bold">진행 중인 작업</h2>
          {rooms === null ? <p role="status" className="sub mt-3 text-sm">불러오는 중…</p>
            : items.length === 0 ? <div className="mt-3 text-sm"><p className="sub">지금 진행 중인 작업이 없어요.</p><Link href="/" className="btn mt-3 w-full">공고 둘러보기</Link></div>
            : <ul className="mt-2 flex flex-col divide-y divide-[var(--line)]">
              {items.map(({ r, stage }) => (
                <li key={r.application.id}>
                  <Link href={href(r)} className="block py-3 active:opacity-80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="sub text-xs">{r.other?.name ?? "의뢰인"}</span>
                      <span className="chip chip-on">{MATCH_STAGE_LABEL[stage]}</span>
                    </div>
                    <p className="mt-1 font-bold">{r.post.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--primary)]">→ {next(r)}</p>
                  </Link>
                </li>
              ))}
            </ul>}
        </section>
        <Link href="/portfolio" className="btn w-full">내 포트폴리오 보기</Link>
      </> : <div className="card text-sm"><p>학생 계정에서 진행 중인 작업을 볼 수 있어요.</p><Link href="/projects" className="btn mt-3 w-full">내 프로젝트 보기</Link></div>}
    </section>
  </>;
}
