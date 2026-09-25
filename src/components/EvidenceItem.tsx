/* eslint-disable @next/next/no-img-element */
import type { Evidence } from "@/types";
import { EVIDENCE_LABEL } from "@shared/portfolio/document";
import { isImage } from "@/lib/files";

/** 증빙 한 개. 원본(파일·링크·설명)은 올린 뒤 바꿀 수 없다 */
export default function EvidenceItem({ e, compact }: { e: Evidence; compact?: boolean }) {
  const img = e.url && isImage(e);
  return (
    <figure className="overflow-hidden rounded-xl bg-[var(--line)]">
      {img && <img src={e.url} alt={e.description || EVIDENCE_LABEL[e.type]} className={`w-full bg-white object-cover ${compact ? "h-24" : "max-h-72"}`} />}
      <figcaption className="px-3 py-2 text-xs">
        <span className="font-semibold">{EVIDENCE_LABEL[e.type]}</span>
        {e.source === "CLIENT" && <span className="ml-1 rounded bg-green-50 px-1 text-[10px] font-semibold text-[#1a8f4b]">의뢰인 제공</span>}
        {e.description && <span className="sub block">{e.description}</span>}
        {e.linkedClaim && <span className="block text-[var(--primary)]">↳ 뒷받침: {e.linkedClaim}</span>}
        {e.url && !img && <a href={e.url} target="_blank" rel="noreferrer" className="block truncate font-semibold text-[var(--primary)] underline">{e.fileName || e.url}</a>}
      </figcaption>
    </figure>
  );
}
