"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import ChatAgreement from "@/components/ChatAgreement";
import Avatar from "@/components/Avatar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { Application, ChatMessage, Post } from "@/types";

/** 채팅방 (/chats/room?id=지원서id). 정적 export 호환을 위해 쿼리로 받는다. */
export default function ChatRoomPage() {
  return <Suspense fallback={<TopBar title="채팅" back />}><Room /></Suspense>;
}

function Room() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const autoOpenAgreement = params.get("agreement") === "1";
  const { user, users } = useSession();
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>();
  const [projectStatus, setProjectStatus] = useState<string | undefined>();   // 계약서 수정 제안은 끝나지 않은(완료·취소 아닌) 프로젝트에서만
  const [toolsOpen, setToolsOpen] = useState(false);
  const [agreementRequest, setAgreementRequest] = useState(0);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update(); viewport.addEventListener("resize", update); viewport.addEventListener("scroll", update);
    return () => { viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update); };
  }, []);
  const bottom = useRef<HTMLDivElement>(null);
  /** 지원서 다시 읽기 (선정·선정 취소·계약서 확정 뒤) */
  const reloadApp = () => repo.getApplication(id).then(async (a) => {
    setApp(a ?? null);
    if (a?.status === "accepted") { const pr = await repo.getProjectByPost(a.postId); setProjectId(pr?.id); setProjectStatus(pr?.status); }
  });

  useEffect(() => {
    let active = true;
    repo.getApplication(id).then(async (a) => {
      if (!active) return;
      setApp(a ?? null);
      if (!a) return setPost(null);
      const p = await repo.getPost(a.postId);
      if (active) setPost(p ?? null);
      if (active && a.status === "accepted") { const pr = await repo.getProjectByPost(a.postId); if (active) { setProjectId(pr?.id); setProjectStatus(pr?.status); } }
    }).catch(() => { if (active) { setApp(null); setPost(null); } });
    repo.listMessages(id).then((value) => { if (active) setMsgs(value); }).catch(() => { if (active) setMsgs([]); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!user || !app || !post || (user.id !== app.studentId && user.id !== post.authorId)) return;
    // 새 메시지: 내가 보낸 것도 구독으로 한 번 더 올 수 있어 id 로 중복 제거
    return repo.onMessage(id, (m) => setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])));
  }, [id, user, app, post]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  useEffect(() => {
    if (!user || !app || !post || (user.id !== app.studentId && user.id !== post.authorId)) return;
    const mark = () => {
      if (document.visibilityState === "visible") void repo.markChatRead(user.id, id, msgs.filter(m => m.applicationId === id && m.senderId !== user.id).map(m => m.id));
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [user, app, post, id, msgs]);

  async function act(f: () => Promise<unknown>) {
    setBusy(true); setNotice("");
    try { await f(); await reloadApp(); } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); }
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user || !canChat || busy) return;
    setBusy(true); setNotice("");
    try {
      const m = await repo.sendMessage(id, user.id, body);
      setText("");
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e) { setNotice((e as Error).message); }
    finally { setBusy(false); }
  }

  const otherId = app && post ? (user?.id === app.studentId ? post.authorId : app.studentId) : null;
  const isOwner = !!user && !!post && user.id === post.authorId;
  const chatOpen = !!app && app.status === "pending" && !!app.shortlistedAt;   // 매칭 대기
  const canChat = !!user && !!app && !!post && (user.id === app.studentId || user.id === post.authorId) && (app.status === "accepted" || app.status === "pending");
  const other = users.find((u) => u.id === otherId);
  const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });

  if (app === undefined || post === undefined) {
    return <><TopBar title="채팅" back /><p className="sub p-6 text-center text-sm">채팅방을 불러오는 중…</p></>;
  }
  if (!app || !post) {
    return <><TopBar title="채팅" back /><p className="card mx-4 text-sm">이 채팅방을 찾을 수 없거나 볼 권한이 없어요.</p></>;
  }
  if (user && app && post && user.id !== app.studentId && user.id !== post.authorId) {
    return <><TopBar title="채팅" back /><p className="card mx-4 text-sm">이 채팅방은 공고 작성자와 지원자만 볼 수 있어요.</p></>;
  }

  return (
    <>
      <TopBar title={other?.name ?? "채팅"} back />
      {/* 선정 → 대화·계약서(매칭 대기) → 계약서 확정 = 선정 확정. 틀어지면 선정 취소 */}
      <div className="mx-4 mb-2 rounded-xl bg-white px-3 py-2 text-sm">
        {app.status === "accepted" ? <p className="flex items-center justify-between gap-2"><span className="font-semibold text-[var(--green)]">선정 확정 · 계약서 확정됨</span>{projectId && <Link href={`/projects/detail?id=${projectId}`} className="shrink-0 text-xs font-semibold underline">프로젝트 보기 ›</Link>}</p>
        : app.status === "rejected" ? <p className="sub">이번에는 함께하지 않기로 했어요.</p>
        : chatOpen ? <div className="flex items-center justify-between gap-2"><span><b>매칭 대기</b><span className="sub"> · 계약서를 양쪽이 확정하면 선정이 확정돼요</span></span>
            <button type="button" disabled={busy} onClick={() => act(() => repo.cancelShortlist(app.id, user!.id))} className="shrink-0 text-xs font-semibold underline disabled:opacity-40">선정 취소</button></div>
        : isOwner ? <div className="flex items-center justify-between gap-2"><span className="sub">{app.shortlistCancelledAt ? "선정이 취소됐어요. 채팅은 계속할 수 있고, 다시 선정하면 계약서를 작성할 수 있어요." : "지금 대화할 수 있어요. 선정하면 계약서를 작성할 수 있어요."}</span>
            <button type="button" disabled={busy} onClick={() => act(() => repo.shortlistApplicant(app.id, user!.id))} className="btn btn-primary shrink-0 px-3 py-1.5 text-xs disabled:opacity-40">선정</button></div>
        : <p className="sub">{app.shortlistCancelledAt ? "선정이 취소됐어요. 채팅은 계속할 수 있어요." : "지금 사장님과 대화할 수 있어요. 선정되면 계약서를 작성할 수 있어요."}</p>}
        {notice && <p role="alert" className="mt-1 text-xs text-[var(--red)]">{notice}</p>}
      </div>
      {user && (chatOpen || app.status === "accepted") && <ChatAgreement key={`${app.id}:${user.id}`} application={app} post={post} actorId={user.id} studentName={users.find(u=>u.id===app.studentId)?.name ?? "작업자"} ownerName={users.find(u=>u.id===post.authorId)?.name ?? "의뢰인"} onChange={reloadApp} autoOpen={autoOpenAgreement} openRequest={agreementRequest} canPropose={!!projectStatus && projectStatus !== "COMPLETED" && projectStatus !== "CANCELLED"} />}
      {post && (
        <Link href={`/posts/detail?id=${post.id}`} className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
          <span className="truncate">{post.title}</span><span className="sub shrink-0">공고 보기 ›</span>
        </Link>
      )}
      <section style={{ paddingBottom: keyboardInset + 80 }} className="flex flex-col gap-2 px-4">
        {app && <p className="sub rounded-xl bg-[var(--line)] p-3 text-xs">지원 메시지: &ldquo;{app.message}&rdquo;</p>}
        {msgs.map((m, i) => {
          const mine = m.senderId === user?.id;
          const bubble = (
            <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
              <p className={`whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] ${mine ? "max-w-[75%] bg-[var(--primary)] text-white" : "bg-white"}`}>{m.body}</p>
              <span className="sub shrink-0 text-[10px]">{time(m.createdAt)}</span>
            </div>
          );
          if (mine) return <div key={m.id}>{bubble}</div>;
          // 카카오톡처럼 상대가 연달아 보낸 메시지는 첫 줄에만 사진과 이름을 단다. 누르면 그 사람 프로필로 간다
          const sender = users.find((u) => u.id === m.senderId);
          const first = msgs[i - 1]?.senderId !== m.senderId;
          const profile = `/profiles/view?id=${m.senderId}`;
          return (
            <div key={m.id} className={`flex items-start gap-2 ${first ? "mt-1" : ""}`}>
              {first ? <Link href={profile} aria-label={`${sender?.name ?? "상대방"} 프로필 보기`}><Avatar user={sender} /></Link> : <span className="w-9 shrink-0" />}
              <div className="flex min-w-0 max-w-[78%] flex-col items-start">
                {first && <Link href={profile} className="sub mb-1 text-xs">{sender?.name ?? "상대방"}</Link>}
                {bubble}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </section>
      <form onSubmit={send} style={{ bottom: keyboardInset }} className="fixed bottom-0 left-1/2 z-[1001] pb-[env(safe-area-inset-bottom)] flex w-full max-w-[480px] -translate-x-1/2 gap-2 border-t border-[var(--line)] bg-white p-2">
        <div className="relative flex items-center">
          <button type="button" aria-label="채팅 도구" aria-expanded={toolsOpen} onClick={() => setToolsOpen(v => !v)} className="h-11 w-11 shrink-0 rounded-full bg-[var(--line)] text-2xl">+</button>
          {toolsOpen && <div className="absolute bottom-full left-0 mb-3 w-60 rounded-2xl border bg-white p-3 shadow-lg">
            <button type="button" disabled={!chatOpen && app.status !== "accepted"} onClick={() => { setToolsOpen(false); setAgreementRequest(v => v + 1); }} className="btn btn-ghost w-full disabled:opacity-40">계약서 작성하기</button>
            {!chatOpen && app.status !== "accepted" && <p className="sub mt-2 text-xs">사장님이 선정하면 계약서를 작성할 수 있어요.</p>}
          </div>}
        </div>
        <input aria-label="메시지" onFocus={() => setToolsOpen(false)} value={text} onChange={(e) => setText(e.target.value)} disabled={!canChat} placeholder={canChat ? "메시지 보내기" : "종료된 지원은 메시지를 보낼 수 없어요"} className="min-w-0 flex-1 rounded-full bg-[var(--line)] px-4 py-2.5 text-base outline-none disabled:opacity-60" />
        <button disabled={busy || !canChat || !text.trim()} className="btn btn-primary rounded-full px-4 py-2.5 disabled:opacity-40">전송</button>
      </form>
    </>
  );
}
