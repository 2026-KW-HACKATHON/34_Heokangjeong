"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import PortfolioPublicationControl from "@/components/PortfolioPublicationControl";
import WorkFieldSummary from "@/components/WorkFieldSummary";
import StarRating from "@/components/StarRating";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { DOMAINS } from "@shared/portfolio/domains";
import type { PortfolioCard, PortfolioEditedVersion, Post, Project } from "@/types";

/** ④ 검증형 포트폴리오: 목록은 요약 카드(역할·기간·평가), 누르면 Case Study 상세(또는 만들기) */
export default function Portfolio() {
  const { user } = useSession();
  const [docs, setDocs] = useState<{ edit: PortfolioEditedVersion; post: Post; project: Project }[]>([]);
  const [cards, setCards] = useState<PortfolioCard[]>([]);
  const [ready, setReady] = useState<{ project: Project; post: Post }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setDocs([]); setCards([]); setReady([]); setError("");
    if (user?.role !== "student") return;
    Promise.all([repo.listPortfolioDocs(user.id), repo.listPortfolio(user.id), repo.listMyProjects(user.id)]).then(([ds, cs, ps]) => {
      if (!active) return;
      setDocs(ds); setCards(cs); setReady(ps.filter(p => p.project.status === "COMPLETED"));
    }).catch(() => { if (active) setError("포트폴리오를 불러오지 못했어요. 서버 마이그레이션과 연결 상태를 확인해 주세요."); });
    return () => { active = false; };
  }, [user]);
  const pending = ready.filter((r) => !docs.some((d) => d.project.id === r.project.id));
  // 검증형 프로젝트와 연결되지 않은 예전 활동 카드만 따로 보여 준다
  const legacy = cards.filter((c) => !docs.some((d) => d.post.id === c.postId) && !ready.some((r) => r.post.id === c.postId));
  const cardOf = (postId: string) => cards.find((c) => c.postId === postId);

  return (
    <>
      <TopBar title="내 포트폴리오" back />
      <section className="flex flex-col gap-3 px-4">
        {user?.role === "student" && <WorkFieldSummary key={user.id} studentId={user.id} />}
        {error && <p role="alert" className="card text-sm text-[var(--red)]">{error}</p>}
        {user?.role !== "student" && <EmptyState text="학생 계정에서 볼 수 있어요" />}
        {docs.map(({ edit, post, project }) => (
          <div key={`${user!.id}:${edit.id}`}>
            <SummaryCard href={`/portfolio/view?id=${project.id}&s=${user!.id}`} title={edit.content.title} domain={DOMAINS[project.domain].label}
              card={cardOf(post.id)} post={post} project={project} action="Case Study 보기" />
            <PortfolioPublicationControl studentId={user!.id} sourceId={project.id} sourceKind="project" />
          </div>
        ))}
        {pending.map(({ project, post }) => (
          <SummaryCard key={project.id} href={`/portfolio/build?id=${project.id}`} title={post.title} domain={DOMAINS[project.domain].label}
            card={cardOf(post.id)} post={post} project={project} action="포트폴리오 만들기" highlight />
        ))}
        {legacy.map((c) => <div key={`${user!.id}:${c.id}`}><SummaryCard title={c.title} card={c} /><PortfolioPublicationControl studentId={user!.id} sourceId={c.id} sourceKind="card" /></div>)}
        {user?.role === "student" && <Link href={`/portfolio/gallery?s=${encodeURIComponent(user.id)}`} className="btn w-full">내 공개 갤러리 보기</Link>}
        {user?.role === "student" && docs.length === 0 && pending.length === 0 && legacy.length === 0 && <EmptyState text="검증을 마친 프로젝트가 생기면 여기에 쌓여요" />}
      </section>
    </>
  );
}

/** 요약 카드: 제목·검증 표시·역할·기간·평가. href 가 있으면 눌러서 상세로 */
function SummaryCard({ title, card, post, project, domain, href, action, highlight }: {
  title: string; card?: PortfolioCard; post?: Post; project?: Project; domain?: string; href?: string; action?: string; highlight?: boolean;
}) {
  const days = project?.completedAt ? Math.max(1, Math.round((Date.parse(project.completedAt) - Date.parse(project.startedAt ?? project.createdAt)) / 86_400_000)) : card?.durationDays ?? post?.durationDays;
  const rating = card?.rating ?? 0;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold leading-snug">{title}</h3>
        {(card?.verified || project?.status === "COMPLETED") && <span className="shrink-0 text-xs font-semibold text-[var(--green)]">의뢰인 검증 완료 ✓</span>}
      </div>
      <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1.5 text-sm">
        {domain && <><dt className="sub">분야</dt><dd>{domain}</dd></>}
        {card?.roleLabel && card.roleLabel !== domain && <><dt className="sub">역할</dt><dd>{card.roleLabel}</dd></>}
        {card && card.tasks.length > 0 && <><dt className="sub">작업</dt><dd><ul className="list-disc pl-4">{card.tasks.map((t) => <li key={t}>{t}</li>)}</ul></dd></>}
        {days !== undefined && <><dt className="sub">기간</dt><dd>{days}일</dd></>}
        {rating > 0 && <><dt className="sub">의뢰인 평가</dt><dd><StarRating value={rating} label="의뢰인 평가" size="sm" /></dd></>}
      </dl>
      {action && <p className={`mt-3 text-right text-sm font-semibold ${highlight ? "text-[var(--primary)]" : "sub"}`}>{action} ›</p>}
    </>
  );
  if (!href) return <article className="card">{body}</article>;
  return <Link href={href} className={`card block active:opacity-80 ${highlight ? "ring-1 ring-[var(--primary)]" : ""}`}>{body}</Link>;
}
