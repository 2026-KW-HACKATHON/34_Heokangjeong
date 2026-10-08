"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import BrandLogo from "./BrandLogo";
import LogoCompanion from "./home/LogoCompanion";
import { useSession } from "@/lib/session";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";

export default function TopBar({ title, back, right, brand = false, monochrome = false }: { title: string; back?: boolean; right?: React.ReactNode; brand?: boolean; monochrome?: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const unreadNotifications = useUnreadNotifications(user?.id);
  const path = usePathname() ?? "/";
  const showCreate = (path === "/" || path === "/me") && user?.role !== "admin";
  const showSearch = ["/", "/me"].includes(path.replace(/(.)\/$/, "$1"));   // 프로필 검색 (이름·닉네임·학과)
  return (
    <header className={`${brand ? "home-topbar " : ""}${monochrome ? "home-topbar-monochrome " : ""}sticky top-0 z-[900] flex h-16 items-center justify-between bg-[#f5f5f7]/95 px-5 backdrop-blur`}>
      <div className={`flex items-center gap-2 ${brand ? "brand-with-companion" : ""}`}>
        {back && <button onClick={() => router.back()} aria-label="뒤로" className="icon-button -ml-3"><Icon name="back" /></button>}
        <h1 className="text-lg font-bold">{brand ? <Link href="/" aria-label="WOLINK 재능 나눔 홈">{monochrome ? <span className="text-xl font-extrabold tracking-tight">WOLINK</span> : <BrandLogo />}</Link> : title}</h1>
        {brand && !monochrome && <LogoCompanion />}
      </div>
      <div className="flex shrink-0 items-center gap-1 text-sm">{right ?? <>{showSearch && <Link href="/profiles/search" aria-label="프로필 검색" title="프로필 검색" className="icon-button"><Icon name="search" /></Link>}{showCreate && <Link href="/posts/new" aria-label="공고 등록" title="공고 등록" className="icon-button"><Icon name="plus" /></Link>}<Link href="/notifications" aria-label={unreadNotifications ? `읽지 않은 알림 ${unreadNotifications}개` : "알림"} className="icon-button relative"><Icon name="bell" />{unreadNotifications > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</Link></>}</div>
    </header>
  );
}
