"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import StatusBadge from "@/components/StatusBadge";
import { collegeLabel } from "@/lib/colleges";
import { clubKindLabel } from "@/lib/clubs";
import type { Club } from "@/types";
import Icon from "@/components/Icon";
import { ErrorText, ProjectStatusBadge, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { distanceM, formatDistance } from "@/lib/geo";
import { listingOf } from "@/lib/listing";
import { DOMAINS } from "@shared/portfolio/domains";
import type { Application, Post, Project, User } from "@/types";

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
  const [msg, setMsg] = useState("");
  const [roleId, setRoleId] = useState("");
  const [clubId, setClubId] = useState("");                 // 단체 이름으로 지원하기 (소속이 확정된 단체만)
  const [myClubs, setMyClubs] = useState<{ club: Club; role: string }[]>([]);   // 단체 이름으로 지원은 대표만
  const act = useAction();
  const reload = () => { repo.getPost(id).then((p) => setPost(p ?? null)); repo.listApplications(id).then(setApps); repo.getProjectByPost(id).then(setProject).catch(() => setProject(undefined)); };
  useEffect(reload, [id]);
  useEffect(() => { if (user?.role === "student") repo.myClubs(user.id).then((list) => setMyClubs(list.filter((m) => m.role === "LEADER"))); }, [user]);
  if (!post) return <><TopBar title="공고" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const author = users.find((u) => u.id === post.authorId) as Extract<User, { role: "resident" }> | undefined;
  const mine = apps.find((a) => a.studentId === user?.id);
  const scope = post.applicantScope ?? "ANY";
  const isOwner = user?.id === post.authorId;
  const listing = listingOf(post);
  const recruiting = post.status === "open";
  const selectedApplication = apps.find((a) => a.status === "accepted");
  const selectedStudent = users.find((u) => u.id === selectedApplication?.studentId);
  const individualDecisionComplete = !post.isTeam && !!project;

  async function submit() {
    if (!user || user.role !== "student") return;
    await act.run(async () => {
      if (post!.isTeam && !roleId) throw new Error("지원할 역할을 선택해 주세요");
      await repo.apply(post!.id, user.id, msg || "지원합니다!", roleId || undefined, clubId || undefined);
      setMsg(""); reload();
    });
  }
  async function select(a: Application) {
    await act.run(async () => { await repo.shortlistApplicant(a.id, user!.id); router.push(`/chats/room?id=${a.id}`); });
  }
  async function cancelSelect(a: Application) { await act.run(async () => { await repo.cancelShortlist(a.id, user!.id); reload(); }); }
  const shortlisting = apps.some((x) => x.status === "pending" && x.shortlistedAt);   // 개인 공고: 한 번에 한 명만 선정 중
  async function reject(a: Application) { await act.run(async () => { await repo.updateApplicationStatus(a.id, "rejected"); reload(); }); }

  return (
    <>
      <TopBar title="공고" back />
      <section className="flex flex-col gap-5 px-5 pb-6">
        <div className="card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5">
              {post.urgent && <span className="chip bg-[var(--red)] font-bold text-white">🚨 긴급</span>}
              {post.handoverOfProject && <span className="chip bg-[var(--primary)] font-bold text-white">🔧 이어받기</span>}
              {(post.applicantScope ?? "ANY") !== "ANY" && <span className="chip">{post.applicantScope === "CLUB" ? "단체만 지원" : "개인만 지원"}</span>}
              <span className="chip chip-on">{post.category}{post.isTeam ? " · 팀 프로젝트" : ""}</span>
            </span>
            <StatusBadge status={post.status} />
          </div>
          {post.handoverOfProject && (
            <p className="sub mb-1 text-xs">이미 운영 중인 서비스예요. 선정되면 인수인계서를 받고 바로 이어받아요.</p>
          )}
          {post.urgent && post.urgentColleges && post.urgentColleges.length > 0 && (
            <p className="sub mb-1 text-xs">{post.urgentColleges.map(collegeLabel).filter(Boolean).join(", ")} 학생에게 알림이 갔어요</p>
          )}
          <div className="silver-badge mb-5 mt-4"><Icon name="folder" width={22} height={22} /></div>
          <h2 className="page-title">{post.title}</h2>
          <p className="sub mt-1 text-sm">{author?.name} · {post.address}{user && <> · 📍 {formatDistance(distanceM(user.location, post.location))}</>}</p>
          <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{post.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-xl bg-[var(--line)] p-2"><dt className="sub text-xs">기간</dt><dd className="font-semibold">{post.durationDays > 0 ? `${post.durationDays}일` : "계약 시 협의"}</dd></div>
            <div className="rounded-xl bg-[var(--line)] p-2"><dt className="sub text-xs">{listing.compensationType === "PAID" ? post.urgent ? "긴급 추가수당" : "기존 보상" : "가게 쿠폰"}</dt><dd className="truncate font-semibold">{listing.compensationType === "PAID" && listing.paidAmount ? `${listing.paidAmount.toLocaleString()}원` : listing.compensationDescription || "미기재"}</dd></div>
          </dl>
          {post.urgent && <p className="mt-2 text-sm">가게 쿠폰: {listing.compensationDescription || post.reward || "미기재"}</p>}
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
                <p className="sub text-sm">&ldquo;{mine.message}&rdquo; · {mine.status === "accepted" ? "선정 확정 🎉" : mine.status === "rejected" ? "이번에는 함께하지 못해요" : mine.shortlistedAt ? "선정됐어요 · 대화하며 계약서를 확정하면 시작해요" : mine.shortlistCancelledAt ? "선정이 취소됐어요 · 채팅은 계속할 수 있어요" : "확인 대기 중"}</p>
                {(mine.status === "accepted" || mine.status === "pending") && <Link href={`/chats/room?id=${mine.id}`} className="btn btn-ghost mt-3 w-full">채팅창으로 가기</Link>}
              </>
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
                {scope !== "INDIVIDUAL" && (
                  <fieldset className="mb-2">
                    <legend className="mb-1.5 text-sm font-semibold">누구 이름으로 지원하나요?</legend>
                    {myClubs.length === 0 ? (
                      <p className="sub text-xs">{scope === "CLUB"
                        ? "단체만 지원할 수 있는 공고예요. 단체 이름으로는 대표만 지원할 수 있어요. 부원이면 대표에게 알려 주세요."
                        : "내가 대표인 단체가 있으면 단체 이름으로도 지원할 수 있어요."}</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {scope === "ANY" && <button type="button" aria-pressed={clubId === ""} onClick={() => setClubId("")} className={`chip ${clubId === "" ? "chip-on" : ""}`}>개인</button>}
                          {myClubs.map(({ club }) => (
                            <button key={club.id} type="button" aria-pressed={clubId === club.id} onClick={() => setClubId(club.id)} className={`chip ${clubId === club.id ? "chip-on" : ""}`}>{club.name}</button>
                          ))}
                        </div>
                        {clubId && <p className="sub mt-1 text-xs">단체 이름으로 맡으면 담당자가 바뀌어도 단체가 계속 관리해요. ({clubKindLabel(myClubs.find((m) => m.club.id === clubId)!.club)})</p>}
                      </>
                    )}
                  </fieldset>
                )}
                <textarea aria-label="지원 메시지" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="할 수 있는 것과 가능한 시간을 간단히 적어 주세요" className="h-24 w-full rounded-xl bg-[var(--line)] p-3 text-sm outline-none" />
                <button onClick={submit} disabled={act.busy || (scope === "CLUB" && !clubId)} className="btn btn-primary mt-3 w-full disabled:opacity-50">지원하기</button>
              </>
            )}
            <div className="mt-2"><ErrorText text={act.error} /></div>
          </div>
        )}

        {isOwner && (
          <div className="card">
            <h3 className="mb-2 font-bold">지원자 {apps.length}명</h3>
            {individualDecisionComplete && <p className="mb-3 rounded-xl bg-[var(--primary-weak)] px-3 py-2 text-sm">
              <b>{selectedStudent?.name ?? "지원자"} 학생 선정 완료</b><br />나머지 지원자에게는 미선정 안내가 자동으로 전달됐어요.
            </p>}
            <ul className="flex flex-col gap-2 text-sm">
              {apps.map((a) => { const s = users.find((u) => u.id === a.studentId) as Extract<User, { role: "student" }> | undefined; const role = post.teamSlots?.find((x) => x.id === a.roleId); return (
                <li key={a.id} className="rounded-xl bg-[var(--line)] px-3 py-2">
                  <div className="flex items-center justify-between"><span><b>{s?.name}</b> <span className="sub">{s?.department}</span></span>
                    <span className={a.status === "accepted" || a.shortlistedAt ? "font-semibold text-[var(--primary)]" : "sub"}>{a.status === "accepted" ? "선정 확정" : a.status === "rejected" ? "거절" : a.shortlistedAt ? "매칭 대기" : a.shortlistCancelledAt ? "선정 취소" : "대기"}</span></div>
                  {s && s.skills.length > 0 && <p className="sub mt-0.5 text-xs">{s.skills.join(" · ")}</p>}
                  {role && <p className="mt-1 text-xs font-semibold text-[var(--primary)]">지원 역할 · {role.label ?? role.category}</p>}
                  <p className="mt-1">{a.message}</p>
                  {a.status === "pending" && a.shortlistedAt ? <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                    {/* 매칭 대기: 대화하며 계약서를 확정하면 선정 확정, 틀어지면 선정 취소 */}
                    <Link href={`/chats/room?id=${a.id}`} className="btn btn-primary px-2 py-2">💬 대화 · 계약서</Link>
                    <button onClick={() => cancelSelect(a)} disabled={act.busy} className="btn bg-white px-2 py-2 disabled:opacity-40">선정 취소</button>
                  </div> : a.status === "pending" && !individualDecisionComplete ? <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                    <Link href={`/chats/room?id=${a.id}`} className="btn bg-white px-2 py-2">채팅창으로 가기</Link>
                    <button onClick={() => select(a)} disabled={act.busy || (!post.isTeam && shortlisting)} title={!post.isTeam && shortlisting ? "선정 중인 지원자가 있어요" : undefined} className="btn btn-primary px-2 py-2 disabled:opacity-40">선정</button>
                    <button onClick={() => reject(a)} disabled={act.busy} className="btn bg-white px-2 py-2 disabled:opacity-40">거절</button>
                  </div> : <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                    <Link href={`/chats/room?id=${a.id}`} className="btn bg-white px-2 py-2">💬 채팅</Link>
                    <span className={`btn cursor-default px-2 py-2 ${a.status === "accepted" ? "btn-primary" : "bg-white sub"}`}>{a.status === "accepted" ? "선정 완료" : "미선정 안내 완료"}</span>
                  </div>}
                </li>); })}
              {apps.length === 0 && <li className="sub">아직 지원자가 없어요</li>}
            </ul>
            <p className="sub mt-2 text-xs">지원 직후부터 학생과 대화할 수 있어요. 선정하면 계약서를 써요. 계약서를 양쪽이 확정하면 선정이 확정되고 프로젝트가 시작돼요. 대화하다 맞지 않으면 선정을 취소하고 다른 지원자를 선정할 수 있어요{!post.isTeam && " (한 번에 한 명)"}.{individualDecisionComplete && " 다시 시험하려면 ‘나 → 데모 데이터 초기화’를 이용하세요."}</p>
            <ErrorText text={act.error} />
          </div>
        )}

        {/* 공고 삭제: 작성자만, 학생을 선정하기 전까지 */}
        {isOwner && !project && (
          <button
            onClick={() => act.run(async () => {
              if (!confirm("이 공고를 지울까요? 받은 지원도 함께 사라져요.")) return;
              await repo.deletePost(post.id, user!.id);
              router.replace("/");
            })}
            disabled={act.busy}
            className="btn btn-ghost w-full text-[var(--red)]">공고 삭제</button>
        )}
        <button onClick={() => router.push("/map")} className="btn btn-ghost w-full">지도에서 보기</button>
      </section>
    </>
  );
}
