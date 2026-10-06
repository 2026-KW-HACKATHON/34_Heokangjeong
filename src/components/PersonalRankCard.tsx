"use client";
import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import type { PersonalRanking, TrustSummary } from "@/types";
import RankBadge, { rankLabel } from "./RankBadge";
import { TierMark } from "./TierCard";
import { applicationTierFor } from "@shared/portfolio/policy";

export default function PersonalRankCard({ studentId }: { studentId: string }) {
  const [state, setState] = useState<{ id: string; ranks?: PersonalRanking; trust?: TrustSummary; error?: string }>({ id: studentId });
  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all([repo.personalRanking(studentId), repo.trustSummary(studentId)]).then(([ranks, trust]) => { if (active) setState({ id: studentId, ranks, trust }); }).catch(() => { if (active) setState({ id: studentId, error: "순위를 불러오지 못했어요. 잠시 후 다시 열어 주세요." }); });
    refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [studentId]);
  const ranks = state.id === studentId ? state.ranks : undefined;
  const trust = state.id === studentId ? state.trust : undefined;
  const supportTier = applicationTierFor(trust?.temperature ?? 36.5, ranks?.current ?? null);
  const tier = supportTier.key;
  return <section className="personal-rank-card" aria-label="개인 랭킹 기록">
    <div className="personal-rank-columns">{([["현재 랭킹", ranks?.current], ["개인 최고 랭킹", ranks?.best]] as const).map(([label, rank]) => <div className="personal-rank-stat" key={label}>
      <p>{label}</p><div>{rank ? <><RankBadge rank={rank} tier={label === "현재 랭킹" ? tier : undefined}/><strong>{rankLabel(rank, label === "현재 랭킹" ? tier : undefined)}</strong></> : <strong className="sub">{ranks ? "순위 없음" : state.error ? "—" : "불러오는 중…"}</strong>}</div>
    </div>)}</div>
    {trust && ranks && <div className="personal-trust-row"><TierMark tier={tier} size={24}/><div><p>지원 등급 · <strong>{supportTier.label}</strong>{ranks.current && ranks.current <= 5 ? " · TOP 5" : ""}</p><span>협업 온도 {trust.temperature.toFixed(1)}°{!trust.paidEligible ? " · 유료 지원은 완료 검증 1건 필요" : " · 유료 지원 가능"}</span></div></div>}
    <p className="personal-rank-note">지원 등급은 TOP 5 또는 협업 온도로 결정돼요.<br/>개인 최고 순위는 기록이며, 지원 조건은 현재 등급을 따릅니다.</p>
    {state.id === studentId && state.error && <p role="alert" className="text-xs text-red-700">{state.error}</p>}
  </section>;
}
