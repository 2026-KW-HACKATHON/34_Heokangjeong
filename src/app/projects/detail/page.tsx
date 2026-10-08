"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import EvidenceItem from "@/components/EvidenceItem";
import Verification from "@/components/Verification";
import OperationsCard from "@/components/OperationsCard";
import ClubWorkers from "@/components/ClubWorkers";
import CancelProject from "@/components/CancelProject";
import ProjectAgreement from "@/components/ProjectAgreement";
import Readiness from "@/components/Readiness";
import MissingRequired from "@/components/MissingRequired";
import { ErrorText, ProjectStatusBadge, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { domainForMember, myAnswers, questionsForMember, stageProgress, STAGES, useBundle } from "@/lib/useBundle";
import { listingOf } from "@/lib/listing";
import { DOMAINS } from "@shared/portfolio/domains";
import { computeReadiness } from "@shared/portfolio/readiness";
import { outcomeLine } from "@shared/portfolio/narrative";
import { fmtDate } from "@shared/portfolio/document";
import type { ProjectBundle, ProjectStatus, User } from "@/types";

/** 프로젝트 허브: 지원 → 선정 → 활동 기록 → 증빙 → 제출 → 검증 → 포트폴리오 */
export default function ProjectPage() {
  return <Suspense fallback={<TopBar title="프로젝트" back />}><Project /></Suspense>;
}

const FLOW: { key: string; label: string; done: (b: ProjectBundle) => boolean }[] = [
  { key: "select", label: "선정", done: () => true },
  { key: "log", label: "활동 기록", done: (b) => b.answers.length > 0 || b.logs.length > 0 },
  { key: "evidence", label: "증빙", done: (b) => b.evidence.length > 0 },
  { key: "submit", label: "제출", done: (b) => b.versions.length > 0 },
  { key: "verify", label: "검증", done: (b) => !!b.verification },
  { key: "portfolio", label: "포트폴리오", done: (b) => b.edits.length > 0 },
];

function Project() {
  const id = useSearchParams().get("id") ?? "";
  const { user, users } = useSession();
  const { bundle: b, error, reload } = useBundle(id);
  const act = useAction();
  const [leaderId, setLeaderId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  if (error) return <><TopBar title="프로젝트" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (!b || !user) return <><TopBar title="프로젝트" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;

  const isOwner = user.id === b.project.ownerId;
  const isMember = b.members.some((m) => m.studentId === user.id);
  const me = b.members.find((m) => m.studentId === user.id);
  const listing = listingOf(b.post);
  const name = (uid: string) => users.find((u: User) => u.id === uid)?.name ?? "학생";
  const latest = b.versions.at(-1);
  const status = b.project.status;
  const canSubmit = isMember && (b.project.mode !== "TEAM" || me?.isLead) && (status === "IN_PROGRESS" || status === "REVISION_REQUESTED");
  const approved = b.versions.find((v) => v.id === b.project.approvedVersionId);
  const readiness = isMember ? computeReadiness({ domain: domainForMember(b, user.id), questionIds: questionsForMember(b, user.id).map((q) => q.id), answers: myAnswers(b, user.id), evidenceTypes: b.evidence.filter((e) => e.authorId === user.id).map((e) => e.type), outcomeCount: b.outcomes.filter((o) => o.authorId === user.id).length }) : null;
  const visibleLogs = isOwner ? b.logs : b.logs.filter((l) => l.authorId === user.id);
  const visibleEvidence = isOwner ? b.evidence : b.evidence.filter((e) => e.authorId === user.id);
  const myMemberVerification = b.memberVerifications.find((v) => v.studentId === user.id);
  const selectedLeaderId = leaderId || b.members.find((m) => m.isLead)?.studentId || b.members[0]?.studentId || "";
  const missingRoles = (b.post.teamSlots ?? []).filter((slot) => b.members.filter((m) => m.roleId === slot.id).length < slot.count);

  return (
    <>
      <TopBar title="프로젝트" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card">
          <div className="mb-2 flex items-center justify-between"><span className="chip chip-on">{DOMAINS[b.project.domain].label} 모듈</span><ProjectStatusBadge status={status} /></div>
          <h2 className="text-xl font-bold">{b.post.title}</h2>
          <dl className="sub mt-3 grid grid-cols-[72px_1fr] gap-y-2 text-sm">
            <dt>의뢰인</dt><dd>{name(b.project.ownerId)}</dd>
            <dt>참여 학생</dt><dd className="flex flex-col items-start gap-1">{b.members.map((m) => <Link key={m.studentId} href={`/profiles/view?id=${m.studentId}`} className="font-semibold text-[var(--primary)] underline underline-offset-2">{name(m.studentId)}{m.isLead ? " (팀장)" : ""} · {m.roleLabel}</Link>)}</dd>
            <dt>시작 날짜</dt><dd>{fmtDate(b.project.startedAt ?? b.project.createdAt)}</dd>
          </dl>
          {/* 단체가 맡은 프로젝트: 대표가 실제 작업한 부원을 참여자로 추가하면 그 부원에게도 기록이 남는다 */}
          <ClubWorkers projectId={id} members={b.members} onChange={reload} />
          <ol className="mt-4 flex items-center justify-between gap-1 text-[11px]" aria-label="진행 단계">
            {FLOW.map((f) => (
              <li key={f.key} className="flex flex-1 flex-col items-center gap-1">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${f.done(b) ? "bg-[var(--primary)] text-white" : "bg-[var(--line)] text-[var(--sub)]"}`} aria-hidden>{f.done(b) ? "✓" : "·"}</span>
                <span className={f.done(b) ? "font-semibold" : "sub"}>{f.label}</span>
              </li>
            ))}
          </ol>
        </div>

        <StatusGuide status={status} isOwner={isOwner} isMember={isMember} id={id} latestComment={latest?.status === "REVISION_REQUESTED" ? latest.reviewComment : undefined} />

        {b.project.mode === "TEAM" && status === "RECRUITING" && isOwner && (
          <div className="card">
            <h3 className="font-bold">팀 구성</h3>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {b.members.map((member) => <li key={member.studentId} className="flex items-center justify-between rounded-xl bg-[var(--line)] px-3 py-2"><span><b>{name(member.studentId)}</b> · {member.roleLabel}</span></li>)}
            </ul>
            {missingRoles.length > 0 ? <p className="mt-3 text-sm text-[#c2410c]">인원이 더 필요해요: {missingRoles.map((s) => s.label ?? s.category).join(", ")}</p> : (
              <>
                <label className="mt-3 block text-sm font-semibold">팀장
                  <select className="mt-1 w-full rounded-xl bg-[var(--line)] p-3" value={selectedLeaderId} onChange={(e) => setLeaderId(e.target.value)}>
                    {b.members.map((member) => <option key={member.studentId} value={member.studentId}>{name(member.studentId)} · {member.roleLabel}</option>)}
                  </select>
                </label>
                <button className="btn btn-primary mt-3 w-full" disabled={act.busy || !selectedLeaderId} onClick={() => act.run(async () => { await repo.startTeamProject(id, user.id, selectedLeaderId); await reload(); })}>팀 확정하고 시작</button>
              </>
            )}
            <ErrorText text={act.error} />
          </div>
        )}

        <div className="card text-sm">
          <h3 className="mb-2 font-bold">의뢰 내용</h3>
          <p className="whitespace-pre-line">{listing.problem}</p>
          <dl className="mt-3 grid grid-cols-[76px_1fr] gap-y-1">
            {listing.expectedDeliverables.length > 0 && <><dt className="sub">결과물</dt><dd>{listing.expectedDeliverables.join(", ")} ({listing.deliverableCount}개)</dd></>}
            {listing.completionCriteria && <><dt className="sub">완료 기준</dt><dd>{listing.completionCriteria}</dd></>}
            {listing.deadline && <><dt className="sub">마감</dt><dd>{listing.deadline}</dd></>}
            <dt className="sub">보완 요청</dt><dd>최대 {listing.revisionLimit}번</dd>
          </dl>
        </div>

        {/* 대화에서 쓰고 양쪽이 확인한 계약서 (읽기 전용) */}
        <ProjectAgreement bundle={b} userId={user.id} users={users} />

        {isMember && status !== "RECRUITING" && (
          <div className="card">
            <h3 className="mb-1 font-bold">활동 기록</h3>
            <p className="sub mb-3 text-xs">한 번에 1~3개 질문만 물어봐요. 짧게 답해도 괜찮아요.</p>
            <div className="grid grid-cols-3 gap-2">
              {STAGES.map((s) => {
                const p = stageProgress(b, user.id, s.key);
                return (
                  <Link key={s.key} href={`/projects/log?id=${id}&stage=${s.key}`} className="rounded-xl bg-[var(--line)] p-3 text-center active:opacity-70">
                    <p className="text-sm font-bold">{s.label}</p>
                    <p className="sub text-[11px]">{s.desc}</p>
                    <p className={`mt-1 text-xs font-semibold ${p.handled === p.total ? "text-[var(--green)]" : "text-[var(--primary)]"}`}>{p.answered}/{p.total}</p>
                  </Link>
                );
              })}
            </div>
            {readiness && <MissingRequired r={readiness} href={(q) => `/projects/log?id=${id}&q=${q}&set=${q}&back=${encodeURIComponent(`/projects/detail?id=${id}`)}`} />}
          </div>
        )}
        {(visibleLogs.length > 0 || isMember) && (
          <div className="card">
            <h3 className="mb-2 font-bold">{isOwner ? "팀원별 중간 기록" : "내 중간 기록"} {visibleLogs.length > 0 && <span className="sub text-sm font-normal">{visibleLogs.length}</span>}</h3>
            {visibleLogs.length === 0 && <p className="sub text-sm">진행 단계에서 오늘 한 일을 남길 수 있어요.</p>}
            <ol className="flex flex-col gap-2 text-sm">{visibleLogs.map((l) => <li key={l.id} className="rounded-xl bg-[var(--line)] px-3 py-2"><span className="sub mr-1 text-xs">{isOwner && `${name(l.authorId)} · `}{fmtDate(l.createdAt)} · {STAGES.find((s) => s.key === l.stage)?.label}</span>{l.note}</li>)}</ol>
          </div>
        )}

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">{isOwner ? "팀원별 증빙" : "내 증빙"} <span className="sub text-sm font-normal">{visibleEvidence.length}</span></h3>
            {(isMember || isOwner) && status !== "RECRUITING" && <Link href={`/projects/evidence?id=${id}`} className="text-sm font-semibold text-[var(--primary)]">+ 추가</Link>}
          </div>
          {visibleEvidence.length === 0 ? <p className="sub text-sm">Before 사진, 결과물 파일, 링크를 올려 주세요. 학생의 주장만으로 포트폴리오를 만들지 않아요.</p>
            : <div className="grid grid-cols-2 gap-2">{visibleEvidence.map((e) => <div key={e.id}>{isOwner && <p className="sub mb-1 text-xs">{name(e.authorId)}</p>}<EvidenceItem e={e} compact /></div>)}</div>}
        </div>

        <div className="card">
          <h3 className="mb-2 font-bold">제출 기록</h3>
          {b.versions.length === 0 && <p className="sub text-sm">아직 제출하지 않았어요.</p>}
          <ol className="flex flex-col gap-2 text-sm">
            {[...b.versions].reverse().map((v) => (
              <li key={v.id} className="rounded-xl bg-[var(--line)] px-3 py-2">
                <div className="flex items-center justify-between"><b>v{v.version}</b>
                  <span className={`text-xs font-semibold ${v.status === "APPROVED" ? "text-[var(--green)]" : v.status === "REVISION_REQUESTED" ? "text-[#c2410c]" : "text-[var(--primary)]"}`}>{v.status === "APPROVED" ? "승인됨" : v.status === "REVISION_REQUESTED" ? "보완 요청" : "검토 대기"}</span></div>
                <p className="sub text-xs">{fmtDate(v.createdAt)} · 결과물 {v.evidenceIds.length}개</p>
                {v.note && <p className="mt-1">{v.note}</p>}
                {v.reviewComment && <p className="mt-1 rounded-lg bg-white px-2 py-1 text-xs">의뢰인: {v.reviewComment}</p>}
              </li>
            ))}
          </ol>
          {canSubmit && <Link href={`/projects/submit?id=${id}`} className="btn btn-primary mt-3 w-full">{status === "REVISION_REQUESTED" ? `보완해서 v${(latest?.version ?? 0) + 1} 제출하기` : "결과물 제출하기"}</Link>}
          {isOwner && status === "REVIEW_PENDING" && <Link href={`/projects/review?id=${id}`} className="btn btn-primary mt-3 w-full">v{latest?.version} 검토하기</Link>}
        </div>

        {status === "COMPLETED" && (
          <div className="card">
            <h3 className="mb-2 font-bold">의뢰인 검증</h3>
            <Verification v={b.verification} outcomes={b.outcomes} approvedVersion={approved?.version} />
            {b.review && <>
              <p className="mt-3 rounded-xl bg-[var(--line)] px-3 py-2 text-sm">“{b.review.comment || "평가 코멘트 없음"}” <span className="sub text-xs">· 만족도 {b.review.satisfaction}/5 · 결과물 {b.review.deliverableQuality}/5</span></p>
              {(b.review.status === "FLAGGED" || b.review.status === "DISPUTED" || b.review.status === "UNDER_REVIEW") && <p role="status" className="mt-2 rounded-xl bg-[#fff7ed] px-3 py-2 text-sm text-[#9a3412]">검토 중인 평가입니다. 확정 전까지 평판 별점에 반영되지 않아요.</p>}
              {isMember && (b.review.status === "NORMAL" || b.review.status === "VALID" || b.review.status === "PARTIALLY_VALID") && <details className="mt-3 rounded-xl border border-[var(--line)] p-3 text-sm">
                <summary className="cursor-pointer font-semibold">이 평가에 이의가 있어요</summary>
                <p className="sub mt-2 text-xs">제출 결과물, 승인 기록, 증빙과 다른 부분을 적어 주세요. 이의제기 즉시 평판 반영이 보류됩니다.</p>
                <textarea aria-label="이의제기 사유" className="mt-2 h-24 w-full rounded-xl bg-[var(--line)] p-3" value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="평가와 프로젝트 기록이 다른 이유" />
                <button className="btn btn-ghost mt-2 w-full" disabled={act.busy || disputeReason.trim().length < 10} onClick={() => act.run(async () => { await repo.disputeReview(id, user.id, disputeReason); setDisputeReason(""); await reload(); })}>이의제기 제출</button>
                <ErrorText text={act.error} />
              </details>}
            </>}
          </div>
        )}

        {/* 계속 운영되는 결과물이면 완료 후 운영·유지보수·인수인계가 이어진다 */}
        {/* 합의 취소: 요청 → 상대 1명 수락, 3일 무응답은 거절 */}
        <CancelProject bundle={b} onChange={reload} />

        {status === "COMPLETED" && <OperationsCard projectId={id} post={b.post} users={users} />}

        {status !== "RECRUITING" && (
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">성과 <span className="sub text-xs font-normal">결과물과 따로 기록해요</span></h3>
              {isMember && <Link href={`/projects/outcome?id=${id}`} className="text-sm font-semibold text-[var(--primary)]">+ 추가</Link>}
            </div>
            {b.outcomes.length === 0 && <p className="sub text-sm">측정한 성과가 없어도 프로젝트는 완료할 수 있어요. 나중에 후속 성과를 더할 수 있어요.</p>}
            <ul className="flex flex-col gap-2 text-sm">
              {b.outcomes.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--line)] px-3 py-2">
                  <span>{outcomeLine(o)}</span>
                  {isOwner && o.measured && !o.verified && <button disabled={act.busy} onClick={() => act.run(async () => { await repo.verifyOutcome(o.id, user.id); await reload(); })} className="btn shrink-0 bg-white px-2 py-1 text-xs">수치 확인</button>}
                </li>
              ))}
            </ul>
            <ErrorText text={act.error} />
          </div>
        )}

        {isMember && readiness && (
          <div className="card">
            <Readiness r={readiness} fixHref={(q) => `/projects/log?id=${id}&q=${q}&set=${q}&back=${encodeURIComponent(`/projects/detail?id=${id}`)}`} />
            {status === "COMPLETED"
              ? b.project.mode === "TEAM" && !myMemberVerification?.verified
                ? <p className="mt-3 rounded-xl bg-[var(--line)] p-3 text-sm">의뢰인의 실제 참여 확인을 받은 팀원만 개인 포트폴리오를 만들 수 있어요.</p>
                : <Link href={`/portfolio/build?id=${id}`} className="btn btn-primary mt-3 w-full">{b.edits.some((e) => e.studentId === user.id) ? "내 포트폴리오 보기·고치기" : "포트폴리오 만들기"}</Link>
              : <p className="sub mt-3 text-xs">의뢰인이 승인·검증하면 이 자료로 포트폴리오를 만들 수 있어요. 진행하면서 미리 채워 두세요.</p>}
          </div>
        )}
        <Link href={`/posts/detail?id=${b.post.id}`} className="btn btn-ghost w-full">공고 보기</Link>
      </section>
    </>
  );
}

function StatusGuide({ status, isOwner, isMember, id, latestComment }: { status: ProjectStatus; isOwner: boolean; isMember: boolean; id: string; latestComment?: string }) {
  const msg: Partial<Record<ProjectStatus, [string, string]>> = isOwner
    ? { IN_PROGRESS: ["학생이 작업 중이에요", "제출되면 여기서 검토할 수 있어요."], REVIEW_PENDING: ["검토할 제출이 있어요", "결과물을 보고 보완 요청 또는 승인·검증을 해 주세요."], REVISION_REQUESTED: ["보완을 기다리는 중", "학생이 다시 제출하면 알려 드려요."], COMPLETED: ["완료·검증된 프로젝트", "확인해 주신 내용이 학생 포트폴리오에 검증 기록으로 남아요."] }
    : isMember
      ? { IN_PROGRESS: ["기록하며 진행해요", "시작 질문부터 답하고, Before 사진을 증빙으로 올려 두세요."], REVIEW_PENDING: ["의뢰인이 검토 중이에요", "보완 요청이 오면 수정해서 다시 제출할 수 있어요."], REVISION_REQUESTED: ["보완 요청이 왔어요", latestComment ?? ""], COMPLETED: ["검증이 끝났어요 🎉", "빠진 기록을 채우고 포트폴리오를 만들어 보세요."] }
      : {};
  const m = msg[status];
  if (!m) return null;
  return (
    <div className={`card ${status === "REVISION_REQUESTED" && isMember ? "bg-orange-50" : "bg-[var(--primary-weak)]"}`}>
      <p className="font-bold">{m[0]}</p>
      {m[1] && <p className="mt-0.5 text-sm">{m[1]}</p>}
      {isMember && status === "IN_PROGRESS" && <Link href={`/projects/log?id=${id}&stage=START`} className="btn btn-primary mt-3 w-full">시작 기록하기</Link>}
    </div>
  );
}
