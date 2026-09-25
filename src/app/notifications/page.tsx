"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { Notification } from "@/types";
import { useChatAlerts } from "@/lib/chat-alerts";

/** ⑥ 알림: 관심 분야·거리에 맞는 새 공고, 내 공고의 지원자. 푸시 연동은 TODO. */
export default function Notifications() {
  const { user } = useSession();
  const { unreadChats } = useChatAlerts();
  const [list, setList] = useState<Notification[]>([]);
  useEffect(() => { if (user) repo.listNotifications(user.id).then(setList); }, [user]);
  return (
    <>
      <TopBar title="알림" back right={<span />} />
      <section className="flex flex-col gap-2 px-4">
        {list.length === 0 && unreadChats.length === 0 && <EmptyState text="새 알림이 없어요" />}
        {unreadChats.map((room) => (
          <Link key={`chat-${room.application.id}`} href={`/chats/room?id=${room.application.id}`} className="card flex items-center gap-3 border border-orange-200 bg-orange-50 active:opacity-80">
            <span className="relative text-2xl" aria-hidden>💬<span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-orange-50" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><b className="truncate">{room.other?.name ?? "새 채팅"}</b><span className="shrink-0 text-xs font-semibold text-orange-600">새 메시지</span></div>
              <p className="sub truncate text-xs">{room.post.title}</p>
              <p className="mt-0.5 truncate text-sm">{room.last?.body ?? "새 메시지가 도착했어요"}</p>
            </div>
            <span className="text-xl text-orange-500" aria-hidden>›</span>
          </Link>
        ))}
        {list.map((n) => (
          <Link key={n.id} href={n.postId ? `/posts/detail?id=${n.postId}` : "#"} className={`card ${n.read ? "opacity-70" : ""}`}>
            {n.distanceM !== undefined && <p className="text-xs font-semibold text-[var(--primary)]">📍 {n.distanceM}m 거리</p>}
            <p className="mt-0.5 text-[15px]">{n.text}</p>
            <p className="sub mt-1 text-xs">{new Date(n.createdAt).toLocaleString("ko-KR")}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
