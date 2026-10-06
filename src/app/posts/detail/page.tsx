"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { collegeLabel } from "@/lib/colleges";
import Icon from "@/components/Icon";
import { ErrorText, ProjectStatusBadge, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { distanceM, formatDistance } from "@/lib/geo";
import { COMPENSATION_LABEL, listingOf } from "@/lib/listing";
import { DOMAINS } from "@shared/portfolio/domains";
import { MIN_VERIFIED_FOR_PAID } from "@shared/portfolio/policy";
import type { Application, Post, Project, TrustSummary, User } from "@/types";

/** 공고 상세 + 지원(개인/팀 역할 선택) + 주민의 지원자 선정 → 프로젝트 시작
 *  앱(정적 export) 빌드를 위해 /posts/[id] 대신 /posts/detail?id=... 형태를 쓴다. */
export default function PostDetailPage() {
  return <Suspense fallback={<TopBar title="공고" back />}><PostDetail /></Suspense>;
}

function PostDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { user, users } = useSession();
  const [post, setPost] = useState<Post | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [project, setProject] = useState<Project | undefined>();
  const [trust, setTrust] = useState<TrustSummary | null>(null);
  const [msg, setMsg] = useState("");
  const [roleId, setRoleId] = useState("");
  const act = useAction();
  const reload = () => { repo.getPost(id).then((p) => setPost(p ?? null)); repo.listApplications(id).then(setApps); repo.getProjectByPost(id).then(setProject).catch(() => setProject(undefined)); };
  useEffect(reload, [id]);
  useEffect(() => { if (user?.role === "student") repo.trustSummary(user.id).then(setTrust); }, [user]);
  if (!post) return <><TopBar title="공고" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const author = users.find((u) => u.id === post.authorId) as Extract<User, { role: "resident" }> | undefined;
  const mine = apps.find((a) => a.studentId === user?.id);
  const isOwner = user?.id === post.authorId;
  const listing = listingOf(post);
  const paidLocked = listing.compensationType === "PAID" && trust !== null && !trust.paidEligible;
  const recruiting = post.status === "open";

  async function submit() {
    if (!user || user.role !== "student") return;
    await act.run(async () => {
      if (post!.isTeam && !roleId) throw new Error("지원할 역할을 선택해 주세요");
      await repo.apply(post!.id, user.id, msg || "지원합니다!", roleId || undefined);
      setMsg(""); reload();
    });
  }
  async function select(a: Application) {
    await act.run(async () => { const p = await repo.selectApplicant(a.id, user!.id); router.push(`/projects/detail?id=${p.id}`); });
  }
  async function reject(a: Application) { await act.run(async () => { await repo.updateApplicationStatus(a.id, "rejected"); reload(); }); }

  return (
    <>
      <TopBar title="공고" back />
      <section className="flex flex-col gap-5 px-5 pb-6">
        <div className="card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5">
              {post.urgent && <span className="chip bg-[var(--red)] font-bold text-white">🚨 긴급</span>}
              <span className="chip chip-on">{post.category}{post.isTeam ? " · 팀 프로젝트" : ""}</span>
            </span>
            <StatusBadge status={post.status} />
          </div>
          {post.urgent && post.urgentColleges && post.urgentColleges.length > 0 && (
            <p className="sub mb-1 text-xs">{post.urgentColleges.map(collegeLabel).filter(Boolean).join(", ")} 학생에게 알림이 갔어요</p>
          )}
          <div className="silver-badge mb-5 mt-4"><Icon name="folder" width={22} height={22} /></div>
          <h2 className="page-title">{post.title}</h2>
          <p className="sub mt-1 text-sm">{author?.name} · {post.address}{user && <> · 📍 {formatDistance(distanceM(user.location, post.location))}</>}</p>
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{post.description}</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-[var(--line)] p-2"><dt className="sub text-xs">기간</dt><dd className="font-semibold">{post.durationDays}일</dd></div>
            <div className="rounded-xl bg-[var(--line)] p-2"><dt className="sub text-xs">난이도</dt><dd className="font-semibold">{"★".repeat(post.difficulty)}</dd></div>
            <div className="rounded-xl bg-[var(--line)] p-2"><dt className="sub text-xs">{COMPENSATION_LABEL[listing.compensationType]}</dt><dd className="truncate font-semibold">{listing.compensationType === "PAID" && listing.paidAmount ? `${listing.paidAmount.toLocaleString()}원` : listing.compensationDescription || "없음"}</dd></div>
          </dl>
        </div>

        <div className="card text-sm">
          <h3 className="mb-2 font-bold">해결할 문제와 완료 기준</h3>
          <dl className="grid grid-cols-[76px_1fr] gap-y-1.5">
            <dt className="sub">문제</dt><dd>{listing.problem}</dd>
            {listing.expectedDeliverables.length > 0 && <><dt className="sub">결과물</dt><dd><ul className="list-disc pl-4">{listing.expectedDeliverables.map((d) => <li key={d}>{d}</li>)}</ul></dd></>}
            {listing.completionCriteria && <><dt className="sub">완료 기준</dt><dd>{listing.completionCriteria}</dd></>}
            {listing.deadline && <><dt className="sub">마감</dt><dd>{listing.deadline}</dd></>}
            <dt className="sub">보완 요청</dt><dd>최대 {listing.revisionLimit}번</dd>
            <dt className="sub">기록 방식</dt><dd>{DOMAINS[listing.domain].label} 포트폴리오 템플릿</dd>
          </dl>
        </div>

        {post.isTeam && post.teamSlots && (
          <div className="card">
            <h3 className="mb-2 font-bold">필요 인원</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {post.teamSlots.map((s) => {
                const filled = s.filledCount ?? s.filled.length;
                return (
                <li key={s.id ?? s.category} className="flex items-center justify-between rounded-xl bg-[var(--line)] px-3 py-2">
                  <span><b>{s.label ?? s.category}</b> · {s.category}</span>
                  <span className={filled >= s.count ? "text-[var(--green)]" : "sub"}>{filled}/{s.count} 확정</span>
                </li>
              ); })}
            </ul>
          </div>
        )}

        {project && (isOwner || mine?.status === "accepted") && (
          <Link href={`/projects/detail?id=${project.id}`} className="card flex items-center justify-between bg-[var(--primary-weak)]">
            <span><span className="block text-xs font-semibold text-[var(--primary)]">프로젝트</span><span className="font-bold">기록·제출·검증 진행 보기</span></span>
            <ProjectStatusBadge status={project.status} />
          </Link>
        )}

        {user?.role === "student" && (recruiting || mine) && (
          <div className="card">
            <h3 className="mb-2 font-bold">{mine ? "지원 완료" : "지원하기"}</h3>
            {mine ? (
              <>
                <p className="sub text-sm">&ldquo;{mine.message}&rdquo; · {mine.status === "pending" ? "확인 대기 중" : mine.status === "accepted" ? "선정됨 🎉" : "이번에는 함께하지 못해요"}</p>
                <Link href={`/chats/room?id=${mine.id}`} className="btn btn-ghost mt-3 w-full">💬 {author?.name ?? "가게"}와 채팅하기</Link>
              </>
            ) : paidLocked ? (
              <p className="rounded-xl bg-[var(--line)] px-3 py-2 text-sm">유료 의뢰는 의뢰인 검증을 받은 프로젝트가 {MIN_VERIFIED_FOR_PAID}개 이상일 때 지원할 수 있어요. 자원봉사·비금전 보상 공고로 첫 검증 경험을 쌓아 보세요.</p>
            ) : (
              <>
                {post.isTeam && post.teamSlots && (
                  <fieldset className="mb-3">
                    <legend className="mb-2 text-sm font-semibold">지원 역할</legend>
                    <div className="flex flex-col gap-2">
                      {post.teamSlots.map((slot) => {
                        const filled = slot.filledCount ?? slot.filled.length;
                        const full = filled >= slot.count;
                        return <label key={slot.id ?? slot.category} className={`flex items-center justify-between rounded-xl border p-3 ${full ? "opacity-50" : "cursor-pointer"}`}>
                          <span><input type="radio" name="role" className="mr-2" value={slot.id} disabled={full} checked={roleId === slot.id} onChange={() => setRoleId(slot.id ?? "")} />{slot.label ?? slot.category}</span>
                          <span className="sub text-xs">{filled}/{slot.count}명</span>
                        </label>;
                      })}
                    </div>
                  </fieldset>
                )}
                <textarea aria-label="지원 메시지" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="할 수 있는 것과 가능한 시간을 간단히 적어 주세요" className="h-24 w-full rounded-xl bg-[var(--line)] p-3 text-sm outline-none" />
                <button onClick={submit} disabled={act.busy} className="btn btn-primary mt-3 w-full disabled:opacity-50">지원하기</button>
              </>
            )}
            <div className="mt-2"><ErrorText text={act.error} /></div>
          </div>
        )}

        {isOwner && (
          <div className="card">
            <h3 className="mb-2 font-bold">지원자 {apps.length}명</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {apps.map((a) => { const s = users.find((u) => u.id === a.studentId) as Extract<User, { role: "student" }> | undefined; const role = post.teamSlots?.find((x) => x.id === a.roleId); return (
                <li key={a.id} className="rounded-xl bg-[var(--line)] px-3 py-2">
                  <div className="flex items-center justify-between"><span><b>{s?.name}</b> <span className="sub">{s?.department}</span></span>
                    <span className={a.status === "accepted" ? "font-semibold text-[var(--primary)]" : "sub"}>{a.status === "pending" ? "대기" : a.status === "accepted" ? "선정" : "거절"}</span></div>
                  {s && s.skills.length > 0 && <p className="sub mt-0.5 text-xs">{s.skills.join(" · ")}</p>}
                  {role && <p className="mt-1 text-xs font-semibold text-[var(--primary)]">지원 역할 · {role.label ?? role.category}</p>}
                  <p className="mt-1">{a.message}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                    <Link href={`/chats/room?id=${a.id}`} className="btn bg-white px-2 py-2">💬 채팅</Link>
                    <button onClick={() => select(a)} disabled={act.busy || a.status !== "pending" || (!!project && !post.isTeam)} className="btn btn-primary px-2 py-2 disabled:opacity-40">선정</button>
                    <button onClick={() => reject(a)} disabled={act.busy || a.status !== "pending"} className="btn bg-white px-2 py-2 disabled:opacity-40">거절</button>
                  </div>
                </li>); })}
              {apps.length === 0 && <li className="sub">아직 지원자가 없어요</li>}
            </ul>
            <p className="sub mt-2 text-xs">선정하면 프로젝트가 시작되고, 학생이 분야별 질문에 답하며 과정을 기록해요. 완료는 학생의 제출을 검토·승인할 때 기록됩니다.</p>
            <ErrorText text={act.error} />
          </div>
        )}
        <button onClick={() => router.push("/map")} className="btn btn-ghost w-full">지도에서 보기</button>
      </section>
    </>
  );
}
