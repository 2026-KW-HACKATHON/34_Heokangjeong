"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ExperienceEditor, { experienceSections } from "@/components/ExperienceEditor";
import TopBar from "@/components/TopBar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { PublishedPortfolio } from "@/types";

export default function ExperiencePage() { return <Suspense fallback={<p className="p-6">경험을 불러오는 중…</p>}><Experience /></Suspense>; }
function Experience() {
  const params = useSearchParams();
  const studentId = params.get("s") ?? "", id = params.get("id") ?? "", kind = params.get("kind");
  const { mode, user } = useSession();
  const [item, setItem] = useState<PublishedPortfolio | null>();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const sample = mode === "mock" && id.startsWith("demo-");
  useEffect(() => {
    let active = true; setItem(undefined); setError(""); setEditing(false); setSaved(false);
    Promise.all([repo.getUser(studentId), repo.listPublishedPortfolio(studentId, user?.id === studentId)]).then(([profile, rows]) => {
      if (active) { setName(profile?.name ?? ""); setItem(rows.find(row => row.sourceId === id && row.sourceKind === kind) ?? null); }
    }).catch(() => { if (active) setError("경험을 불러오지 못했어요. 다시 시도해 주세요."); });
    return () => { active = false; };
  }, [studentId, id, kind, sample, user?.id]);
  return <><TopBar title="경험 포트폴리오" back /><main className="experience-page">
    {error ? <p role="alert">{error}</p> : item === undefined ? <p role="status">경험을 불러오는 중…</p> : !item ? <div><h1>공개된 경험을 찾을 수 없어요</h1><p>비공개로 전환되었거나 삭제된 게시물입니다.</p></div> : <article>
      {user?.id === studentId && !editing && <button className="btn experience-edit-button" onClick={() => { setEditing(true); setSaved(false); }}>게시물 수정</button>}
      {saved && <p role="status" className="text-sm text-sky-700">변경사항을 저장했어요.</p>}
      {editing ? <ExperienceEditor key={`${studentId}:${id}`} item={item} onCancel={() => setEditing(false)} onSave={updated => { setItem(updated); setEditing(false); setSaved(true); }} /> : <>
      <p className="experience-kicker">{sample ? "SAMPLE EXPERIENCE" : item.category}</p>
      <h1>{item.title}</h1><p className="experience-byline">{name} · {item.category}{sample ? " · 첨부 이미지로 만든 예시" : ` · ${item.publishedAt.slice(0, 10)}`}</p>
      {item.coverUrl && <img className="experience-hero" src={item.coverUrl} alt={`${item.title} 대표 이미지`} />}
      <p className="experience-intro">{item.summary}</p>
      {experienceSections(item).map((section, i) => <section key={i}><h2>{section.title}</h2><p>{section.body || "아직 작성한 내용이 없어요."}</p></section>)}
      </>}
    </article>}
    <Link className="experience-back" href={user?.id === studentId ? "/me" : `/portfolio/gallery?s=${encodeURIComponent(studentId)}`}>← 프로필로 돌아가기</Link>
  </main></>;
}
