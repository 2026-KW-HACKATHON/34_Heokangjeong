"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";
import { useSession } from "@/lib/session";
import { useUnreadChats } from "@/lib/useUnreadChats";

const tabs = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/map", label: "지도", icon: "map" },
  { href: "/chats", label: "채팅", icon: "chat" },
  { href: "/activity", label: "기록", icon: "folder" },
  { href: "/me", label: "나", icon: "user" },
];

// 관리자는 채팅·랭킹 대신 관리 업무만 본다 (심사·단체·운영 현황)
const adminTabs = [
  { href: "/admin", label: "심사", icon: "folder" },
  { href: "/clubs", label: "단체", icon: "user" },
  { href: "/", label: "공고", icon: "home" },
  { href: "/map", label: "지도", icon: "map" },
  { href: "/me", label: "나", icon: "user" },
];

export default function BottomTab() {
  const path = usePathname() ?? "/";
  const { user } = useSession();
  const isAdmin = user?.role === "admin";
  const list = isAdmin ? adminTabs : tabs;
  const unread = useUnreadChats(isAdmin ? undefined : user?.id);
  if (path.startsWith("/login") || path.startsWith("/onboarding")) return null;
  if (["/projects/log", "/projects/evidence", "/projects/submit", "/projects/review", "/projects/outcome", "/portfolio/build"].some(p => path.startsWith(p))) return null;
  return (
    <nav aria-label="주 메뉴" className="glass-nav bottom-tab-bar fixed left-1/2 z-[1000] -translate-x-1/2">
      <ul className="flex">
        {list.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={`${t.href}${t.label}`} className="flex-1">
              <Link href={t.href} aria-current={on ? "page" : undefined} className={`flex min-h-[68px] flex-col items-center gap-1 py-2 text-[11px] ${on ? "text-[var(--primary)] font-semibold" : "text-[var(--sub)]"}`}>
                <span className={`relative rounded-xl px-3 py-1 ${on ? "bg-[var(--primary-weak)]" : ""}`}><Icon name={t.icon as IconName} width={21} height={21} />{t.href === "/chats" && unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white"><span aria-hidden="true">{unread > 99 ? "99+" : unread}</span><span className="sr-only">읽지 않은 메시지 {unread}개</span></span>}</span>{t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
