"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import ChatAgreement from "@/components/ChatAgreement";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { Application, ChatMessage, Post } from "@/types";

/** 채팅방 (/chats/room?id=지원서id). 정적 export 호환을 위해 쿼리로 받는다. */
export default function ChatRoomPage() {
  return <Suspense fallback={<TopBar title="채팅" back />}><Room /></Suspense>;
}

function Room() {
  const id = useSearchParams().get("id") ?? "";
  const { user, users } = useSession();
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    repo.getApplication(id).then(async (a) => {
      if (!active) return;
      setApp(a ?? null);
      if (!a) return setPost(null);
      const p = await repo.getPost(a.postId);
      if (active) setPost(p ?? null);
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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user) return;
    setText("");
    const m = await repo.sendMessage(id, user.id, body);
    setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  const otherId = app && post ? (user?.id === app.studentId ? post.authorId : app.studentId) : null;
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
      {user && <ChatAgreement key={`${app.id}:${user.id}`} application={app} post={post} actorId={user.id} studentName={users.find(u=>u.id===app.studentId)?.name ?? "작업자"} ownerName={users.find(u=>u.id===post.authorId)?.name ?? "의뢰인"} />}
      {post && (
        <Link href={`/posts/detail?id=${post.id}`} className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
          <span className="truncate">{post.title}</span><span className="sub shrink-0">공고 보기 ›</span>
        </Link>
      )}
      <section className="flex flex-col gap-2 px-4 pb-[calc(var(--bottom-tab-h)+72px)]">
        {app && <p className="sub rounded-xl bg-[var(--line)] p-3 text-xs">지원 메시지: &ldquo;{app.message}&rdquo;</p>}
        {msgs.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
              <p className={`max-w-[75%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] ${mine ? "bg-[var(--primary)] text-white" : "bg-white"}`}>{m.body}</p>
              <span className="sub shrink-0 text-[10px]">{time(m.createdAt)}</span>
            </div>
          );
        })}
        <div ref={bottom} />
      </section>
      <form onSubmit={send} className="fixed bottom-[var(--bottom-tab-h)] left-1/2 z-[1001] flex w-full max-w-[480px] -translate-x-1/2 gap-2 border-t border-[var(--line)] bg-white p-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="메시지 보내기" className="flex-1 rounded-full bg-[var(--line)] px-4 py-2.5 text-[15px] outline-none" />
        <button disabled={!text.trim()} className="btn btn-primary rounded-full px-4 py-2.5 disabled:opacity-40">전송</button>
      </form>
    </>
  );
}
