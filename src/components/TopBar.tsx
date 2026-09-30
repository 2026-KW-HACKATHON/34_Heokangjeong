"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Icon from "./Icon";
import BrandLogo from "./BrandLogo";
import { useSession } from "@/lib/session";
import { useUnreadNotifications } from "@/lib/useUnreadNotifications";

export default function TopBar({ title, back, right, brand = false }: { title: string; back?: boolean; right?: React.ReactNode; brand?: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const unreadNotifications = useUnreadNotifications(user?.id);
  const path = usePathname() ?? "/";
  const showCreate = path === "/" || path === "/me";
  return (
    <header className="sticky top-0 z-[900] flex h-16 items-center justify-between bg-[#f5f5f7]/95 px-5 backdrop-blur">
      <div className="flex items-center gap-2">
        {back && <button onClick={() => router.back()} aria-label="뒤로" className="icon-button -ml-3"><Icon name="back" /></button>}
        <h1 className="text-lg font-bold">{brand ? <Link href="/" aria-label="월계 재능나눔 홈"><BrandLogo /></Link> : title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-sm">{right ?? <>{showCreate && <Link href="/posts/new" aria-label="공고 등록" title="공고 등록" className="icon-button"><Icon name="plus" /></Link>}<Link href="/notifications" aria-label={unreadNotifications ? `읽지 않은 알림 ${unreadNotifications}개` : "알림"} className="icon-button relative"><Icon name="bell" />{unreadNotifications > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-[#f97316] px-1 text-center text-[10px] font-bold leading-4 text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</Link></>}</div>
    </header>
  );
}
