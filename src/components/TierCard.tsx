import Link from "next/link";
import type { TrustSummary } from "@/types";
import { TIERS } from "@shared/portfolio/policy";

const COLORS: Record<string, string> = {
  UNRANKED: "#71717a", BRONZE: "#956440", SILVER: "#64748b", GOLD: "#997319",
  PLATINUM: "#357980", EMERALD: "#24835e", DIAMOND: "#367bb0", MASTER: "#7751a3",
  GRANDMASTER: "#b04c52", CHALLENGER: "#947126",
};

export default function TierCard({ trust }: { trust: TrustSummary }) {
  const current = TIERS.find(t => t.key === trust.tier.key) ?? TIERS[0];
  const next = TIERS[TIERS.indexOf(current) + 1];
  const progress = next ? Math.max(0, Math.min(100, (trust.verifiedCount - current.minVerified) / (next.minVerified - current.minVerified) * 100)) : 100;
  return <section aria-labelledby="my-tier-title" className="mb-8 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between"><h2 id="my-tier-title" className="text-sm font-semibold">내 티어</h2><span className="sub text-xs">검증된 지역 활동</span></div>
    <div className="my-6 flex items-center gap-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-gradient-to-br from-white via-[#f5f5f7] to-[#e4e4e7]" style={{ color: COLORS[current.key] }}>
        <svg aria-hidden="true" width="48" height="54" viewBox="0 0 48 54" fill="none"><path d="M24 3 43 11v16c0 10-11 18-19 24C16 45 5 37 5 27V11Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="2" />{current.key === "UNRANKED" ? <path d="M17 27h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /> : <path d="m24 15 10 12-10 13-10-13Z" fill="currentColor" />}</svg>
      </div>
      <div><p className="text-2xl font-bold tracking-tight">{current.label}</p><p className="sub mt-1 text-sm">{trust.verifiedCount === 0 ? "첫 번째 나눔을 시작해 보세요" : `함께 완성한 활동 ${trust.verifiedCount}건`}</p></div>
    </div>
    <div className="flex justify-between gap-2 text-xs"><span>{next ? `다음 티어 · ${next.label}` : "가장 높은 티어에 도달했어요"}</span><span className="sub">{next ? `${trust.verifiedCount} / ${next.minVerified}건` : `${trust.verifiedCount}건 완료`}</span></div>
    <div role="progressbar" aria-label="다음 티어 진행도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-700" style={{ width: `${progress}%` }} /></div>
    <p className="sub mt-3 text-xs leading-5">{next ? `점주가 확인한 활동 ${next.minVerified - trust.verifiedCount}건을 더 완료하면 ${next.label}로 올라가요.` : "이웃과 함께 쌓은 경험을 포트폴리오로 확인해 보세요."}</p>
    <Link href="/portfolio" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold">내 포트폴리오 보기 ↗</Link>
    <details className="mt-3 border-t border-[var(--line)] pt-4 text-xs"><summary className="cursor-pointer font-medium">전체 티어와 승급 기준</summary><ol className="mt-3 grid grid-cols-2 gap-2">{TIERS.map(t => <li key={t.key} className={`flex justify-between gap-2 rounded-lg px-2 py-2 ${t.key === current.key ? "bg-zinc-100 font-semibold" : "sub"}`}><span>{t.label}</span><span>{t.minVerified}건</span></li>)}</ol><p className="sub mt-3 leading-5">데모 정책 · 점주가 확인한 완료 건수 기준입니다. 지역 기여 랭킹 점수와는 별도로 계산하며, 질문 답변량이나 비활동 기간은 티어에 영향을 주지 않습니다.</p></details>
  </section>;
}
