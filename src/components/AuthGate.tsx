"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

const OPEN = ["/login", "/onboarding"];

/** Supabase 연결 시: 로그인 안 했으면 /login, 프로필이 없으면 /onboarding 으로 보낸다. mock 에서는 아무것도 안 한다. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { mode, loading, authId, user, pendingEmail } = useSession();
  const router = useRouter();
  const path = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const target = mode === "mock" || loading ? null : !authId ? "/login" : !user ? "/onboarding" : null;
  const blocked = target !== null && !OPEN.includes(path);

  useEffect(() => { if (blocked) router.replace(target!); }, [blocked, target, router]);
  useEffect(() => { if (mode === "supabase" && !loading && user && OPEN.includes(path)) router.replace("/"); }, [mode, loading, user, path, router]);
  // 가입 정보 입력 직후, 또는 로그인은 됐지만 프로필이 없는 계정은 프로필 만들기로
  useEffect(() => { if (mode === "supabase" && !loading && ((authId && !user) || (!authId && pendingEmail)) && path === "/login") router.replace("/onboarding"); }, [mode, loading, authId, user, pendingEmail, path, router]);
  // 가입 진행 중이 아닌데 프로필 만들기에 있으면(새로고침·"다른 계정으로 로그인") 로그인 화면으로
  useEffect(() => { if (mode === "supabase" && !loading && !authId && !pendingEmail && path === "/onboarding") router.replace("/login"); }, [mode, loading, authId, pendingEmail, path, router]);

  if (mode === "supabase" && loading) return <p className="sub p-10 text-center text-sm">불러오는 중…</p>;
  if (blocked) return null;
  return <>{children}</>;
}
