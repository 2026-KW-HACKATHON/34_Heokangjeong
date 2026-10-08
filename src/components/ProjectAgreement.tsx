"use client";
import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import type { WorkAgreement } from "@/lib/agreement";
import type { ProjectBundle, User } from "@/types";

/**
 * 프로젝트 화면의 약속서 (채팅에서 쓰고 양쪽이 확인한 것을 읽기 전용으로).
 * 학생은 자기 약속서, 의뢰인은 팀원마다. 고치는 곳은 대화방(약속서)이다.
 */
export default function ProjectAgreement({ bundle, userId, users }: { bundle: ProjectBundle; userId: string; users: User[] }) {
  const isOwner = bundle.project.ownerId === userId;
  const members = bundle.members.filter((m) => m.applicationId && (isOwner || m.studentId === userId));
  const [rows, setRows] = useState<Record<string, WorkAgreement | null | "error">>({});
  useEffect(() => {
    let active = true;
    for (const m of members) {
      repo.getAgreement(m.applicationId!, userId)
        .then((a) => { if (active) setRows((r) => ({ ...r, [m.applicationId!]: a })); })
        .catch(() => { if (active) setRows((r) => ({ ...r, [m.applicationId!]: "error" })); });
    }
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.project.id, userId, members.map((m) => m.applicationId).join()]);
  // 약속서가 있는 것만 (약속서 없이 끝난 예전·데모 프로젝트는 칸 자체를 숨긴다)
  const shown = members.filter((m) => { const a = rows[m.applicationId!]; return a && a !== "error"; });
  if (!shown.length) return null;
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "학생";

  return (
    <div className="card text-sm" aria-label="약속서">
      <h3 className="mb-2 font-bold">약속서</h3>
      <div className="flex flex-col gap-4">
        {shown.map((m) => {
          const a = rows[m.applicationId!] as WorkAgreement;
          return (
            <section key={m.studentId}>
              {isOwner && shown.length > 1 && <p className="mb-1 text-xs font-semibold">{name(m.studentId)} · {m.roleLabel}</p>}
              <>
                <p className={`mb-2 text-xs font-semibold ${a.finalizedAt ? "text-[var(--green)]" : "text-[#c2410c]"}`}>
                  {a.finalizedAt ? `양쪽 확인 완료 · ${a.finalizedAt.slice(0, 10)} 확정` : "아직 확정 전이에요 · 양쪽이 확인하면 확정돼요"}
                </p>
                <dl className="grid grid-cols-[84px_1fr] gap-y-1.5">
                  {([
                    ["작업 기간", `${a.terms.startDate} ~ ${a.terms.endDate}`], ["작업 범위", a.terms.scope], ["결과물", a.terms.deliverables],
                    ["완료 기준", a.terms.acceptance], ["쿠폰·지급", a.terms.coupon], ["완료 전 수정", `${a.terms.revisions}회`],
                    ["인계 방법", a.terms.handoff], ["제외 범위", a.terms.exclusions || "별도 기재 없음"],
                  ] as const).map(([k, v]) => <div key={k} className="contents"><dt className="sub">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>)}
                </dl>
              </>
            </section>
          );
        })}
      </div>
    </div>
  );
}
