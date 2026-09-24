"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { DOMAINS } from "@shared/portfolio/domains";
import type { PortfolioCard, PortfolioEditedVersion, Post, Project } from "@/types";

/** ④ 검증형 포트폴리오: 의뢰인 검증을 거친 Case Study 목록 + 예전 활동 카드 */
export default function Portfolio() {
  const { user } = useSession();
  const [docs, setDocs] = useState<{ edit: PortfolioEditedVersion; post: Post; project: Project }[]>([]);
  const [cards, setCards] = useState<PortfolioCard[]>([]);
  const [ready, setReady] = useState<{ project: Project; post: Post }[]>([]);
  useEffect(() => {
    if (user?.role !== "student") return;
    repo.listPortfolioDocs(user.id).then(setDocs);
    repo.listPortfolio(user.id).then(setCards);
    repo.listMyProjects(user.id).then((ps) => setReady(ps.filter((p) => p.project.status === "COMPLETED")));
  }, [user]);
  const pending = ready.filter((r) => !docs.some((d) => d.project.id === r.project.id));
  return (
    <>
      <TopBar title="내 포트폴리오" back />
      <section className="flex flex-col gap-3 px-4">
        {user?.role !== "student" && <EmptyState text="학생 계정에서 볼 수 있어요" />}
        {user?.role === "student" && (
          <div className="card bg-[var(--primary)] text-white">
            <p className="text-sm opacity-90">봉사시간이 아니라, 문제를 해결한 경험을 기록해요</p>
            <p className="mt-1 font-bold">지역에서 경험하고 → 검증받고 → 커리어로</p>
          </div>
        )}
        {pending.map(({ project, post }) => (
          <Link key={project.id} href={`/portfolio/build?id=${project.id}`} className="card flex items-center justify-between bg-[var(--primary-weak)]">
            <span><span className="block text-xs font-semibold text-[var(--primary)]">검증 완료 · 포트폴리오를 만들 수 있어요</span><span className="font-bold">{post.title}</span></span><span className="text-[var(--primary)]">›</span>
          </Link>
        ))}
        {docs.map(({ edit, post, project }) => (
          <Link key={edit.id} href={`/portfolio/view?id=${project.id}&s=${user!.id}`} className="card block active:opacity-80">
            <div className="flex items-center justify-between"><span className="chip chip-on">{DOMAINS[project.domain].label}</span><span className="text-xs font-semibold text-[var(--green)]">🛡️ Client Verified</span></div>
            <h3 className="mt-2 font-bold">{edit.content.title}</h3>
            <p className="sub mt-1 line-clamp-2 text-sm">{edit.content.summary}</p>
            <p className="sub mt-2 text-xs">{post.title} · 편집본 v{edit.version}</p>
          </Link>
        ))}
        {user?.role === "student" && docs.length === 0 && pending.length === 0 && <EmptyState text="검증을 마친 프로젝트가 생기면 Case Study 로 만들 수 있어요" />}
        {cards.length > 0 && <h3 className="sub mt-2 text-sm font-semibold">활동 카드</h3>}
        {cards.map((c) => (
          <article key={c.id} className="card">
            <div className="flex items-center justify-between"><h3 className="font-bold">{c.title}</h3>{c.verified && <span className="text-xs font-semibold text-[var(--green)]">상인 인증 완료 ✓</span>}</div>
            <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1.5 text-sm">
              <dt className="sub">역할</dt><dd>{c.roleLabel}</dd>
              {c.tasks.length > 0 && <><dt className="sub">작업</dt><dd><ul className="list-disc pl-4">{c.tasks.map((t) => <li key={t}>{t}</li>)}</ul></dd></>}
              <dt className="sub">기간</dt><dd>{c.durationDays}일</dd>
              <dt className="sub">평가</dt><dd>{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</dd>
            </dl>
          </article>
        ))}
      </section>
    </>
  );
}
