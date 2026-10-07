"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublishedPortfolio, Student } from "@/types";

export default function PortfolioFeed({ student, items, owner = false }: { student: Student; items: PublishedPortfolio[]; owner?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = selected === null ? undefined : items[selected];
  useEffect(() => {
    if (!active) { dialog.current?.close(); return; }
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    if (dialog.current) dialog.current.scrollTop = 0;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [active]);
  return <section className="portfolio-feed" aria-label="공개 포트폴리오 피드">
    <div className="portfolio-feed-heading"><div><p>SELECTED WORKS</p><h2>포트폴리오 피드</h2></div><span>{items.length}개의 공개 작업</span></div>
    {items.length ? <div className="portfolio-feed-grid">{items.map((item, i) => <button type="button" key={`${item.sourceKind}:${item.sourceId}`} onClick={() => setSelected(i)} className={`portfolio-feed-tile gallery-tone-${i % 4}`} aria-label={`${item.title} 포트폴리오 열기`}>
      {item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" /> : <span className="portfolio-feed-placeholder" aria-hidden="true">{item.category.slice(0, 2)}</span>}
      <span className="portfolio-feed-tile-caption"><small>{item.category}</small><strong>{item.title}</strong></span>
    </button>)}</div> : <div className="portfolio-feed-empty"><span aria-hidden="true">▦</span><strong>아직 공개한 작업이 없어요</strong><p>{owner ? "내 포트폴리오에서 공개할 작업과 대표 사진을 선택해 주세요." : "공개된 작업이 생기면 이곳에 표시됩니다."}</p>{owner && <Link href="/portfolio" className="btn btn-primary">공개할 작업 고르기</Link>}</div>}
    <dialog ref={dialog} className="portfolio-gallery-dialog portfolio-post-dialog" aria-label="포트폴리오 게시물" onClose={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }} onKeyDown={e => { if (e.key === "ArrowRight" && selected !== null) setSelected(Math.min(items.length - 1, selected + 1)); if (e.key === "ArrowLeft" && selected !== null) setSelected(Math.max(0, selected - 1)); }}>
      {active && <article>
        <header className="gallery-detail-header"><div className="portfolio-post-author"><span className="portfolio-post-avatar">{student.avatarUrl ? <img src={student.avatarUrl} alt="" /> : student.name.slice(0, 1)}</span><span><strong>{student.name}</strong><small>{student.department}</small></span></div><button autoFocus className="gallery-close" aria-label="게시물 닫기" onClick={() => setSelected(null)}>×</button></header>
        <div className={`portfolio-post-cover gallery-tone-${selected! % 4}`}>{active.coverUrl ? <img src={active.coverUrl} alt={`${active.title} 대표 이미지`} /> : <div><small>{active.category}</small><strong>{active.title}</strong></div>}</div>
        <div className="portfolio-post-body"><p className="portfolio-post-category">{active.category} · {active.publishedAt.slice(0, 10)}</p><h2>{active.title}</h2><p className="portfolio-post-summary">{active.summary}</p>{active.sections.map((section, i) => <section key={i}><h3>{section.title}</h3><p>{section.body}</p></section>)}</div>
        <footer className="gallery-detail-footer"><button disabled={selected === 0} onClick={() => setSelected(n => n! - 1)}>← 이전</button><span>{selected! + 1} / {items.length}</span><button disabled={selected === items.length - 1} onClick={() => setSelected(n => n! + 1)}>다음 →</button></footer>
      </article>}
    </dialog>
  </section>;
}
