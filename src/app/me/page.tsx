"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import PortfolioProfileHeader from "@/components/PortfolioProfileHeader";
import PortfolioFeed from "@/components/PortfolioFeed";
import WorkFieldSummary from "@/components/WorkFieldSummary";
import { useSession } from "@/lib/session";
import { repo } from "@/lib/repo";
import type { PublishedPortfolio } from "@/types";

export default function Me() {
  const { mode, user, users, setUserId, signOut } = useSession();
  const [items, setItems] = useState<PublishedPortfolio[]>([]);
  const [feedError, setFeedError] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (user?.role !== "student") { setItems([]); return; }
    let active = true;
    const refresh = () => repo.listPublishedPortfolio(user.id)
      .then(rows => { if (active) { setItems(rows); setFeedError(""); } })
      .catch(() => { if (active) setFeedError("공개 피드를 불러오지 못했어요."); });
    refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [user?.id, user?.role]);

  async function resetDemo() {
    if (!repo.resetDemo) return;
    setResetting(true);
    try {
      await repo.resetDemo();
      setUserId("s1");
      window.location.assign("/");
    } finally {
      setResetting(false);
    }
  }

  return <>
    <TopBar title="나의 작업실" />
    <main className="portfolio-me">
      {user?.role === "student" ? <>
        <PortfolioProfileHeader key={user.id} student={user} publishedCount={items.length} editable />
        <WorkFieldSummary key={user.id} studentId={user.id} />
        {feedError && <p role="alert" className="card text-sm">{feedError}</p>}
        <PortfolioFeed student={user} items={items} owner />
        <Link href="/portfolio" className="btn w-full">작업 관리 · 공개 범위 설정</Link>
        <details className="portfolio-me-details"><summary>나의 활동 정보</summary><dl><dt>보유 기술</dt><dd>{user.skills.join(", ") || "미입력"}</dd><dt>관심 분야</dt><dd>{user.interests.join(", ") || "미입력"}</dd><dt>가능 시간</dt><dd>{user.availableHours || "미입력"}</dd></dl><Link href="/projects">진행 프로젝트 보기 →</Link></details>
      </> : <section className="card"><h2 className="text-xl font-bold">{user?.name ?? "나의 프로필"}</h2><p className="sub mt-2 text-sm">{user?.role === "resident" ? `${user.kind} · ${user.address}` : "계정을 불러오는 중이에요."}</p><Link href="/projects" className="btn mt-5 w-full">내 프로젝트 보기</Link></section>}
      {mode === "mock" && <>
        <section className="card text-sm">
          <label className="font-semibold" htmlFor="demo-account">데모 계정 전환</label>
          <select id="demo-account" className="mt-2 w-full rounded-xl bg-[var(--line)] p-3" value={user?.id ?? ""} onChange={e => setUserId(e.target.value)}>
            <optgroup label="학생">{users.filter(u => u.role === "student").map(u => <option key={u.id} value={u.id}>{u.name} · {u.role === "student" ? u.department : ""}</option>)}</optgroup>
            <optgroup label="주민·상인">{users.filter(u => u.role === "resident").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
          <p className="sub mt-2 text-xs">계정을 바꿔 학생과 주민·상인의 화면을 확인할 수 있어요.</p>
        </section>
        <section className="card text-sm">
          <h3 className="font-bold">데모 다시 시작</h3>
          <p className="sub mt-2">지원·선정·채팅·알림 기록을 처음 상태로 되돌려 같은 흐름을 다시 시험할 수 있어요.</p>
          <button onClick={resetDemo} disabled={resetting} className="btn btn-ghost mt-3 w-full disabled:opacity-50">{resetting ? "초기화 중…" : "데모 데이터 초기화"}</button>
        </section>
      </>}
      {mode === "supabase" && <button onClick={signOut} className="btn btn-ghost w-full">로그아웃</button>}
    </main>
  </>;
}
