"use client";
import { useCallback, useRef, useState } from "react";
import type { ProjectStatus } from "@/types";
import { STATUS_LABEL } from "@shared/portfolio/stateMachine";

/** 버튼 한 번 = 작업 하나. 진행 중에는 다시 못 누르고(중복 클릭 방지), 에러는 문장으로 보여 준다 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const run = useCallback(async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return undefined;
    lock.current = true;
    setBusy(true); setError("");
    try { return await f(); } catch (e) { setError((e as Error).message || "문제가 생겼어요"); return undefined; } finally { lock.current = false; setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

export function ErrorText({ text }: { text: string }) {
  if (!text) return null;
  return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-[var(--red)]">{text}</p>;
}

export const inputCls = "w-full rounded-xl bg-[var(--line)] p-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
      {hint && <span className="sub mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

const PROJECT_COLOR: Record<ProjectStatus, string> = {
  RECRUITING: "text-[var(--red)] bg-red-50",
  IN_PROGRESS: "text-[#b47a00] bg-yellow-50",
  REVIEW_PENDING: "text-[var(--primary)] bg-[var(--primary-weak)]",
  REVISION_REQUESTED: "text-[#c2410c] bg-orange-50",
  COMPLETED: "text-[#1a8f4b] bg-green-50",
  CANCELLED: "text-[var(--sub)] bg-[var(--line)]",
};
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PROJECT_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

/** 1~5 점 선택 (라디오 그룹, 키보드로 이동 가능) */
export function Rating({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="flex items-center justify-between gap-2 text-sm">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="font-semibold">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label} ${n}점`} onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-full text-base focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${n <= value ? "bg-[var(--primary)] text-white" : "bg-[var(--line)] text-[var(--sub)]"}`}>{n}</button>
        ))}
      </span>
    </fieldset>
  );
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--line)] px-3 py-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="font-semibold">{label}</span>{sub && <span className="sub block text-xs">{sub}</span>}</span>
    </label>
  );
}

/** 하단 고정 버튼 영역. 입력 화면에서 키보드가 올라와도 내용 아래에 붙어 있도록 sticky 로 둔다 */
export function BottomCTA({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 z-[950] -mx-4 mt-4 flex gap-2 border-t border-[var(--line)] bg-[var(--bg)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">{children}</div>;
}
