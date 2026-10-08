"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import EmptyState from "@/components/EmptyState";
import { ErrorText, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { CLUB_KINDS, clubKindLabel } from "@/lib/clubs";
import { COLLEGES, collegeLabel } from "@/lib/colleges";
import type { Club, ClubKind } from "@/types";

/**
 * 단체(동아리·학회·학생회) 목록.
 * 이미 등록된 단체 중에서 고르고, 없으면 새로 신청한다(관리자 승인 후 목록에 뜬다).
 * 가입은 신청만 하고, 그 단체 대표가 수락해야 소속이 된다.
 */
export default function Clubs() {
  const { user } = useSession();
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [mine, setMine] = useState<{ club: Club; role: string }[]>([]);
  const [kind, setKind] = useState<ClubKind | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", kind: "CENTRAL" as ClubKind, kindOther: "", description: "", college: "" });
  const act = useAction();
  const create = useAction();

  const reload = () => {
    repo.listClubs().then(setClubs);
    if (user) repo.myClubs(user.id).then(setMine);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [user]);

  const joined = new Set(mine.map((m) => m.club.id));
  const shown = (clubs ?? []).filter((c) =>
    (kind === "ALL" || c.kind === kind) && (!q.trim() || c.name.includes(q.trim())));

  return (
    <>
      <TopBar title="단체" back={user?.role !== "admin"} />
      <section className="flex flex-col gap-3 px-4">
        {mine.length > 0 && (
          <div className="card flex flex-col gap-2">
            <h3 className="font-bold">내 단체</h3>
            {mine.map(({ club, role }) => (
              <Link key={club.id} href={`/clubs/detail?id=${club.id}`} className="flex items-center justify-between rounded-xl bg-[var(--line)] px-3 py-2 text-sm">
                <span><b>{club.name}</b> <span className="sub">{clubKindLabel(club)}</span></span>
                <span className="sub text-xs">{role === "LEADER" ? "대표" : "부원"} ›</span>
              </Link>
            ))}
          </div>
        )}

        <div className="card flex flex-col gap-2">
          <input className={inputCls} placeholder="단체 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
            <button onClick={() => setKind("ALL")} className={`chip ${kind === "ALL" ? "chip-on" : ""}`}>전체</button>
            {CLUB_KINDS.map((k) => <button key={k.key} onClick={() => setKind(k.key)} className={`chip ${kind === k.key ? "chip-on" : ""}`}>{k.label}</button>)}
          </div>
        </div>

        <ErrorText text={act.error} />
        {clubs === null && <p className="sub p-6 text-center text-sm">불러오는 중…</p>}
        {clubs !== null && shown.length === 0 && <EmptyState text="조건에 맞는 단체가 없어요. 아래에서 새로 신청할 수 있어요." />}
        {shown.map((c) => (
          <div key={c.id} className="card flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/clubs/detail?id=${c.id}`} className="font-bold">{c.name}</Link>
              <span className="chip">{clubKindLabel(c)}</span>
            </div>
            <p className="sub text-xs">{c.college ? `${collegeLabel(c.college)} · ` : ""}소속 {c.memberCount ?? 0}명</p>
            {c.description && <p className="text-sm">{c.description}</p>}
            {user?.role === "student" && (joined.has(c.id)
              ? <p className="text-xs text-[var(--primary)]">내 단체예요</p>
              : <button onClick={() => act.run(async () => { await repo.joinClub(c.id, user.id); reload(); act.setError("가입을 신청했어요. 단체 대표가 수락하면 소속이 돼요."); })}
                  disabled={act.busy} className="btn btn-ghost w-full text-sm">가입 신청하기</button>)}
          </div>
        ))}

        {/* 목록에 없으면 새로 신청 (관리자 승인 필요) */}
        {user?.role === "student" && (
          <div className="card flex flex-col gap-3">
            <button onClick={() => setOpen(!open)} className="text-left font-bold">+ 우리 단체가 목록에 없어요</button>
            {open && (
              <>
                <p className="sub text-xs">신청하면 앱 관리자가 확인한 뒤 목록에 올라가요. 승인되면 신청한 분이 대표가 돼요.</p>
                <input className={inputCls} placeholder="단체 이름 (예: 광운 웹스튜디오)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                <div>
                  <p className="sub mb-1.5 text-xs">유형</p>
                  <div className="flex flex-wrap gap-2">
                    {CLUB_KINDS.map((k) => <button key={k.key} type="button" aria-pressed={f.kind === k.key} onClick={() => setF({ ...f, kind: k.key })} className={`chip ${f.kind === k.key ? "chip-on" : ""}`}>{k.label}</button>)}
                  </div>
                  <p className="sub mt-1 text-xs">{CLUB_KINDS.find((k) => k.key === f.kind)!.hint}</p>
                </div>
                {f.kind === "OTHER" && <input className={inputCls} placeholder="유형 직접 입력 (예: 교내 방송국)" value={f.kindOther} onChange={(e) => setF({ ...f, kindOther: e.target.value })} />}
                <select className={inputCls} value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })}>
                  <option value="">주로 활동하는 단과대학 (선택 안 함)</option>
                  {COLLEGES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <textarea className={`${inputCls} h-20`} placeholder="어떤 단체인지 한두 줄로 적어 주세요" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
                <ErrorText text={create.error} />
                <button onClick={() => create.run(async () => {
                  if (f.name.trim().length < 2) throw new Error("단체 이름을 적어 주세요");
                  if (f.kind === "OTHER" && !f.kindOther.trim()) throw new Error("유형을 직접 적어 주세요");
                  await repo.createClub(user.id, { name: f.name, kind: f.kind, kindOther: f.kindOther, description: f.description, college: f.college || undefined });
                  setF({ name: "", kind: "CENTRAL", kindOther: "", description: "", college: "" }); setOpen(false);
                  create.setError("신청했어요. 관리자 승인 후 목록에 올라가요.");
                })} disabled={create.busy} className="btn btn-primary w-full">단체 등록 신청</button>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
