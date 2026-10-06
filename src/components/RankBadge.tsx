import { TierMark } from "./TierCard";
type Tier = "SEED" | "TRUST" | "RECOMMENDED";
const LABELS = { SEED: "새싹", TRUST: "신뢰", RECOMMENDED: "추천" };
export function rankLabel(rank: number, tier?: Tier) { return `${rank <= 5 ? "추천" : tier ? LABELS[tier] : "순위"} (${rank}위)`; }
export default function RankBadge({ rank, tier }: { rank: number; tier?: Tier }) {
  if (rank > 5) return <span className="rank-tier-mark" role="img" aria-label={`${rank}위${tier ? ` · ${LABELS[tier]}` : ""}`}><small>{rank}위</small>{tier ? <TierMark tier={tier} size={32}/> : <span className="rank-neutral-mark">—</span>}</span>;
  const starPeaks = rank === 1 ? [0, 2, 4] : rank === 2 ? [1, 3] : rank === 3 ? [2] : [];
  return <span className="rank-badge rank-crown-unified" role="img" aria-label={`${rank}위 · 추천 왕관${rank <= 3 ? ` · 별 ${4 - rank}개` : ""}`}>
    <span className="rank-crown-emblem" aria-hidden="true"><TierMark tier="RECOMMENDED" size={32}/>{starPeaks.map(peak => <span key={peak} className={`rank-crown-peak-star rank-crown-peak-${peak + 1}`}>★</span>)}</span>
    <span className="rank-crown-position" aria-hidden="true">{rank}</span>
  </span>;
}
