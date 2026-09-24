"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DocBlock } from "@shared/portfolio/document";
import { toNotionBlocks } from "@shared/portfolio/notionBlocks";
import type { PortfolioEditedVersion } from "@/types";
import { listNotionExports, notion, notionAvailable, type NotionExportResult, type NotionExportRow, type NotionPage, type NotionStatus } from "@/lib/notion";
import { ErrorText, inputCls, useAction } from "./ui";

/**
 * Notion 저장: 연결(OAuth) → 저장 위치 선택 → 저장 내용 미리보기 → 페이지 생성 → 실제 Notion URL.
 * 같은 편집본을 두 번 저장하면 기존 페이지를 돌려준다. "새 버전으로 저장"을 눌러야 새 페이지가 생긴다.
 */
export default function NotionPanel({ edit, doc }: { edit: PortfolioEditedVersion; doc: DocBlock[] }) {
  const sp = useSearchParams();
  const back = sp.get("notion");
  const backMsg = sp.get("notion_msg");
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [pages, setPages] = useState<NotionPage[] | null>(null);
  const [query, setQuery] = useState("");
  const [parent, setParent] = useState<NotionPage | "workspace" | null>(null);
  const [result, setResult] = useState<NotionExportResult | null>(null);
  const [exportsList, setExports] = useState<NotionExportRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const act = useAction();
  const preview = useMemo(() => toNotionBlocks(doc, edit.content.summary), [doc, edit.content.summary]);

  const refresh = useCallback(async () => {
    if (!notionAvailable) return;
    try { setStatus(await notion.status()); } catch (e) { setStatus({ configured: false, connected: false }); act.setError((e as Error).message); }
    setExports(await listNotionExports(edit.id));
  }, [edit.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh]);

  async function search() {
    const r = await act.run(() => notion.search(query));
    if (r) setPages(r);
  }
  useEffect(() => { if (status?.connected && pages === null) search(); }, [status?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(forceNew: boolean) {
    if (!parent) return act.setError("저장할 위치를 골라 주세요");
    const r = await act.run(() => notion.exportPage(edit.id, parent === "workspace" ? null : parent.id, forceNew));
    if (r) { setResult(r); setExports(await listNotionExports(edit.id)); }
  }
  const saved = exportsList.find((x) => x.status === "SUCCEEDED" || x.status === "PARTIAL");
  const returnTo = () => { const u = new URL(window.location.href); u.searchParams.delete("notion"); u.searchParams.delete("notion_msg"); return u.toString(); };

  return (
    <div className="card flex flex-col gap-3">
      <h3 className="font-bold">Notion 에 저장</h3>
      {back === "connected" && <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm text-[#1a8f4b]">Notion 계정이 연결됐어요.</p>}
      {back === "cancelled" && <p role="status" className="rounded-xl bg-[var(--line)] px-3 py-2 text-sm">Notion 연결을 취소했어요. 저장하려면 다시 연결해 주세요.</p>}
      {back === "error" && <ErrorText text={`Notion 연결에 실패했어요${backMsg ? `: ${backMsg}` : ""}`} />}

      {!notionAvailable ? (
        <p className="rounded-xl bg-[var(--line)] px-3 py-2 text-sm">Notion 저장은 서버(Supabase)에 연결된 상태에서만 쓸 수 있어요. 지금은 가짜 데이터 모드라 미리보기만 볼 수 있어요.</p>
      ) : !status ? <p className="sub text-sm">연결 상태 확인 중…</p>
        : !status.configured ? <p className="rounded-xl bg-[var(--line)] px-3 py-2 text-sm">서버에 Notion 연동 설정이 아직 없어요 (NOTION_CLIENT_ID 등). docs/NOTION.md 를 참고해 설정해 주세요.</p>
        : !status.connected ? (
          <>
            <p className="text-sm">내 Notion 계정을 연결하면 이 포트폴리오를 실제 Notion 페이지로 만들어요. 연결 화면에서 <b>저장할 페이지를 공유</b>해 주세요.</p>
            <button disabled={act.busy} onClick={() => act.run(() => notion.connect(returnTo()))} className="btn btn-primary w-full">Notion 계정 연결</button>
          </>
        ) : (
          <>
            <p className="sub text-xs">연결됨: {status.workspaceIcon && !status.workspaceIcon.startsWith("http") ? `${status.workspaceIcon} ` : ""}{status.workspaceName ?? "Notion 워크스페이스"} · <button className="underline" onClick={() => act.run(async () => { await notion.disconnect(); setPages(null); await refresh(); })}>연결 해제</button></p>
            {saved && !result && (
              <div className="rounded-xl bg-green-50 px-3 py-2 text-sm">
                이 편집본(v{edit.version})은 이미 저장했어요. <a href={saved.url ?? "#"} target="_blank" rel="noreferrer" className="font-semibold text-[#1a8f4b] underline">기존 페이지 열기</a>
              </div>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">저장 위치</legend>
              <div className="flex gap-2">
                <input className={inputCls} placeholder="페이지 검색" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} aria-label="Notion 페이지 검색" />
                <button onClick={search} disabled={act.busy} className="btn btn-ghost shrink-0 px-3">검색</button>
              </div>
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto text-sm">
                <li><label className="flex items-center gap-2 rounded-lg px-2 py-2"><input type="radio" name="parent" checked={parent === "workspace"} onChange={() => setParent("workspace")} /> 🔒 내 워크스페이스 최상위 (나만 보기)</label></li>
                {(pages ?? []).map((p) => (
                  <li key={p.id}><label className="flex items-center gap-2 rounded-lg px-2 py-2"><input type="radio" name="parent" checked={parent !== "workspace" && parent?.id === p.id} onChange={() => setParent(p)} /> {p.icon ?? "📄"} {p.title}</label></li>
                ))}
                {pages && pages.length === 0 && <li className="sub px-2 text-xs">공유된 페이지가 없어요. Notion 연결 시 페이지를 공유하거나 최상위에 저장하세요.</li>}
              </ul>
            </fieldset>
          </>
        )}

      <div className="rounded-xl bg-[var(--line)] p-3 text-sm">
        <button onClick={() => setShowPreview(!showPreview)} className="font-semibold" aria-expanded={showPreview}>저장 내용 미리보기 {showPreview ? "▲" : "▼"}</button>
        <p className="sub text-xs">Notion 블록 {preview.blocks.length}개 · 제목 “{edit.content.title}”</p>
        {preview.failed.length > 0 && <p className="mt-1 text-xs text-[#c2410c]">첨부 {preview.failed.length}개는 Notion 에서 열 수 없는 주소라 넣지 못해요 (부분 저장): {[...new Set(preview.failed.map((f) => f.reason))].join(", ")}</p>}
        {showPreview && (
          <ol className="mt-2 flex flex-col gap-0.5 text-xs">
            {preview.blocks.map((b, i) => {
              const t = b.type as string;
              const text = (b[t]?.rich_text ?? b[t]?.caption ?? []).map((r: { text?: { content: string } }) => r.text?.content ?? "").join("");
              return <li key={i} className={t.startsWith("heading") ? "mt-1 font-bold" : "sub"}>{t === "image" ? "🖼 " : t === "to_do" ? (b.to_do.checked ? "☑ " : "☐ ") : t === "quote" ? "❝ " : t === "bulleted_list_item" ? "• " : ""}{text.slice(0, 80) || t}</li>;
            })}
          </ol>
        )}
      </div>

      <ErrorText text={act.error} />
      {result && (
        <div className="rounded-xl bg-green-50 px-3 py-2 text-sm" role="status">
          {result.existing ? "이미 저장한 버전이라 기존 페이지를 열어요." : result.status === "PARTIAL" ? "저장했어요. 일부 첨부는 넣지 못했어요 (부분 실패)." : "Notion 에 저장했어요."}
          <a href={result.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold text-[#1a8f4b] underline">Notion 에서 열기 ↗</a>
          {result.failedAttachments.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-[#c2410c]">{result.failedAttachments.map((f, i) => <li key={i}>{f.reason}</li>)}</ul>}
        </div>
      )}
      {status?.connected && (
        <div className="flex flex-col gap-2">
          {!saved && !result && <button disabled={act.busy || !parent} onClick={() => save(false)} className="btn btn-primary w-full disabled:opacity-40">{act.busy ? "저장 중…" : "Notion 에 저장"}</button>}
          {(saved || result) && <button disabled={act.busy || !parent} onClick={() => { if (confirm("같은 편집본으로 새 Notion 페이지를 하나 더 만들까요?")) save(true); }} className="btn btn-ghost w-full text-sm disabled:opacity-40">새 버전으로 저장 (새 페이지)</button>}
        </div>
      )}
      {act.error && act.error.includes("다시 연결") && <button onClick={() => act.run(() => notion.connect(returnTo()))} className="btn btn-ghost w-full text-sm">Notion 다시 연결</button>}
    </div>
  );
}
