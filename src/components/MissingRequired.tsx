import Link from "next/link";
import type { ReadinessResult } from "@shared/portfolio/readiness";

/** 진행 중 안내: 분야별 필수 자료 중 아직 없는 것 (막지 않고 권고만) */
export default function MissingRequired({ r, href }: { r: ReadinessResult; href: (questionId: string) => string }) {
  if (r.missingRequired.length === 0) return <p className="mt-3 text-xs font-semibold text-[var(--green)]">✓ 포트폴리오 필수 자료를 모두 채웠어요</p>;
  return (
    <div className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs" role="status">
      <p className="font-semibold">포트폴리오 필수 자료 {r.missingRequired.length}개가 아직 없어요</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {r.missingRequired.map((it) => it.questionId
          ? <li key={it.key}><Link href={href(it.questionId)} className="chip bg-white text-[#c2410c]">{it.label}{it.state === "SKIPPED" ? " (건너뜀)" : ""} ›</Link></li>
          : <li key={it.key} className="chip bg-white">{it.label}</li>)}
      </ul>
    </div>
  );
}
