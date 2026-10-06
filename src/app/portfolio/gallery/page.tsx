"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import PersonalRankCard from "@/components/PersonalRankCard";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { PublishedPortfolio, User } from "@/types";

export default function GalleryPage() {
  return <Suspense fallback={<p className="p-6">갤러리를 불러오는 중…</p>}><Gallery /></Suspense>;
}
function Gallery() {
  const id = useSearchParams().get("s") ?? "";
  const { user } = useSession();
  const [profile, setProfile] = useState<User>();
  const [items, setItems] = useState<PublishedPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = selected === null ? undefined : items[selected];
  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setProfile(undefined); setItems([]); setSelected(null);
    if (!id) { setError("사용자를 찾을 수 없어요."); setLoading(false); return; }
    Promise.all([repo.getUser(id), repo.listPublishedPortfolio(id)]).then(([p, rows]) => { if (live) { setProfile(p); setItems(rows); } }).catch(() => { if (live) setError("갤러리를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, reload]);
  useEffect(() => {
    const refresh = () => setReload(n => n + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    if (!active) { dialog.current?.close(); return; }
    dialog.current?.showModal();
    if (dialog.current) dialog.current.scrollTop = 0;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [active]);
  return <>
    <TopBar title="포트폴리오 갤러리" back />
    <section className="px-4">
      {loading ? <p role="status" className="card sub">갤러리를 불러오는 중…</p> : error ? <div role="alert" className="card"><p>{error}</p><button className="btn mt-3" onClick={() => setReload(n => n + 1)}>다시 시도</button></div> : !profile ? <p className="card">사용자를 찾을 수 없어요.</p> : <>
        <header className="gallery-profile">
          <div className="gallery-avatar" aria-hidden="true">{profile.name.slice(0, 1)}</div>
          <div><h1 className="text-xl font-bold">{profile.name}</h1><p className="sub mt-1 text-sm">{profile.role === "student" ? profile.department : "우리 동네 이웃"}</p><p className="mt-2 text-sm">공개한 작업 <strong>{items.length}</strong></p></div>
        </header>
        {profile.role === "student" && <PersonalRankCard key={id} studentId={id} />}
        <p className="sub mb-5 text-xs">본인이 공개한 작업을 모았어요. 표지를 눌러 자세히 살펴보세요.</p>
        {user?.id === id && <Link className="btn mb-5 w-full" href="/portfolio">내 포트폴리오 공개 관리</Link>}
        {items.length ? <div className="portfolio-gallery-grid">{items.map((item, i) => <button key={`${item.sourceKind}:${item.sourceId}`} onClick={() => setSelected(i)} className={`portfolio-gallery-tile gallery-tone-${i % 4}`} aria-label={`${item.title} 자세히 보기`}>
          <span className="gallery-cover-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <span className="gallery-cover-category">{item.category}</span><strong>{item.title}</strong><span className="gallery-cover-action">작업 보기 ↗</span>
        </button>)}</div> : <div className="gallery-empty"><span aria-hidden="true">▦</span><h2 className="font-semibold">아직 공개한 포트폴리오가 없어요</h2><p className="sub mt-2 text-sm">공개한 작업이 생기면 여기에 표시됩니다.</p></div>}
      </>}
    </section>
    <dialog ref={dialog} className="portfolio-gallery-dialog" aria-label="공개 포트폴리오 상세" onClose={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }} onKeyDown={e => { if (e.key === "ArrowRight" && selected !== null) setSelected(Math.min(items.length - 1, selected + 1)); if (e.key === "ArrowLeft" && selected !== null) setSelected(Math.max(0, selected - 1)); }}>
      {active && <article>
        <header className="gallery-detail-header"><span className="text-sm font-semibold">{profile?.name}의 작업</span><button autoFocus className="gallery-close" aria-label="포트폴리오 닫기" onClick={() => setSelected(null)}>×</button></header>
        <div className={`gallery-detail-cover gallery-tone-${selected! % 4}`}><p className="mb-3 text-xs">{active.category}</p><h2 className="text-2xl font-bold leading-snug">{active.title}</h2></div>
        <div className="p-6"><p className="mb-6 whitespace-pre-wrap leading-relaxed">{active.summary}</p>{active.sections.map((s, i) => <section key={i} className="mb-6"><h3 className="mb-2 font-bold">{s.title}</h3><p className="sub whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p></section>)}<p className="sub text-xs">{active.publishedAt.slice(0, 10)} 공개</p></div>
        <footer className="gallery-detail-footer"><button disabled={selected === 0} onClick={() => setSelected(n => n! - 1)}>← 이전 작업</button><span>{selected! + 1} / {items.length}</span><button disabled={selected === items.length - 1} onClick={() => setSelected(n => n! + 1)}>다음 작업 →</button></footer>
      </article>}
    </dialog>
  </>;
}
