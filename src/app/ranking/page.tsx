"use client";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import type { RankRow, TrustSummary } from "@/types";
import { useSession } from "@/lib/session";
import TierCard from "@/components/TierCard";

const KINDS = [["individual", "개인"], ["team", "팀"], ["department", "학과"]] as const;
const MEDAL = ["🥇", "🥈", "🥉"];

/** ③ 지역 기여 랭킹: 해결 수·평가·난이도 기반 점수. 점수 공식은 repo.ranking 에 있음. */
export default function Ranking() {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("individual");
  const [rows, setRows] = useState<RankRow[]>([]);
  const { user, loading: sessionLoading, mode } = useSession();
  const [trustState, setTrustState] = useState<{ userId: string; value: TrustSummary } | null>(null);
  const [tierError, setTierError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const trust = trustState?.userId === user?.id ? trustState?.value : null;
  useEffect(() => {
    let active = true;
    setTierError("");
    if (!user || user.role !== "student") { setTrustState(null); return; }
    repo.trustSummary(user.id).then(value => { if (active) setTrustState({ userId: user.id, value }); }).catch(() => { if (active) setTierError("내 티어를 불러오지 못했어요. 잠시 후 다시 열어 주세요."); });
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
        {user?.role === "student"
          ? trust ? <TierCard trust={trust} /> : <p role="status" className="card mb-8 text-sm">{tierError || "내 등급을 불러오는 중…"}</p>
          : <p role="status" className="card mb-8 text-sm">{sessionLoading
            ? "사용자 정보를 불러오는 중…"
            : user?.role === "resident"
              ? "개인 등급은 학생 활동에 제공돼요. 지역 기여 랭킹은 아래에서 확인할 수 있어요."
              : mode === "mock" ? "데모 사용자를 불러오지 못했어요." : "로그인하면 내 등급을 확인할 수 있어요."}</p>}
        <h2 className="mb-2 text-xl font-bold tracking-tight">지역 기여 랭킹</h2>
        <p className="sub mb-5 text-sm">우리 동네에 변화를 만든 이웃들이에요.</p>
        <div className="mb-3 flex gap-2">{KINDS.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "chip-on" : ""}`}>{l}</button>)}</div>
        <ul className="card flex flex-col divide-y divide-[var(--line)] p-0">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-7 text-center text-lg">{MEDAL[i] ?? i + 1}</span>
              <div className="flex-1"><p className="font-semibold">{r.label}</p><p className="sub text-xs">{r.sub} · {r.solved}개 해결</p></div>
              <span className="font-bold text-[var(--primary)]">{r.score}점</span>
            </li>
          ))}
          {rows.length === 0 && <li role="status" className="sub p-6 text-center text-sm">{loading ? "랭킹을 불러오는 중…" : error || "아직 기록이 없어요"}</li>}
        </ul>
        <p className="sub mt-3 text-xs">점수 = 해결 수×10 + 평가 평균×4 + 난이도 합×3 (임시). 팀 랭킹은 팀 기능이 붙으면 채워집니다.</p>
      </section>
    </>
  );
}
