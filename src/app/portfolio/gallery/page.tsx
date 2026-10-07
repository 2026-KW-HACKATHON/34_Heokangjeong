"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import PortfolioProfileHeader from "@/components/PortfolioProfileHeader";
import PortfolioFeed from "@/components/PortfolioFeed";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { PublishedPortfolio, Student } from "@/types";

export default function GalleryPage() {
  return <Suspense fallback={<p className="p-6">갤러리를 불러오는 중…</p>}><Gallery /></Suspense>;
}
function Gallery() {
  const id = useSearchParams().get("s") ?? "";
  const { user } = useSession();
  const [profile, setProfile] = useState<Student | null>(null);
  const [items, setItems] = useState<PublishedPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!id) { setError("사용자를 찾을 수 없어요."); setLoading(false); return; }
    const refresh = () => { setLoading(true); Promise.all([repo.getUser(id), repo.listPublishedPortfolio(id)]).then(([p, rows]) => { if (active) { setProfile(p?.role === "student" ? p : null); setItems(rows); setError(""); } }).catch(() => { if (active) setError("갤러리를 불러오지 못했어요."); }).finally(() => { if (active) setLoading(false); }); };
    refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [id]);
  return <><TopBar title="포트폴리오 갤러리" back /><main className="portfolio-me">
    {loading ? <p role="status" className="card sub">갤러리를 불러오는 중…</p> : error ? <p role="alert" className="card">{error}</p> : !profile ? <p className="card">학생 프로필을 찾을 수 없어요.</p> : <><PortfolioProfileHeader student={profile} publishedCount={items.length} /><PortfolioFeed student={profile} items={items} owner={user?.id === id} /></>}
  </main></>;
}
