"use client";
import { useState } from "react";
import type { Student } from "@/types";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";

export default function PortfolioProfileHeader({ student, editable = false }: { student: Student; publishedCount: number; editable?: boolean }) {
  const { refreshUsers } = useSession();
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState(student.about ?? "");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function cancel() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setAvatar(null); setAbout(student.about ?? ""); setEditing(false); setError("");
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const avatarUrl = avatar ? await repo.uploadPortfolioImage(student.id, avatar) : undefined;
      await repo.updatePortfolioProfile(student.id, { about: about.trim().slice(0, 300), avatarUrl });
      await refreshUsers(); setEditing(false); setAvatar(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className={`portfolio-identity${editing ? " is-editing" : ""}`} aria-label="내 소개">
    <div className="portfolio-identity-main">
      <div className="portfolio-identity-avatar" aria-label={`${student.name}의 프로필 사진`}>
        {preview || student.avatarUrl ? <img src={preview ?? student.avatarUrl} alt="" /> : <span aria-hidden="true">{student.name.slice(0, 1)}</span>}
      </div>
      <div className="portfolio-identity-text">
        <h1>{student.name}</h1>
        <p className="portfolio-identity-dept">{student.department}</p>
      </div>
    </div>
    <div className="portfolio-identity-about">
      <div className="portfolio-identity-about-heading"><h2>About me</h2>{editable && <button type="button" onClick={() => { if (editing) cancel(); else { setEditing(true); setError(""); } }} aria-expanded={editing}>{editing ? "닫기" : "프로필 편집"}</button>}</div>
      {editing ? <div className="portfolio-identity-editor">
        <label>소개글 <textarea maxLength={300} value={about} onChange={e => setAbout(e.target.value)} placeholder="어떤 작업을 좋아하고, 동네에서 어떤 변화를 만들고 싶은지 적어 주세요." /></label>
        <label className="portfolio-photo-picker">프로필 사진 선택 <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5_000_000) { setError("5MB 이하 이미지를 선택해 주세요."); return; } if (preview) URL.revokeObjectURL(preview); setAvatar(file); setPreview(URL.createObjectURL(file)); }} /></label>
        <p className="portfolio-editor-note">얼굴 사진이 아니어도 좋아요. 직접 고른 이미지만 공개됩니다.</p>
        {error && <p role="alert" className="portfolio-editor-error">{error}</p>}
        <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>{busy ? "저장 중…" : "저장하기"}</button>
      </div> : <p>{student.about?.trim() || (editable ? "나를 소개하는 한두 문장을 적어 보세요." : "아직 소개글이 없어요.")}</p>}
      {!editing && <div className="profile-specialties"><h3>Skills & interests</h3><p>{student.skills.join(" · ")}</p><span>{student.interests.join(" / ")}</span></div>}
    </div>
  </section>;
}
