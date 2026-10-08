"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DocBlock } from "@shared/portfolio/document";
import { toNotionBlocks, type NotionBlock } from "@shared/portfolio/notionBlocks";
import type { PortfolioEditedVersion } from "@/types";
import { listNotionExports, notion, notionAvailable, type NotionExportResult, type NotionExportRow, type NotionPage, type NotionStatus } from "@/lib/notion";
import { ErrorText, inputCls, useAction } from "./ui";

/** Server-side frozen preview -> explicit save. Never auto-publish on OAuth return. */
export default function NotionPanel({ edit, doc }: { edit: PortfolioEditedVersion; doc: DocBlock[] }) {
  const sp = useSearchParams();
  const [status, setStatus] = useState<NotionStatus | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [query, setQuery] = useState("");
  const [parent, setParent] = useState("");
  const [jobs, setJobs] = useState<NotionExportRow[]>([]);
  const [preview, setPreview] = useState<NotionExportResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);   // 'Notion으로 내보내기'를 눌러 저장 단계를 펼쳤는가
  const requestId = useRef<string>();
  const act = useAction();
  const run = act.run;
  const refresh = useCallback(async () => {
    setLoaded(false);
    const [connection, history] = await Promise.all([notion.status(), listNotionExports(edit.id)]);
    setStatus(connection); setJobs(history); setLoaded(true);
  }, [edit.id]);
  useEffect(() => { if (notionAvailable) void run(refresh); }, [refresh, run]);
  async function search() { await act.run(async () => { setPages(await notion.search(query)); }); }
  async function prepare(newVersion: boolean) {
    if (!parent) return act.setError("저장 위치를 골라 주세요");
    if (newVersion) requestId.current ??= crypto.randomUUID();
    await act.run(async () => {
      const job = await notion.prepare(edit.id, parent === "workspace" ? null : parent, newVersion ? requestId.current : undefined);
      setPreview(job);
      await refresh();
    });
  }
  async function save() {
    if (!preview) return;
    await act.run(async () => {
      try {
        const result = await notion.exportPage(preview.id);
        setPreview(result);
        if (result.status === "SUCCEEDED" || (result.status === "PARTIAL" && result.nextIndex >= result.totalBlocks)) requestId.current = undefined;
      } finally { await refresh(); }
    });
  }
  const finished = jobs.some(j => j.status === "SUCCEEDED" || (j.status === "PARTIAL" && j.nextIndex >= j.totalBlocks));
  const unfinished = jobs.some(j => ["READY", "PENDING", "UNKNOWN", "FAILED"].includes(j.status) || (j.status === "PARTIAL" && j.nextIndex < j.totalBlocks));
  const returnTo = () => { const u = new URL(window.location.href); u.searchParams.delete("notion"); u.searchParams.delete("notion_msg"); return u.toString(); };
  const retryable = (j: NotionExportResult) => ["READY", "FAILED"].includes(j.status) || (j.status === "PARTIAL" && j.nextIndex < j.totalBlocks);
  // 화면: 버튼 하나 → (연결 뒤) '내보내기'를 누르면 저장 위치 → 내용 확인 → 저장. 각 단계의 '뒤로'는 한 단계 전으로.
  const black = "btn w-full bg-[#1d1d1f] text-white disabled:opacity-50";
  const lastDone = jobs.find((j) => j.url && j.status === "SUCCEEDED");
  return <section className="flex flex-col gap-3" aria-label="Notion 저장">
    {sp.get("notion") === "cancelled" && <p role="status" className="sub text-sm">연결을 취소했어요. 작성한 문서는 그대로 보존됩니다.</p>}
    {sp.get("notion") === "error" && <ErrorText text="Notion 연결에 실패했어요. 다시 시도해 주세요." />}
    {!notionAvailable ? <DemoNotion edit={edit} doc={doc} />
    : !loaded && !status ? <p role="status" className="sub text-sm">연결을 확인 중이에요.</p>
    : !status?.configured ? <p className="sub text-sm">서버 설정이 필요해요. docs/NOTION.md의 배포 절차를 확인해 주세요.</p>
    : !status.connected ? <button disabled={act.busy} className={black} onClick={() => act.run(() => notion.connect(returnTo()))}>Notion 계정 연결</button>
    : preview ? <>
      <div className="rounded-xl border border-[var(--line)] p-4">
        <h4 className="font-bold">{preview.title}</h4>
        <p className="sub mt-2 text-xs">저장 위치: {preview.parentPageId ? (pages.find((p) => p.id === preview.parentPageId)?.title ?? "선택한 페이지") : "워크스페이스 최상위"} · {preview.totalBlocks}개 블록</p>
        <ol className="my-4 max-h-80 space-y-2 overflow-y-auto text-sm">{preview.blocks.map((b, i) => <li key={i} className="whitespace-pre-wrap break-words">{(b[b.type]?.rich_text ?? b[b.type]?.caption ?? []).map((r: { text?: { content: string } }) => r.text?.content ?? "").join("")}{b.type === "image" && " [이미지]"}</li>)}</ol>
        {preview.failedAttachments.length > 0 && <p className="mb-3 text-sm text-[var(--red)]">첨부 {preview.failedAttachments.length}개는 저장할 수 없어요. 본문에 누락 안내가 남습니다.</p>}
        {retryable(preview) && <button disabled={act.busy || !loaded} className={black} onClick={save}>{act.busy ? "저장 중…" : "확인한 내용을 Notion에 저장"}</button>}
        {preview.url && <a className="mt-2 inline-block font-semibold underline" target="_blank" rel="noreferrer" href={preview.url}>저장 완료 · Notion에서 페이지 확인 ↗</a>}
        {preview.error && <p className="mt-2 text-sm text-[var(--red)]">{preview.error}</p>}
      </div>
      <button disabled={act.busy} className="btn btn-ghost w-full" onClick={() => { const done = !!preview.url; setPreview(null); if (done) setOpen(false); }}>뒤로</button>
    </>
    : !open ? <>
      <button disabled={act.busy} className={black} onClick={() => setOpen(true)}>Notion으로 내보내기</button>
      {lastDone && <a className="sub text-center text-xs underline" target="_blank" rel="noreferrer" href={lastDone.url!}>지난번에 저장한 Notion 페이지 보기 ↗</a>}
    </>
    : <>
      <p className="sub text-xs">연결됨 · {status.workspaceName || "Notion"} · <button disabled={act.busy} className="underline" onClick={() => act.run(async () => { await notion.disconnect(); setPages([]); setParent(""); setPreview(null); setOpen(false); await refresh(); })}>연결 해제</button> · <button disabled={act.busy} className="underline" onClick={() => act.run(() => notion.connect(returnTo()))}>권한 다시 연결</button></p>
      {!unfinished && <fieldset className="space-y-3">
        <legend className="font-semibold">저장 위치 선택</legend>
        <div className="flex gap-2"><input aria-label="Notion 페이지 검색" className={inputCls} value={query} onChange={e => setQuery(e.target.value)} placeholder="페이지 이름" /><button disabled={act.busy} className="btn btn-ghost shrink-0" onClick={search}>검색</button></div>
        <label className="flex gap-2 text-sm"><input type="radio" name="notion-parent" checked={parent === "workspace"} onChange={() => setParent("workspace")} />내 워크스페이스 최상위</label>
        {pages.map(p => <label key={p.id} className="flex gap-2 text-sm"><input type="radio" name="notion-parent" checked={parent === p.id} onChange={() => setParent(p.id)} />{p.title}</label>)}
        <p className="sub text-xs">허용된 페이지를 검색해 선택하세요. 첨부 링크도 선택한 위치의 독자에게 전달됩니다.</p>
        <button disabled={act.busy || !parent} className={black} onClick={() => prepare(finished)}>{finished ? "새 페이지로 저장 준비" : "저장 내용 확인"}</button>
      </fieldset>}
      {jobs.length > 0 && <div className="space-y-2"><h4 className="text-sm font-semibold">저장 기록</h4>{jobs.map(j => <article key={j.id} className="rounded-xl border border-[var(--line)] p-3 text-sm">
        <p>{j.status === "SUCCEEDED" ? "저장 완료" : j.status === "PARTIAL" ? "일부 저장 · 확인 필요" : j.status === "UNKNOWN" ? "저장 결과 확인 필요" : j.status === "PENDING" ? "저장 진행 중 · 자동 재실행 안 함" : j.status === "READY" ? "저장 준비됨" : "저장 실패"} · {j.nextIndex}/{j.totalBlocks} · {j.createdAt.slice(0, 16).replace("T", " ")}</p>
        {j.url && <a className="mt-2 inline-block underline" target="_blank" rel="noreferrer" href={j.url}>Notion에서 페이지 확인 ↗</a>}
        {j.error && <p className="mt-2 text-[var(--red)]">{j.error}</p>}
        {j.failedAttachments.map((f, i) => <p key={i} className="mt-1 text-[var(--red)]">{f.reason}</p>)}
        {retryable(j) && <button disabled={act.busy} className="btn btn-ghost mt-2 w-full" onClick={() => setPreview(j)}>내용 확인 · 같은 작업 이어서 저장</button>}
        {!j.url && ["READY", "FAILED"].includes(j.status) && <button disabled={act.busy} className="mt-3 underline" onClick={() => act.run(async () => { await notion.cancelPrepared(j.id); setPreview(null); requestId.current = undefined; await refresh(); })}>저장 준비 취소 · 위치 다시 선택</button>}
        {["UNKNOWN", "PENDING"].includes(j.status) && <p className="sub mt-2">오래 멈춰 있다면 중복 방지를 위해 관리자 확인이 필요해요. 기록 ID: {j.id}</p>}
      </article>)}<button disabled={act.busy} className="sub text-xs underline" onClick={() => act.run(refresh)}>저장 기록 새로고침</button></div>}
      <button disabled={act.busy} className="btn btn-ghost w-full" onClick={() => setOpen(false)}>뒤로</button>
    </>}
    <ErrorText text={act.error} />
  </section>;
}

/**
 * 데모 모드: 서버가 없어 실제 Notion 에는 저장할 수 없지만, 실제와 같은 버튼·단계(연결 → 내보내기 → 위치 → 내용 확인 → 저장)를 보여 준다.
 * 미리보기는 서버가 보내는 것과 같은 함수(toNotionBlocks)로 만든 블록이라 실제로 들어갈 내용 그대로다.
 */
function DemoNotion({ edit, doc }: { edit: PortfolioEditedVersion; doc: DocBlock[] }) {
  const [step, setStep] = useState<"start" | "connected" | "location" | "preview" | "saved">("start");
  const [parent, setParent] = useState("");
  const built = toNotionBlocks(doc, edit.content.summary);
  const pages = [{ id: "workspace", title: "내 워크스페이스 최상위" }, { id: "demo-page", title: "포트폴리오 모음 (예시 페이지)" }];
  const text = (b: NotionBlock) => ((b[b.type]?.rich_text ?? b[b.type]?.caption ?? []) as { text?: { content: string } }[]).map((r) => r.text?.content ?? "").join("");
  const black = "btn w-full bg-[#1d1d1f] text-white disabled:opacity-50";
  if (step === "start") return <button className={black} onClick={() => setStep("connected")}>Notion 계정 연결</button>;
  if (step === "connected") return <button className={black} onClick={() => setStep("location")}>Notion으로 내보내기</button>;
  if (step === "location") return <div className="flex flex-col gap-3">
    <fieldset className="space-y-3">
      <legend className="font-semibold">저장 위치 선택</legend>
      {pages.map((p) => <label key={p.id} className="flex gap-2 text-sm"><input type="radio" name="notion-demo-parent" checked={parent === p.id} onChange={() => setParent(p.id)} />{p.title}</label>)}
      <button disabled={!parent} className={black} onClick={() => setStep("preview")}>저장 내용 확인</button>
    </fieldset>
    <button className="btn btn-ghost w-full" onClick={() => setStep("connected")}>뒤로</button>
  </div>;
  return <div className="flex flex-col gap-3">
    <div className="rounded-xl border border-[var(--line)] p-4">
      <h4 className="font-bold">{edit.content.title}</h4>
      <p className="sub mt-2 text-xs">저장 위치: {pages.find((p) => p.id === parent)?.title} · {built.blocks.length}개 블록</p>
      <ol className="my-4 max-h-80 space-y-2 overflow-y-auto text-sm">{built.blocks.map((b, i) => <li key={i} className="whitespace-pre-wrap break-words">{text(b)}{b.type === "image" && " [이미지]"}</li>)}</ol>
      {built.failed.length > 0 && <p className="mb-3 text-sm text-[var(--red)]">첨부 {built.failed.length}개는 공개 주소가 아니라 저장할 수 없어요. 본문에 누락 안내가 남습니다.</p>}
      {step === "preview"
        ? <button className={black} onClick={() => setStep("saved")}>확인한 내용을 Notion에 저장</button>
        : <p role="status" className="text-sm font-semibold text-[var(--green)]">저장 완료 (데모 모드라 실제 Notion 에는 저장되지 않았어요)</p>}
    </div>
    <button className="btn btn-ghost w-full" onClick={() => setStep(step === "saved" ? "connected" : "location")}>뒤로</button>
  </div>;
}
