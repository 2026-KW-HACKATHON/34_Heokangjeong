"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { ErrorText, useAction } from "@/components/ui";
import { COVERAGE_LABEL, OPERATION_LABEL, TICKET_KIND_LABEL, canOpenHandover, daysLeft, handoverReadiness } from "@/lib/maintenance";
import type { ClubMember, OperationsBundle, Post, TicketKind, User } from "@/types";

/**
 * 완료 후 운영 카드. 점주는 담당자·보증 기간·인수인계 준비도를 보고 유지보수를 요청하고,
 * 담당 학생은 인수인계 정보를 채우고 인계를 요청한다. (계속 운영되는 결과물 공고에만 붙는다)
 */
export default function OperationsCard({ projectId, post, users }: { projectId: string; post: Post; users: User[] }) {
  const { user } = useSession();
  const [b, setB] = useState<OperationsBundle | null | undefined>(undefined);
  const [kind, setKind] = useState<TicketKind>("BUG");
  const [body, setBody] = useState("");
  const [mates, setMates] = useState<ClubMember[]>([]);   // 같은 단체 소속 (담당자 넘기기용)
  const act = useAction();
  const reload = () => repo.getOperations(projectId).then(setB);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [projectId]);
  useEffect(() => {
    const clubId = b && b !== null ? b.operations.clubId : undefined;
    if (clubId) repo.listClubMembers(clubId).then((list) => setMates(list.filter((m) => m.status === "ACTIVE")));
  }, [b]);

  if (b === undefined) return null;
  if (b === null) return null;                    // 운영이 아직 시작되지 않음(완료 전) 또는 만들고 끝나는 일
  const o = b.operations;
  const isMaintainer = user?.id === o.maintainerId;
  const isOwner = user?.id === post.authorId;
  const name = (id?: string) => users.find((u) => u.id === id)?.name ?? "미정";
  const ready = handoverReadiness(o);
  const req = daysLeft(o.warrantyRequestUntil);
  const def = daysLeft(o.warrantyDefectUntil);
  const left = Math.max(0, (post.warrantyRequestCount ?? 3) - o.requestUsed);

  const run = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await reload(); });

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">🔧 운영 상태</h3>
        <span className={`chip ${o.status === "HANDOVER_OPEN" ? "bg-[var(--yellow)] text-white" : "chip-on"}`}>{OPERATION_LABEL[o.status]}</span>
      </div>

      <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-sm">
        <dt className="sub">담당 학생</dt><dd>{name(o.maintainerId)}{o.clubId && <span className="sub"> · 단체가 관리</span>}</dd>
        <dt className="sub">내용 수정</dt>
        <dd>{req === null ? "—" : req > 0 ? `D-${req} · ${left}회 남음` : <span className="text-[var(--sub)]">기간 지남</span>}</dd>
        <dt className="sub">오류·버그</dt>
        <dd>{def === null ? "—" : def > 0 ? `D-${def}` : <span className="text-[var(--sub)]">기간 지남</span>}</dd>
        {o.deployUrl && <><dt className="sub">사이트</dt><dd className="truncate"><a href={o.deployUrl} target="_blank" rel="noreferrer" className="text-[var(--primary)] underline">{o.deployUrl}</a></dd></>}
        <dt className="sub">가동 점검</dt>
        <dd className="flex items-center gap-2">
          {o.lastCheckAt ? <span className={o.lastCheckOk ? "text-[var(--green)]" : "text-[var(--red)]"}>{o.lastCheckOk ? "정상" : "응답 없음"}</span> : <span className="sub">아직 안 함</span>}
          <button onClick={() => run(async () => {
            const ok = o.deployUrl ? await fetch(o.deployUrl, { mode: "no-cors" }).then(() => true).catch(() => false) : false;
            await repo.recordUptime(projectId, ok);
          })} className="sub text-xs underline">지금 점검하기</button>
        </dd>
      </dl>

      {/* 인수인계 준비도 — 다음 사람이 이어받을 수 있는 상태인가 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="sub">인수인계 준비도</span><b>{ready.percent}%</b>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
          <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${ready.percent}%` }} />
        </div>
        {ready.missingRequired.length > 0 && <p className="sub mt-1 text-xs">아직 필요해요: {ready.missingRequired.map((f) => f.label).join(", ")}</p>}
      </div>

      {b.doc && <Link href={`/projects/handover?id=${projectId}`} className="text-sm text-[var(--primary)]">📄 인수인계서 보기 ›</Link>}

      {/* 단체가 맡은 서비스: 같은 단체 안에서는 사장님 승인 없이 담당자를 넘긴다 */}
      {o.clubId && (isMaintainer || mates.some((m) => m.studentId === user?.id && m.role === "LEADER")) && mates.length > 1 && (
        <div className="rounded-xl bg-[var(--line)] p-3">
          <p className="text-sm font-semibold">단체 안에서 담당자 넘기기</p>
          <p className="sub mb-2 text-xs">같은 단체 부원에게 넘기면 사장님 승인 없이 바로 바뀌어요. 단체 밖으로 넘길 때만 이어받기 공고가 올라가요.</p>
          <div className="flex flex-wrap gap-1.5">
            {mates.filter((m) => m.studentId !== o.maintainerId).map((m) => (
              <button key={m.studentId} onClick={() => run(() => repo.assignMaintainer(projectId, m.studentId, user!.id))} disabled={act.busy} className="chip bg-white">
                {name(m.studentId)}에게
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 담당 학생: 인수인계 작성 · 인계 요청 */}
      {isMaintainer && (
        <div className="flex flex-col gap-2">
          <Link href={`/projects/handover?id=${projectId}`} className="btn btn-primary w-full">인수인계 정보 작성</Link>
          {o.status !== "HANDOVER_OPEN" && (
            <button onClick={() => run(() => repo.openHandover(projectId, user!.id))} disabled={!canOpenHandover(o) || act.busy} className="btn btn-ghost w-full disabled:opacity-40">
              인계 요청 (더 이상 맡기 어려워요)
            </button>
          )}
          {!canOpenHandover(o) && <p className="sub text-xs">인수인계 필수 항목을 모두 채우면 인계를 요청할 수 있어요.</p>}
        </div>
      )}

      {/* 인계 모집 중이면 다른 공고처럼 홈·지도에 '[이어받기] ...' 공고가 올라간다 */}
      {o.status === "HANDOVER_OPEN" && (
        <p className="rounded-xl bg-[var(--primary-weak)] p-3 text-xs leading-5">
          다음 담당자를 모집 중이에요. 홈 피드에 <b>[이어받기]</b> 공고로 올라가 있고, 학생이 지원하면 사장님이 선정해요.
        </p>
      )}

      {/* 점주: 유지보수 요청 */}
      {isOwner && (
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--line)] p-3">
          <p className="text-sm font-semibold">유지보수 요청하기</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TICKET_KIND_LABEL) as TicketKind[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`chip ${kind === k ? "chip-on" : "bg-white"}`}>{TICKET_KIND_LABEL[k]}</button>
            ))}
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="예: 메뉴 사진이 업로드가 안 돼요" className="h-16 w-full rounded-xl bg-white p-3 text-sm outline-none" />
          <button onClick={() => run(async () => {
            if (!body.trim()) throw new Error("어떤 점이 불편한지 적어 주세요");
            await repo.createTicket(projectId, user!.id, kind, body.trim()); setBody("");
          })} disabled={act.busy} className="btn btn-primary w-full">요청 보내기</button>
        </div>
      )}

      {/* 요청 목록 */}
      {b.tickets.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {b.tickets.map((t) => (
            <li key={t.id} className="rounded-xl bg-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{TICKET_KIND_LABEL[t.kind]}</span>
                <span className={`text-xs ${t.coverage.startsWith("FREE") ? "text-[var(--primary)]" : "sub"}`}>{COVERAGE_LABEL[t.coverage]}</span>
              </div>
              <p className="mt-1">{t.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="sub">{t.status === "DONE" ? "처리 완료" : t.assigneeId ? `담당: ${name(t.assigneeId)}` : "담당자 미정"}</span>
                {t.status === "OPEN" && (t.assigneeId === user?.id || t.authorId === user?.id) && (
                  <button onClick={() => run(() => repo.closeTicket(t.id, user!.id))} className="text-[var(--primary)] underline">처리 완료로 표시</button>
                )}
              </div>
              {t.coverage === "NEW_POST" || t.coverage === "EXPIRED" ? (
                <Link href="/posts/new" className="mt-1 block text-xs text-[var(--primary)]">새 공고로 올리기 ›</Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* 담당자 이력 — 사람은 바뀌어도 프로젝트는 남는다 */}
      {b.history.length > 0 && (
        <details className="text-xs">
          <summary className="sub cursor-pointer">담당자 이력 {b.history.length}명</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {b.history.map((h) => (
              <li key={h.id} className="flex justify-between"><span>{name(h.studentId)}</span>
                <span className="sub">{h.startedOn} ~ {h.endedOn ?? "현재"} · 요청 {h.ticketsClosed}건 처리</span></li>
            ))}
          </ul>
        </details>
      )}
      <ErrorText text={act.error} />
    </section>
  );
}
