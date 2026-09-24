import type { ClientVerification, Outcome } from "@/types";
import { CLAIM_KEYS, CLAIM_LABEL } from "@shared/portfolio/document";

/** Claim 단위 의뢰인 검증: 의뢰인이 "무엇을" 확인했는지 항목별로 보여 준다. 학생이 바꿀 수 없는 원본 */
export default function Verification({ v, outcomes, approvedVersion }: { v: ClientVerification | null; outcomes: Outcome[]; approvedVersion?: number | null }) {
  if (!v) return <p className="sub text-sm">아직 의뢰인 검증 전이에요.</p>;
  const measured = outcomes.filter((o) => o.measured);
  const verified = measured.filter((o) => o.verified);
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#1a8f4b]"><span aria-hidden>🛡️</span> Client Verified{approvedVersion ? ` · 제출 v${approvedVersion} 승인` : ""}</p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {CLAIM_KEYS.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden className={v[k] ? "text-[var(--green)]" : "sub"}>{v[k] ? "✓" : "—"}</span>
            <span className={v[k] ? "" : "sub"}>{CLAIM_LABEL[k]}{v[k] ? "" : " (확인되지 않음)"}</span>
            <span className="sr-only">{v[k] ? "확인됨" : "확인되지 않음"}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className={measured.length && verified.length === measured.length ? "text-[var(--green)]" : "sub"}>{measured.length && verified.length === measured.length ? "✓" : "—"}</span>
          <span className={verified.length ? "" : "sub"}>{measured.length ? `성과 수치 확인 ${verified.length}/${measured.length}` : "성과 수치는 아직 확인되지 않음"}</span>
        </li>
      </ul>
      {v.note && <p className="sub mt-2 text-xs">의뢰인 메모: {v.note}</p>}
      <p className="sub mt-2 text-[11px]">의뢰인이 {v.createdAt.slice(0, 10)} 에 직접 확인한 항목이에요. 학생이 수정할 수 없어요.</p>
    </div>
  );
}
