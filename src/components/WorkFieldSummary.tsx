"use client";

import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import { workFieldSummary } from "@/lib/workFields";
import type { PortfolioCard, Post } from "@/types";

export default function WorkFieldSummary({ studentId, detailed = false }: { studentId: string; detailed?: boolean }) {
  const [data, setData] = useState<{ cards: PortfolioCard[]; posts: Post[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    Promise.all([repo.listPortfolio(studentId), repo.listPosts()])
      .then(([cards, posts]) => { if (active) setData({ cards, posts }); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [studentId]);
  const summary = data ? workFieldSummary(data.cards, data.posts) : null;
  return <section className="card" aria-label="분야별 작업 기록">
    <h2 className="text-base font-bold">분야별 작업 기록</h2>
    {!summary ? <p role="status" className="sub mt-3 text-sm">{error ? "작업 기록을 불러오지 못했어요." : "작업 기록을 불러오는 중…"}</p> : <>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--line)] p-3"><dt className="sub text-xs">제일 많이 한 분야</dt><dd className="mt-1 font-bold">{summary.mostFrequent ?? "아직 없음"}</dd></div>
        <div className="rounded-xl bg-[var(--line)] p-3"><dt className="sub text-xs">평균 별점</dt><dd className="mt-1 font-bold">{summary.averageRating === null ? "평가 전" : `★ ${summary.averageRating.toFixed(1)} / 5`}</dd></div>
      </dl>
      <p className="sub mt-3 text-xs">의뢰인이 완료를 인증한 작업 {summary.total}건 기준</p>
      {detailed && (summary.byField.length ? <ul className="mt-4 divide-y divide-[var(--line)]">
        {summary.byField.map(field => <li key={field.category} className="py-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">{field.category}</h3><span className="sub text-sm">{field.count}건 · {field.averageRating === null ? "평가 전" : `★ ${field.averageRating.toFixed(1)}`}</span></div>
          <ul className="sub mt-2 space-y-1 text-sm">{field.works.map(work => <li key={work.id}>• {work.title}</li>)}</ul>
        </li>)}
      </ul> : <p className="sub mt-4 text-sm">완료·인증된 작업이 생기면 분야별로 모아 보여드려요.</p>)}
    </>}
  </section>;
}
