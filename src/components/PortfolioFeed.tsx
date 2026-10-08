"use client";
import { useState } from "react";
import { repo } from "@/lib/repo";
import Link from "next/link";
import type { PublishedPortfolio, Student } from "@/types";

export default function PortfolioFeed({ student, items, owner = false, onChange }: { student: Student; items: PublishedPortfolio[]; owner?: boolean; onChange?: (item: PublishedPortfolio) => void }) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function toggle(item: PublishedPortfolio) {
    const key = `${item.sourceKind}:${item.sourceId}`;
    const updated = { ...item, visible: !(visibility[key] ?? item.visible !== false) };
    setBusy(key); setError("");
    try { await repo.updatePublishedPortfolio(student.id, updated); setVisibility(v => ({ ...v, [key]: updated.visible })); onChange?.(updated); }
    catch(e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  return <section className="portfolio-feed" aria-label="공개 포트폴리오 피드">
    <div className="portfolio-feed-heading"><div><p>SELECTED EXPERIENCES</p><h2>경험과 작업</h2></div><span>{items.length}개의 경험</span></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {items.length ? <div className="portfolio-feed-grid">{items.map((item, i) => <div className="portfolio-feed-item" key={`${item.sourceKind}:${item.sourceId}`}><Link href={feedHref(student.id, item)} className={`portfolio-feed-tile gallery-tone-${i % 4}`} aria-label={`${item.title} 포트폴리오 열기`}>
      {item.coverUrl ? <img src={item.coverUrl} alt={item.title} loading="lazy" /> : <span className="portfolio-feed-placeholder" aria-hidden="true">{item.category.slice(0, 2)}</span>}
      <span className="portfolio-feed-tile-caption"><small>{item.category}</small><strong>{item.title}</strong></span>
    </Link>
      {owner && <button type="button" className="portfolio-visibility" disabled={busy !== null} aria-label={`${item.title}: ${(visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false) ? "공개 중 · 비공개로 전환" : "비공개 · 공개로 전환"}`} aria-pressed={visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false} onClick={() => toggle(item)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {(visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false) ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M3 9c4 7 14 7 18 0M5 12l-2 3m6-1-1 3m7-3 1 3m3-5 2 3"/></>}
        </svg>
        <span>{(visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false) ? "공개" : "비공개"}</span>
      </button>}
    </div>)}</div> : <div className="portfolio-feed-empty"><strong>아직 공개한 작업이 없어요</strong><p>공개할 작업과 대표 사진을 선택해 주세요.</p>{owner && <Link href="/portfolio" className="btn btn-primary">공개할 작업 고르기</Link>}</div>}
  </section>;
}

/** 프로젝트 작업은 의뢰인 검증이 붙은 포트폴리오 페이지(템플릿)로, 직접 쓴 활동 기록은 기존 게시물 화면으로 연다 */
export const feedHref = (studentId: string, item: PublishedPortfolio) => item.sourceKind === "project"
  ? `/portfolio/view?id=${encodeURIComponent(item.sourceId)}&s=${encodeURIComponent(studentId)}`
  : `/portfolio/experience?s=${encodeURIComponent(studentId)}&kind=${item.sourceKind}&id=${encodeURIComponent(item.sourceId)}`;
