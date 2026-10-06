import Link from "next/link";
import type { TrustSummary } from "@/types";
import { TIERS, applicationTierFor } from "@shared/portfolio/policy";

const COLORS: Record<string, string> = {
  SEED: "#4f7c57", TRUST: "#28717b", RECOMMENDED: "#b17b20",
};
const MARK = { SEED: "/tiers/seed.png", TRUST: "/tiers/trust.png", RECOMMENDED: "/tiers/recommended.png" } as const;

/** User-approved transparent PNG marks are tinted with their alpha mask. */
export function TierMark({ tier, size = 42 }: { tier: keyof typeof MARK; size?: number }) {
  const mask = `url(${MARK[tier]})`;
  return <span aria-hidden="true" className="block shrink-0" style={{ width: size, height: size, backgroundColor: COLORS[tier], WebkitMaskImage: mask, maskImage: mask, WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }} />;
}

export default function TierCard({ trust, rank = null }: { trust: TrustSummary; rank?: number | null }) {
  const current = applicationTierFor(trust.temperature, rank);
  const topFive = rank !== null && rank > 0 && rank <= 5;
  const next = TIERS[TIERS.indexOf(current) + 1];
  const progress = next ? Math.max(0, Math.min(100, (trust.temperature - current.minTemperature) / (next.minTemperature - current.minTemperature) * 100)) : 100;
  return <section aria-labelledby="my-tier-title" className="mb-8 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between"><h2 id="my-tier-title" className="text-sm font-semibold">내 지원 등급</h2><span className="sub text-xs">{topFive ? `TOP 5 · ${rank}위` : "협업 온도 기준"}</span></div>
    <div className="my-6 flex items-center gap-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${COLORS[current.key]}18` }}><TierMark tier={current.key} /></div>
      <div><p className="text-2xl font-bold tracking-tight">{current.label}</p><p className="sub mt-1 text-sm">협업 온도 {trust.temperature.toFixed(1)}° · 완료 {trust.verifiedCount}건</p></div>
    </div>
    <div className="flex justify-between gap-2 text-xs"><span>{next ? `다음 등급 · ${next.label}` : "가장 높은 등급이에요"}</span><span className="sub">{next ? `${trust.temperature.toFixed(1)}° / ${next.minTemperature.toFixed(1)}°` : `${trust.temperature.toFixed(1)}°`}</span></div>
    <div role="progressbar" aria-label="다음 티어 진행도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-700" style={{ width: `${progress}%` }} /></div>
    <p className="sub mt-3 text-xs leading-5">{topFive ? "현재 개인 랭킹 TOP 5에 들어 추천 등급이 적용돼요." : next ? `점주 평가로 온도 ${Math.max(0, next.minTemperature - trust.temperature).toFixed(1)}°를 더 쌓으면 ${next.label} 등급이 돼요.` : "이웃과 함께 쌓은 신뢰가 추천 등급으로 이어졌어요."}</p>
    <Link href="/portfolio" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold">내 포트폴리오 보기 ↗</Link>
    <details className="mt-3 border-t border-[var(--line)] pt-4 text-xs"><summary className="cursor-pointer font-medium">전체 등급과 승급 기준</summary><ol className="mt-3 grid grid-cols-3 gap-2">{TIERS.map(t => <li key={t.key} className={`flex flex-col gap-1 rounded-lg px-2 py-2 ${t.key === current.key ? "bg-zinc-100 font-semibold" : "sub"}`}><TierMark tier={t.key} size={20} /><span>{t.label}</span><span>{t.minTemperature.toFixed(1)}° 이상</span></li>)}</ol><p className="sub mt-3 leading-5">데모 정책 · 온도는 점주가 평가한 기한 준수·소통·인수인계를 반영합니다. 개인 랭킹 TOP 5는 온도와 관계없이 추천 지원 등급이 적용됩니다. 유료 지원은 별도로 완료 검증 1건이 필요합니다.</p></details>
  </section>;
}
