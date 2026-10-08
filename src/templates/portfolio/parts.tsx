"use client";
// 템플릿 공통 부품. 편집 칸과 잠김 표시는 여기 하나뿐이라, 템플릿이 달라도 편집·잠금 규칙은 같다.
import { useEffect, useRef, useState } from "react";
import { EVIDENCE_LABEL, type DocBlock } from "@shared/portfolio/document";
import { isImage } from "@/lib/files";
import type { Evidence, PortfolioContent } from "@/types";

/** 블록 종류를 빠뜨리면 컴파일 오류가 나게 한다 (새 블록 종류 = 모든 템플릿에서 오류) */
export function assertNever(x: never): never { throw new Error(`처리하지 않은 블록: ${JSON.stringify(x)}`); }

export type BlockOf<K extends DocBlock["kind"]> = Extract<DocBlock, { kind: K }>;

/** 글 하나. 평소에는 글, 편집 중에는 같은 자리에서 늘어나는 입력칸 */
export function EditableText({ value, onChange, editing, label, multiline = true, className = "", placeholder }: {
  value: string; onChange: (v: string) => void; editing: boolean; label: string; multiline?: boolean; className?: string; placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = ref.current; if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight + 2}px`; } }, [value, editing]);
  if (!editing) {
    if (!multiline) return <span className={className}>{value}</span>;
    return <div className={className}>{value.split(/\n+/).filter(Boolean).map((p, i) => <p key={i} className="pf-p">{p}</p>)}</div>;
  }
  return (
    <textarea ref={ref} aria-label={label} data-editable={label} rows={multiline ? 3 : 1} value={value} placeholder={placeholder}
      onChange={(e) => onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
      className={`pf-edit ${className}`} />
  );
}

/** 잠긴 블록: 편집 중에만 잠김 표시가 붙는다. 내용은 원본 그대로이고 입력칸이 없다 */
export function Locked({ editing, origin, children, className = "" }: { editing: boolean; origin: "client" | "record"; children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${editing ? "pf-locked" : ""} ${className}`} data-locked={origin}>
      {editing && <span className="pf-lock-badge">🔒 잠김 · {origin === "client" ? "의뢰인 원본" : "프로젝트 기록"}</span>}
      {children}
    </div>
  );
}

// ── 글 고치기 도우미 (불변 갱신) ───────────────────────────────────────────────
export const setSection = (c: PortfolioContent, key: string, body: string): PortfolioContent =>
  ({ ...c, sections: c.sections.map((s) => (s.key === key ? { ...s, body } : s)) });
export const setTool = (c: PortfolioContent, i: number, patch: Partial<PortfolioContent["tools"][number]>): PortfolioContent =>
  ({ ...c, tools: c.tools.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

/** 사용 도구와 역량. 편집 중에는 이름·이유·역량을 고치고 더하고 뺄 수 있다 */
export function ToolsEditor({ content, onChange, editing, nameClass = "font-semibold", whyClass = "", chipClass = "chip" }: {
  content: PortfolioContent; onChange: (c: PortfolioContent) => void; editing: boolean; nameClass?: string; whyClass?: string; chipClass?: string;
}) {
  if (!editing) return (
    <>
      {content.tools.length > 0 && <ul className="flex flex-col gap-1">{content.tools.map((t) => <li key={t.name}><span className={nameClass}>{t.name}</span>{t.why && <span className={whyClass}> — {t.why}</span>}</li>)}</ul>}
      {content.skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{content.skills.map((s) => <span key={s} className={chipClass}>{s}</span>)}</div>}
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      {content.tools.map((t, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label="도구 이름" className="pf-edit w-28" value={t.name} onChange={(e) => onChange(setTool(content, i, { name: e.target.value }))} />
          <input aria-label="도구를 쓴 이유" className="pf-edit flex-1" placeholder="왜 이 도구를 썼나요?" value={t.why} onChange={(e) => onChange(setTool(content, i, { why: e.target.value }))} />
          <button type="button" aria-label={`도구 ${t.name} 빼기`} className="px-1 text-sm opacity-60" onClick={() => onChange({ ...content, tools: content.tools.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="self-start text-sm font-semibold underline" onClick={() => onChange({ ...content, tools: [...content.tools, { name: "", why: "" }] })}>+ 도구 추가</button>
      <SkillsInput content={content} onChange={onChange} />
    </div>
  );
}

/** 역량: 입력한 글자는 그대로 두고(쉼표·띄어쓰기 유지), 목록만 갱신한다 */
function SkillsInput({ content, onChange }: { content: PortfolioContent; onChange: (c: PortfolioContent) => void }) {
  const [text, setText] = useState(content.skills.join(", "));
  return (
    <label className="mt-1 text-xs opacity-70">역량 (쉼표로 구분)
      <input aria-label="역량" className="pf-edit mt-1 w-full" value={text}
        onChange={(e) => { setText(e.target.value); onChange({ ...content, skills: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }); }} />
    </label>
  );
}

/**
 * 증빙을 웹 포트폴리오처럼 보여 준다: 이미지는 크게(원본 비율) + 아래 작은 캡션, 파일·링크는 깔끔한 링크 줄.
 * 원본 그대로이고 고칠 수 없다 (잠금은 바깥 Locked 가 표시).
 */
export function EvidenceFigures({ evidence, columns = 1 }: { evidence: Evidence[]; columns?: 1 | 2 }) {
  const images = evidence.filter((e) => e.url && isImage(e));
  const others = evidence.filter((e) => !(e.url && isImage(e)));
  return (
    <div className="pf-figs">
      {images.length > 0 && (
        <div className={`pf-fig-grid ${columns === 2 && images.length > 1 ? "pf-fig-grid-2" : ""}`}>
          {images.map((e) => (
            <figure key={e.id} className="pf-fig">
              <a href={e.url} target="_blank" rel="noreferrer" aria-label={`${EVIDENCE_LABEL[e.type]} 원본 크게 보기`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.url} alt={e.description || EVIDENCE_LABEL[e.type]} loading="lazy" className="pf-fig-img" />
              </a>
              <EvidenceCaption e={e} />
            </figure>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="pf-files">
          {others.map((e) => (
            <li key={e.id} className="pf-file">
              <span className="pf-file-icon" aria-hidden="true">{e.type === "DELIVERABLE_URL" ? "↗" : e.url ? "▤" : "✎"}</span>
              <span className="min-w-0 flex-1">
                <EvidenceCaption e={e} />
                {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="pf-file-link">{e.fileName || e.url.replace(/^https?:\/\//, "")}</a>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function EvidenceCaption({ e }: { e: Evidence }) {
  return (
    <figcaption className="pf-fig-cap">
      <span className="pf-fig-kind">{EVIDENCE_LABEL[e.type]}{e.source === "CLIENT" && <span className="pf-fig-client">의뢰인 제공</span>}</span>
      {e.description && <span className="pf-fig-desc">{e.description}</span>}
      {e.linkedClaim && <span className="pf-fig-desc">↳ 뒷받침: {e.linkedClaim}</span>}
    </figcaption>
  );
}
