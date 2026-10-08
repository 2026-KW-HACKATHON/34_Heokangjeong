"use client";
import { Suspense, useEffect, useRef, useState } from "react";
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
  const menu = useRef<HTMLDetailsElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  // "자세한 포트폴리오 보기"는 모든 게시물에 붙는다. HTML 포트폴리오(의뢰인 검증 포함)가 있으면 열고, 없으면 안내 창
  const [detailed, setDetailed] = useState<boolean | null>(null);   // null = 확인 중
  const [noPortfolio, setNoPortfolio] = useState(false);
  const sample = mode === "mock" && id.startsWith("demo-");
  useEffect(() => {
    let active = true; setItem(undefined); setError(""); setEditing(false); setSaved(false);
    Promise.all([repo.getUser(studentId), repo.listPublishedPortfolio(studentId, user?.id === studentId)]).then(([profile, rows]) => {
      if (active) { setName(profile?.name ?? ""); setItem(rows.find(row => row.sourceId === id && row.sourceKind === kind) ?? null); }
    }).catch(() => { if (active) setError("경험을 불러오지 못했어요. 다시 시도해 주세요."); });
    return () => { active = false; };
  }, [studentId, id, kind, sample, user?.id]);
  useEffect(() => {
    let active = true; setDetailed(null);
    if (kind === "project" && id && studentId && user) repo.getPublicPortfolio(id, studentId).then((p) => { if (active) setDetailed(!!p); }).catch(() => { if (active) setDetailed(false); });
    else setDetailed(false);   // 프로젝트가 아닌 게시물(직접 쓴 피드·활동 기록)은 HTML 포트폴리오가 없다
    return () => { active = false; };
  }, [kind, id, studentId, user]);
  return <><TopBar title="경험 포트폴리오" back /><main className="experience-page">
    {error ? <p role="alert">{error}</p> : item === undefined ? <p role="status">경험을 불러오는 중…</p> : !item ? <div><h1>공개된 경험을 찾을 수 없어요</h1><p>비공개로 전환되었거나 삭제된 게시물입니다.</p></div> : <article>
      {!editing && user?.id === studentId && <div className="experience-toolbar">
        <details className="experience-more" ref={menu}><summary aria-label="게시물 더보기">···</summary><div className="experience-more-menu"><button type="button" onClick={() => { menu.current?.removeAttribute("open"); setEditing(true); setSaved(false); }}>게시물 수정</button></div></details>
      </div>}
      {saved && <p role="status" className="text-sm text-sky-700">변경사항을 저장했어요.</p>}
      {editing ? <ExperienceEditor key={`${studentId}:${id}`} item={item} onCancel={() => setEditing(false)} onSave={updated => { setItem(updated); setEditing(false); setSaved(true); }} /> : <>
      <p className="experience-kicker">{sample ? "SAMPLE EXPERIENCE" : item.category}</p>
      <h1>{item.title}</h1><p className="experience-byline">{name} · {item.category}{sample ? " · 첨부 이미지로 만든 예시" : ` · ${item.publishedAt.slice(0, 10)}`}</p>
      {item.coverUrl && <img className="experience-hero" src={item.coverUrl} alt={`${item.title} 대표 이미지`} />}
      <p className="experience-intro">{item.summary}</p>
      {item.sourceKind === "manual" ? <>
        {item.sections.map((section, i) => <section key={i}><h2>{section.title}</h2><p>{section.body}</p></section>)}
        {!!item.imageUrls?.length && <section className="experience-photos" aria-label="게시물 사진">{item.imageUrls.filter(url => url !== item.coverUrl).map((url, i) => <img key={`${url}:${i}`} src={url} alt={`${item.title} 사진 ${i + 2}`} loading="lazy" />)}</section>}
      </> : experienceSections(item).map((section, i) => <section key={i}><h2>{section.title}</h2><p>{section.body || "아직 작성한 내용이 없어요."}</p></section>)}
      <section className="experience-detail-cta">
        <h2>더 자세히 보고 싶다면</h2>
        <p>문제·결정·과정·결과를 정리한 포트폴리오 페이지예요. 의뢰인 평가 원문과 검증 결과, 증빙이 함께 들어 있어요.</p>
        {detailed
          ? <Link data-demo-tour="portfolio-detail" className="btn btn-primary w-full" href={`/portfolio/view?id=${encodeURIComponent(id)}&s=${encodeURIComponent(studentId)}`}>자세한 포트폴리오 보기</Link>
          : <button type="button" className="btn btn-primary w-full disabled:opacity-50" disabled={detailed === null} onClick={() => setNoPortfolio(true)}>자세한 포트폴리오 보기</button>}
      </section>
      </>}
    </article>}
    {noPortfolio && (
      <div className="pf-dialog-backdrop" onClick={() => setNoPortfolio(false)}>
        <div className="pf-dialog" role="alertdialog" aria-labelledby="no-pf-title" onClick={(e) => e.stopPropagation()}>
          <h2 id="no-pf-title" className="text-base font-bold">등록된 포트폴리오가 없어요</h2>
          <p className="sub mt-2 text-sm">{user?.id === studentId
            ? "이 게시물에는 아직 HTML 포트폴리오가 없어요. 의뢰받은 프로젝트를 완료하고 포트폴리오를 만들면 여기서 열 수 있어요."
            : "이 게시물에는 등록된 HTML 포트폴리오가 없어요."}</p>
          <button type="button" autoFocus className="btn btn-primary mt-4 w-full" onClick={() => setNoPortfolio(false)}>확인</button>
        </div>
      </div>
    )}
    <Link className="experience-back" href={user?.id === studentId ? "/me" : `/portfolio/gallery?s=${encodeURIComponent(studentId)}`}>← 프로필로 돌아가기</Link>
  </main></>;
}
