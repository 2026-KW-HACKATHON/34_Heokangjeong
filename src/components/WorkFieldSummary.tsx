"use client";

import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import { workFieldSummary } from "@/lib/workFields";
import StarRating from "@/components/StarRating";
import type { PortfolioCard, Post, TrustSummary } from "@/types";

export default function WorkFieldSummary({ studentId, detailed = false }: { studentId: string; detailed?: boolean }) {
  const [data, setData] = useState<{ cards: PortfolioCard[]; posts: Post[]; trust: TrustSummary } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError(false);
    Promise.all([repo.listPortfolio(studentId), repo.listPosts(), repo.trustSummary(studentId)])
      .then(([cards, posts, trust]) => { if (active) setData({ cards, posts, trust }); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [studentId]);
  const summary = data ? workFieldSummary(data.cards, data.posts) : null;
  const reviewCount = data?.trust.reviewCount ?? 0;
  const anomalyCount = data?.trust.anomalyCount ?? 0;
  const heldReviewCount = data?.trust.heldReviewCount ?? 0;
  const verifiedCount = data?.trust.verifiedCount ?? 0;
  const reputationScore = data?.trust.reputationScore ?? 0;
  const reputationRating = reputationScore / 20;
  return <section className="card work-field-summary" aria-label="분야별 작업 기록">
    <h2 className="text-base font-bold">분야별 작업 기록</h2>
    {!summary ? <p role="status" className="sub mt-3 text-sm">{error ? "작업 기록을 불러오지 못했어요." : "작업 기록을 불러오는 중…"}</p> : <>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--line)] p-3"><dt className="sub text-xs">검증 프로젝트</dt><dd className="mt-1 font-bold">{verifiedCount}건</dd></div>
        <div className="rounded-xl bg-[var(--line)] p-3"><dt className="sub text-xs">평판 별점</dt><dd className="mt-1">{reviewCount > 0 ? <StarRating value={reputationRating} size="sm" /> : <b>평가 전</b>}</dd></div>
        <div className="col-span-2 rounded-xl bg-[var(--line)] p-3"><dt className="sub text-xs">제일 많이 한 분야</dt><dd className="mt-1 font-bold">{summary.mostFrequent.length ? summary.mostFrequent.join(" · ") : "아직 없음"}</dd></div>
      </dl>
      <p className="sub mt-3 text-xs">의뢰인이 완료를 인증한 작업 {summary.total}건 기준</p>
      {reviewCount > 0 && <p className="sub mt-1 text-xs">평판 별점은 의뢰인 평가 {reviewCount}건에 완료율·기한·인수인계·소통과 Bayesian 보정·평가자 신뢰도·증빙 일치도를 함께 반영해요{anomalyCount ? ` · 통계 이상치 ${anomalyCount}건 완화` : ""}.</p>}
      {heldReviewCount > 0 && <p className="mt-1 text-xs text-[#9a3412]">검토 중인 평가 {heldReviewCount}건은 현재 평판 별점에서 제외했어요.</p>}
      {detailed && (summary.byField.length ? <ul className="mt-4 divide-y divide-[var(--line)]">
        {summary.byField.map(field => <li key={field.category} className="py-3">
          <div className="flex items-center justify-between"><h3 className="font-semibold">{field.category}</h3><span className="sub text-sm">{field.count}건 · {field.averageRating === null ? "평가 전" : `★ ${field.averageRating.toFixed(1)}`}</span></div>
          <ul className="sub mt-2 space-y-1 text-sm">{field.works.map(work => <li key={work.id}>• {work.title}</li>)}</ul>
        </li>)}
      </ul> : <p className="sub mt-4 text-sm">완료·인증된 작업이 생기면 분야별로 모아 보여드려요.</p>)}
    </>}
  </section>;
}
