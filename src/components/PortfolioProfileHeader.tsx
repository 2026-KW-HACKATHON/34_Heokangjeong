"use client";
import { useState } from "react";
import type { Category, Student } from "@/types";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { nicknameError, nicknameProblem } from "@/lib/nickname";
import { Silhouette } from "@/components/Avatar";
const INTEREST_OPTIONS: Category[] = ["디자인", "사진", "영상", "웹/앱", "SNS홍보", "디지털도움", "기타"];

export default function PortfolioProfileHeader({ student, editable = false }: { student: Student; publishedCount: number; editable?: boolean }) {
  const { refreshUsers, users } = useSession();
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState(student.about ?? "");
  const [department, setDepartment] = useState(student.department);
  const [nickname, setNickname] = useState(student.nickname ?? "");
  const [skills, setSkills] = useState(student.skills.join(", "));
  const [interests, setInterests] = useState<Category[]>(student.interests);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function cancel() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setAvatar(null); setAbout(student.about ?? ""); setDepartment(student.department); setNickname(student.nickname ?? ""); setSkills(student.skills.join(", ")); setInterests(student.interests); setEditing(false); setError("");
  }
  async function save() {
    if (!department.trim()) { setError("학과를 입력해 주세요."); return; }
    const nickChanged = nickname.trim() !== (student.nickname ?? "");
    if (nickChanged) { const problem = nicknameProblem(nickname, users, student.id); if (problem) { setError(problem); return; } }
    setBusy(true); setError("");
    try {
      const avatarUrl = avatar ? await repo.uploadPortfolioImage(student.id, avatar) : undefined;
      await repo.updatePortfolioProfile(student.id, { about: about.trim().slice(0, 300), avatarUrl, department: department.trim(), skills: [...new Set(skills.split(/[,\n]/).map(skill => skill.trim()).filter(Boolean))].slice(0, 20), interests, ...(nickChanged ? { nickname: nickname.trim() } : {}) });
      await refreshUsers(); setEditing(false); setAvatar(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    } catch (e) { setError(nicknameError((e as Error).message)); }
    finally { setBusy(false); }
  }
  return <section className={`portfolio-identity${editing ? " is-editing" : ""}`} aria-label="내 소개">
    <div className="portfolio-identity-main">
      <div className="portfolio-identity-avatar" aria-label={`${student.name}의 프로필 사진`}>
        {preview || student.avatarUrl ? <img src={preview ?? student.avatarUrl} alt="" /> : <Silhouette />}
      </div>
      <div className="portfolio-identity-text">
        <div className="portfolio-identity-name-row"><h1>{student.name}</h1>
          {student.nickname ? <p className="portfolio-identity-nick">@{student.nickname}</p>
            : editable && <p className="portfolio-identity-nick">닉네임을 정해 주세요 · 프로필 편집</p>}</div>
        <p className="portfolio-identity-dept">{student.department}</p>
      </div>
    </div>
    <div className="portfolio-identity-about">
      <div className="portfolio-identity-about-heading"><h2>About me</h2>{editable && <button type="button" onClick={() => { if (editing) cancel(); else { setEditing(true); setError(""); } }} aria-expanded={editing}>{editing ? "닫기" : "프로필 편집"}</button>}</div>
      {editing ? <div className="portfolio-identity-editor">
        <label>닉네임 <input aria-label="닉네임" maxLength={16} placeholder="2~16자, 한글·영문·숫자·_ ." value={nickname} onChange={e => setNickname(e.target.value.replace(/\s/g, ""))} /></label>
        <label>학과 <input aria-label="학과" maxLength={80} value={department} onChange={e => setDepartment(e.target.value)} /></label>
        <label>소개글 <textarea maxLength={300} value={about} onChange={e => setAbout(e.target.value)} placeholder="어떤 작업을 좋아하고, 동네에서 어떤 변화를 만들고 싶은지 적어 주세요." /></label>
        <label>보유 기술 <textarea aria-label="보유 기술" maxLength={600} rows={2} value={skills} onChange={e => setSkills(e.target.value)} placeholder="예: Python, Figma, 사진 촬영 · 쉼표나 줄바꿈으로 구분" /></label>
        <fieldset className="profile-interest-options"><legend>관심 분야</legend>{INTEREST_OPTIONS.map(interest => <label key={interest}><input type="checkbox" checked={interests.includes(interest)} onChange={e => setInterests(current => e.target.checked ? [...current, interest] : current.filter(item => item !== interest))} />{interest}</label>)}</fieldset>
        <label className="portfolio-photo-picker">프로필 사진 선택 <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5_000_000) { setError("5MB 이하 이미지를 선택해 주세요."); return; } if (preview) URL.revokeObjectURL(preview); setAvatar(file); setPreview(URL.createObjectURL(file)); }} /></label>
        <p className="portfolio-editor-note">얼굴 사진이 아니어도 좋아요. 직접 고른 이미지만 공개됩니다.</p>
        {error && <p role="alert" className="portfolio-editor-error">{error}</p>}
        <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>{busy ? "저장 중…" : "저장하기"}</button>
      </div> : <p>{student.about?.trim() || (editable ? "나를 소개하는 한두 문장을 적어 보세요." : "아직 소개글이 없어요.")}</p>}
      {!editing && <div className="profile-specialties"><h3>Skills & interests</h3><p>{student.skills.join(" · ")}</p><span>{student.interests.join(" / ")}</span></div>}
    </div>
  </section>;
}
