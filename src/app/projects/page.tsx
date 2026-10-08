"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { ProjectStatusBadge } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { DOMAINS } from "@shared/portfolio/domains";
import type { Post, Project } from "@/types";

/** 내 프로젝트: 학생은 선정된 프로젝트, 의뢰인은 내 공고의 프로젝트 */
export default function Projects() {
  const { user } = useSession();
  const [rows, setRows] = useState<{ project: Project; post: Post }[] | null>(null);
  useEffect(() => { if (user) repo.listMyProjects(user.id).then(setRows); }, [user]);
  const todo = (p: Project) => {
    const owner = p.ownerId === user?.id;
    if (owner) return p.status === "REVIEW_PENDING" ? "검토할 제출이 있어요" : undefined;
    if (p.status === "CANCELLED") return undefined;
    return p.status === "IN_PROGRESS" ? "기록하고 제출해요" : p.status === "REVISION_REQUESTED" ? "보완 요청이 왔어요" : p.status === "COMPLETED" ? "포트폴리오로 만들 수 있어요" : undefined;
  };
  return (
    <>
      <TopBar title="내 프로젝트" back />
      <section className="flex flex-col gap-3 px-4">
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
