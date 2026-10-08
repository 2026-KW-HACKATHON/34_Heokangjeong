"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { clubKindLabel } from "@/lib/clubs";
import { collegeLabel } from "@/lib/colleges";
import type { Club, ClubMember, Post, Project } from "@/types";

/** 단체 상세: 소속 명단, 대표의 가입 수락·거절 */
export default function ClubDetailPage() {
  return <Suspense fallback={<TopBar title="단체" back />}><ClubDetail /></Suspense>;
}

function ClubDetail() {
  const id = useSearchParams().get("id") ?? "";
  const { user, users } = useSession();
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [works, setWorks] = useState<{ project: Project; post: Post }[]>([]);   // 단체 활동 기록
  const act = useAction();

  const reload = async () => {
    const [list, m, w] = await Promise.all([repo.listClubs(), repo.listClubMembers(id), repo.listClubProjects(id)]);
    setClub(list.find((c) => c.id === id) ?? null);
    setMembers(m);
    setWorks(w);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [id]);

  if (club === undefined) return <><TopBar title="단체" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (!club) return <><TopBar title="단체" back /><p className="card mx-4 text-sm">단체를 찾을 수 없어요.</p></>;

  const me = members.find((m) => m.studentId === user?.id);
  const isLeader = me?.role === "LEADER" && me.status === "ACTIVE";
  const waiting = members.filter((m) => m.status === "PENDING");
  const active = members.filter((m) => m.status === "ACTIVE");
  const name = (uid: string) => users.find((u) => u.id === uid)?.name ?? "학생";
  const dept = (uid: string) => { const u = users.find((x) => x.id === uid); return u?.role === "student" ? u.department : ""; };
  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await reload(); });

  return (
    <>
      <TopBar title={club.name} back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-bold">{club.name}</h2><span className="chip chip-on">{clubKindLabel(club)}</span></div>
          <p className="sub text-xs">{club.college ? `${collegeLabel(club.college)} · ` : ""}소속 {active.length}명</p>
          {club.description && <p className="mt-2 text-sm">{club.description}</p>}
        </div>

        {isLeader && (
          <div className="card flex flex-col gap-2">
            <h3 className="font-bold">가입 신청 {waiting.length}건</h3>
            {waiting.length === 0 && <p className="sub text-sm">새 신청이 없어요.</p>}
            {waiting.map((m) => (
              <div key={m.studentId} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--line)] px-3 py-2 text-sm">
                <span><b>{name(m.studentId)}</b> <span className="sub">{dept(m.studentId)}</span></span>
                <span className="flex gap-1.5">
                  <button onClick={() => run(() => repo.reviewMember(id, m.studentId, true, user!.id))} className="btn btn-primary px-3 py-1.5 text-xs">수락</button>
                  <button onClick={() => run(() => repo.reviewMember(id, m.studentId, false, user!.id))} className="btn bg-white px-3 py-1.5 text-xs">거절</button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 단체 활동 기록: 이 단체 이름으로 맡아 완료한 프로젝트 */}
        <div className="card flex flex-col gap-2">
          <h3 className="font-bold">단체 활동 기록 {works.filter((w) => w.project.status === "COMPLETED").length}건</h3>
          {works.length === 0 && <p className="sub text-sm">아직 이 단체 이름으로 맡은 프로젝트가 없어요.</p>}
          {works.map(({ project, post }) => (
            <Link key={project.id} href={`/projects/detail?id=${project.id}`} className="rounded-xl bg-[var(--line)] px-3 py-2 text-sm">
              <b>{post.title}</b>
              <span className="sub block text-xs">{project.status === "COMPLETED" ? "완료·검증됨" : "진행 중"}</span>
            </Link>
          ))}
        </div>

        <div className="card flex flex-col gap-2">
          <h3 className="font-bold">소속 명단</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {active.map((m) => (
              <li key={m.studentId} className="flex items-center justify-between">
                <Link href={`/profiles/view?id=${m.studentId}`} className="flex-1">{name(m.studentId)} <span className="sub text-xs">{dept(m.studentId)}</span></Link>
                {m.role === "LEADER" ? <span className="chip chip-on text-xs">대표</span>
                  : isLeader && <button onClick={() => { if (confirm(`${name(m.studentId)} 님에게 대표를 넘길까요?`)) run(() => repo.transferLeader(id, m.studentId, user!.id)); }} className="text-xs text-[var(--primary)] underline">대표 넘기기</button>}
              </li>
            ))}
          </ul>
        </div>

        <ErrorText text={act.error} />
        {me?.status === "PENDING" && <p className="sub text-center text-sm">가입 신청 후 대표의 수락을 기다리고 있어요.</p>}
        {me?.status === "ACTIVE" && (
          <button onClick={() => run(() => repo.leaveClub(id, user!.id))} className="btn btn-ghost w-full">단체 탈퇴</button>
        )}
      </section>
    </>
  );
}
