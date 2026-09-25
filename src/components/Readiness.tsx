import Link from "next/link";
import type { ReadinessResult } from "@shared/portfolio/readiness";
import type { Stage } from "@/types";

const LEVEL = { REQUIRED: "필수", RECOMMENDED: "권장", OPTIONAL: "선택" } as const;
const STATE = { DONE: "✓", MISSING: "·", SKIPPED: "건너뜀", NOT_APPLICABLE: "해당 없음" } as const;

/** 포트폴리오 자료 준비도. 실력 점수가 아니라 포트폴리오에 쓸 자료가 얼마나 갖춰졌는지다 */
export default function Readiness({ r, fixHref }: { r: ReadinessResult; fixHref?: (questionId: string, stage?: Stage) => string }) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="text-sm font-bold">포트폴리오 자료 준비도</p>
        <p className="text-2xl font-bold text-[var(--primary)]">{r.percent}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuenow={r.percent} aria-valuemin={0} aria-valuemax={100} aria-label="포트폴리오 자료 준비도">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${r.percent}%` }} />
      </div>
      <p className="sub mt-1 text-xs">실력 점수가 아니에요. 100% 가 아니어도 포트폴리오를 만들 수 있어요. 건너뛴 항목은 AI 가 지어내지 않고 비워 둡니다.</p>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {r.items.map((it) => (
          <li key={it.key} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1">
            <span className="flex items-center gap-2">
              <span className={`w-9 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${it.level === "REQUIRED" ? "bg-[var(--primary-weak)] text-[var(--primary)]" : "bg-[var(--line)] text-[var(--sub)]"}`}>{LEVEL[it.level]}</span>
              <span className={it.state === "DONE" ? "" : "sub"}>{it.label}</span>
            </span>
            {it.state === "DONE" ? <span className="text-[var(--green)]" aria-label="완료">✓</span>
              : it.questionId && fixHref ? <Link href={fixHref(it.questionId)} className="text-xs font-semibold text-[var(--primary)]">{it.state === "MISSING" ? "채우기" : `${STATE[it.state]} · 고치기`}</Link>
              : <span className="sub text-xs">{it.state === "MISSING" ? "없음" : STATE[it.state]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
