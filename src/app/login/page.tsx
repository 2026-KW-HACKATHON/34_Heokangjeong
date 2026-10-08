"use client";
import { useEffect, useState } from "react";
import { isKakaoEnabled, useSession } from "@/lib/session";
import BrandLogo from "@/components/BrandLogo";
import { clearDemoBrowserData, startDemoSession } from "@/lib/demoIdentity";
import { mockRepo } from "@/lib/repo/mock";
import { startDemoTour } from "@/lib/demoTour";

/** 이메일·비밀번호 로그인/가입 (Supabase 연결 시에만 쓰인다) */
export default function Login() {
  const { mode, loading, users, signIn, signUp, signInWithKakao } = useSession();
  const [isNew, setIsNew] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [kakao, setKakao] = useState(false);     // 카카오 로그인이 켜져 있을 때만 버튼을 보여 준다
  useEffect(() => { if (mode === "supabase") isKakaoEnabled().then(setKakao); }, [mode]);
  if (mode === "mock") {
    const examples = [
      { label: "학생으로 체험", detail: "공고 찾기부터 지원·포트폴리오까지", user: users.find(u => u.role === "student") },
      { label: "상인으로 체험", detail: "공고 등록부터 학생 선정·결과 확인까지", user: users.find(u => u.role === "resident" && u.kind === "상인") },
      { label: "주민으로 체험", detail: "필요한 도움을 요청하고 진행 과정 살펴보기", user: users.find(u => u.role === "resident" && u.kind === "주민") },
    ];
    return <main className="flex min-h-screen flex-col justify-center px-6 py-10">
      <header className="text-center">
        <h1><BrandLogo stacked /></h1>
        <p className="sub mt-4 text-sm">주민에게는 필요한 재능을, 대학생에게는 실제 경험을</p>
      </header>
      <section className="mt-10" aria-labelledby="demo-entry-title">
        <p className="text-sm font-semibold text-[var(--primary)]">WOLINK 데모</p>
        <h2 id="demo-entry-title" className="mt-2 text-2xl font-bold">어떤 입장에서 둘러볼까요?</h2>
        <p className="sub mt-2 text-sm">가입 없이 예시 계정으로 기능을 체험할 수 있어요.</p>
        <div className="mt-6 flex flex-col gap-3">
          {examples.map(({label, detail, user}) => <button key={label} type="button" disabled={loading || !user}
            onClick={async () => { if (!user) return; clearDemoBrowserData(); await mockRepo.resetDemo!(); startDemoSession(user.id); if (user.role === "student") startDemoTour("student"); else if (user.role === "resident" && user.kind === "상인") startDemoTour("merchant"); window.location.assign(user.role === "resident" && user.kind === "상인" ? "/posts/new/" : "/"); }}
            className="card flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-[var(--primary-weak)] disabled:opacity-50">
            <span><span className="block text-base font-bold">{label}</span><span className="sub mt-1 block text-sm">{detail}</span><span className="sub mt-1 block text-xs">예시 계정 · {user?.name ?? "불러오는 중"}</span></span>
            <span aria-hidden="true" className="text-2xl text-[var(--sub)]">›</span>
          </button>)}
        </div>
        <p className="sub mt-5 text-center text-xs">체험 내용은 이 기기의 브라우저에 저장되며 실제 계정이나 DB에는 반영되지 않아요.</p>
      </section>
    </main>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await (isNew ? signUp : signIn)(email.trim(), pw); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const field = "w-full rounded-xl bg-[var(--line)] p-3.5 text-[15px] outline-none";
  async function enterDemo(role: "student" | "merchant") {
    clearDemoBrowserData();
    await mockRepo.resetDemo!();
    startDemoSession(role === "student" ? "s1" : "r7");
    startDemoTour(role);
    window.location.assign(role === "student" ? "/" : "/posts/new/");
  }
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
      {/* 카카오 공급자를 Supabase 에서 켜면 '준비 중' 표시가 사라진다 */}
      <button onClick={async () => { setErr(""); try { await signInWithKakao(); } catch (x) { setErr((x as Error).message); } }}
        className={`btn w-full bg-[#FEE500] text-[#191600] ${kakao ? "" : "opacity-60"}`}>
        카카오로 시작하기{kakao ? "" : " (준비 중)"}
      </button>
      <button onClick={() => { setIsNew(!isNew); setErr(""); }} className="sub text-sm">{isNew ? "이미 계정이 있어요 · 로그인" : "처음이에요 · 가입하기"}</button>
      <div className="mt-2 border-t border-[var(--line)] pt-5" aria-label="가입 없이 체험하기">
        <p className="sub mb-3 text-center text-sm">가입 없이 기능 체험하기</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => enterDemo("student")} className="btn border border-[var(--line)] bg-white text-sm">학생 입장 데모</button>
          <button type="button" onClick={() => enterDemo("merchant")} className="btn border border-[var(--line)] bg-white text-sm">상인 입장 데모</button>
        </div>
        <p className="sub mt-3 text-center text-xs">체험 내용은 이 브라우저에만 저장됩니다.</p>
      </div>
    </section>
  );
}
