"use client";
import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import type { Resident } from "@/types";

/** 사장님(주민·상인) '나' 화면. 가게 사진·로고 등 무엇이든 프로필 사진으로 올릴 수 있다 (채팅·프로필에 보인다) */
export default function ResidentProfileCard({ user }: { user: Resident }) {
  const { refreshUsers } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) { setError("5MB 이하 이미지를 선택해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const url = await repo.uploadPortfolioImage(user.id, file);
      await repo.updateAvatar(user.id, url);
      await refreshUsers();
    } catch (e) { setError((e as Error).message || "사진을 올리지 못했어요."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={72} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{user.name}</h2>
          <p className="sub mt-1 text-sm">{user.kind} · {user.address}</p>
          <label className={`mt-2 inline-block cursor-pointer text-sm font-semibold text-[var(--primary)] ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? "올리는 중…" : "프로필 사진 바꾸기"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      <p className="sub mt-3 text-xs">가게 사진이나 로고 등 무엇이든 좋아요. 채팅과 프로필에 보여요.</p>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--red)]">{error}</p>}
      <Link href="/projects" className="btn mt-5 w-full">내 프로젝트 보기</Link>
    </section>
  );
}
