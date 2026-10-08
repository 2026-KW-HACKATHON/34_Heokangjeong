"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { PublishedPortfolio } from "@/types";
import { withFeedCollection, type FeedCollection } from "@/lib/portfolio/collection";

type SelectedImage = { id: string; file: File; preview: string };
const accepted = ["image/jpeg", "image/png", "image/webp"];

export default function CreatePortfolioFeed() {
  const { user, loading } = useSession();
  const router = useRouter();
  const [photos, setPhotos] = useState<SelectedImage[]>([]);
  const [coverId, setCoverId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [collection, setCollection] = useState<FeedCollection>("experience");
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("collection"); if (value === "archive") setCollection(value); }, []);
  const previews = useRef<string[]>([]);
  useEffect(() => () => { previews.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    if (photos.length + incoming.length > 8) return setError("사진은 최대 8장까지 올릴 수 있어요.");
    if (incoming.some(file => !accepted.includes(file.type) || file.size > 5_000_000)) return setError("JPG, PNG, WebP 사진을 장당 5MB 이하로 선택해 주세요.");
    const added = incoming.map(file => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    previews.current.push(...added.map(photo => photo.preview));
    setPhotos(current => [...current, ...added]);
    if (!coverId && photos.length === 0) setCoverId(added[0].id);
    setError("");
  }
  function removePhoto(id: string) {
    setPhotos(current => current.filter(photo => photo.id !== id));
    if (coverId === id) setCoverId(photos.find(photo => photo.id !== id)?.id ?? "");
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!user || user.role !== "student") return setError("학생 프로필에서 피드를 작성할 수 있어요.");
    if (!photos.length || !coverId) return setError("사진을 올리고 대표사진을 골라 주세요.");
    if (!title.trim() || !body.trim()) return setError("제목과 내용을 적어 주세요.");
    setBusy(true); setError("");
    try {
      const uploaded: string[] = [];
      for (const photo of photos) uploaded.push(await repo.uploadPortfolioImage(user.id, photo.file));
      const coverUrl = uploaded[photos.findIndex(photo => photo.id === coverId)];
      const item: PublishedPortfolio = {
        studentId: user.id, sourceId: crypto.randomUUID(), sourceKind: "manual",
        title: title.trim(), summary: body.trim().slice(0, 120), category: "개인 작업",
        sections: [{ title: "작업 이야기", body: body.trim() }],
        publishedAt: new Date().toISOString(), coverUrl, imageUrls: uploaded, visible: true,
      };
      await repo.createPortfolioFeed(user.id, withFeedCollection(item, collection));
      router.push(`/portfolio/experience?s=${encodeURIComponent(user.id)}&kind=manual&id=${item.sourceId}`);
    } catch (cause) { setError((cause as Error).message || "피드를 올리지 못했어요. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <><TopBar title="새 포트폴리오" back /><main className="portfolio-compose">
    {loading ? <p>프로필을 불러오는 중…</p> : user?.role !== "student" ? <div className="portfolio-compose-empty"><h1>학생 프로필에서 작성할 수 있어요</h1><Link href="/me">내 작업실로 돌아가기</Link></div> : <form onSubmit={publish}>
      <p className="portfolio-compose-kicker">MY EXPERIENCE</p><h1>새 경험을 기록해요</h1><p className="portfolio-compose-lead">사진을 고르고, 내 말로 작업 이야기를 남겨 보세요.</p>
      <section className="portfolio-compose-section"><div className="portfolio-compose-step"><b>01</b><div><h2>사진 올리기</h2><p>사진을 누르면 피드의 대표사진으로 지정돼요.</p></div></div>
        <label className="portfolio-compose-upload">+ 사진 추가<input aria-label="사진 추가" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={event => { addPhotos(event.target.files); event.target.value = ""; }} /></label>
        {!!photos.length && <div className="portfolio-compose-photos">{photos.map((photo, index) => <div key={photo.id} className="portfolio-compose-photo"><button type="button" aria-label={`사진 ${index + 1} 대표사진으로 선택`} aria-pressed={coverId === photo.id} onClick={() => setCoverId(photo.id)}><img src={photo.preview} alt={`업로드한 사진 ${index + 1}`} />{coverId === photo.id && <span>대표사진</span>}</button><button type="button" className="portfolio-compose-remove" aria-label={`사진 ${index + 1} 삭제`} onClick={() => removePhoto(photo.id)}>×</button></div>)}</div>}
        <p className="portfolio-compose-help">JPG · PNG · WebP, 장당 5MB 이하 · 최대 8장</p>
      </section>
      <section className="portfolio-compose-section"><div className="portfolio-compose-step"><b>02</b><div><h2>글 형식 선택</h2><p>HTML 글 프롬프트는 추후 추가할 예정이에요.</p></div></div><div className="portfolio-compose-prompt" aria-label="HTML 글 프롬프트 준비 중">선택할 글 형식이 아직 없어요</div></section>
      <section className="portfolio-compose-section"><div className="portfolio-compose-step"><b>03</b><div><h2>내용 작성</h2><p>내가 맡은 일과 배운 점을 자유롭게 적어 주세요.</p></div></div>
        <label>제목<input aria-label="피드 제목" required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="예: 동네 카페 메뉴판을 새롭게 만든 경험" /></label>
        <label>공개 위치<select aria-label="공개 위치" value={collection} onChange={event => setCollection(event.target.value as FeedCollection)}><option value="experience">월링크 활동</option><option value="archive">개인 작업 · 앱 밖의 개인 기록</option></select></label>
        {collection === "archive" && <p className="portfolio-compose-help">앱 밖에서 쌓은 개인 기록은 최대 3개까지 공개할 수 있어요.</p>}
        <label>본문<textarea aria-label="피드 본문" required maxLength={10000} rows={12} value={body} onChange={event => setBody(event.target.value)} placeholder="작업을 시작한 이유, 진행 과정, 결과와 느낀 점을 적어 주세요." /></label>
      </section>
      {error && <p role="alert" className="portfolio-compose-error">{error}</p>}
      <button type="submit" className="portfolio-compose-submit" disabled={busy || !photos.length || !coverId || !title.trim() || !body.trim()}>{busy ? "피드 올리는 중…" : "피드 업로드"}</button>
    </form>}
  </main></>;
}
