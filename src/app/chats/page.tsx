"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { useUnreadChatCounts } from "@/lib/useUnreadChats";
import type { ChatRoom } from "@/types";

const STATUS = { accepted: "매칭됨", rejected: "거절됨" } as const;

/** 채팅 목록: 내가 지원했거나, 내 공고에 들어온 지원서마다 채팅방 하나 */
export default function Chats() {
  const { user } = useSession();
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const unreadCounts = useUnreadChatCounts(user?.id);
  useEffect(() => { if (user) repo.listChatRooms(user.id).then(setRooms); }, [user]);

  return (
    <>
      <TopBar title="채팅" />
      <section className="flex flex-col gap-2 px-4">
        {rooms === null && <p className="sub p-6 text-center text-sm">불러오는 중…</p>}
        {rooms?.length === 0 && <EmptyState text={user?.role === "student" ? "공고에 지원하면 가게와 채팅할 수 있어요" : "내 공고에 지원이 오면 여기서 채팅할 수 있어요"} />}
        {rooms?.map((r) => (
          <Link key={r.application.id} href={`/chats/room?id=${r.application.id}`} className="card flex flex-col gap-1 active:opacity-80">
            <div className="flex items-center justify-between">
              <b>{r.other?.name ?? "알 수 없음"}</b>
              {(unreadCounts[r.application.id] ?? 0) > 0 ? (
                <span className="min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white" aria-label={`읽지 않은 메시지 ${unreadCounts[r.application.id]}개`}>
                  {unreadCounts[r.application.id] > 99 ? "99+" : unreadCounts[r.application.id]}
                </span>
              ) : r.application.status !== "pending" ? (
                <span className={`chip ${r.application.status === "accepted" ? "chip-on" : ""}`}>{STATUS[r.application.status]}</span>
              ) : null}
            </div>
            <p className="sub truncate text-xs">{r.post.title}</p>
            <p className="truncate text-sm">{r.last?.body ?? r.application.message}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
