"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/map", label: "지도", icon: "🗺️" },
  { href: "/posts/new", label: "등록", icon: "➕" },
  { href: "/projects", label: "프로젝트", icon: "🧩" },
  { href: "/chats", label: "채팅", icon: "💬" },
  { href: "/me", label: "나", icon: "👤" },
];

export default function BottomTab() {
  const path = usePathname() ?? "/";
  // 로그인·온보딩, 그리고 질문 화면(하단 버튼이 키보드 위에 붙어야 함)에서는 숨긴다
  if (path.startsWith("/login") || path.startsWith("/onboarding") || path.startsWith("/projects/log")) return null;
  return (
    <nav className="fixed bottom-0 left-1/2 z-[1000] w-full max-w-[480px] -translate-x-1/2 border-t border-[var(--line)] bg-white/95 backdrop-blur">
      <ul className="flex">
        {tabs.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${on ? "text-[var(--primary)] font-semibold" : "text-[var(--sub)]"}`}>
                <span className="text-xl leading-none">{t.icon}</span>{t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
