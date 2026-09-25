"use client";
import { useState } from "react";
import { useSession } from "@/lib/session";
import BrandLogo from "@/components/BrandLogo";

/** 이메일·비밀번호 로그인/가입 (Supabase 연결 시에만 쓰인다) */
export default function Login() {
  const { mode, signIn, signUp } = useSession();
  const [isNew, setIsNew] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (mode === "mock") return <p className="sub p-10 text-center text-sm">서버 연결 전에는 로그인 없이 &lsquo;나&rsquo; 탭에서 계정을 바꿔 볼 수 있어요.</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await (isNew ? signUp : signIn)(email.trim(), pw); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const field = "w-full rounded-xl bg-[var(--line)] p-3.5 text-[15px] outline-none";
  return (
    <section className="flex min-h-screen flex-col justify-center gap-6 px-6">
      <div>
        <h1><BrandLogo stacked /></h1>
        <p className="sub mt-4 text-center text-sm">주민에게는 필요한 재능을, 대학생에게는 실제 경험을</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className={field} type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={field} type="password" autoComplete={isNew ? "new-password" : "current-password"} placeholder="비밀번호 (6자 이상)" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="text-sm text-[var(--red)]">{err}</p>}
        <button disabled={busy} className="btn btn-primary w-full disabled:opacity-50">{busy ? "잠시만요…" : isNew ? "가입하기" : "로그인"}</button>
      </form>
      <button onClick={() => { setIsNew(!isNew); setErr(""); }} className="sub text-sm">{isNew ? "이미 계정이 있어요 · 로그인" : "처음이에요 · 가입하기"}</button>
    </section>
  );
}
