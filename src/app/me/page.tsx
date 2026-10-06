"use client";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { useSession } from "@/lib/session";
import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import type { PortfolioCard, TrustSummary } from "@/types";
import Icon from "@/components/Icon";

/** 내 정보. 서버 연결 전(mock)에는 계정 전환, 연결 후에는 로그아웃. 학생 프로필 항목: 학과·기술·관심·시간·거리 */
export default function Me() {
  const { mode, user, users, setUserId, signOut } = useSession();
  const [works, setWorks] = useState<PortfolioCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [trust, setTrust] = useState<TrustSummary | null>(null);
  useEffect(() => {
    let active = true; setTrust(null);
    if (user?.role === "student") repo.trustSummary(user.id).then(t => { if (active) setTrust(t); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.role]);
  useEffect(() => {
    let active = true;
    setWorks([]); setError(false); setLoading(true);
    if (user?.role !== "student") { setLoading(false); return; }
    repo.listPortfolio(user.id).then((cards) => { if (active) setWorks(cards); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.role]);
  return (
    <>
      <TopBar title="나의 작업실" />
      <section className="flex flex-col gap-5 px-5 pb-6">
        <div className="py-4"><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary-weak)] text-[var(--primary)]"><Icon name="user" width={32} height={32} /></div><h2 className="page-title">{user?.name ?? "나의 프로필"}</h2><p className="sub mt-2 text-sm">{user?.role === "student" ? user.department : user?.role === "resident" ? user.kind : ""}</p><p className="sub mt-4 text-sm">이웃과 함께 만든 경험을 차곡차곡.</p></div>
        {mode === "mock" && <div className="card">
          <p className="sub text-xs">지금 보는 계정</p>
          <select aria-label="계정 전환" className="mt-1 w-full rounded-xl bg-[var(--line)] p-3 text-[15px]" value={user?.id ?? ""} onChange={(e) => setUserId(e.target.value)}>
            <optgroup label="학생">{users.filter((u) => u.role === "student").map((u) => <option key={u.id} value={u.id}>{u.name} · {(u as { department: string }).department}</option>)}</optgroup>
            <optgroup label="주민·상인">{users.filter((u) => u.role === "resident").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
          <p className="sub mt-2 text-xs">서버(Supabase) 연결 전이라 로그인 대신 계정을 골라 화면을 확인합니다.</p>
        </div>}
        {user?.role === "student" && (
          <div className="card text-sm">
            <h3 className="mb-4 font-bold">나의 재능과 활동</h3>
            <dl className="grid grid-cols-[92px_1fr] gap-y-1.5">
              <dt className="sub">학과</dt><dd>{user.department}</dd>
              <dt className="sub">보유 기술</dt><dd>{user.skills.join(", ")}</dd>
              <dt className="sub">관심 분야</dt><dd>{user.interests.join(", ")}</dd>
              <dt className="sub">가능 시간</dt><dd>{user.availableHours}</dd>
              <dt className="sub">가능 거리</dt><dd>{user.maxDistanceM}m</dd>
            </dl>
          </div>
        )}
        {user?.role === "resident" && <div className="card text-sm"><h3 className="font-bold">{user.name}</h3><p className="sub mt-1">{user.kind} · {user.address}</p></div>}
        {user?.role === "student" && <section aria-label="완료 작업 포트폴리오">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-bold">내가 남긴 결과물</h3><Link className="inline-flex min-h-11 items-center text-sm text-[var(--primary)]" href="/portfolio">전체 보기</Link></div>
          {loading ? <p role="status" className="card sub text-sm">작업 기록을 불러오는 중이에요.</p> : error ? <p role="alert" className="card text-sm">작업 기록을 불러오지 못했어요. 새로고침해 주세요.</p> : works.length === 0 ? <div className="card py-8 text-center"><Icon name="folder" className="mx-auto mb-4 text-[var(--primary)]" width={32} height={32} /><p className="font-semibold">아직 등록된 작업물이 없어요</p><p className="sub mt-2 text-sm">저장된 포트폴리오를 여기에서 모아 볼 수 있어요.</p><Link href="/" className="btn btn-primary mt-5 text-sm">참여할 공고 찾기</Link></div> : <div className="grid grid-cols-2 gap-x-4 gap-y-6">{works.map((work) => <Link key={work.id} href="/portfolio" className="min-w-0"><div className="work-cover mb-3 flex-col gap-3"><Icon name="folder" width={36} height={36} /><span className="text-xs">대표 이미지 없음</span></div><h4 className="line-clamp-2 text-sm font-semibold">{work.title}</h4><p className="sub mt-1 text-xs">{work.roleLabel}</p>{work.verified && <p className="mt-2 text-xs text-[var(--primary)]">✓ 완료 인증</p>}</Link>)}</div>}
        </section>}
        {trust && <section className="card text-sm"><h3 className="font-bold">협업 온도 · 등급</h3><p className="mt-3">{trust.tier.label} · 온도 {trust.temperature.toFixed(1)}° · 완료 {trust.verifiedCount}건</p><p className="sub mt-2">점주 평가가 온도와 다음 등급에 반영돼요.</p><div className="mt-3 flex flex-wrap gap-2">{trust.badges.map(b => <span key={b.code} className="silver-badge text-xs">{b.label}</span>)}</div><Link href="/projects" className="mt-3 inline-block underline">프로젝트 기록 보기</Link></section>}
        <ul className="card flex flex-col divide-y divide-[var(--line)] p-0 text-[15px]">
          <li><Link href="/projects" className="flex min-h-14 items-center justify-between px-4 py-3.5"><span className="inline-flex items-center gap-3"><Icon name="folder" width={19} height={19} />내 진행 프로젝트</span><Icon name="arrow" width={16} height={16} /></Link></li>
          <li><Link href="/portfolio" className="flex min-h-14 items-center justify-between px-4 py-3.5"><span className="inline-flex items-center gap-3"><Icon name="folder" width={19} height={19} />내 포트폴리오</span><Icon name="arrow" width={16} height={16} className="sub" /></Link></li>
        </ul>
        {mode === "supabase" && <button onClick={signOut} className="btn btn-ghost w-full">로그아웃</button>}
      </section>
    </>
  );
}
