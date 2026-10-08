"use client";
import { useEffect, useRef, useState } from "react";
import { repo } from "@/lib/repo";
import { publicationFromSource } from "@/lib/portfolio/publication";
import type { PublishedPortfolio } from "@/types";

export default function PortfolioPublicationControl({ studentId, sourceId, sourceKind }: { studentId: string; sourceId: string; sourceKind: PublishedPortfolio["sourceKind"] }) {
  const [published, setPublished] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PublishedPortfolio | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [currentCover, setCurrentCover] = useState<string | undefined>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    repo.listPublishedPortfolio(studentId).then(items => { if (active) { const item = items.find(p => p.sourceId === sourceId && p.sourceKind === sourceKind); setPublished(!!item); setCurrentCover(item?.coverUrl); } }).catch(() => { if (active) setError("공개 설정을 불러오지 못했어요."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [studentId, sourceId, sourceKind]);
  useEffect(() => { if (preview) dialog.current?.showModal(); }, [preview]);
  async function openPreview() {
    setBusy(true); setError("");
    try { setPreview(await publicationFromSource(repo, studentId, sourceId, sourceKind)); }
    catch { setError("공개할 내용을 불러오지 못했어요."); }
    finally { setBusy(false); }
  }
  async function save(visible: boolean) {
    setBusy(true); setError("");
    try {
      if (visible) {
        const coverUrl = coverFile ? await repo.uploadPortfolioImage(studentId, coverFile) : currentCover;
        await repo.publishPortfolio(studentId, sourceId, sourceKind, coverUrl);
        setCurrentCover(coverUrl);
      }
      else await repo.unpublishPortfolio(studentId, sourceId, sourceKind);
      setPublished(visible); dialog.current?.close(); setPreview(null); setCoverFile(null);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
    } catch { setError("공개 설정을 저장하지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <div className="publication-control">
    <span className="sub text-xs" aria-live="polite">{published ? "갤러리에 공개 중" : "비공개"}</span>
    <div className="flex gap-3">
      {published && <button disabled={busy} onClick={() => save(false)} className="text-xs underline">비공개로 전환</button>}
      <button disabled={busy} onClick={openPreview} className="text-xs font-semibold underline">{busy ? "불러오는 중…" : published ? "공개 내용 갱신" : "갤러리에 공개"}</button>
    </div>
    {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
    <dialog ref={dialog} className="portfolio-gallery-dialog" aria-label="포트폴리오 공개 미리보기" onClose={() => setPreview(null)} onClick={e => { if (e.target === e.currentTarget && !busy) dialog.current?.close(); }}>
      {preview && <div className="p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">공개할 내용 확인</h2><button autoFocus disabled={busy} onClick={() => dialog.current?.close()} aria-label="공개 미리보기 닫기" className="gallery-close">×</button></div>
        <p className="sub mb-5 text-sm">{sourceKind === "project"
          ? "아래 제목과 본문, 대표 사진이 갤러리 게시물로 공개돼요. 게시물에는 '자세한 포트폴리오 보기' 버튼이 붙어, 누르면 내 포트폴리오 페이지(의뢰인 평가 원문·검증 결과·증빙 포함)가 열려요. 편집은 나만 할 수 있어요."
          : "아래 제목과 본문, 직접 선택한 대표 사진만 공개됩니다. 원본 증빙과 의뢰인 평가는 포함하지 않아요."}</p>
        <label className="portfolio-cover-picker">피드 대표 사진 <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5_000_000) { setError("5MB 이하 이미지를 선택해 주세요."); return; } if (coverPreview) URL.revokeObjectURL(coverPreview); setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }} /></label>
        {(coverPreview || currentCover) && <img className="portfolio-cover-preview" src={coverPreview ?? currentCover} alt="선택한 대표 사진 미리보기" />}
        <p className="sub mb-4 text-xs">사진이 없으면 분야별 기본 표지가 표시됩니다. JPG, PNG, WebP · 최대 5MB</p>
        <h3 className="text-xl font-bold">{preview.title}</h3><p className="my-4 whitespace-pre-wrap text-sm">{preview.summary}</p>
        {preview.sections.map((s, i) => <section key={i} className="mb-4"><h4 className="font-semibold">{s.title}</h4><p className="sub mt-1 whitespace-pre-wrap text-sm">{s.body}</p></section>)}
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} onClick={() => save(true)} className="btn btn-primary w-full">{busy ? "저장 중…" : "이 내용을 갤러리에 공개"}</button>
      </div>}
    </dialog>
  </div>;
}
