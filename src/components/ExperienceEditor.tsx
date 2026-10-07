"use client";
import { useEffect, useState } from "react";
import type { PublishedPortfolio } from "@/types";
import { repo } from "@/lib/repo";

export const EXPERIENCE_FIELDS = ["경험 소개", "문제 정의", "해결 방법", "작성할 내용", "인사이트"];
export function experienceSections(item: PublishedPortfolio) {
  const key = (text: string) => text.replace(/\s/g, "");
  return [...EXPERIENCE_FIELDS.map(title => ({ title, body: item.sections.find(s => key(s.title) === key(title))?.body ?? "" })), ...item.sections.filter(s => !EXPERIENCE_FIELDS.some(title => key(title) === key(s.title)))];
}
export default function ExperienceEditor({ item, onSave, onCancel }: { item: PublishedPortfolio; onSave: (item: PublishedPortfolio) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(() => ({ ...item, sections: experienceSections(item) }));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!photo) { setPreview(""); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const coverUrl = photo ? await repo.uploadPortfolioImage(item.studentId, photo) : draft.coverUrl;
      const updated = { ...draft, title: draft.title.trim(), coverUrl };
      await repo.updatePublishedPortfolio(item.studentId, updated); onSave(updated);
    } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="experience-editor" onSubmit={save}>
    <p className="sub text-sm">저장하면 현재 공개 중인 게시물에 반영돼요. 원본 활동 기록과 평가는 변경되지 않아요.</p>
    <fieldset disabled={busy}>
      <label>제목<input aria-label="제목" required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>한 줄 소개<textarea aria-label="한 줄 소개" maxLength={500} value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /></label>
      <label>대표 사진<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5_000_000) { setError("JPG, PNG, WebP 형식의 5MB 이하 사진을 선택해 주세요."); return; } setPhoto(file); setError(""); }} /></label>
      {(preview || draft.coverUrl) && <img className="experience-edit-cover" src={preview || draft.coverUrl} alt="대표 사진 미리보기" />}
      {draft.sections.map((section, index) => <label key={index}>{section.title}<textarea aria-label={section.title} maxLength={5000} rows={5} value={section.body} placeholder={`${section.title}을 자유롭게 적어 주세요.`} onChange={e => setDraft({ ...draft, sections: draft.sections.map((s, i) => i === index ? { ...s, body: e.target.value } : s) })} /></label>)}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="experience-edit-actions"><button type="button" className="btn" onClick={onCancel}>취소</button><button className="btn btn-primary" type="submit">{busy ? "저장 중…" : "변경사항 저장"}</button></div>
    </fieldset>
  </form>;
}
