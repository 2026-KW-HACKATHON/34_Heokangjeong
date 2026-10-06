"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import type { RankRow, TrustSummary } from "@/types";
import { useSession } from "@/lib/session";
import TierCard from "@/components/TierCard";
import Link from "next/link";
import RankBadge from "@/components/RankBadge";

const KINDS = [["individual", "개인"], ["team", "팀"], ["department", "학과"]] as const;

/** ③ 지역 기여 랭킹: 해결 수·평가·난이도 기반 점수. 점수 공식은 repo.ranking 에 있음. */
export default function Ranking() {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("individual");
  const [rows, setRows] = useState<RankRow[]>([]);
  const { user } = useSession();
  const [trustState, setTrustState] = useState<{ userId: string; value: TrustSummary } | null>(null);
  const [tierError, setTierError] = useState("");
  const [personalRank, setPersonalRank] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const trust = trustState?.userId === user?.id ? trustState?.value : null;
  useEffect(() => {
    let active = true;
    setTierError("");
    setPersonalRank(null);
    if (!user) return;
    Promise.all([repo.trustSummary(user.id), repo.personalRanking(user.id)]).then(([value, rank]) => { if (active) { setTrustState({ userId: user.id, value }); setPersonalRank(rank.current); } }).catch(() => { if (active) setTierError("내 티어를 불러오지 못했어요. 잠시 후 다시 열어 주세요."); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setRows([]);
    repo.ranking(kind).then(value => { if (active) setRows(value); }).catch(() => { if (active) setError("랭킹을 불러오지 못했어요."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind]);
  return (
    <>
      <TopBar title="랭킹" />
      <section className="px-4">
        {trust ? <TierCard trust={trust} rank={personalRank} /> : <p role="status" className="card mb-8 text-sm">{tierError || (user ? "내 티어를 불러오는 중…" : "로그인하면 내 티어를 확인할 수 있어요.")}</p>}
        <h2 className="mb-2 text-xl font-bold tracking-tight">지역 기여 랭킹</h2>
        <p className="sub mb-5 text-sm">우리 동네에 변화를 만든 이웃들이에요.</p>
        <div className="mb-3 flex gap-2">{KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "chip-on" : ""}`}>{l}</button>)}</div>
        <ul className="card flex flex-col divide-y divide-[var(--line)] p-0">
          {rows.map((r, i) => (
            <li key={r.id}>
              {kind === "individual" ? <Link href={`/portfolio/gallery?s=${encodeURIComponent(r.id)}`} className="rank-profile-link" aria-label={`${r.label}님의 공개 포트폴리오 보기`}>
                <RankBadge rank={i + 1} />
                <div className="flex-1"><p className="font-semibold">{r.label}</p><p className="sub text-xs">{r.sub} · {r.solved}개 해결</p></div>
                <span className="font-bold">{r.score}점</span><span aria-hidden="true" className="sub">›</span>
              </Link> : <div className="flex items-center gap-3 px-4 py-3">
              <RankBadge rank={i + 1} />
              <div className="flex-1"><p className="font-semibold">{r.label}</p><p className="sub text-xs">{r.sub} · {r.solved}개 해결</p></div>
              <span className="font-bold text-[var(--primary)]">{r.score}점</span>
              </div>}
            </li>
          ))}
          {rows.length === 0 && <li role="status" className="sub p-6 text-center text-sm">{loading ? "랭킹을 불러오는 중…" : error || "아직 기록이 없어요"}</li>}
        </ul>
        <details className="rank-badge-guide"><summary>TOP 5 추천 왕관</summary><div className="rank-badge-palette">{["금", "핑크", "하늘", "초록", "철"].map((name, i) => <div key={name}><RankBadge rank={i + 1} /><span>{i + 1}위 · 추천</span></div>)}</div></details>
        <p className="sub mt-3 text-xs">점수 = 해결 수×10 + 평가 평균×4 + 난이도 합×3 (임시). 팀 랭킹은 팀 기능이 붙으면 채워집니다.</p>
      </section>
    </>
  );
}
