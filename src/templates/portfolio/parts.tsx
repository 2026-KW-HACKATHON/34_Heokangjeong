"use client";
// 템플릿 공통 부품. 편집 칸과 잠김 표시는 여기 하나뿐이라, 템플릿이 달라도 편집·잠금 규칙은 같다.
import { useEffect, useRef, useState } from "react";
import type { DocBlock } from "@shared/portfolio/document";
import type { PortfolioContent } from "@/types";

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
