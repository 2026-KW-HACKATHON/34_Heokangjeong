"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

export default function TopBar({ title, back, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-[900] flex h-16 items-center justify-between bg-[#f5f5f7]/95 px-5 backdrop-blur">
      <div className="flex items-center gap-2">
        {back && <button onClick={() => router.back()} aria-label="뒤로" className="icon-button -ml-3"><Icon name="back" /></button>}
        <h1 className="text-lg font-bold">{title}</h1>
      </div>
      <div className="flex items-center gap-3 text-sm">{right ?? <Link href="/notifications" aria-label="알림" className="icon-button"><Icon name="bell" /></Link>}</div>
    </header>
  );
}
