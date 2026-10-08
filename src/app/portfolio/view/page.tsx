"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import NotionPanel from "@/components/NotionPanel";
import { ErrorText, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { pageBlocks, pageFromBundle, type PortfolioPage } from "@/lib/portfolio/page";
import { templateFor } from "@/templates/portfolio";
import type { PortfolioContent } from "@/types";

/**
 * 포트폴리오 페이지. 고른 템플릿으로 화면 전체를 그린다.
 * 소유자: 같은 자리에서 '편집' → 저장하면 편집본 버전이 쌓인다. 디자인 바꾸기·Notion 내보내기는 메뉴에서.
 * 다른 사람: 피드에 공개된 작업만, 편집 없이 읽기 전용.
 * 의뢰인 평가 원문·검증·증빙·성과·프로젝트 정보는 어느 경우든 원본 그대로이고 고칠 수 없다.
 */
export default function PortfolioViewPage() {
  return <Suspense fallback={<TopBar title="포트폴리오" back />}><View /></Suspense>;
}

function View() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const { user, users } = useSession();
  const studentId = sp.get("s") ?? user?.id ?? "";
  const owner = !!user && studentId === user.id;
  const [page, setPage] = useState<PortfolioPage | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setPage(undefined); setError("");
    if (!id || !studentId || !user) return;
    const load = owner
      ? repo.getPortfolioDoc(id, studentId).then((d) => (d ? pageFromBundle(d.bundle, d.edit, studentId, users) : null))
      : repo.getPublicPortfolio(id, studentId).then((p) => p ?? null);
    load.then((p) => { if (active) setPage(p); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
    // users 는 목록이 바뀔 때마다 새 배열이라 의뢰인 이름만 다시 계산되게 길이만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, studentId, owner, user?.id, users.length, reloadKey]);

  if (error) return <><TopBar title="포트폴리오" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (page === undefined) return <><TopBar title="포트폴리오" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (page === null) return (
    <><TopBar title="포트폴리오" back />
      <div className="card mx-4 text-sm">
        {owner ? <>아직 저장한 포트폴리오가 없어요.<Link href={`/portfolio/build?id=${id}`} className="btn btn-primary mt-3 w-full">포트폴리오 만들기</Link></>
          : <>공개되지 않았거나 숨겨진 포트폴리오예요.<Link className="btn mt-3 w-full" href={`/portfolio/gallery?s=${encodeURIComponent(studentId)}`}>공개 갤러리 보기</Link></>}
      </div>
    </>
  );
  return <PortfolioScreen key={`${page.edit.id}:${owner}`} page={page} owner={owner} userId={user!.id} onSaved={() => setReloadKey((k) => k + 1)} openMenu={sp.has("notion")} />;
}

function PortfolioScreen({ page, owner, userId, onSaved, openMenu }: { page: PortfolioPage; owner: boolean; userId: string; onSaved: () => void; openMenu: boolean }) {
  const router = useRouter();
  const storeKey = `wolgye-pf-edit:${page.projectId}:${page.studentId}`;
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState<PortfolioContent>(page.edit.content);
  const [baseDraftId, setBaseDraftId] = useState(page.edit.draftId);
  const [restored, setRestored] = useState(false);
  const [menu, setMenu] = useState(owner && openMenu);
  const act = useAction();

  // 저장하지 않은 편집은 이 브라우저에만 임시 보관 (새로고침·뒤로 가기 대비)
  useEffect(() => {
    if (!owner) return;
    try {
      const s = localStorage.getItem(storeKey);
      if (!s) return;
      const d = JSON.parse(s);
      if (d.editId === page.edit.id && d.content) { setContent(d.content); setBaseDraftId(d.baseDraftId ?? page.edit.draftId); setEditing(true); setRestored(true); }
    } catch { /* 저장소를 못 쓰면 무시 */ }
  }, [owner, storeKey, page.edit.id, page.edit.draftId]);
  const update = (c: PortfolioContent, draftId = baseDraftId) => {
    setContent(c);
    try { localStorage.setItem(storeKey, JSON.stringify({ editId: page.edit.id, baseDraftId: draftId, content: c })); } catch { /* 무시 */ }
  };
  const discard = () => { try { localStorage.removeItem(storeKey); } catch { /* 무시 */ } setContent(page.edit.content); setBaseDraftId(page.edit.draftId); setEditing(false); setRestored(false); };

  async function save() {
    const saved = await act.run(() => repo.savePortfolioEdit(baseDraftId, userId, content));
    if (!saved) return;
    try { localStorage.removeItem(storeKey); } catch { /* 무시 */ }
    setEditing(false); setRestored(false); onSaved();
  }

  /** 소유자든 아니든 늘 바로 이전 페이지로. 주소로 바로 들어와 이전 페이지가 없을 때만 목록·갤러리로 */
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(owner ? "/portfolio" : `/portfolio/gallery?s=${encodeURIComponent(page.studentId)}`);
  };
  const blocks = useMemo(() => pageBlocks(page, content, editing), [page, content, editing]);
  const tpl = templateFor(content.templateId);
  const newerDraft = owner && page.latestDraft && page.latestDraft.createdAt > page.edit.createdAt && page.latestDraft.id !== baseDraftId ? page.latestDraft : undefined;

  return (
    <>
      {/* 포트폴리오만 보이게: 앱 상단바·버전 줄 없이 시작한다 (버전은 ⋯ 메뉴, 이동은 아래 메뉴) */}
      {owner && (restored || (newerDraft && !editing) || editing || act.error) && (
        <div className="flex flex-col gap-2 px-4 pb-2 pt-3">
          {restored && <p className="rounded-xl bg-[var(--primary-weak)] px-3 py-2 text-xs" role="status">저장하지 않은 편집 내용을 불러왔어요. <button className="font-semibold underline" onClick={discard}>버리기</button></p>}
          {newerDraft && !editing && (
            <div className="rounded-xl bg-yellow-50 px-3 py-2 text-xs">
              새 초안이 있어요. 지금 글은 그대로 두고, 원하면 새 초안으로 다시 시작할 수 있어요.
              <button className="ml-1 font-semibold underline" onClick={() => { setBaseDraftId(newerDraft.id); update({ ...newerDraft.content, templateId: content.templateId }, newerDraft.id); setEditing(true); }}>새 초안으로 편집 시작</button>
            </div>
          )}
          {editing && <p className="rounded-xl bg-[var(--line)] px-3 py-2 text-xs" role="status">편집 중이에요. 점선 칸을 눌러 바로 고치세요. 🔒 표시는 의뢰인 원본·프로젝트 기록이라 고칠 수 없어요.</p>}
          <ErrorText text={act.error} />
        </div>
      )}

      {/* 앱은 휴대폰 폭(480px) 틀 안에 있지만, 포트폴리오 템플릿은 화면 전체 폭을 쓴다 (PC 에서는 웹 포트폴리오처럼) */}
      <div className="pf-bleed"><tpl.Component page={page} content={content} blocks={blocks} editing={editing} onChange={(c) => update(c)} /></div>

      {owner && (
        <div className="pf-pill" role="group" aria-label="포트폴리오 메뉴">
          {editing ? (
            <>
              <button type="button" onClick={discard} disabled={act.busy}>취소</button>
              <button type="button" className="pf-pill-primary" onClick={save} disabled={act.busy}>{act.busy ? "저장 중…" : `v${page.edit.version + 1} 저장`}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={goBack}>‹ 뒤로</button>
              <button type="button" onClick={() => router.push(`/portfolio/templates?id=${page.projectId}`)}>디자인</button>
              <button type="button" onClick={() => setEditing(true)}>편집</button>
              <button type="button" aria-label="더보기" aria-expanded={menu} onClick={() => setMenu(true)}>⋯</button>
            </>
          )}
        </div>
      )}

      {!owner && (
        <div className="pf-pill" role="group" aria-label="포트폴리오 메뉴">
          <button type="button" onClick={goBack}>‹ 뒤로</button>
        </div>
      )}

      {owner && menu && (
        <div className="pf-sheet-backdrop" onClick={() => setMenu(false)}>
          <div className="pf-sheet" role="dialog" aria-label="더보기" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between"><h2 className="font-bold">더보기</h2><button className="sub text-sm" onClick={() => setMenu(false)}>닫기</button></div>
            <p className="sub mb-3 text-xs">{page.edit.createdAt.slice(0, 10)} 저장</p>
            <div className="flex flex-col gap-2">
              <Link className="btn btn-ghost w-full" href={`/portfolio/build?id=${page.projectId}`}>초안 다시 만들기</Link>
              <p className="mt-2 text-sm font-bold">Notion으로도 내보내기 <span className="sub text-xs font-normal">· 선택</span></p>
              <NotionPanel edit={page.edit} doc={pageBlocks(page)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
