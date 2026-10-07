"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import Icon from "@/components/Icon";
import { repo } from "@/lib/repo";
import type { User } from "@/types";

export default function ProfileViewPage() {
  return <Suspense fallback={<TopBar title="프로필" back />}><ProfileView /></Suspense>;
}

function ProfileView() {
  const id = useSearchParams().get("id") ?? "";
  const [profile, setProfile] = useState<User | null | undefined>(undefined);
  useEffect(() => { repo.getUser(id).then((value) => setProfile(value ?? null)).catch(() => setProfile(null)); }, [id]);
  if (profile === undefined) return <><TopBar title="프로필" back /><p className="sub p-6 text-center text-sm">프로필을 불러오는 중…</p></>;
  if (!profile) return <><TopBar title="프로필" back /><p className="card mx-4 text-sm">프로필을 찾을 수 없어요.</p></>;
  return <>
    <TopBar title="프로필" back />
    <main className="flex flex-col gap-4 px-5">
      <section className="card">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-weak)] text-[var(--primary)]"><Icon name="user" width={32} height={32} /></div>
        <h2 className="page-title">{profile.name}</h2>
        <p className="sub mt-1 text-sm">{profile.role === "student" ? `${profile.school || "학교 미입력"} · ${profile.department}` : profile.role === "resident" ? `${profile.kind} · ${profile.address}` : "앱 관리자"}</p>
      </section>
      {profile.role === "student" && <section className="card text-sm">
        <h3 className="mb-4 font-bold">기본 정보</h3>
        <dl className="grid grid-cols-[84px_1fr] gap-y-2">
          <dt className="sub">학교</dt><dd>{profile.school || "미입력"}</dd>
          <dt className="sub">학과</dt><dd>{profile.department || "미입력"}</dd>
          <dt className="sub">나이</dt><dd>{profile.age ? `${profile.age}세` : "미입력"}</dd>
          <dt className="sub">전화번호</dt><dd>{profile.phone || "미입력"}</dd>
          <dt className="sub">보유 기술</dt><dd>{profile.skills.join(", ") || "미입력"}</dd>
          <dt className="sub">관심 분야</dt><dd>{profile.interests.join(", ") || "미입력"}</dd>
          <dt className="sub">활동 시간</dt><dd>{profile.availableHours || "미입력"}</dd>
        </dl>
      </section>}
    </main>
  </>;
}
