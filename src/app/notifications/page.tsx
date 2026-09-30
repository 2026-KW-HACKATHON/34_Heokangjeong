"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { Notification } from "@/types";
import { NOTIFICATION_READ_EVENT } from "@/lib/useUnreadNotifications";

/** ⑥ 알림: 관심 분야·거리에 맞는 새 공고, 내 공고의 지원자. 푸시 연동은 TODO. */
export default function Notifications() {
  const { user } = useSession();
  const [list, setList] = useState<Notification[]>([]);
  useEffect(() => {
    let active = true;
    if (!user) return;
    repo.listNotifications(user.id).then((items) => { if (active) setList(items); });
    const off = repo.onNotification(user.id, (notification) => setList((items) => items.some((item) => item.id === notification.id) ? items : [notification, ...items]));
    return () => { active = false; off(); };
  }, [user]);
  const open = (notification: Notification) => {
    if (!user || notification.read) return;
    setList((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    repo.markNotificationRead(notification.id, user.id).then(() => window.dispatchEvent(new Event(NOTIFICATION_READ_EVENT))).catch(() => {});
  };
  return (
    <>
      <TopBar title="알림" back right={<span />} />
      <section className="flex flex-col gap-2 px-4">
        {list.length === 0 && <EmptyState text="새 알림이 없어요" />}
        {list.map((n) => (
          <Link key={n.id} href={n.href ?? (n.postId ? `/posts/detail?id=${n.postId}` : "#")} onClick={() => open(n)} className={`card relative ${n.read ? "opacity-70" : ""}`}>
            {!n.read && <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-[#f97316]" aria-label="읽지 않음" />}
            {n.distanceM !== undefined && <p className="text-xs font-semibold text-[var(--primary)]">📍 {n.distanceM}m 거리</p>}
            <p className="mt-0.5 text-[15px]">{n.text}</p>
            <p className="sub mt-1 text-xs">{new Date(n.createdAt).toLocaleString("ko-KR")}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
