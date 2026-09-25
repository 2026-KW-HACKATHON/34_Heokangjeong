"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { distanceM } from "@/lib/geo";
import { recommendScore } from "@/lib/recommend";
import type { Category, Post } from "@/types";
import Icon, { type IconName } from "@/components/Icon";

const CATS: ("전체" | Category)[] = ["전체", "디자인", "영상", "사진", "SNS홍보", "웹/앱", "디지털도움", "기타"];

/** 홈: ① 맞춤 공고 추천 피드. 학생이면 적합도 순, 주민이면 내 공고 위주. */
export default function Home() {
  const { user, users } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cat, setCat] = useState<(typeof CATS)[number]>("전체");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { repo.listPosts().then(setPosts).catch(() => setError("공고를 불러오지 못했어요. 잠시 후 새로고침해 주세요.")).finally(() => setLoading(false)); }, []);
  const name = (id: string) => users.find((u) => u.id === id)?.name;

  const rows = useMemo(() => {
    let list = posts.filter((p) => (cat === "전체" || p.category === cat) && (!onlyOpen || p.status !== "done") && `${p.title} ${p.description} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase()));
    if (user?.role === "student") {
      return list.map((p) => ({ p, d: distanceM(user.location, p.location), s: recommendScore(user, p) })).sort((a, b) => b.s - a.s);
    }
    if (user?.role === "resident") list = [...list.filter((p) => p.authorId === user.id), ...list.filter((p) => p.authorId !== user.id)];
    return list.map((p) => ({ p, d: user ? distanceM(user.location, p.location) : undefined, s: undefined as number | undefined }));
  }, [posts, cat, onlyOpen, user, query]);

  return (
    <>
      <TopBar title="월계 · 재능나눔" />
      <section className="px-5 pb-6">
        <div className="pb-7 pt-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--primary)]">우리 동네에서 시작하는 작은 변화</p>
          <h2 className="page-title">{user?.role === "resident" ? <>이웃의 재능으로,<br />새로운 가능성을.</> : <>가까운 이웃에게,<br />나의 재능을.</>}</h2>
          <p className="sub mt-3 text-sm leading-relaxed">{user?.role === "resident" ? "필요한 도움을 나누고, 함께 완성해 보세요." : "잘하는 일로 돕고, 나만의 경험을 쌓아보세요."}</p>
          <Link href={user?.role === "resident" ? "/posts/new" : "/map"} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--primary)]">{user?.role === "resident" ? "도움 요청하기" : "지도에서 가까운 공고 보기"}<Icon name="arrow" width={17} height={17} /></Link>
        </div>
        <label className="mb-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-[var(--sub)]"><Icon name="search" width={20} height={20} /><input aria-label="공고 검색" type="search" placeholder="어떤 재능을 나누고 싶나요?" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none" /></label>
        <div className="mb-8 grid grid-cols-4 gap-2">
          {([["디자인", "pen"], ["사진", "camera"], ["웹/앱", "web"], ["디지털도움", "phone"]] as [Category, IconName][]).map(([c, icon]) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(cat === c ? "전체" : c)} className="flex flex-col items-center gap-2 text-xs"><span className={`flex h-16 w-full items-center justify-center rounded-2xl transition-colors ${cat === c ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--primary)]"}`}><Icon name={icon} width={27} height={27} /></span>{c === "디지털도움" ? "디지털 도움" : c}</button>)}
        </div>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold tracking-tight">이웃이 기다리는 도움</h2><span className="sub text-xs">{loading ? "불러오는 중" : `${rows.length}개의 공고`}</span></div>
        <div className="category-scroll -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`chip ${cat === c ? "chip-on" : ""}`}>{c}</button>)}
        </div>
        <label className="sub mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 완료된 공고 숨기기</label>
        <div className="flex flex-col gap-3">
          {loading && <p role="status" className="card sub text-sm">이웃의 요청을 불러오고 있어요.</p>}
          {error && <p role="alert" className="card text-sm text-[var(--red)]">{error}</p>}
          {!loading && !error && rows.length === 0 && <EmptyState text="조건에 맞는 공고가 없어요. 다른 분야를 살펴보세요." />}
          {rows.map(({ p, d, s }) => <PostCard key={p.id} post={p} authorName={name(p.authorId)} distance={d} score={s} />)}
        </div>
      </section>
    </>
  );
}
