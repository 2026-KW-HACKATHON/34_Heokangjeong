"use client";
import { useEffect, useState } from "react";
import { isKakaoEnabled, useSession } from "@/lib/session";
import BrandLogo from "@/components/BrandLogo";
import { clearDemoBrowserData, startDemoSession } from "@/lib/demoIdentity";
import { mockRepo, users as demoUsers } from "@/lib/repo/mock";
import { startDemoTour } from "@/lib/demoTour";

/** 체험 안내(DemoTour)가 이 두 계정을 기준으로 짜여 있다 */
const DEMO_CHOICES = [
  { id: "s1", label: "학생으로 체험", detail: "공고 찾기부터 지원·포트폴리오까지", role: "student" as const },
  { id: "r7", label: "상인으로 체험", detail: "공고 등록부터 학생 선정·결과 확인까지", role: "merchant" as const },
];

async function enterDemo(id: string, role: "student" | "merchant") {
  clearDemoBrowserData();
  await mockRepo.resetDemo!();
  startDemoSession(id);
  startDemoTour(role);
  window.location.assign("/");   // 학생·상인 모두 홈에서 체험 안내를 시작한다
}

/** 첫 화면: 가입 없이 바로 체험을 고른다 (부스에서 주민분들께 이 화면부터 보여 준다) */
function DemoChooser({ children }: { children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
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
        {DEMO_CHOICES.map(({ id, label, detail, role }) => <button key={id} type="button" disabled={busy}
          onClick={async () => { setBusy(true); await enterDemo(id, role); }}
          className="card flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-[var(--primary-weak)] disabled:opacity-50">
          <span><span className="block text-base font-bold">{label}</span><span className="sub mt-1 block text-sm">{detail}</span><span className="sub mt-1 block text-xs">예시 계정 · {demoUsers.find(u => u.id === id)?.name}</span></span>
          <span aria-hidden="true" className="text-2xl text-[var(--sub)]">›</span>
        </button>)}
      </div>
      <p className="sub mt-5 text-center text-xs">체험 내용은 이 기기의 브라우저에 저장되며 실제 계정이나 DB에는 반영되지 않아요.</p>
    </section>
    {children}
  </main>;
}

/** 첫 화면은 체험 선택. 실제 계정 로그인은 아래 링크를 눌러야 펼쳐진다 */
export default function Login() {
  const { mode, signIn, signUp, signInWithKakao } = useSession();
  const [isNew, setIsNew] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [kakao, setKakao] = useState(false);     // 카카오 로그인이 켜져 있을 때만 버튼을 보여 준다
  useEffect(() => { if (mode === "supabase") isKakaoEnabled().then(setKakao); }, [mode]);
  const [showLogin, setShowLogin] = useState(false);
  if (mode === "mock") return <DemoChooser />;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await (isNew ? signUp : signIn)(email.trim(), pw); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const field = "w-full rounded-xl bg-[var(--line)] p-3.5 text-[15px] outline-none";
  if (!showLogin) return <DemoChooser>
    <button type="button" onClick={() => setShowLogin(true)} className="sub mt-8 text-center text-sm underline underline-offset-4">이미 계정이 있어요 · 로그인</button>
  </DemoChooser>;
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
      <button type="button" onClick={() => setShowLogin(false)} className="sub text-sm">‹ 체험 화면으로 돌아가기</button>
    </section>
  );
}
