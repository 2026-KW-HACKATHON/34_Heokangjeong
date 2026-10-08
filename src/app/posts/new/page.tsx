"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, Field, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { WOLGYE_CENTER } from "@/lib/geo";
import { getDemoTour } from "@/lib/demoTour";
import { draftPost, type PostDraft } from "@/lib/ai/draft";
import { COLLEGES, URGENT_MIN_REWARD } from "@/lib/colleges";
import { DOMAINS, DOMAIN_KEYS, domainForCategory } from "@shared/portfolio/domains";
import type { Category, DomainKey } from "@/types";

const CATS: Category[] = ["디자인", "영상", "사진", "SNS홍보", "웹/앱", "디지털도움", "기타"];
const DEMO_EXAMPLE = {
  memo: "월계 미용실의 주요 시술과 가격을 손님이 한눈에 볼 수 있도록 포스터로 만들고 싶어요.",
  title: "월계 미용실 시술 안내 포스터",
  problem: "새로운 시술과 가격 안내가 매장 안에서 잘 보이지 않아 손님이 자주 문의해요.",
  description: "시술명·가격 목록과 매장 사진을 제공할게요. 매장 부착용 포스터와 SNS 안내 이미지를 부탁드립니다.",
  deliverables: "A3 매장 부착용 포스터 PDF 1종\nSNS용 정사각 이미지 1종\n수정 가능한 원본 파일",
  completionCriteria: "점주가 시술명과 가격을 확인하고 A3 인쇄용 PDF와 SNS 이미지를 받으면 완료",
  reward: "커트 1회 이용권 · 유효기간 3개월",
};

/** 공고 등록 (주민·상인). 고민을 대충 적으면 AI 초안이 폼을 채워 주고, 사장님이 확인·수정 후 등록한다.
 *  문제·기대 결과물·완료 기준은 나중에 학생 제출을 검토하고 검증하는 기준이 된다. 위치는 계정 위치를 기본값으로 쓴다(지도 선택은 TODO). */
export default function NewPost() {
  const router = useRouter();
  const { user, mode } = useSession();
  const demo = mode === "mock";
  // difficulty 는 사장님이 고르지 않는다 (주관적이라서). AI 초안이 추정하고, 없으면 보통(2)
  const [f, setF] = useState({ title: "", category: "디자인" as Category, description: "", reward: "", durationDays: 0, difficulty: 2 as 1 | 2 | 3, isTeam: false });
  const [scope, setScope] = useState<"ANY" | "INDIVIDUAL" | "CLUB">("ANY");
  const [urgentPay, setUrgentPay] = useState("");            // 긴급 공고일 때만 받는 현금 사례비
  const [l, setL] = useState({ problem: "", deliverables: "", completionCriteria: "", deadline: "", revisionLimit: 2, domain: null as DomainKey | null });
  const [monthlyCost, setMonthlyCost] = useState("");
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
      const example = (value: string, fallback: string) => value.trim() || (demo ? fallback : "");
      const title = example(f.title, DEMO_EXAMPLE.title);
      const problem = example(l.problem, DEMO_EXAMPLE.problem);
      const reward = example(f.reward, DEMO_EXAMPLE.reward);
      const description = example(f.description, DEMO_EXAMPLE.description);
      const deliverables = example(l.deliverables, DEMO_EXAMPLE.deliverables);
      const completionCriteria = example(l.completionCriteria, DEMO_EXAMPLE.completionCriteria);
      if (!title) throw new Error("제목을 입력해 주세요");
      if (!problem) throw new Error("어떤 문제를 해결하고 싶은지 적어 주세요");
      if (ongoing && monthlyCost && (!Number.isSafeInteger(Number(monthlyCost)) || Number(monthlyCost) < 0)) throw new Error("월 운영 비용은 0 이상의 정수로 입력해 주세요");
      if (!reward) throw new Error("제공할 가게 쿠폰을 적어 주세요");
      // 긴급 공고는 즉시 알림이 가므로 현금 사례비 최소 금액을 요구한다 (DB 제약과 같은 기준)
      const paid = urgent.on ? Number((urgentPay || (demo ? String(URGENT_MIN_REWARD) : "")).replace(/,/g, "")) : undefined;
      if (urgent.on) {
        if (!Number.isSafeInteger(paid) || !paid || paid < URGENT_MIN_REWARD) throw new Error(`긴급 추가수당은 ${URGENT_MIN_REWARD.toLocaleString()}원 이상이어야 해요`);
      }
      const p = await repo.createPost({
        ...f, title, reward, authorId: user!.id, location: user!.location ?? WOLGYE_CENTER, address: (user as { address?: string }).address ?? "월계1동", isTeam: false, teamSlots: undefined,
        description: [description, "작업 기간: 학생이 계약서 작성 시 제안하고 양쪽이 확인합니다.", ...(ongoing ? [`월 운영 비용: ${monthlyCost === "" ? "학생과 협의 후 확정" : Number(monthlyCost).toLocaleString() + "원/월 (예산 · 계약 시 확정)"}`] : [])].filter(Boolean).join("\n\n"),
        problem, domain, expectedDeliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean), completionCriteria,
        deadline: l.deadline || undefined, revisionLimit: l.revisionLimit, compensationType: urgent.on ? "PAID" : "NON_MONETARY", compensationDescription: reward,
        paidAmount: paid,
        urgent: urgent.on, urgentColleges: urgent.on ? urgent.colleges : [],
        ongoing, warrantyRequestDays: ops.requestDays, warrantyRequestCount: ops.requestCount, warrantyDefectDays: ops.defectDays, clientOwnedBilling: ops.clientBilling,
        applicantScope: scope,
      });
      if (demo && getDemoTour()?.role === "merchant" && getDemoTour()?.step === 1) {
        await repo.apply(p.id, "s5", "안녕하세요. 시각디자인을 전공한 윤서연입니다. 시술명과 가격의 우선순위를 정리해 A3 포스터와 SNS 이미지 시안을 제작하겠습니다.");
        await repo.apply(p.id, "s10", "안녕하세요. 경영학부 배수아입니다. 손님이 자주 묻는 시술을 먼저 배치하고 읽기 쉬운 안내 문구를 제안하겠습니다.");
      }
      router.replace(`/posts/detail?id=${p.id}`);
    });
  }
  async function makeDraft() {
    const request = memo.trim() || (demo ? DEMO_EXAMPLE.memo : "");
    if (!request) return act.setError("가게 고민을 한 줄이라도 적어 주세요");
    setDrafting(true);
    let d: PostDraft;
    try {
      d = demo ? {
        title: DEMO_EXAMPLE.title, category: "디자인", description: DEMO_EXAMPLE.description,
        deliverables: DEMO_EXAMPLE.deliverables.split("\n"), departments: ["디자인학과"],
        durationDays: 7, difficulty: 2, isTeam: false,
        reasons: ["데모 모드에서 준비된 예시 초안입니다. 원하는 내용으로 수정할 수 있어요."],
      } : await draftPost(request + (l.deadline ? `\n희망 마감일: ${l.deadline}` : ""));
    } catch (e) { setDrafting(false); return act.setError((e as Error).message); }
    setDraft(d);
    setF({ title: d.title, category: d.category, description: d.description, reward: f.reward, durationDays: 0, difficulty: d.difficulty, isTeam: false });
    setL({ ...l, problem: l.problem || request, deliverables: d.deliverables.join("\n") || l.deliverables });
    setDrafting(false);
  }
  return (
    <>
      <TopBar title="공고 등록" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card flex flex-col gap-3">
          <div><h2 className="font-bold">✨ {demo ? "예시 공고를 바로 채워 드려요" : "대충 적으면 AI가 공고를 써 드려요"}</h2><p className="sub mt-0.5 text-xs">{demo ? "데모에서는 고민을 비워 둬도 준비된 예시 초안이 채워져요. 실제 AI 생성은 서버 연결 모드에서 동작해요." : "어떤 재능이 필요한지 몰라도 괜찮아요. 가게 고민만 편하게 적어 주세요."}</p></div>
          <textarea aria-label="가게 고민" className={`${inputCls} h-24`} placeholder={demo ? DEMO_EXAMPLE.memo : "예: 메뉴판이 낡아서 손님들이 잘 못 알아봐요. 폰으로 QR 찍어서 메뉴 보게 하고 싶어요. 메뉴 20개 정도"} value={memo} onChange={(e) => setMemo(e.target.value)} />
          <Field label="마감 기간 선택" hint="언제까지 결과물이 필요하신가요? 실제 작업 기간은 학생이 계약서에서 제안해요."><input aria-label="희망 마감일" type="date" className={inputCls} value={l.deadline} onChange={e => setL({ ...l, deadline: e.target.value })} /></Field>
          <button data-demo-tour="post-example" onClick={makeDraft} disabled={drafting} className="btn btn-primary w-full disabled:opacity-50">{drafting ? "초안 만드는 중…" : demo ? "예시 공고 채우기" : "빠른 AI 공고 생성"}</button>
          {draft && (
            <div className="rounded-xl bg-[var(--primary-weak)] p-3 text-sm">
              <p className="font-bold text-[var(--primary)]">{demo ? "데모 예시 초안" : "AI 초안"} · 아래 폼에 채워 두었어요</p>
              <dl className="mt-2 flex flex-col gap-1">
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">제목</dt><dd className="font-semibold">{draft.title}</dd></div>
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">필요 재능</dt><dd>{draft.category}</dd></div>
                <div className="flex gap-2"><dt className="sub w-16 shrink-0">추천 학과</dt><dd>{draft.departments.join(", ")}</dd></div>
                {draft.deliverables.length > 0 && <div className="flex gap-2"><dt className="sub w-16 shrink-0">결과물</dt><dd>{draft.deliverables.join(", ")}</dd></div>}
              </dl>
              {draft.reasons.length > 0 && <ul className="sub mt-2 list-disc pl-4 text-xs">{draft.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              <p className="sub mt-2 text-xs">내용을 확인하고 필요하면 고친 뒤 등록해 주세요.</p>
            </div>
          )}
        </div>
        <div className="card flex flex-col gap-3">
          {demo && <p className="sub text-xs">데모에서는 빈칸의 예시 내용이 등록할 때 자동으로 사용돼요. 바꾸고 싶은 항목만 입력해 주세요.</p>}
          <Field label="제목"><input className={inputCls} placeholder={demo ? DEMO_EXAMPLE.title : "어떤 도움이 필요한가요? (예: 메뉴판 디자인)"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">{CATS.map((c) => <button key={c} type="button" aria-pressed={f.category === c} onClick={() => setF({ ...f, category: c })} className={`chip ${f.category === c ? "chip-on" : ""}`}>{c}</button>)}</div>
          <Field label="어떤 문제를 해결하고 싶나요?" hint="학생이 포트폴리오에 ‘문제’로 쓰는 출발점이에요."><textarea className={`${inputCls} h-20`} placeholder={demo ? DEMO_EXAMPLE.problem : "예: 메뉴가 한 판에 섞여 있어 손님이 원하는 메뉴를 못 찾아요"} value={l.problem} onChange={(e) => setL({ ...l, problem: e.target.value })} /></Field>
          <Field label="자세한 내용"><textarea className={`${inputCls} h-24`} placeholder={demo ? DEMO_EXAMPLE.description : "원하는 결과물, 가능한 시간, 제공할 자료"} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="기대 결과물" hint="한 줄에 하나씩"><textarea className={`${inputCls} h-20`} placeholder={DEMO_EXAMPLE.deliverables} value={l.deliverables} onChange={(e) => setL({ ...l, deliverables: e.target.value })} /></Field>
          <Field label="완료 기준" hint="검토·승인할 때 이 기준으로 확인해요."><input className={inputCls} placeholder={demo ? DEMO_EXAMPLE.completionCriteria : "예: 인쇄소에 바로 넘길 수 있는 PDF"} value={l.completionCriteria} onChange={(e) => setL({ ...l, completionCriteria: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="보완 요청 횟수"><select className={inputCls} value={l.revisionLimit} onChange={(e) => setL({ ...l, revisionLimit: +e.target.value })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}번</option>)}</select></Field>
          </div>
          <Field label="완료 시 제공할 가게 쿠폰" hint="이 공고를 완료한 학생에게 약속한 쿠폰을 동일하게 제공해요.">
            <input className={inputCls} aria-label="가게 쿠폰" placeholder={demo ? DEMO_EXAMPLE.reward : "예: 음료 쿠폰 5장 · 유효기간 3개월"} value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} />
          </Field>
          <Field label="포트폴리오 기록 방식" hint="학생이 이 분야의 질문에 답하며 과정을 기록해요.">
            <select className={inputCls} value={domain} onChange={(e) => setL({ ...l, domain: e.target.value as DomainKey })}>{DOMAIN_KEYS.map((k) => <option key={k} value={k}>{DOMAINS[k].label}</option>)}</select>
          </Field>
          <p className="sub text-xs">작업 시작일과 완료 예정일은 학생이 계약서에 작성하고 양쪽이 확인해요.</p>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">모집 방식</legend>
            <p className="sub mb-2 text-xs">개인 또는 단체 중 지원 대상을 선택해 주세요.</p>

            <p className="mb-1 text-sm">누가 지원할 수 있나요?</p>
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
        </div>
        {/* 유지보수: 만들고 끝나는 일인지, 계속 운영되는 결과물인지 */}
        <div className="card flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ongoing} onChange={(e) => setOps({ ...ops, ongoing: e.target.checked, touched: true })} />
            <span><b>AS 보증 기간 작성</b>
              <span className="sub block text-xs">웹사이트, QR 메뉴판, 예약·주문 시스템처럼 계속 돌아가는 것. 포스터·사진·영상처럼 파일을 받고 끝나는 일은 체크하지 않아요.</span>
            </span>
          </label>
          {ongoing && (
            <div className="flex flex-col gap-3 rounded-xl bg-[var(--line)] p-3 text-sm">
              <p className="sub text-xs leading-5">완료 후 도움받을 기간과 횟수를 적어 주세요. 학생이 사용 방법과 관리 정보를 남겨 드려요.</p>
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
              <div className="rounded-xl bg-white p-3">
                <h3 className="font-semibold">웹페이지를 열어 줄 컴퓨터가 필요해요</h3>
                <p className="sub mt-1 text-xs leading-5">손님이 언제든 웹페이지를 볼 수 있도록 인터넷에 연결된 컴퓨터를 빌려 사용해요. 무료로 시작할 수도 있고, 이용량에 따라 매달 비용이 생길 수 있어요. 학생과 사용할 서비스를 정한 뒤 실제 비용을 확인해요.</p>
                <label className="mt-3 block text-xs">월 운영 비용 예산(원)
                  <input aria-label="월 운영 비용 예산(원)" inputMode="numeric" className={`${inputCls} mt-1`} placeholder="예: 1000 · 모르면 비워 두세요" value={monthlyCost} onChange={e => setMonthlyCost(e.target.value)} />
                </label>
                <p className="sub mt-1 text-xs">예: 1,000원/월은 입력 예시이며 실제 요금이 아니에요. 입력한 예산은 공고 내용에 표시됩니다.</p>
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={ops.clientBilling} onChange={e => setOps({ ...ops, clientBilling: e.target.checked })} />
                  <span>운영 서비스는 사장님 계정으로 가입하고 비용도 직접 결제할게요.</span>
                </label>
              </div>
            </div>
          )}
        </div>
        {/* 긴급 공고: 평소 공고는 알림이 가지 않는다. 급할 때만 고른 단과대학 학생에게 즉시 알림 */}
        <div className="card flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={urgent.on} onChange={(e) => setUrgent({ ...urgent, on: e.target.checked })} />
            <span><b>🚨 긴급 공고로 올릴게요</b><span className="sub block text-xs">지금 바로 사람이 필요할 때만 선택하세요. 고른 단과대학 학생과 관심 분야가 맞는 학생에게 즉시 알림이 갑니다.</span></span>
          </label>
          {urgent.on && <Field label="긴급 추가수당(원) · 필수" hint={`가게 쿠폰과 별도로 지급할 금액이에요. 최소 ${URGENT_MIN_REWARD.toLocaleString()}원부터 입력해 주세요.`}>
            <input aria-label="긴급 추가수당(원)" inputMode="numeric" required={!demo} className={inputCls} placeholder={demo ? String(URGENT_MIN_REWARD) : "금액을 입력해 주세요"} value={urgentPay} onChange={e => setUrgentPay(e.target.value)} />
          </Field>}
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
        <button data-demo-tour="post-submit" onClick={submit} disabled={act.busy} className="btn btn-primary w-full disabled:opacity-50">{urgent.on ? "🚨 긴급 공고 등록하기" : "등록하기"}</button>
        <p className="sub text-center text-xs">{urgent.on ? "등록 즉시 선택한 단과대학 학생과 관심 분야가 맞는 학생에게 알림이 갑니다." : "평소 공고는 알림 없이 올라가고, 학생이 홈·지도에서 찾아봅니다."}</p>
      </section>
    </>
  );
}
