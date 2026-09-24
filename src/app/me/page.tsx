"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { useSession } from "@/lib/session";
import { repo } from "@/lib/repo";
import type { TrustSummary } from "@/types";

/** 내 정보. 서버 연결 전(mock)에는 계정 전환, 연결 후에는 로그아웃. 학생은 검증 기반 신뢰 지표(티어·온도·뱃지) */
export default function Me() {
  const { mode, user, users, setUserId, signOut } = useSession();
  const [trust, setTrust] = useState<TrustSummary | null>(null);
  useEffect(() => { setTrust(null); if (user?.role === "student") repo.trustSummary(user.id).then(setTrust); }, [user]);
  return (
    <>
      <TopBar title="나" />
      <section className="flex flex-col gap-3 px-4">
        {mode === "mock" && <div className="card">
          <p className="sub text-xs">지금 보는 계정</p>
          <select aria-label="계정 전환" className="mt-1 w-full rounded-xl bg-[var(--line)] p-3 text-[15px]" value={user?.id ?? ""} onChange={(e) => setUserId(e.target.value)}>
            <optgroup label="학생">{users.filter((u) => u.role === "student").map((u) => <option key={u.id} value={u.id}>{u.name} · {(u as { department: string }).department}</option>)}</optgroup>
            <optgroup label="주민·상인">{users.filter((u) => u.role === "resident").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
          <p className="sub mt-2 text-xs">서버(Supabase) 연결 전이라 로그인 대신 계정을 골라 화면을 확인합니다. 데모: 행복분식(점주) ↔ 김하늘(학생)</p>
          {repo.resetDemo && <button onClick={async () => { if (confirm("이 브라우저의 데모 기록을 모두 지우고 처음 상태로 돌릴까요?")) { await repo.resetDemo!(); location.reload(); } }} className="btn btn-ghost mt-2 w-full text-sm">데모 데이터 초기화</button>}
        </div>}
        {user?.role === "student" && (
          <div className="card text-sm">
            <h3 className="mb-2 font-bold">{user.name}</h3>
            <dl className="grid grid-cols-[92px_1fr] gap-y-1.5">
              <dt className="sub">학과</dt><dd>{user.department}</dd>
              <dt className="sub">보유 기술</dt><dd>{user.skills.join(", ")}</dd>
              <dt className="sub">관심 분야</dt><dd>{user.interests.join(", ")}</dd>
              <dt className="sub">가능 시간</dt><dd>{user.availableHours}</dd>
              <dt className="sub">가능 거리</dt><dd>{user.maxDistanceM}m</dd>
            </dl>
          </div>
        )}
        {user?.role === "student" && trust && (
          <div className="card text-sm">
            <h3 className="mb-3 font-bold">검증된 활동</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--line)] p-2"><p className="sub text-xs">티어</p><p className="font-bold">{trust.tier.label}</p></div>
              <div className="rounded-xl bg-[var(--line)] p-2"><p className="sub text-xs">협업 온도</p><p className="font-bold">{trust.temperature.toFixed(1)}℃</p></div>
              <div className="rounded-xl bg-[var(--line)] p-2"><p className="sub text-xs">검증 프로젝트</p><p className="font-bold">{trust.verifiedCount}개</p></div>
            </div>
            <p className="sub mt-2 text-xs">티어는 의뢰인이 검증한 프로젝트 수, 온도는 의뢰인의 기한·소통·인계 평가로 정해져요. 답변 양이나 준비도는 쓰지 않아요. {trust.paidEligible ? "유료 의뢰에 지원할 수 있어요." : "검증 프로젝트가 1개 이상이면 유료 의뢰에 지원할 수 있어요."}</p>
            {trust.badges.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{trust.badges.map((b) => <span key={b.code} className="chip chip-on">🏅 {b.label}</span>)}</div>}
          </div>
        )}
        {user?.role === "resident" && <div className="card text-sm"><h3 className="font-bold">{user.name}</h3><p className="sub mt-1">{user.kind} · {user.address}</p></div>}
        <ul className="card flex flex-col divide-y divide-[var(--line)] p-0 text-[15px]">
          {[["/projects", "🧩 내 프로젝트"], ["/portfolio", "📁 내 포트폴리오"], ["/chats", "💬 채팅"], ["/ranking", "🏆 지역 기여 랭킹"], ["/teams", "👥 팀 프로젝트"], ["/notifications", "🔔 알림"], ["/posts/new", "➕ 공고 등록 (주민·상인)"]].map(([h, l]) => (
            <li key={h}><Link href={h} className="flex items-center justify-between px-4 py-3.5">{l}<span className="sub">›</span></Link></li>
          ))}
        </ul>
        {mode === "supabase" && <button onClick={signOut} className="btn btn-ghost w-full">로그아웃</button>}
      </section>
    </>
  );
}
