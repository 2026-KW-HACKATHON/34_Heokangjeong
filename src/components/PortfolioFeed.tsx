"use client";
import Link from "next/link";
import type { PublishedPortfolio, Student } from "@/types";

export default function PortfolioFeed({ student, items, owner = false }: { student: Student; items: PublishedPortfolio[]; owner?: boolean }) {
  return <section className="portfolio-feed" aria-label="공개 포트폴리오 피드">
    <div className="portfolio-feed-heading"><div><p>SELECTED EXPERIENCES</p><h2>경험과 작업</h2></div><span>{items.length}개의 경험</span></div>
    {items.length ? <div className="portfolio-feed-grid">{items.map((item, i) => <Link key={`${item.sourceKind}:${item.sourceId}`} href={`/portfolio/experience?s=${encodeURIComponent(student.id)}&kind=${item.sourceKind}&id=${encodeURIComponent(item.sourceId)}`} className={`portfolio-feed-tile gallery-tone-${i % 4}`} aria-label={`${item.title} 포트폴리오 열기`}>
      {item.coverUrl ? <img src={item.coverUrl} alt={item.title} loading="lazy" /> : <span className="portfolio-feed-placeholder" aria-hidden="true">{item.category.slice(0, 2)}</span>}
      <span className="portfolio-feed-tile-caption"><small>{item.category}</small><strong>{item.title}</strong></span>
    </Link>)}</div> : <div className="portfolio-feed-empty"><strong>아직 공개한 작업이 없어요</strong><p>공개할 작업과 대표 사진을 선택해 주세요.</p>{owner && <Link href="/portfolio" className="btn btn-primary">공개할 작업 고르기</Link>}</div>}
  </section>;
}
