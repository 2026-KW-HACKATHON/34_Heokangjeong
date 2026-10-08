"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { MATCH_STAGE_LABEL, matchStage } from "@/lib/matchStage";
import { useUrlState } from "@/lib/useUrlState";
import { DOMAINS } from "@shared/portfolio/domains";
import type { ChatRoom, Post, Project } from "@/types";

/**
 * 기록 = 내 작업 한곳 (예전 '내 진행 프로젝트' 목록을 합쳤다).
 *  - 진행 중: 채팅과 같은 기준(src/lib/matchStage.ts)의 '진행 중' 단계. 기록 이어 하기(활동 기록) · 프로젝트 보기(제출·검토)
 *  - 완료  : 의뢰인이 승인한 프로젝트. 포트폴리오(보기/만들기) · 프로젝트 보기(검증·평가)
 * 기록한 답·중간 기록·증빙이 포트폴리오 재료가 된다. 분야별 작업 기록(통계)은 내 프로필에 있다.
 */
export default function ActivityPage() { return <Suspense fallback={<TopBar title="작업 기록" />}><Activity /></Suspense>; }
function Activity() {
  const { user } = useSession();
  // 탭은 주소에 둔다 → 포트폴리오·프로젝트를 보고 뒤로 와도 보던 탭 그대로
  const [tab, setTab] = useUrlState<"active" | "done">("tab", "active", ["active", "done"]);
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [projects, setProjects] = useState<{ project: Project; post: Post }[] | null>(null);
  const [withPortfolio, setWithPortfolio] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (user?.role !== "student") return;
    repo.listChatRooms(user.id).then(setRooms).catch(() => setRooms([]));
    repo.listMyProjects(user.id).then(setProjects).catch(() => setProjects([]));
    repo.listPortfolioDocs(user.id).then((docs) => setWithPortfolio(new Set(docs.map((d) => d.project.id)))).catch(() => {});
  }, [user]);

  const active = (rooms ?? [])
    .map((r) => ({ r, stage: matchStage({ applicationStatus: r.application.status, shortlisted: !!r.application.shortlistedAt, shortlistCancelled: !!r.application.shortlistCancelledAt, projectStatus: r.projectStatus, agreementFinalizedAt: r.agreementFinalizedAt, lastMessageAt: r.last?.createdAt }) }))
    .filter((x) => x.stage === "IN_PROGRESS");
  const done = (projects ?? []).filter(({ project }) => project.status === "COMPLETED")
    .sort((a, b) => (b.project.completedAt ?? "").localeCompare(a.project.completedAt ?? ""));
  const loading = rooms === null || projects === null;
  const next = (r: ChatRoom) =>
    r.projectStatus === "REVISION_REQUESTED" ? "보완 요청이 왔어요"
    : r.projectStatus === "REVIEW_PENDING" ? "의뢰인이 검토 중이에요"
    : "과정을 기록해요";

  if (user && user.role !== "student") return <>
    <TopBar title="작업 기록" />
    <section className="px-4"><div className="card text-sm"><p>학생 계정에서 내 작업을 볼 수 있어요.</p><Link href="/projects" className="btn mt-3 w-full">내 프로젝트 보기</Link></div></section>
  </>;

  return <>
    <TopBar title="작업 기록" />
    <section className="flex flex-col gap-3 px-4">
      <div className="flex gap-2" role="tablist" aria-label="내 작업">
        {([["active", "진행 중", active.length], ["done", "완료", done.length]] as const).map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`chip px-4 py-2 text-[15px] ${tab === key ? "chip-on font-semibold" : ""}`}>{label}{!loading && <span className="ml-1 opacity-70">{n}</span>}</button>
        ))}
      </div>

      {loading ? <p role="status" className="sub p-6 text-center text-sm">불러오는 중…</p>
      : tab === "active" ? (
        active.length === 0
          ? <div className="card text-sm"><p className="sub">지금 진행 중인 작업이 없어요. 계약서를 확정하고 대화를 시작하면 여기에 떠요.</p><Link href="/" className="btn mt-3 w-full">공고 둘러보기</Link></div>
          : active.map(({ r, stage }) => (
            <article key={r.application.id} className="card">
              <div className="flex items-center justify-between gap-2"><span className="sub text-xs">{r.other?.name ?? "의뢰인"}</span><span className="chip chip-on">{MATCH_STAGE_LABEL[stage]}</span></div>
              <h3 className="mt-1 font-bold">{r.post.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[var(--primary)]">→ {next(r)}</p>
              {r.projectId ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href={`/projects/log?id=${r.projectId}&stage=next`} className="btn btn-primary text-sm">기록 이어 하기</Link>
                  <Link href={`/projects/detail?id=${r.projectId}`} className="btn btn-ghost text-sm">프로젝트 보기</Link>
                </div>
              ) : <Link href={`/chats/room?id=${r.application.id}`} className="btn btn-ghost mt-3 w-full text-sm">대화 보기</Link>}
            </article>
          ))
      ) : (
        done.length === 0
          ? <div className="card text-sm"><p className="sub">아직 완료한 작업이 없어요. 의뢰인이 결과물을 승인하면 여기에 모여요.</p></div>
          : done.map(({ project, post }) => (
            <article key={project.id} className="card">
              <div className="flex items-center justify-between gap-2"><span className="chip chip-on">{DOMAINS[project.domain].label}</span><span className="text-xs font-semibold text-[var(--green)]">의뢰인 검증 완료 ✓</span></div>
              <h3 className="mt-2 font-bold">{post.title}</h3>
              {project.completedAt && <p className="sub mt-1 text-xs">{project.completedAt.slice(0, 10)} 완료</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {withPortfolio.has(project.id)
                  ? <Link href={`/portfolio/view?id=${project.id}&s=${user?.id}`} className="btn btn-primary text-sm">포트폴리오 보기</Link>
                  : <Link href={`/portfolio/build?id=${project.id}`} className="btn btn-primary text-sm">포트폴리오 만들기</Link>}
                <Link href={`/projects/detail?id=${project.id}`} className="btn btn-ghost text-sm">프로젝트 보기</Link>
              </div>
            </article>
          ))
      )}
    </section>
  </>;
}
