"use client";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { WOLGYE_CENTER } from "@/lib/geo";
import type { Category } from "@/types";

const CATS: Category[] = ["디자인", "영상", "사진", "SNS홍보", "웹/앱", "디지털도움", "기타"];

/** 가입 직후 프로필 만들기: 학생이면 학과·기술·관심, 주민·상인이면 상호·주소 */
export default function Onboarding() {
  const { saveProfile, signOut } = useSession();
  const [role, setRole] = useState<"student" | "resident">("student");
  const [f, setF] = useState({ name: "", department: "", school: "광운대학교", age: "", phone: "", skills: "", interests: [] as Category[], availableHours: "", maxDistanceM: 1500, kind: "상인" as "상인" | "주민", address: "" });
  const [err, setErr] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const skills = f.skills.split(",").map((s) => s.trim()).filter(Boolean);

  const missing = {
    name: !f.name.trim(),
    department: role === "student" && !f.department.trim(),
    skills: role === "student" && skills.length === 0,
    interests: role === "student" && f.interests.length === 0,
    availableHours: role === "student" && !f.availableHours.trim(),
    address: role === "resident" && !f.address.trim(),
  };
  const hasMissing = Object.values(missing).some(Boolean);

  async function submit() {
    setTriedSubmit(true);
    if (hasMissing) return setErr("필수 항목을 모두 입력해 주세요");
    setBusy(true); setErr("");
    try {
      await saveProfile(role === "student"
        ? { role, name: f.name.trim(), department: f.department.trim(), school: f.school.trim(), age: f.age ? Number(f.age) : undefined, phone: f.phone.trim() || undefined, skills, interests: f.interests, availableHours: f.availableHours, maxDistanceM: f.maxDistanceM, location: WOLGYE_CENTER }
        : { role, name: f.name.trim(), kind: f.kind, address: f.address.trim(), location: WOLGYE_CENTER });
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const field = (invalid = false) => `w-full rounded-xl border bg-[var(--line)] p-3 text-[15px] outline-none ${invalid ? "border-[var(--red)]" : "border-transparent"}`;
  const required = <span className="ml-1 text-[var(--red)]" aria-hidden="true">*</span>;
  return (
    <section className="flex flex-col gap-3 px-4 py-8">
      <h1 className="text-xl font-bold">프로필 만들기</h1>
      <div className="grid grid-cols-2 gap-2">
        {([["student", "🎓 광운대 학생"], ["resident", "🏪 주민·상인"]] as const).map(([r, l]) => (
          <button key={r} onClick={() => setRole(r)} className={`btn ${role === r ? "btn-primary" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      <div className="card flex flex-col gap-3">
        <label className="text-sm">{role === "student" ? "이름" : "상호 또는 이름"}{required}<input required aria-invalid={triedSubmit && missing.name} className={`${field(triedSubmit && missing.name)} mt-1`} placeholder={role === "student" ? "예: 홍길동" : "예: 월계 커피"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        {role === "student" ? (
          <>
            <label className="text-sm">학과{required}<input required aria-invalid={triedSubmit && missing.department} className={`${field(triedSubmit && missing.department)} mt-1`} placeholder="예: 소프트웨어학부" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></label>
            <label className="text-sm">학교<input className={`${field()} mt-1`} placeholder="예: 광운대학교" value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-sm">나이<input type="number" min={17} max={100} className={`${field()} mt-1`} placeholder="예: 23" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></label><label className="text-sm">전화번호<input type="tel" className={`${field()} mt-1`} placeholder="010-0000-0000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label></div>
            <label className="text-sm">보유 기술{required}<input required aria-invalid={triedSubmit && missing.skills} className={`${field(triedSubmit && missing.skills)} mt-1`} placeholder="쉼표로 구분 (예: Figma, 포스터, React)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></label>
            <div><p className={`mb-1.5 text-xs ${triedSubmit && missing.interests ? "text-[var(--red)]" : "sub"}`}>관심 분야{required}</p><div className="flex flex-wrap gap-2">{CATS.map((c) => (
              <button key={c} onClick={() => setF({ ...f, interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c] })} className={`chip ${f.interests.includes(c) ? "chip-on" : ""}`}>{c}</button>
            ))}</div></div>
            <label className="text-sm">활동 가능 시간{required}<input required aria-invalid={triedSubmit && missing.availableHours} className={`${field(triedSubmit && missing.availableHours)} mt-1`} placeholder="예: 평일 저녁, 주말" value={f.availableHours} onChange={(e) => setF({ ...f, availableHours: e.target.value })} /></label>
            <label className="text-sm"><span className="sub block text-xs">활동 가능 거리(m)</span><input type="number" min={100} step={100} className={field()} value={f.maxDistanceM} onChange={(e) => setF({ ...f, maxDistanceM: +e.target.value })} /></label>
          </>
        ) : (
          <>
            <div className="flex gap-2">{(["상인", "주민"] as const).map((k) => <button key={k} onClick={() => setF({ ...f, kind: k })} className={`chip ${f.kind === k ? "chip-on" : ""}`}>{k}</button>)}</div>
            <label className="text-sm">주소{required}<input required aria-invalid={triedSubmit && missing.address} className={`${field(triedSubmit && missing.address)} mt-1`} placeholder="예: 월계로 45길 12" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
          </>
        )}
      </div>
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
      <button onClick={submit} disabled={busy} className="btn btn-primary w-full disabled:opacity-50">{busy ? "저장 중…" : "시작하기"}</button>
      <button onClick={signOut} className="sub text-sm">다른 계정으로 로그인</button>
    </section>
  );
}
