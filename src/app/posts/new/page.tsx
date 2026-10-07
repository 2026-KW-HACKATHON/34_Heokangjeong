"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, Field, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { WOLGYE_CENTER } from "@/lib/geo";
import { draftPost, type PostDraft } from "@/lib/ai/draft";
import { COMPENSATION_LABEL } from "@/lib/listing";
import { COLLEGES, urgentMinReward } from "@/lib/colleges";
import { DOMAINS, DOMAIN_KEYS, domainForCategory } from "@shared/portfolio/domains";
import type { Category, CompensationType, DomainKey, RoleSlot } from "@/types";

const CATS: Category[] = ["디자인", "영상", "사진", "SNS홍보", "웹/앱", "디지털도움", "기타"];

/** 공고 등록 (주민·상인). 고민을 대충 적으면 AI 초안이 폼을 채워 주고, 사장님이 확인·수정 후 등록한다.
 *  문제·기대 결과물·완료 기준은 나중에 학생 제출을 검토하고 검증하는 기준이 된다. 위치는 계정 위치를 기본값으로 쓴다(지도 선택은 TODO). */
export default function NewPost() {
  const router = useRouter();
  const { user } = useSession();
  // difficulty 는 사장님이 고르지 않는다 (주관적이라서). AI 초안이 추정하고, 없으면 보통(2)
  const [f, setF] = useState({ title: "", category: "디자인" as Category, description: "", reward: "", durationDays: 7, difficulty: 2 as 1 | 2 | 3, isTeam: false });
  const [scope, setScope] = useState<"ANY" | "INDIVIDUAL" | "CLUB">("ANY");
  const [l, setL] = useState({ problem: "", deliverables: "", completionCriteria: "", deadline: "", revisionLimit: 2, compensationType: "NON_MONETARY" as CompensationType, paidAmount: "", domain: null as DomainKey | null });
  const [slots, setSlots] = useState<RoleSlot[]>([{ label: "디자이너", category: "디자인", count: 1, filled: [] }]);
  // 계속 운영되는 결과물(웹사이트 등)이면 완료 후 유지보수·인수인계가 따라붙는다
  const [ops, setOps] = useState({ ongoing: false, touched: false, requestDays: 30, requestCount: 3, defectDays: 90, clientBilling: true });
  const [urgent, setUrgent] = useState({ on: false, colleges: [] as string[], open: null as string | null });
  const [memo, setMemo] = useState("");
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const act = useAction();
  if (user?.role !== "resident") return <><TopBar title="공고 등록" back /><p className="sub p-6 text-center text-sm">주민·상인 계정으로 전환하면 공고를 등록할 수 있어요. (나 › 계정 전환)</p></>;
  const domain = l.domain ?? domainForCategory(f.category);
  const ongoing = ops.touched ? ops.ongoing : f.category === "웹/앱";

  async function submit() {
    await act.run(async () => {
      if (!f.title.trim()) throw new Error("제목을 입력해 주세요");
      if (!l.problem.trim()) throw new Error("어떤 문제를 해결하고 싶은지 적어 주세요");
      if (!(f.durationDays >= 1)) throw new Error("예상 기간은 1일 이상으로 적어 주세요");
      if (f.isTeam && slots.some((s) => !(s.count >= 1))) throw new Error("팀 역할 인원은 1명 이상으로 적어 주세요");
      const paid = l.compensationType === "PAID" ? Number(l.paidAmount.replace(/,/g, "")) : undefined;
      if (l.compensationType === "PAID" && (!paid || paid <= 0)) throw new Error("유료 의뢰는 금액을 적어 주세요");
      // 긴급 공고는 학생에게 즉시 알림이 가므로 최소 사례비를 둔다 (DB 제약과 같은 기준)
      const min = urgentMinReward(f.difficulty);
      if (urgent.on && (l.compensationType !== "PAID" || !paid || paid < min))
        throw new Error(`긴급 공고는 사례비가 ${min.toLocaleString()}원 이상이어야 해요`);
      const p = await repo.createPost({
        ...f, authorId: user!.id, location: user!.location ?? WOLGYE_CENTER, address: (user as { address?: string }).address ?? "월계1동", teamSlots: f.isTeam ? slots : undefined,
        problem: l.problem.trim(), domain, expectedDeliverables: l.deliverables.split("\n").map((s) => s.trim()).filter(Boolean), completionCriteria: l.completionCriteria.trim(),
        deadline: l.deadline || undefined, revisionLimit: l.revisionLimit, compensationType: l.compensationType, compensationDescription: f.reward.trim(), paidAmount: paid,
        urgent: urgent.on, urgentColleges: urgent.on ? urgent.colleges : [],
        ongoing, warrantyRequestDays: ops.requestDays, warrantyRequestCount: ops.requestCount, warrantyDefectDays: ops.defectDays, clientOwnedBilling: ops.clientBilling,
        applicantScope: scope,
      });
      router.replace(`/posts/detail?id=${p.id}`);
    });
  }
  async function makeDraft() {
    if (!memo.trim()) return act.setError("가게 고민을 한 줄이라도 적어 주세요");
    setDrafting(true);
    let d: PostDraft;
    try { d = await draftPost(memo); } catch (e) { setDrafting(false); return act.setError((e as Error).message); }
    setDraft(d);
    setF({ title: d.title, category: d.category, description: d.description, reward: d.reward ?? f.reward, durationDays: d.durationDays, difficulty: d.difficulty, isTeam: d.isTeam });
    setL({ ...l, problem: l.problem || memo.trim(), deliverables: d.deliverables.join("\n") || l.deliverables });
    if (d.teamSlots) setSlots(d.teamSlots);
    setDrafting(false);
  }
  return (
    <>
      <TopBar title="공고 등록" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card flex flex-col gap-3">
          <div><h2 className="font-bold">✨ 대충 적으면 AI가 공고를 써 드려요</h2><p className="sub mt-0.5 text-xs">어떤 재능이 필요한지 몰라도 괜찮아요. 가게 고민만 편하게 적어 주세요.</p></div>
          <textarea aria-label="가게 고민" className={`${inputCls} h-24`} placeholder="예: 메뉴판이 낡아서 손님들이 잘 못 알아봐요. 폰으로 QR 찍어서 메뉴 보게 하고 싶어요. 메뉴 20개 정도" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <button onClick={makeDraft} disabled={drafting} className="btn btn-primary w-full disabled:opacity-50">{drafting ? "초안 만드는 중…" : "공고 초안 만들기"}</button>
          {draft && (
            <div className="rounded-xl bg-[var(--primary-weak)] p-3 text-sm">
              <p className="font-bold text-[var(--primary)]">AI 초안 · 아래 폼에 채워 두었어요</p>
              <dl className="mt-2 flex flex-col gap-1">
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">제목</dt><dd className="font-semibold">{draft.title}</dd></div>
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">필요 재능</dt><dd>{draft.teamSlots ? draft.teamSlots.map((s) => `${s.category} ${s.count}명`).join(", ") + " (팀 공고로 제안)" : `${draft.category} 1명`}</dd></div>
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">추천 학과</dt><dd>{draft.departments.join(", ")}</dd></div>
                {draft.deliverables.length > 0 && <div className="flex gap-2"><dt className="sub w-16 shrink-0">결과물</dt><dd>{draft.deliverables.join(", ")}</dd></div>}
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">예상 기간</dt><dd>{draft.durationDays % 7 === 0 ? `${draft.durationDays / 7}주` : `${draft.durationDays}일`}</dd></div>
              </dl>
              {draft.reasons.length > 0 && <ul className="sub mt-2 list-disc pl-4 text-xs">{draft.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              <p className="sub mt-2 text-xs">내용을 확인하고 필요하면 고친 뒤 등록해 주세요.</p>
            </div>
          )}
        </div>
        <div className="card flex flex-col gap-3">
          <Field label="제목"><input className={inputCls} placeholder="어떤 도움이 필요한가요? (예: 메뉴판 디자인)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">{CATS.map((c) => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => setF({ ...f, category: c })} className={`chip ${f.category === c ? "chip-on" : ""}`}>{c}</button>)}</div>
          <Field label="어떤 문제를 해결하고 싶나요?" hint="학생이 포트폴리오에 ‘문제’로 쓰는 출발점이에요."><textarea className={`${inputCls} h-20`} placeholder="예: 메뉴가 한 판에 섞여 있어 손님이 원하는 메뉴를 못 찾아요" value={l.problem} onChange={(e) => setL({ ...l, problem: e.target.value })} /></Field>
          <Field label="자세한 내용"><textarea className={`${inputCls} h-24`} placeholder="원하는 결과물, 가능한 시간, 제공할 자료" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="기대 결과물" hint="한 줄에 하나씩"><textarea className={`${inputCls} h-20`} placeholder={"A2 메뉴판 인쇄 파일 1종\n원본 디자인 파일"} value={l.deliverables} onChange={(e) => setL({ ...l, deliverables: e.target.value })} /></Field>
          <Field label="완료 기준" hint="검토·승인할 때 이 기준으로 확인해요."><input className={inputCls} placeholder="예: 인쇄소에 바로 넘길 수 있는 PDF" value={l.completionCriteria} onChange={(e) => setL({ ...l, completionCriteria: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="마감일"><input type="date" className={inputCls} value={l.deadline} onChange={(e) => setL({ ...l, deadline: e.target.value })} /></Field>
            <Field label="보완 요청 횟수"><select className={inputCls} value={l.revisionLimit} onChange={(e) => setL({ ...l, revisionLimit: +e.target.value })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}번</option>)}</select></Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">보상</legend>
            <div className="flex gap-2">{(Object.keys(COMPENSATION_LABEL) as CompensationType[]).map((c) => <button key={c} type="button" aria-pressed={l.compensationType === c} onClick={() => setL({ ...l, compensationType: c })} className={`chip ${l.compensationType === c ? "chip-on" : ""}`}>{COMPENSATION_LABEL[c]}</button>)}</div>
            {l.compensationType !== "VOLUNTEER" && <input className={`${inputCls} mt-2`} aria-label="보상 내용" placeholder={l.compensationType === "PAID" ? "보상 설명 (선택)" : "예: 식사권 5장, 음료 쿠폰"} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />}
            {l.compensationType === "PAID" && <input inputMode="numeric" className={`${inputCls} mt-2`} aria-label="금액(원)" placeholder="금액(원)" value={l.paidAmount} onChange={(e) => setL({ ...l, paidAmount: e.target.value })} />}
            {l.compensationType === "PAID" && <p className="sub mt-1 text-xs">{urgent.on ? "긴급 공고는 유료여도 모든 학생이 지원할 수 있어요." : "유료 의뢰는 검증된 프로젝트 경험이 있는 학생만 지원할 수 있어요."}</p>}
          </fieldset>
          <Field label="포트폴리오 기록 방식" hint="학생이 이 분야의 질문에 답하며 과정을 기록해요.">
            <select className={inputCls} value={domain} onChange={(e) => setL({ ...l, domain: e.target.value as DomainKey })}>{DOMAIN_KEYS.map((k) => <option key={k} value={k}>{DOMAINS[k].label}</option>)}</select>
          </Field>
          <Field label="예상 기간(일)"><input type="number" min={1} className={inputCls} value={f.durationDays || ""} onChange={(e) => setF({ ...f, durationDays: +e.target.value })} /></Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">모집 방식</legend>
            <p className="sub mb-2 text-xs">① 누구 이름으로 지원받을지, ② 몇 명이 필요한지를 각각 고르세요.</p>

            <p className="mb-1 text-sm">① 누가 지원할 수 있나요?</p>
            <div className="flex flex-wrap gap-2">
              {([["ANY", "개인·단체 모두"], ["INDIVIDUAL", "개인만"], ["CLUB", "단체만"]] as const).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={scope === v} onClick={() => setScope(v)} className={`chip ${scope === v ? "chip-on" : ""}`}>{label}</button>
              ))}
            </div>
            <p className="sub mt-1 text-xs">
              {scope === "CLUB" ? "이미 있는 동아리·학회·학생회 이름으로만 지원받아요. 담당자가 바뀌어도 그 단체가 계속 관리해요."
                : scope === "INDIVIDUAL" ? "학생 개인만 지원할 수 있어요."
                : "학생 개인도, 동아리 같은 단체도 지원할 수 있어요."}
            </p>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={f.isTeam} onChange={(e) => setF({ ...f, isTeam: e.target.checked })} />
            <span>② 역할을 나눠 여러 명을 모집할게요
              <span className="sub block text-xs">예: 디자인 1명 + 개발 1명처럼 역할별로 따로 뽑아요. 한 명이면 체크하지 않아요.</span></span>
          </label>
          {f.isTeam && (
            <div className="rounded-xl bg-[var(--line)] p-3 text-sm">
              {slots.map((s, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_64px] gap-2">
                  <input aria-label="역할 이름" className="rounded-lg bg-white p-2" placeholder="예: 디자이너" value={s.label ?? ""} onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                  <select aria-label="역할" className="flex-1 rounded-lg bg-white p-2" value={s.category} onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, category: e.target.value as Category } : x))}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                  <input aria-label="인원" type="number" min={1} className="w-16 rounded-lg bg-white p-2" value={s.count || ""} onChange={(e) => setSlots(slots.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
                </div>
              ))}
              <button onClick={() => setSlots([...slots, { label: "", category: "영상", count: 1, filled: [] }])} className="text-[var(--primary)]">+ 역할 추가</button>
            </div>
          )}
        </div>
        {/* 유지보수: 만들고 끝나는 일인지, 계속 운영되는 결과물인지 */}
        <div className="card flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ongoing} onChange={(e) => setOps({ ...ops, ongoing: e.target.checked, touched: true })} />
            <span><b>🔧 만든 뒤에도 계속 운영되는 결과물이에요</b>
              <span className="sub block text-xs">웹사이트, QR 메뉴판, 예약·주문 시스템처럼 계속 돌아가는 것. 포스터·사진·영상처럼 파일을 받고 끝나는 일은 체크하지 않아요.</span>
            </span>
          </label>
          {ongoing && (
            <div className="flex flex-col gap-3 rounded-xl bg-[var(--line)] p-3 text-sm">
              <p className="sub text-xs leading-5">완료되면 학생이 인수인계 정보(저장소·배포 주소·관리자 계정·월 비용)를 남기고, 사장님 화면에서 보증 기간과 담당자를 볼 수 있어요. 담당 학생이 빠지면 다른 학생이 이어받아요.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">내용 수정 무상 기간(일)
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={ops.requestDays || ""} onChange={(e) => setOps({ ...ops, requestDays: +e.target.value, touched: true })} /></label>
                <label className="text-xs">무상 횟수
                  <input type="number" min={0} className={`${inputCls} mt-1`} value={ops.requestCount || ""} onChange={(e) => setOps({ ...ops, requestCount: +e.target.value, touched: true })} /></label>
              </div>
              <label className="text-xs">오류·버그 무상 기간(일)
                <input type="number" min={0} className={`${inputCls} mt-1`} value={ops.defectDays || ""} onChange={(e) => setOps({ ...ops, defectDays: +e.target.value, touched: true })} />
                <span className="sub mt-1 block">학생 작업 자체의 문제는 더 길게 잡는 게 보통이에요. 이 기간이 지나면 새 공고로 올려서 다시 맡길 수 있어요.</span>
              </label>
              <p className="sub text-xs">오래 운영할 결과물이면 위의 <b>누가 지원할 수 있나요</b>에서 &lsquo;단체만&rsquo; 을 고르면, 담당자가 바뀌어도 단체가 계속 관리해요.</p>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5" checked={ops.clientBilling} onChange={(e) => setOps({ ...ops, clientBilling: e.target.checked, touched: true })} />
                <span>도메인·호스팅은 <b>내(사장님) 명의와 결제 수단</b>으로 가입할게요
                  <span className="sub block">학생 계정으로 가입하면 나중에 학생이 떠났을 때 아무도 손댈 수 없어요.</span></span>
              </label>
            </div>
          )}
        </div>
        {/* 긴급 공고: 평소 공고는 알림이 가지 않는다. 급할 때만 고른 단과대학 학생에게 즉시 알림 */}
        <div className="card flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={urgent.on} onChange={(e) => setUrgent({ ...urgent, on: e.target.checked })} />
            <span><b>🚨 긴급 공고로 올릴게요</b><span className="sub block text-xs">지금 바로 사람이 필요할 때만 선택하세요. 고른 단과대학 학생과 관심 분야가 맞는 학생에게 즉시 알림이 갑니다.</span></span>
          </label>
          {urgent.on && (
            <div className="rounded-xl bg-[var(--primary-weak)] p-3 text-xs leading-5">
              <p>긴급 공고는 사례비 <b>{urgentMinReward(f.difficulty).toLocaleString()}원 이상</b>이 필요해요.</p>
              <p className="mt-1.5">급하게 와 주는 학생에게 최소한의 보상을 보장하고, 긴급 알림이 남용되지 않게 하려는 기준이에요.</p>
              {l.compensationType !== "PAID" && <p className="mt-1.5 font-semibold text-[var(--red)]">위 보상에서 ‘사례비’를 고르고 금액을 적어 주세요.</p>}
            </div>
          )}
          {urgent.on && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">어느 쪽 학생이 필요하세요?</legend>
              <p className="sub mb-2 text-xs">무엇을 배우는 곳인지 보고 고르세요. 여러 개 고를 수 있어요. 고르지 않으면 모든 학생에게 알림이 갑니다.</p>
              <ul className="flex flex-col gap-1.5">
                {COLLEGES.map((c) => {
                  const on = urgent.colleges.includes(c.key);
                  return (
                    <li key={c.key} className={`rounded-xl border p-2.5 ${on ? "border-[var(--primary)] bg-[var(--primary-weak)]" : "border-[var(--line)] bg-[var(--line)]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" aria-pressed={on} onClick={() => setUrgent({ ...urgent, colleges: on ? urgent.colleges.filter((x) => x !== c.key) : [...urgent.colleges, c.key] })} className="flex-1 text-left text-sm font-semibold">
                          {on ? "✓ " : ""}{c.label}
                        </button>
                        <button type="button" aria-expanded={urgent.open === c.key} onClick={() => setUrgent({ ...urgent, open: urgent.open === c.key ? null : c.key })} className="sub shrink-0 text-xs underline">
                          {urgent.open === c.key ? "접기" : "세부 학과"}
                        </button>
                      </div>
                      <p className="sub mt-0.5 text-xs">{c.what}</p>
                      {urgent.open === c.key && <p className="mt-1.5 border-t border-white/60 pt-1.5 text-xs leading-5">{c.departments.join(" · ")}</p>}
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
        </div>
        <ErrorText text={act.error} />
        <button onClick={submit} disabled={act.busy} className="btn btn-primary w-full disabled:opacity-50">{urgent.on ? "🚨 긴급 공고 등록하기" : "등록하기"}</button>
        <p className="sub text-center text-xs">{urgent.on ? "등록 즉시 선택한 단과대학 학생과 관심 분야가 맞는 학생에게 알림이 갑니다." : "평소 공고는 알림 없이 올라가고, 학생이 홈·지도에서 찾아봅니다."}</p>
      </section>
    </>
  );
}
