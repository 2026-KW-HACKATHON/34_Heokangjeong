"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";
import { useSession } from "@/lib/session";
import { useUnreadChats } from "@/lib/useUnreadChats";

const tabs = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/map", label: "지도", icon: "map" },
  { href: "/portfolio", label: "포트폴리오", icon: "folder" },
  { href: "/chats", label: "채팅", icon: "chat" },
  { href: "/ranking", label: "랭킹", icon: "trophy" },
  { href: "/me", label: "나", icon: "user" },
];

export default function BottomTab() {
  const path = usePathname() ?? "/";
  const { user } = useSession();
  const unread = useUnreadChats(user?.id);
  if (path.startsWith("/login") || path.startsWith("/onboarding")) return null;
  if (["/projects/log", "/projects/evidence", "/projects/submit", "/projects/review", "/projects/outcome", "/portfolio/build"].some(p => path.startsWith(p))) return null;
  return (
    <nav aria-label="주 메뉴" className="glass-nav fixed bottom-0 left-1/2 z-[1000] w-full max-w-[480px] -translate-x-1/2 border-t border-[var(--line)] pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {tabs.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
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
