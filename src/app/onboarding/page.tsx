"use client";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { WOLGYE_CENTER } from "@/lib/geo";
import type { Category } from "@/types";

const CATS: Category[] = ["디자인", "영상", "사진", "SNS홍보", "웹/앱", "디지털도움", "기타"];

/** 가입 직후 프로필 만들기: 학생이면 학과·기술·관심, 주민·상인이면 상호·주소 */
export default function Onboarding() {
  const { saveProfile, signOut, pendingEmail } = useSession();
  const [role, setRole] = useState<"student" | "resident">("student");
  const [f, setF] = useState({ name: "", department: "", skills: "", interests: [] as Category[], availableHours: "", maxDistanceM: 1500, kind: "상인" as "상인" | "주민", address: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.name.trim()) return setErr(role === "student" ? "이름을 입력해 주세요" : "상호 또는 이름을 입력해 주세요");
    if (role === "student" && !(f.maxDistanceM >= 100)) return setErr("활동 가능 거리는 100m 이상으로 적어 주세요");
    setBusy(true); setErr("");
    try {
      await saveProfile(role === "student"
        ? { role, name: f.name.trim(), department: f.department.trim(), skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean), interests: f.interests, availableHours: f.availableHours, maxDistanceM: f.maxDistanceM, location: WOLGYE_CENTER }
        : { role, name: f.name.trim(), kind: f.kind, address: f.address.trim() || "월계1동", location: WOLGYE_CENTER });
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const field = "w-full rounded-xl bg-[var(--line)] p-3 text-[15px] outline-none";
  return (
    <section className="flex flex-col gap-3 px-4 py-8">
      <h1 className="text-xl font-bold">프로필 만들기</h1>
      {pendingEmail && <p className="sub -mt-1 text-sm">{pendingEmail} 로 가입해요 · 마지막 단계예요</p>}
      <div className="grid grid-cols-2 gap-2">
        {([["student", "🎓 광운대 학생"], ["resident", "🏪 주민·상인"]] as const).map(([r, l]) => (
          <button key={r} onClick={() => setRole(r)} className={`btn ${role === r ? "btn-primary" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      <div className="card flex flex-col gap-3">
        <input className={field} placeholder={role === "student" ? "이름" : "상호 또는 이름 (예: 월계 커피)"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        {role === "student" ? (
          <>
            <input className={field} placeholder="학과 (예: 소프트웨어학부)" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
            <input className={field} placeholder="보유 기술, 쉼표로 (예: Figma, 포스터, React)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />
            <div><p className="sub mb-1.5 text-xs">관심 분야</p><div className="flex flex-wrap gap-2">{CATS.map((c) => (
              <button key={c} onClick={() => setF({ ...f, interests: f.interests.includes(c) ? f.interests.filter((x) => x !== c) : [...f.interests, c] })} className={`chip ${f.interests.includes(c) ? "chip-on" : ""}`}>{c}</button>
            ))}</div></div>
            <input className={field} placeholder="활동 가능 시간 (예: 평일 저녁, 주말)" value={f.availableHours} onChange={(e) => setF({ ...f, availableHours: e.target.value })} />
            <label className="text-sm"><span className="sub block text-xs">활동 가능 거리(m)</span><input type="number" min={100} step={100} className={field} value={f.maxDistanceM || ""} onChange={(e) => setF({ ...f, maxDistanceM: +e.target.value })} /></label>
          </>
        ) : (
          <>
            <div className="flex gap-2">{(["상인", "주민"] as const).map((k) => <button key={k} onClick={() => setF({ ...f, kind: k })} className={`chip ${f.kind === k ? "chip-on" : ""}`}>{k}</button>)}</div>
            <input className={field} placeholder="주소 (예: 월계로 45길 12)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </>
        )}
      </div>
      {err && <p className="text-sm text-[var(--red)]">{err}</p>}
      <button onClick={submit} disabled={busy} className="btn btn-primary w-full disabled:opacity-50">{busy ? "저장 중…" : "시작하기"}</button>
      <button onClick={signOut} className="sub text-sm">다른 계정으로 로그인</button>
    </section>
  );
}
