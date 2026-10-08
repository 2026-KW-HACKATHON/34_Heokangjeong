"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { distanceM } from "@/lib/geo";
import { recommendScore } from "@/lib/recommend";
import type { Post } from "@/types";
import Icon from "@/components/Icon";
import { categoryMatches, type HomeCategory } from "@/components/home/categories";
import { HOME_CATEGORIES } from "@/components/home/categories";
import CategoryPicker from "@/components/home/CategoryPicker";
import { useUrlFlag, useUrlState } from "@/lib/useUrlState";
import ConnectionWorld from "@/components/home/ConnectionWorld";

/** 홈: ① 맞춤 공고 추천 피드. 학생이면 적합도 순, 주민이면 내 공고 위주. */
// 분야·'모집 중만'·탭은 주소에 둔다 → 공고를 보고 뒤로 와도 고른 그대로
export default function HomePage() { return <Suspense fallback={null}><Home /></Suspense>; }
function Home() {
  const { user, users } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cat, setCat] = useUrlState<HomeCategory>("cat", "전체", ["전체", ...HOME_CATEGORIES.map((c) => c.value)]);
  const [onlyOpen, setOnlyOpen] = useUrlFlag("open", true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { repo.listPosts().then(setPosts).catch(() => setError("공고를 불러오지 못했어요. 잠시 후 새로고침해 주세요.")).finally(() => setLoading(false)); }, []);
  const name = (id: string) => users.find((u) => u.id === id)?.name;
  // 사장님: 내 공고 / 동네 공고, 학생: 추천 공고 / 내가 지원한 공고
  const [mineOnly, setMineOnly] = useUrlFlag("mine", true);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (user?.role !== "student") return;
    repo.listApplications().then((list) => setAppliedIds(new Set(list.filter((a) => a.studentId === user.id).map((a) => a.postId)))).catch(() => {});
  }, [user]);

  const eligiblePosts = useMemo(() => {
    const hideDone = onlyOpen && mineOnly;   // 내 공고·내가 지원한 공고 탭에서는 끝난 것도 보여 준다
    let list = posts.filter((p) => categoryMatches(cat, p.category) && (!hideDone || p.status !== "done") && `${p.title} ${p.description} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase()));
    if (user?.role === "student") {
      if (!mineOnly) list = list.filter((p) => appliedIds.has(p.id));          // '내가 지원한 공고' 탭
    }
    if (user?.role === "resident") list = mineOnly ? list.filter((p) => p.authorId === user.id) : list.filter((p) => p.authorId !== user.id);
    return list;
  }, [posts, cat, onlyOpen, user, query, mineOnly, appliedIds]);
  const categoryCounts = useMemo(() => {
    const base = posts.filter((p) => {
      if (onlyOpen && mineOnly && p.status === "done") return false;
      if (!`${p.title} ${p.description} ${p.address}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
      if (user?.role === "student" && !mineOnly && !appliedIds.has(p.id)) return false;
      if (user?.role === "resident" && (mineOnly ? p.authorId !== user.id : p.authorId === user.id)) return false;
      return true;
    });
    return Object.fromEntries((["전체", ...HOME_CATEGORIES.map((item) => item.value)] as HomeCategory[]).map((value) => [value, base.filter((p) => categoryMatches(value, p.category)).length])) as Record<HomeCategory, number>;
  }, [posts, onlyOpen, user, query, mineOnly, appliedIds]);
  const rows = useMemo(() => {
    if (user?.role === "student") return eligiblePosts.map((p) => ({ p, d: distanceM(user.location, p.location), s: recommendScore(user, p) })).sort((a, b) => b.s - a.s);
    const list = eligiblePosts;
    return list.map((p) => ({ p, d: user ? distanceM(user.location, p.location) : undefined, s: undefined as number | undefined }));
  }, [eligiblePosts, user]);

  // 아래로 내리면 상단을 숨기고, 조금이라도 위로 올리면 다시 보여 준다 (맨 위 근처에서는 항상 보임)
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      document.body.dataset.homeBars = y > last && y > 160 ? "hidden" : "shown";
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); delete document.body.dataset.homeBars; };
  }, []);
  return (
    <ConnectionWorld>
      <TopBar title="월계 재능나눔" brand />
      <section className="home-content px-5 pb-6">
        <CategoryPicker category={cat} counts={categoryCounts} onChange={setCat} />
        <div className="home-feed">
        {(user?.role === "resident" || user?.role === "student") && (
          <div className="filter-pill-row mb-4" role="tablist" aria-label="공고 보기">
            {(user.role === "resident" ? [[true, "내 공고"], [false, "동네 공고"]] as const : [[true, "추천 공고"], [false, "내가 지원한 공고"]] as const).map(([v, label]) => (
              <button key={label} role="tab" aria-selected={mineOnly === v} onClick={() => setMineOnly(v)} className="filter-pill">{label}</button>
            ))}
          </div>
        )}
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-bold tracking-tight">{user?.role === "resident" ? (mineOnly ? "내가 올린 공고" : "동네 공고") : user?.role === "student" && !mineOnly ? "내가 지원한 공고" : "동네 공고"}</h2><span className="sub text-xs" role="status">{loading ? "불러오는 중" : `${rows.length}개의 공고`}</span></div>
        <label className="home-search mb-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-[var(--sub)]"><Icon name="search" width={20} height={20} /><input aria-label="공고 검색" type="search" placeholder="제목, 내용, 동네로 찾아보세요" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none" /></label>
        <label className="sub mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 완료된 공고 숨기기</label>
        <div className="flex flex-col gap-3">
          {loading && <p role="status" className="card sub text-sm">이웃의 요청을 불러오고 있어요.</p>}
          {error && <p role="alert" className="card text-sm text-[var(--red)]">{error}</p>}
          {!loading && !error && rows.length === 0 && <EmptyState text={user?.role === "resident" && mineOnly ? "아직 올린 공고가 없어요. 위 ＋ 로 공고를 올려 보세요."
            : user?.role === "student" && !mineOnly ? "아직 지원한 공고가 없어요. 추천 공고에서 찾아보세요."
            : "조건에 맞는 공고가 없어요. 다른 분야를 살펴보세요."} />}
          {rows.map(({ p, d }, index) => <div data-demo-tour={p.id === "p9" ? "student-post" : undefined} key={`${cat}-${p.id}`} className="home-post-enter" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><PostCard post={p} authorName={name(p.authorId)} distance={d} /></div>)}
        </div>
        </div>
      </section>
    </ConnectionWorld>
  );
}
