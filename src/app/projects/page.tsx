"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { ProjectStatusBadge } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { DOMAINS } from "@shared/portfolio/domains";
import type { Operations, Post, Project } from "@/types";

/** 내 프로젝트: 학생은 선정된 프로젝트, 의뢰인은 내 공고의 프로젝트 */
export default function Projects() {
  const { user } = useSession();
  const [rows, setRows] = useState<{ project: Project; post: Post }[] | null>(null);
  // 담당 학생이 빠진 프로젝트 — 다른 학생이 이어받을 수 있다 (Project Baton)
  const [openings, setOpenings] = useState<{ operations: Operations; post: Post; project: Project }[]>([]);
  useEffect(() => {
    if (!user) return;
    repo.listMyProjects(user.id).then(setRows);
    if (user.role === "student") repo.listHandoverOpenings().then((list) => setOpenings(list.filter((x) => x.operations.maintainerId !== user.id)));
  }, [user]);
  const todo = (p: Project) => {
    const owner = p.ownerId === user?.id;
    if (owner) return p.status === "REVIEW_PENDING" ? "검토할 제출이 있어요" : undefined;
    return p.status === "IN_PROGRESS" ? "기록하고 제출해요" : p.status === "REVISION_REQUESTED" ? "보완 요청이 왔어요" : p.status === "COMPLETED" ? "포트폴리오로 만들 수 있어요" : undefined;
  };
  return (
    <>
      <TopBar title="내 프로젝트" />
      <section className="flex flex-col gap-3 px-4">
        {openings.length > 0 && (
          <div className="card flex flex-col gap-2">
            <h3 className="font-bold">🔧 이어받을 프로젝트</h3>
            <p className="sub text-xs">담당 학생이 빠진 운영 중인 서비스예요. 인수인계서가 있어서 바로 시작할 수 있어요.</p>
            {openings.map(({ project, post, operations }) => (
              <Link key={project.id} href={`/projects/detail?id=${project.id}`} className="rounded-xl bg-[var(--line)] px-3 py-2 text-sm active:opacity-80">
                <b>{post.title}</b>
                <span className="sub block text-xs">{operations.deployUrl ?? "배포 주소 미입력"} · 저장소 {operations.repoUrl ? "있음" : "없음"}</span>
              </Link>
            ))}
          </div>
        )}
        {rows === null && <p className="sub p-6 text-center text-sm">불러오는 중…</p>}
        {rows?.length === 0 && <EmptyState text={user?.role === "resident" ? "지원자를 선정하면 프로젝트가 시작돼요" : "공고에 지원하고 선정되면 프로젝트가 시작돼요"} />}
        {rows?.map(({ project, post }) => (
          <Link key={project.id} href={`/projects/detail?id=${project.id}`} className="card block active:opacity-80">
            <div className="mb-2 flex items-center justify-between"><span className="chip chip-on">{DOMAINS[project.domain].label}</span><ProjectStatusBadge status={project.status} /></div>
            <h3 className="font-bold">{post.title}{project.mode === "TEAM" && <span className="ml-1 text-sm text-[var(--primary)]">(팀)</span>}</h3>
            {todo(project) && <p className="mt-1 text-sm font-semibold text-[var(--primary)]">→ {todo(project)}</p>}
          </Link>
        ))}
      </section>
    </>
  );
}
