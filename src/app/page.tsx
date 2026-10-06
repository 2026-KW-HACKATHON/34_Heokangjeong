"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "@/components/TopBar";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { distanceM } from "@/lib/geo";
import { recommendScore } from "@/lib/recommend";
import type { Post } from "@/types";
import Icon from "@/components/Icon";
import TalentConnection, { categoryMatches, type HomeCategory } from "@/components/home/TalentConnection";
import ConnectionWorld from "@/components/home/ConnectionWorld";

/** 홈: ① 맞춤 공고 추천 피드. 학생이면 적합도 순, 주민이면 내 공고 위주. */
export default function Home() {
  const { user, users } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cat, setCat] = useState<HomeCategory>("전체");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exploring, setExploring] = useState(false);
  const feedTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!exploring) return;
    const timeout = window.setTimeout(() => setExploring(false), 1000);
    return () => window.clearTimeout(timeout);
  }, [exploring]);
  useEffect(() => { repo.listPosts().then(setPosts).catch(() => setError("공고를 불러오지 못했어요. 잠시 후 새로고침해 주세요.")).finally(() => setLoading(false)); }, []);
  const name = (id: string) => users.find((u) => u.id === id)?.name;

  const rows = useMemo(() => {
    let list = posts.filter((p) => categoryMatches(cat, p.category) && (!onlyOpen || p.status !== "done") && `${p.title} ${p.description} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase()));
    if (user?.role === "student") {
      return list.map((p) => ({ p, d: distanceM(user.location, p.location), s: recommendScore(user, p) })).sort((a, b) => b.s - a.s);
    }
    if (user?.role === "resident") list = [...list.filter((p) => p.authorId === user.id), ...list.filter((p) => p.authorId !== user.id)];
    return list.map((p) => ({ p, d: user ? distanceM(user.location, p.location) : undefined, s: undefined as number | undefined }));
  }, [posts, cat, onlyOpen, user, query]);

  // The hero and its CTA use the same active requests as the feed after exploration.
  const connections = useMemo(() => {
    const list = posts.filter((p) => p.status !== "done" && categoryMatches(cat, p.category));
    return user?.role === "student" ? list.sort((a, b) => recommendScore(user, b) - recommendScore(user, a)) : list;
  }, [posts, cat, user]);
  function explore() {
    setQuery("");
    setOnlyOpen(true);
    setExploring(true);
    feedTitle.current?.focus({ preventScroll: true });
    feedTitle.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  return (
    <ConnectionWorld>
      <TopBar title="월계 재능나눔" brand />
      <section className="home-content px-5 pb-6">
        <TalentConnection category={cat} onCategoryChange={setCat} onExplore={explore} count={connections.length} suggestedPost={connections[0]} authorName={connections[0] && name(connections[0].authorId)} loading={loading} failed={!!error} resident={user?.role === "resident"} />
        <div className={`home-feed ${exploring ? "is-arriving" : ""}`}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 ref={feedTitle} tabIndex={-1} className="home-feed-title text-xl font-bold tracking-tight">이웃이 기다리는 도움</h2><span className="sub text-xs" role="status">{loading ? "불러오는 중" : `${rows.length}개의 공고`}</span></div>
        <label className="home-search mb-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-[var(--sub)]"><Icon name="search" width={20} height={20} /><input aria-label="공고 검색" type="search" placeholder="제목, 내용, 동네로 찾아보세요" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none" /></label>
        <label className="sub mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 완료된 공고 숨기기</label>
        <div className="flex flex-col gap-3">
          {loading && <p role="status" className="card sub text-sm">이웃의 요청을 불러오고 있어요.</p>}
          {error && <p role="alert" className="card text-sm text-[var(--red)]">{error}</p>}
          {!loading && !error && rows.length === 0 && <EmptyState text="조건에 맞는 공고가 없어요. 다른 분야를 살펴보세요." />}
          {rows.map(({ p, d }, index) => <div key={`${cat}-${p.id}`} className="home-post-enter" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><PostCard post={p} authorName={name(p.authorId)} distance={d} /></div>)}
        </div>
        </div>
      </section>
    </ConnectionWorld>
  );
}
