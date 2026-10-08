"use client";
import { Suspense, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import PortfolioProfileHeader from "@/components/PortfolioProfileHeader";
import PortfolioFeed from "@/components/PortfolioFeed";
import { repo } from "@/lib/repo";
import type { PublishedPortfolio, User } from "@/types";

export default function ProfileViewPage() {
  return <Suspense fallback={<TopBar title="프로필" back />}><ProfileView /></Suspense>;
}
function ProfileView() {
  const id = useSearchParams().get("id") ?? "";
  const [profile, setProfile] = useState<User | null | undefined>();
  const [items, setItems] = useState<PublishedPortfolio[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all([repo.getUser(id), repo.listPublishedPortfolio(id)]).then(([user, publications]) => { if (active) { setProfile(user ?? null); setItems(publications); } }).catch(() => { if (active) setProfile(null); });
    return () => { active = false; };
  }, [id]);
  return <><TopBar title="프로필" back /><main className="portfolio-me">
    {profile === undefined ? <p role="status" className="card sub">프로필을 불러오는 중…</p> : !profile ? <p className="card">프로필을 찾을 수 없어요.</p> : profile.role === "student" ? <><PortfolioProfileHeader student={profile} publishedCount={items.length} /><PortfolioFeed student={profile} items={items} /></> : <section className="card flex items-center gap-4"><Avatar user={profile} size={72} /><div className="min-w-0"><h1 className="text-xl font-bold">{profile.name}</h1><p className="sub mt-1 text-sm">{profile.role === "resident" ? `${profile.kind} · ${profile.address}` : "앱 관리자"}</p></div></section>}
  </main></>;
}
