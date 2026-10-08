"use client";
import { useState } from "react";
import { repo } from "@/lib/repo";
import Link from "next/link";
import type { PublishedPortfolio, Student } from "@/types";
import { feedCollection, type FeedCollection } from "@/lib/portfolio/collection";

export default function PortfolioFeed({ student, items, owner = false, onChange }: { student: Student; items: PublishedPortfolio[]; owner?: boolean; onChange?: (item: PublishedPortfolio) => void }) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [collection, setCollection] = useState<FeedCollection>("experience");
  const selectedItems = items.filter(item => feedCollection(item) === collection);
  async function toggle(item: PublishedPortfolio) {
    const key = `${item.sourceKind}:${item.sourceId}`;
    const updated = { ...item, visible: !(visibility[key] ?? item.visible !== false) };
    setBusy(key); setError("");
    try { await repo.updatePublishedPortfolio(student.id, updated); setVisibility(v => ({ ...v, [key]: updated.visible })); onChange?.(updated); }
    catch(e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  return <section className="portfolio-feed" aria-label="공개 포트폴리오 피드">
    <div className="portfolio-feed-heading"><div><p>SELECTED EXPERIENCES</p><div className="portfolio-feed-tabs" role="tablist" aria-label="포트폴리오 구분"><button role="tab" id="experience-tab" aria-controls="portfolio-feed-panel" aria-selected={collection === "experience"} onClick={() => setCollection("experience")}>경험과 작업</button><button role="tab" id="archive-tab" aria-controls="portfolio-feed-panel" aria-selected={collection === "archive"} onClick={() => setCollection("archive")}>개인 아카이브</button></div></div><div className="portfolio-feed-heading-actions"><span>{selectedItems.length}개의 기록</span>{owner && <Link href={`/portfolio/create?collection=${collection}`} className="portfolio-feed-create" aria-label="새 포트폴리오 피드 작성">+<span>피드 작성</span></Link>}</div></div>
    {collection === "archive" && <p className="portfolio-archive-note">월링크 밖에서 쌓은 개인 기록 · 최대 3개까지 공개 가능</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div id="portfolio-feed-panel" role="tabpanel" aria-labelledby={collection === "archive" ? "archive-tab" : "experience-tab"}>{selectedItems.length ? <div className="portfolio-feed-grid">{selectedItems.map((item, i) => <div className="portfolio-feed-item" key={`${item.sourceKind}:${item.sourceId}`}><Link href={`/portfolio/experience?s=${encodeURIComponent(student.id)}&kind=${item.sourceKind}&id=${encodeURIComponent(item.sourceId)}`} className={`portfolio-feed-tile gallery-tone-${i % 4}`} aria-label={`${item.title} 포트폴리오 열기`}>
      {item.coverUrl ? <img src={item.coverUrl} alt={item.title} loading="lazy" /> : <span className="portfolio-feed-placeholder" aria-hidden="true">{item.category.slice(0, 2)}</span>}
      <span className="portfolio-feed-tile-caption"><small>{item.category}</small><strong>{item.title}</strong></span>
    </Link>
      {owner && <button type="button" className="portfolio-visibility" disabled={busy !== null} aria-label={`${item.title}: ${(visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false) ? "공개 중 · 비공개로 전환" : "비공개 · 공개로 전환"}`} aria-pressed={visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false} onClick={() => toggle(item)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {(visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false) ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M3 9c4 7 14 7 18 0M5 12l-2 3m6-1-1 3m7-3 1 3m3-5 2 3"/></>}
        </svg>
        <span>{(visibility[`${item.sourceKind}:${item.sourceId}`] ?? item.visible !== false) ? "공개" : "비공개"}</span>
      </button>}
    </div>)}</div> : <div className="portfolio-feed-empty"><strong>{collection === "archive" ? "아직 공개한 아카이브가 없어요" : "아직 공개한 작업이 없어요"}</strong><p>공개할 작업과 대표 사진을 선택해 주세요.</p>{owner && <Link href={`/portfolio/create?collection=${collection}`} className="btn btn-primary">기록 작성하기</Link>}</div>}</div>
  </section>;
}
