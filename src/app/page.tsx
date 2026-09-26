"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { distanceM } from "@/lib/geo";
import { recommendationLabel, recommendScore } from "@/lib/recommend";
import type { Category, Post } from "@/types";
import Icon, { type IconName } from "@/components/Icon";

type HomeCategory = "전체" | "디자인" | "사진/영상" | "웹/앱" | "SNS홍보" | "디지털도움";
const CATEGORY_BUTTONS: { value: Exclude<HomeCategory, "전체">; label: string; icon: IconName; categories: Category[] }[] = [
  { value: "디자인", label: "디자인", icon: "pen", categories: ["디자인"] },
  { value: "사진/영상", label: "사진/영상", icon: "camera", categories: ["사진", "영상"] },
  { value: "웹/앱", label: "웹/앱", icon: "web", categories: ["웹/앱"] },
  { value: "SNS홍보", label: "SNS 홍보", icon: "megaphone", categories: ["SNS홍보"] },
  { value: "디지털도움", label: "디지털 도움", icon: "phone", categories: ["디지털도움"] },
];

function categoryMatches(filter: HomeCategory, category: Category) {
  return filter === "전체" || CATEGORY_BUTTONS.find((item) => item.value === filter)?.categories.includes(category) === true;
}

/** 홈: ① 맞춤 공고 추천 피드. 학생이면 적합도 순, 주민이면 내 공고 위주. */
export default function Home() {
  const { user, users } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cat, setCat] = useState<HomeCategory>("전체");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { repo.listPosts().then(setPosts).catch(() => setError("공고를 불러오지 못했어요. 잠시 후 새로고침해 주세요.")).finally(() => setLoading(false)); }, []);
  const name = (id: string) => users.find((u) => u.id === id)?.name;

  const rows = useMemo(() => {
    let list = posts.filter((p) => categoryMatches(cat, p.category) && (!onlyOpen || p.status !== "done") && `${p.title} ${p.description} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase()));
    if (user?.role === "student") {
      return list.map((p) => ({ p, d: distanceM(user.location, p.location), s: recommendScore(user, p), recommendation: recommendationLabel(user, p) })).sort((a, b) => b.s - a.s);
    }
    if (user?.role === "resident") list = [...list.filter((p) => p.authorId === user.id), ...list.filter((p) => p.authorId !== user.id)];
    return list.map((p) => ({ p, d: user ? distanceM(user.location, p.location) : undefined, s: undefined as number | undefined, recommendation: undefined as string | undefined }));
  }, [posts, cat, onlyOpen, user, query]);

  return (
    <>
      <TopBar title="월계 재능나눔" brand />
      <section className="px-5 pb-6">
        <div className="pb-7 pt-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--primary)]">우리 동네에서 시작하는 작은 변화</p>
          <h2 className="page-title">{user?.role === "resident" ? <>이웃의 재능으로,<br />새로운 가능성을.</> : <>가까운 이웃에게,<br />나의 재능을.</>}</h2>
          <p className="sub mt-3 text-sm leading-relaxed">{user?.role === "resident" ? "필요한 도움을 나누고, 함께 완성해 보세요." : "잘하는 일로 돕고, 나만의 경험을 쌓아보세요."}</p>
          <Link href={user?.role === "resident" ? "/posts/new" : "/map"} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--primary)]">{user?.role === "resident" ? "도움 요청하기" : "지도에서 가까운 공고 보기"}<Icon name="arrow" width={17} height={17} /></Link>
        </div>
        <label className="mb-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-[var(--sub)]"><Icon name="search" width={20} height={20} /><input aria-label="공고 검색" type="search" placeholder="어떤 재능을 나누고 싶나요?" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none" /></label>
        <div className="mb-8 grid grid-cols-5 gap-2">
          {CATEGORY_BUTTONS.map((item) => <button key={item.value} aria-pressed={cat === item.value} onClick={() => setCat(cat === item.value ? "전체" : item.value)} className="flex min-w-0 flex-col items-center gap-2 text-center text-[11px] leading-tight"><span className={`flex h-14 w-full items-center justify-center rounded-2xl transition-colors ${cat === item.value ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--primary)]"}`}><Icon name={item.icon} width={25} height={25} /></span><span>{item.label}</span></button>)}
        </div>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold tracking-tight">이웃이 기다리는 도움</h2><span className="sub text-xs">{loading ? "불러오는 중" : `${rows.length}개의 공고`}</span></div>
        <label className="sub mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 완료된 공고 숨기기</label>
        <div className="flex flex-col gap-3">
          {loading && <p role="status" className="card sub text-sm">이웃의 요청을 불러오고 있어요.</p>}
          {error && <p role="alert" className="card text-sm text-[var(--red)]">{error}</p>}
          {!loading && !error && rows.length === 0 && <EmptyState text="조건에 맞는 공고가 없어요. 다른 분야를 살펴보세요." />}
          {rows.map(({ p, d, recommendation }) => <PostCard key={p.id} post={p} authorName={name(p.authorId)} distance={d} recommendation={recommendation} />)}
        </div>
      </section>
    </>
  );
}
