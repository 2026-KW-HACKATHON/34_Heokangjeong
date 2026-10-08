"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import Icon from "@/components/Icon";
import { useSession } from "@/lib/session";
import { searchStudents } from "@/lib/nickname";

/** 프로필 검색: 학생 이름·@닉네임·학과로 찾아 프로필로 간다. 동명이인은 닉네임으로 구분 */
export default function ProfileSearchPage() {
  const { user, users } = useSession();
  const [query, setQuery] = useState("");
  const found = useMemo(() => searchStudents(users, query).filter((s) => s.id !== user?.id), [users, query, user?.id]);
  return <>
    <TopBar title="프로필 검색" back />
    <section className="flex flex-col gap-3 px-4 pb-8">
      <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-[var(--sub)]">
        <Icon name="search" width={20} height={20} />
        <input autoFocus aria-label="프로필 검색" type="search" placeholder="이름, @닉네임, 학과로 찾아보세요" value={query} onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none" />
      </label>
      {!query.trim() ? <p className="sub px-1 text-sm">같은 이름이 여럿이면 닉네임으로 구분해요.</p>
        : found.length === 0 ? <p className="card sub text-sm">찾는 학생이 없어요.</p>
        : <ul className="card flex flex-col divide-y divide-[var(--line)] p-0" aria-label="검색 결과">{found.map((s) => <li key={s.id}>
            <Link href={`/profiles/view?id=${s.id}`} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--line)] font-bold">
                {s.role === "student" && s.avatarUrl ? <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" /> : s.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1"><b>{s.name}</b>{s.nickname && <span className="sub text-sm"> @{s.nickname}</span>}
                <span className="sub block truncate text-xs">{s.role === "student" ? s.department : ""}</span></span>
              <span className="sub" aria-hidden="true">›</span>
            </Link></li>)}</ul>}
    </section>
  </>;
}
