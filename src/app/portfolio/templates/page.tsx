"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { pageBlocks, pageFromBundle, type PortfolioPage } from "@/lib/portfolio/page";
import { TEMPLATES } from "@/templates/portfolio";
import { templateIdOf } from "@/templates/portfolio/meta";

/**
 * 템플릿 고르기: 미리캔버스처럼 옆으로 넘겨 보며 고른다. 미리보기는 견본이 아니라 내 포트폴리오 내용이다.
 * 고르면 글은 그대로 두고 템플릿만 바꾼 편집본 버전을 저장한다 (언제든 다시 바꿀 수 있다).
 */
export default function TemplatesPage() {
  return <Suspense fallback={<TopBar title="디자인 고르기" back />}><Picker /></Suspense>;
}

function Picker() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const first = sp.get("first") === "1";
  const router = useRouter();
  const { user, users } = useSession();
  const [page, setPage] = useState<PortfolioPage | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const selectedIndex = useRef(0);
  const moving = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(settleTimer.current), []);
  const act = useAction();

  useEffect(() => {
    let active = true;
    if (!id || !user) return;
    repo.getPortfolioDoc(id, user.id)
      .then((d) => { if (active) setPage(d ? pageFromBundle(d.bundle, d.edit, user.id, users) : null); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id, users.length]);

  const current = page ? templateIdOf(page.edit.content.templateId) : undefined;
  // 처음 열면 지금 쓰는 템플릿 자리로
  useEffect(() => {
    if (!current) return;
    const i = TEMPLATES.findIndex((t) => t.id === current);
    selectedIndex.current = i;
    setIndex(i);
    const el = strip.current;
    const child = el?.children[i];
    if (el && child) {
      const parentRect = el.getBoundingClientRect(), childRect = child.getBoundingClientRect();
      el.scrollTo({left: el.scrollLeft + childRect.left + childRect.width / 2 - parentRect.left - parentRect.width / 2, behavior: "instant"});
    }
  }, [current]);
  const blocks = useMemo(() => (page ? pageBlocks(page) : []), [page]);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(TEMPLATES.length - 1, i));
    selectedIndex.current = n;
    moving.current = true;
    setIndex(n);
    const el = strip.current, child = el?.children[n];
    if (el && child) {
      const parentRect = el.getBoundingClientRect(), childRect = child.getBoundingClientRect();
      el.scrollTo({left: el.scrollLeft + childRect.left + childRect.width / 2 - parentRect.left - parentRect.width / 2, behavior: "smooth"});
    }
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { moving.current = false; }, 700);
  };
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    let best = 0, dist = Infinity;
    Array.from(el.children).forEach((c, i) => { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (!moving.current) { selectedIndex.current = best; setIndex(best); }
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { moving.current = false; selectedIndex.current = best; setIndex(best); }, 150);
  };

  async function choose() {
    if (!page || !user) return;
    const tpl = TEMPLATES[index];
    if (tpl.id === current) { router.push(`/portfolio/view?id=${id}&s=${user.id}`); return; }
    const saved = await act.run(() => repo.savePortfolioEdit(page.edit.draftId, user.id, { ...page.edit.content, templateId: tpl.id }));
    if (saved) router.push(`/portfolio/view?id=${id}&s=${user.id}`);
  }

  if (error) return <><TopBar title="디자인 고르기" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (page === undefined) return <><TopBar title="디자인 고르기" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (page === null) return <><TopBar title="디자인 고르기" back /><p className="card mx-4 text-sm">먼저 포트폴리오를 저장해 주세요.</p></>;
  const sel = TEMPLATES[index];

  return (
    <>
      <TopBar title="디자인 고르기" back />
      <section className="flex flex-col gap-3 pb-28">
        <div className="px-4">
          <p className="text-lg font-bold">{first ? "포트폴리오 디자인을 골라 주세요" : "디자인 바꾸기"}</p>
          <p className="sub mt-1 text-sm">옆으로 넘겨 보세요. 어떤 디자인이든 내용은 모두 그대로 들어가고, 나중에 언제든 바꿀 수 있어요.</p>
        </div>
        <div ref={strip} className="pf-picker" onScroll={onScroll} onPointerDown={() => { moving.current = false; }} onWheel={() => { moving.current = false; }} role="listbox" aria-label="템플릿">
          {TEMPLATES.map((t, i) => (
            <div key={t.id} className="pf-slide" role="option" aria-selected={i === index} aria-current={t.id === current} aria-label={t.name} onClick={() => go(i)}>
              <div className="pf-preview" aria-hidden="true">
                <div className="pf-preview-inner"><t.Component page={page} content={page.edit.content} blocks={blocks} editing={false} onChange={() => {}} /></div>
              </div>
              <p className="mt-2 font-bold">{t.name}{t.id === current && <span className="sub ml-2 text-xs font-normal">· 지금 쓰는 디자인</span>}</p>
              <p className="sub text-xs">{t.description}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button type="button" aria-label="이전 디자인" className="chip" onClick={() => go(selectedIndex.current - 1)} disabled={index === 0}>‹</button>
          {TEMPLATES.map((t, i) => <span key={t.id} className={`h-2 w-2 rounded-full ${i === index ? "bg-[var(--primary)]" : "bg-[var(--line)]"}`} />)}
          <button type="button" aria-label="다음 디자인" className="chip" onClick={() => go(selectedIndex.current + 1)} disabled={index === TEMPLATES.length - 1}>›</button>
        </div>
        <div className="px-4">
          <ErrorText text={act.error} />
          <button type="button" disabled={act.busy} onClick={choose} className="btn btn-primary w-full disabled:opacity-50">
            {act.busy ? "저장 중…" : sel.id === current && !first ? "지금 디자인 그대로 두기" : `‘${sel.name}’ 디자인 쓰기`}
          </button>
        </div>
      </section>
    </>
  );
}
