"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

const OPEN = ["/login", "/onboarding"];

/** Supabase 연결 시: 로그인 안 했으면 /login, 프로필이 없으면 /onboarding 으로 보낸다. mock 에서는 아무것도 안 한다. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { mode, loading, authId, user } = useSession();
  const router = useRouter();
  const path = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const target = mode === "mock" || loading ? null : !authId ? "/login" : !user ? "/onboarding" : null;
  const blocked = target !== null && !OPEN.includes(path);

  useEffect(() => { if (blocked) router.replace(target!); }, [blocked, target, router]);
  useEffect(() => { if (mode === "supabase" && !loading && user && OPEN.includes(path)) router.replace("/"); }, [mode, loading, user, path, router]);

  if (mode === "supabase" && loading) return <p className="sub p-10 text-center text-sm">불러오는 중…</p>;
  if (blocked) return null;
  return <>{children}</>;
}
