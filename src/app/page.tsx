"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { useUrlFlag, useUrlState } from "@/lib/useUrlState";

/** 홈: ① 맞춤 공고 추천 피드. 학생이면 적합도 순, 주민이면 내 공고 위주. */
// 분야·'모집 중만'·탭은 주소에 둔다 → 공고를 보고 뒤로 와도 고른 그대로
export default function HomePage() { return <Suspense fallback={null}><Home /></Suspense>; }
function Home() {
  const { user, users } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cat, setCat] = useUrlState<HomeCategory>("cat", "전체", ["전체", ...HOME_CATEGORIES.map((c) => c.value)]);
  const [onlyOpen, setOnlyOpen] = useUrlFlag("open", true);
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
  // 사장님: 내 공고 / 동네 공고, 학생: 추천 공고 / 내가 지원한 공고
  const [mineOnly, setMineOnly] = useUrlFlag("mine", true);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (user?.role !== "student") return;
    repo.listApplications().then((list) => setAppliedIds(new Set(list.filter((a) => a.studentId === user.id).map((a) => a.postId)))).catch(() => {});
  }, [user]);

  const rows = useMemo(() => {
    const hideDone = onlyOpen && mineOnly;   // 내 공고·내가 지원한 공고 탭에서는 끝난 것도 보여 준다
    let list = posts.filter((p) => categoryMatches(cat, p.category) && (!hideDone || p.status !== "done"));
    if (user?.role === "student") {
      if (!mineOnly) list = list.filter((p) => appliedIds.has(p.id));          // '내가 지원한 공고' 탭
      return list.map((p) => ({ p, d: distanceM(user.location, p.location), s: recommendScore(user, p) })).sort((a, b) => b.s - a.s);
    }
    if (user?.role === "resident") list = mineOnly ? list.filter((p) => p.authorId === user.id) : list.filter((p) => p.authorId !== user.id);
    return list.map((p) => ({ p, d: user ? distanceM(user.location, p.location) : undefined, s: undefined as number | undefined }));
  }, [posts, cat, onlyOpen, user, mineOnly, appliedIds]);

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
  function explore() {
    setOnlyOpen(true);
    setExploring(true);
    feedTitle.current?.focus({ preventScroll: true });
    feedTitle.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  return (
    <div className="home-minimal">
      <TopBar title="월계 재능나눔" brand monochrome />
      <section className="home-content px-5 pb-6">
        <section className="home-minimal-intro" aria-label="월링크 소개">
          <div className="home-minimal-brand">
            <svg className="home-minimal-w" width="112" height="112" viewBox="0 0 64 64" fill="none" role="img" aria-label="WOLINK W"><path d="m13 21 9 24 10-21 10 21 9-24" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <h2>가까운 곳에,<br />나의 재능이 닿도록.</h2>
          </div>
          <nav className="home-minimal-categories" aria-label="공고 분야 선택">
            <div className="home-minimal-category-heading"><span>어떤 재능을 연결해 볼까요?</span><button type="button" aria-pressed={cat === "전체"} onClick={() => setCat("전체")}>전체 보기</button></div>
            <div className="home-minimal-category-grid">{HOME_CATEGORIES.map(item => <button key={item.value} type="button" aria-pressed={cat === item.value} onClick={() => { setCat(cat === item.value ? "전체" : item.value); explore(); }}><span><Icon name={item.icon} width={22} height={22} /></span><b>{item.label}</b></button>)}</div>
          </nav>
        </section>
        <div className={`home-feed ${exploring ? "is-arriving" : ""}`}>
        {(user?.role === "resident" || user?.role === "student") && (
          <div className="mb-4 flex gap-2" role="tablist" aria-label="공고 보기">
            {(user.role === "resident" ? [[true, "내 공고"], [false, "동네 공고"]] as const : [[true, "추천 공고"], [false, "내가 지원한 공고"]] as const).map(([v, label]) => (
              <button key={label} role="tab" aria-selected={mineOnly === v} onClick={() => setMineOnly(v)} className={`chip ${mineOnly === v ? "chip-on" : ""}`}>{label}</button>
            ))}
          </div>
        )}
        <div className="mb-4 flex items-center justify-between gap-3"><h2 ref={feedTitle} tabIndex={-1} className="home-feed-title text-xl font-bold tracking-tight">{user?.role === "resident" ? (mineOnly ? "내가 올린 공고" : "동네 다른 가게 공고") : user?.role === "student" && !mineOnly ? "내가 지원한 공고" : "이웃이 기다리는 도움"}</h2><span className="sub text-xs" role="status">{loading ? "불러오는 중" : `${rows.length}개의 공고`}</span></div>
        <label className="sub mb-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 완료된 공고 숨기기</label>
        <div className="flex flex-col gap-3">
          {loading && <p role="status" className="card sub text-sm">이웃의 요청을 불러오고 있어요.</p>}
          {error && <p role="alert" className="card text-sm text-[var(--red)]">{error}</p>}
          {!loading && !error && rows.length === 0 && <EmptyState text={user?.role === "resident" && mineOnly ? "아직 올린 공고가 없어요. 위 ＋ 로 공고를 올려 보세요."
            : user?.role === "student" && !mineOnly ? "아직 지원한 공고가 없어요. 추천 공고에서 찾아보세요."
            : "조건에 맞는 공고가 없어요. 다른 분야를 살펴보세요."} />}
          {rows.map(({ p, d }, index) => <div key={`${cat}-${p.id}`} className="home-post-enter" style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}><PostCard post={p} authorName={name(p.authorId)} distance={d} /></div>)}
        </div>
        </div>
      </section>
    </div>
  );
}
