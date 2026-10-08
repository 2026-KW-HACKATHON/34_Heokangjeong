"use client";
import { useEffect, useState } from "react";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { ErrorText, useAction } from "@/components/ui";
import type { ClubMember, ProjectMember } from "@/types";

/**
 * 단체가 맡은 프로젝트에서, 대표가 "실제로 이 작업을 한 부원" 을 추가한다.
 * 추가된 부원에게도 검증된 활동 기록(포트폴리오)이 남는다. 채팅은 그대로 대표 ↔ 사장님 1대1.
 */
export default function ClubWorkers({ projectId, members, onChange }: { projectId: string; members: ProjectMember[]; onChange: () => void }) {
  const { user, users } = useSession();
  const [mates, setMates] = useState<ClubMember[]>([]);
  const [open, setOpen] = useState(false);
  const act = useAction();

  useEffect(() => {
    if (user?.role !== "student") return;
    repo.myClubs(user.id).then(async (mine) => {
      const led = mine.find((m) => m.role === "LEADER");
      if (!led) return;
      const list = await repo.listClubMembers(led.club.id);
      setMates(list.filter((m) => m.status === "ACTIVE" && m.studentId !== user.id));
    });
  }, [user]);

  // 내가 이 프로젝트의 참여자이면서 어떤 단체의 대표일 때만 보여 준다
  if (!user || !members.some((m) => m.studentId === user.id) || mates.length === 0) return null;
  const left = mates.filter((m) => !members.some((x) => x.studentId === m.studentId));
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? "부원";

  return (
    <div className="mt-3 rounded-xl bg-[var(--line)] p-3 text-sm">
      <button type="button" onClick={() => setOpen(!open)} className="font-semibold">＋ 함께 작업한 부원 추가</button>
      <p className="sub mt-0.5 text-xs">추가하면 그 부원에게도 이 활동이 검증 기록으로 남아요.</p>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {left.length === 0 && <p className="sub text-xs">추가할 부원이 없어요.</p>}
          {left.map((m) => (
            <button key={m.studentId} onClick={() => act.run(async () => {
              const role = prompt(`${name(m.studentId)} 님이 맡은 역할을 적어 주세요`, "참여") ?? "참여";
              await repo.addClubWorker(projectId, m.studentId, role, user.id);
              onChange();
            })} disabled={act.busy} className="chip bg-white">{name(m.studentId)}</button>
          ))}
        </div>
      )}
      <ErrorText text={act.error} />
    </div>
  );
}
