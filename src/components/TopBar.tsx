"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChatAlerts } from "@/lib/chat-alerts";

export default function TopBar({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const router = useRouter();
  const { hasUnreadChat } = useChatAlerts();
  return (
    <header className="sticky top-0 z-[900] flex h-14 items-center justify-between bg-[var(--bg)]/95 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        {back && <button onClick={() => router.back()} aria-label="뒤로" className="-ml-1 p-1 text-xl">‹</button>}
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      <div className="flex items-center gap-3 text-sm">{right ?? <Link href="/notifications" aria-label={hasUnreadChat ? "알림, 읽지 않은 채팅 있음" : "알림"} className="relative text-xl">
        🔔
        {hasUnreadChat && <span className="absolute -right-1.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-[var(--bg)]" />}
      </Link>}</div>
    </header>
  );
}
