"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { ProjectStatusBadge } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { DOMAINS } from "@shared/portfolio/domains";
import type { Post, Project } from "@/types";

/** 기록: 지금 진행 중인 작업 (분야별 작업 기록은 내 프로필에 있다) + 내 포트폴리오로 가는 길 */
export default function ActivityPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<{ project: Project; post: Post }[] | null>(null);
  useEffect(() => { if (user?.role === "student") repo.listMyProjects(user.id).then(setRows).catch(() => setRows([])); }, [user]);
  // 완료·취소된 것은 빼고, 아직 손이 가는 것(진행·검토 대기·보완 요청·팀원 모집)만
  const active = (rows ?? []).filter(({ project }) => project.status !== "COMPLETED" && project.status !== "CANCELLED");
  const todo = (p: Project) => p.status === "IN_PROGRESS" ? "기록하고 제출해요" : p.status === "REVISION_REQUESTED" ? "보완 요청이 왔어요" : p.status === "REVIEW_PENDING" ? "의뢰인이 검토 중이에요" : p.status === "RECRUITING" ? "팀원이 모이면 시작해요" : undefined;
  return <>
    <TopBar title="작업 기록" />
    <section className="flex flex-col gap-4 px-4">
      {user?.role === "student" ? <>
        <section className="card" aria-label="진행 중인 작업">
          <h2 className="text-base font-bold">진행 중인 작업</h2>
          {rows === null ? <p role="status" className="sub mt-3 text-sm">불러오는 중…</p>
            : active.length === 0 ? <div className="mt-3 text-sm"><p className="sub">지금 진행 중인 작업이 없어요.</p><Link href="/" className="btn mt-3 w-full">공고 둘러보기</Link></div>
            : <ul className="mt-2 flex flex-col divide-y divide-[var(--line)]">
              {active.map(({ project, post }) => (
                <li key={project.id}>
                  <Link href={`/projects/detail?id=${project.id}`} className="block py-3 active:opacity-80">
                    <div className="flex items-center justify-between gap-2"><span className="chip chip-on">{DOMAINS[project.domain].label}</span><ProjectStatusBadge status={project.status} /></div>
                    <p className="mt-2 font-bold">{post.title}{project.mode === "TEAM" && <span className="ml-1 text-sm text-[var(--primary)]">(팀)</span>}</p>
                    {todo(project) && <p className="mt-1 text-sm font-semibold text-[var(--primary)]">→ {todo(project)}</p>}
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
