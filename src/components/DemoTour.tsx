"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { getDemoTour, saveDemoTour, type DemoPicks, type DemoRole, type DemoTourState } from "@/lib/demoTour";
import { clearDemoBrowserData, endDemoSession } from "@/lib/demoIdentity";
import { useSession } from "@/lib/session";

type Step = { path: string; target: string; title: string; description: string; action?: "next"; cta?: string };
const intro: Step = {
  path: "/", target: '[data-demo-tour="brand-intro"]', title: "월계와 사람을 잇는 WOLINK",
  description: "WOLINK는 월계(Wolgye)와 링크(Link)를 합친 이름입니다. 월계1동의 청년과 지역을 이어 함께 성장해요. 대학생은 전공을 살린 재능기부로 실무 경험을 쌓고, 주민과 상인은 디지털 도움과 홍보를 얻습니다.",
  action: "next", cta: "가자",
};
const steps: Record<DemoRole, Step[]> = {
  merchant: [
    { path: "/", target: '[data-demo-tour="merchant-create"]', title: "우리 가게 도움 요청하기", description: "오른쪽 위 ＋를 눌러 보세요." },
    { path: "/posts/new/", target: '[data-demo-tour="post-ai"]', title: "가게 고민 고르기", description: "고민 카드를 하나 골라 보세요. 직접 적고 ‘Gemini 요약’을 눌러도 돼요. AI가 몇 초 만에 공고를 써 줘요." },
    { path: "/posts/new/", target: '[data-demo-tour="post-submit"]', title: "공고 올리기", description: "AI가 공고를 다 채웠어요. 등록을 눌러 올려 보세요." },
    { path: "/posts/detail/", target: '[data-demo-tour="merchant-pick"]', title: "지원자 고르기", description: "학생 3명이 지원했어요. 마음에 드는 학생을 골라 보세요. 정답은 없어요!" },
    { path: "/chats/room/", target: '[data-demo-tour="agreement"]', title: "계약서 확인", description: "선정한 학생과 주고받을 계약서예요. 눌러서 열어 보세요." },
  ],
  student: [
    intro,
    { path: "/", target: '[data-demo-tour="student-post"]', title: "원하는 공고 지원하기", description: "관심 있는 공고를 살펴보고 지원하는 흐름을 체험해요. 김하늘 학생에게 맞는 베이커리 패키지 공고 카드를 눌러 시작하세요." },
    { path: "/posts/detail/?id=p9", target: '[data-demo-tour="student-problem"]', title: "문제와 완료 기준 확인", description: "가게가 겪는 문제와 전달할 결과물, 완료 기준을 먼저 읽어 보세요. 준비되면 다음을 눌러 지원 단계로 이동합니다.", action: "next" },
    { path: "/posts/detail/?id=p9", target: '[data-demo-tour="student-apply"]', title: "공고에 지원하기", description: "김하늘의 지원 메시지가 미리 작성돼 있어요. 내용을 확인하고 지원하기를 눌러 보세요." },
    { path: "/posts/detail/?id=p9", target: '[data-demo-tour="student-applied"]', title: "지원 후 채팅", description: "지원하면 사장님과 바로 대화할 수 있어요. 채팅창으로 이동해 보세요." },
    { path: "/chats/room/", target: '[data-demo-tour="student-chat-send"]', title: "사장님과 소통하기", description: "인쇄 크기와 선호 색상을 묻는 메시지가 채워져 있어요. 전송하면 매칭 대기 사례로 이어집니다." },
    { path: "/chats/room/?id=a13", target: '[data-demo-tour="agreement"]', title: "선정 후 작업 계약서", description: "계약서를 열고 직접 작성하거나 예시 프롬프트를 골라 보세요. 예시는 글자가 입력되는 모습을 보여 주고, Gemini 요약으로 내용을 정리합니다." },
    { path: "/me/", target: '[data-demo-tour="feed-item"]', title: "검증된 경험과 작업", description: "미용실 계약은 아직 진행 중입니다. 여기서는 의뢰인이 검증을 마친 별도의 한식당 메뉴판 작업을 열어봅니다." },
    { path: "/portfolio/experience/?s=s1&kind=project&id=demo-menu-2", target: '[data-demo-tour="portfolio-experience-content"]', title: "경험 기록 읽기", description: "작업 배경과 역할을 읽어 보세요. 다음을 누르면 단계별 포트폴리오를 엽니다.", action: "next" },
    { path: "/portfolio/experience/?s=s1&kind=project&id=demo-menu-2", target: '[data-demo-tour="portfolio-detail"]', title: "실제 포트폴리오 열기", description: "문제 정의부터 결과와 의뢰인 평가까지 작성된 포트폴리오를 눌러 확인하세요." },
    { path: "/portfolio/view/?id=demo-menu-2&s=s1", target: '[data-demo-tour="portfolio-frame"]', title: "포트폴리오 단계 열기", description: "실제 작성된 기록이에요. 첫 번째 ‘개요’ 단계를 눌러 읽기를 시작하세요." },
    ...[
      ["개요", "프로젝트 목표와 맡은 역할을 읽고 다음 화살표를 눌러 보세요."],
      ["문제 정의", "가게와 손님이 겪던 문제와 이를 확인한 배경을 읽어 보세요."],
      ["요구사항 정리", "의뢰인과 협의해 필요한 내용을 어떻게 정리했는지 확인하세요."],
      ["시안 제작과 개선", "초안을 만들고 피드백을 반영한 과정을 읽어 보세요."],
      ["작업 전·후", "작업 전과 후가 어떻게 달라졌는지 살펴보세요."],
      ["전달한 결과물", "점주에게 전달한 결과물을 확인하세요."],
      ["현장 사용", "결과물이 현장에서 어떻게 사용됐는지 읽어 보세요."],
      ["작업 회고", "작업에서 배운 점과 다음에 개선할 부분을 살펴보세요."],
      ["평가와 검증", "의뢰인 평가와 실제 검증 항목까지 살펴보면 안내가 끝나요."],
    ].map(([title, description], i) => ({
      path: "/portfolio/view/?id=demo-menu-2&s=s1", target: '[data-demo-tour="portfolio-frame"]',
      title, description: i === 8 ? description : `${description} 화면의 다음 화살표를 누르면 이어집니다.`,
      ...(i === 8 ? { action: "next" as const } : {}),
    })),
  ],
};

function matchesStep(step: Step, path: string | null) {
  if (!path) return false;
  const expected = new URL(step.path, window.location.origin);
  const current = new URL(window.location.href);
  return path.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "")
    && [...expected.searchParams].every(([key, value]) => current.searchParams.get(key) === value);
}

/** 다음 방문객을 위해 체험 흔적을 지우고 첫 화면(학생/상인 고르기)으로 돌아간다 */
export function restartDemo() {
  clearDemoBrowserData();
  endDemoSession();
  window.location.assign("/login/");
}

const RESULT_IMAGE: Record<string, string> = {
  "디자인": "/portfolio-exhibition/menu-demo/overview.png", "기타": "/portfolio-exhibition/menu-demo/overview.png",
  "SNS홍보": "/portfolio-samples/cafe.png", "사진": "/portfolio-samples/cafe.png", "영상": "/portfolio-samples/cafe.png",
};
const RESULT_ICON: Record<string, string> = { "웹/앱": "📱", "디지털도움": "🧾" };
const elapsed = (from?: number) => {
  if (!from) return "";
  const sec = Math.max(1, Math.round((Date.now() - from) / 1000));
  return sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`;
};

/** 상인 체험의 끝: 2주 뒤로 건너뛰어 결과물을 받고, 방문객이 직접 별점을 준다 */
function MerchantFinale({ picks, onClose }: { picks: DemoPicks; onClose: () => void }) {
  const [phase, setPhase] = useState<"skip" | "rate" | "done">("skip");
  const [stars, setStars] = useState(0);
  const [time] = useState(() => elapsed(picks.startedAt));
  useEffect(() => { const t = window.setTimeout(() => setPhase("rate"), 1800); return () => clearTimeout(t); }, []);
  const name = picks.studentName ?? "선정한 학생";
  const image = RESULT_IMAGE[picks.category ?? ""] ;
  const icon = RESULT_ICON[picks.category ?? ""] ?? "🎁";
  if (phase === "skip") return <div className="demo-finale-skip" style={{ textAlign: "center", color: "white" }}>
    <p style={{ fontSize: 14, opacity: .8 }}>⏩ 시간을 빨리 감는 중…</p>
    <p style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>2주 후</p>
  </div>;
  return <div style={{ width: "min(340px, 100%)", padding: 22, borderRadius: 20, background: "white", boxShadow: "0 16px 50px #0004", textAlign: "center" }}>
    {phase === "rate" ? <>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#436991" }}>결과물 도착!</p>
      <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{name} 학생이 작업을 끝냈어요</h2>
      {image ? <img src={image} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain", marginTop: 14, borderRadius: 12, background: "#f4f2ee" }} />
        : <div aria-hidden="true" style={{ fontSize: 64, marginTop: 14 }}>{icon}</div>}
      {picks.title && <p style={{ fontSize: 13, color: "#68717e", marginTop: 8 }}>{picks.title}</p>}
      <p style={{ fontSize: 15, fontWeight: 700, marginTop: 16 }}>마음에 드셨나요? 별점을 눌러 주세요</p>
      <div role="group" aria-label="별점" style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" aria-label={`${n}점`} onClick={() => { setStars(n); window.setTimeout(() => setPhase("done"), 450); }}
          style={{ fontSize: 34, lineHeight: 1, color: n <= stars ? "#f5b301" : "#d5d9de", transition: "transform .15s", transform: n <= stars ? "scale(1.12)" : "none" }}>★</button>)}
      </div>
    </> : <>
      <div aria-hidden="true" style={{ fontSize: 46 }}>🎉</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>체험 완료!</h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>
        보내 주신 <b style={{ color: "#f5b301" }}>{"★".repeat(stars)}</b> 평가는<br /><b>{name}</b> 학생의 포트폴리오에<br />검증된 경력으로 기록돼요.
      </p>
      {time && <p style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: "#436991", background: "#eef5fc", borderRadius: 10, padding: "8px 10px" }}>고민 하나 해결까지 걸린 시간 · {time}</p>}
      <button type="button" onClick={restartDemo} style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 12, background: "#202932", color: "white", fontWeight: 700 }}>다음 분 체험 시작</button>
      <button type="button" onClick={onClose} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 12, color: "#436991", fontWeight: 700, fontSize: 14 }}>자유롭게 둘러보기</button>
    </>}
  </div>;
}

export default function DemoTour() {
  const { mode, loading } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [tour, setTour] = useState<DemoTourState | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [clicked, setClicked] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedRole, setCompletedRole] = useState<DemoRole>("student");
  const [completedPicks, setCompletedPicks] = useState<DemoPicks>({});
  const [frame, setFrame] = useState({left:0, top:0, right:0, bottom:0});
  useEffect(() => {
    if (!tour && !completed) return;
    const update = () => {
      const shell = document.querySelector<HTMLElement>(".app-shell");
      if (!shell) return;
      const box = shell.getBoundingClientRect();
      const border = parseFloat(getComputedStyle(shell).borderLeftWidth) || 0;
      const next = {left:Math.max(0,box.left+border), top:Math.max(0,box.top+border), right:Math.min(window.innerWidth,box.right-border), bottom:Math.min(window.innerHeight,box.bottom-border)};
      setFrame(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    };
    update(); const timer = window.setInterval(update, 200);
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    return () => { clearInterval(timer); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [tour, completed, path]);
  const [tipHeight, setTipHeight] = useState(230);
  const [tipElement, setTipElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!tipElement) return;
    const observer = new ResizeObserver(() => setTipHeight(tipElement.getBoundingClientRect().height));
    observer.observe(tipElement);
    return () => observer.disconnect();
  }, [tipElement]);
  useEffect(() => { setTour(getDemoTour()); }, []);
  useEffect(() => { if (completed && path !== "/") router.replace("/"); }, [completed, path, router]);
  useEffect(() => { document.body.classList.toggle("guided-demo", !!tour || completed); return () => document.body.classList.remove("guided-demo"); }, [tour, completed]);
  const finish = useCallback(() => { saveDemoTour(null); setTour(null); setRect(null); setCompleted(false); }, []);
  const baseStep = tour && steps[tour.role][tour.step];
  const step = useMemo(() => tour?.role === "student" && tour.step === 3 && alreadyApplied && !clicked
    ? { ...baseStep!, target: '[data-demo-tour="student-applied"]', title: "이미 지원한 공고", description: "이 브라우저에서는 이미 지원했어요. 지원 내역을 확인한 뒤 다음 단계에서 채팅창으로 이동하세요.", action: "next" as const }
    : baseStep, [tour?.role, tour?.step, alreadyApplied, clicked, baseStep]);
  useEffect(() => {
    if (tour?.role !== "student" || tour.step !== 3 || !path?.startsWith("/posts/detail")) return;
    const update = () => setAlreadyApplied(!!document.querySelector('[data-demo-tour="student-applied"]'));
    update();
    const timer = window.setInterval(update, 250);
    return () => clearInterval(timer);
  }, [tour?.role, tour?.step, path]);
  const advance = useCallback(() => {
    if (!tour) return;
    const next = tour.step + 1;
    if (next >= steps[tour.role].length) { setCompletedPicks(getDemoTour()?.picks ?? tour.picks ?? {}); saveDemoTour(null); setCompletedRole(tour.role); setTour(null); setRect(null); setCompleted(true); return; }
    const updated = { ...tour, picks: { ...tour.picks, ...getDemoTour()?.picks }, step: next };
    saveDemoTour(updated); setTour(updated); setClicked(false); setRect(null);
    const destination = steps[tour.role][next].path;
    const here = window.location.pathname + window.location.search;
    if (destination !== "/posts/detail/" && destination !== "/chats/room/" && here !== destination) window.location.assign(destination);
  }, [tour]);

  useEffect(() => {
    if (tour?.role !== "student" || tour.step < 10 || tour.step > 18 || !path?.startsWith("/portfolio/view")) return;
    const stages = ["overview", "problem", "decisions", "process", "beforeAfter", "deliverable", "usage", "reflection", "evaluation"];
    const stageIndex = tour.step - 10;
    const frame = document.querySelector<HTMLIFrameElement>('[data-demo-tour="portfolio-frame"]');
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || event.data?.type !== "wolink-demo-portfolio-stage") return;
      const expectedAction = stageIndex === 0 ? "open" : "next";
      if (event.data.stage === stages[stageIndex] && event.data.action === expectedAction) advance();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tour?.role, tour?.step, path, advance]);

  useEffect(() => {
    if (!step || loading || mode !== "mock" || (step.target.includes('"agreement"') && clicked) || !matchesStep(step, path)) return;
    let current: Element | null = null;
    const update = () => {
      current = document.querySelector(step.target);
      if (current) {
        const next = current.getBoundingClientRect();
        setRect(previous => previous && previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height ? previous : next);
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(update, 250);
    const onClick = (event: MouseEvent) => { if (current && current.contains(event.target as Node) && !step.target.includes('"portfolio-frame"')) setClicked(true); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    update();
    document.querySelector(step.target)?.scrollIntoView({ block: step.target.includes('"post-review"') ? "start" : "center", behavior: "auto" });
    update();
    return () => { observer.disconnect(); clearInterval(timer); document.removeEventListener("click", onClick, true); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [step, path, loading, mode, clicked, tour]);

  useEffect(() => {
    if (!tour || !step || !clicked || step.action === "next") return;
    if (step.target.includes('"post-example"') || step.target.includes('"post-ai"') || step.target.includes('"post-submit"') || step.target.includes('"merchant-pick"') || step.target.includes('"student-apply"') || step.target.includes('"agreement"') || step.target.includes('"student-me"')) return;
    advance();
  }, [tour, step, clicked, advance, finish]);

  useEffect(() => {
    // 공고 초안이 나타나면 다음 단계로 (고민 카드를 누르든, 직접 쓰고 요약을 누르든)
    if (!(step?.target.includes('"post-example"') && clicked) && !step?.target.includes('"post-ai"')) return;
    const timer = window.setInterval(() => { if (document.querySelector('[data-demo-tour="post-drafted"]')) advance(); }, 200);
    return () => clearInterval(timer);
  }, [step, clicked, advance]);

  useEffect(() => {
    if (step?.target.includes('"post-review"') && tipElement?.closest("#post-review-guide")) tipElement.scrollIntoView({block:"start",behavior:"auto"});
  }, [step, tipElement]);

  useEffect(() => {
    if (step?.target.includes('"student-me"') && clicked && path?.replace(/\/$/, "") === "/me") {
      saveDemoTour(null); setTour(null); setRect(null); setCompleted(true);
    }
  }, [step, clicked, path]);

  useEffect(() => {
    if (step?.target.includes('"post-submit"') && clicked && path?.replace(/\/$/, "") === "/posts/detail") advance();
  }, [tour, step?.target, clicked, path, advance]);

  useEffect(() => {
    if (step?.target.includes('"merchant-pick"') && clicked && path?.replace(/\/$/, "") === "/chats/room") advance();
  }, [step, step?.target, clicked, path, advance]);

  useEffect(() => {
    if (!step?.target.includes('"student-apply"') || !clicked || !matchesStep(step, path)) return;
    const timer = window.setInterval(() => {
      if (document.querySelector('[data-demo-tour="student-applied"]')) advance();
    }, 200);
    return () => clearInterval(timer);
  }, [step, path, clicked, advance]);

  useEffect(() => {
    if (!step?.target.includes('"agreement"') || !clicked) return;
    setRect(null);
    const dialog = document.querySelector<HTMLDialogElement>(".agreement-dialog");
    if (!dialog) return;
    dialog.addEventListener("close", advance, { once: true });
    return () => dialog.removeEventListener("close", advance);
  }, [step, clicked, advance]);

  const bounds = frame.right > frame.left && frame.bottom > frame.top ? frame : {left:0,top:0,right:typeof window === "undefined" ? 390 : window.innerWidth,bottom:typeof window === "undefined" ? 844 : window.innerHeight};
  const frameWidth = bounds.right - bounds.left, frameHeight = bounds.bottom - bounds.top;
  if (completed) return <div role="dialog" aria-modal="true" aria-label="튜토리얼 완료" style={{ position: "fixed", left:bounds.left, top:bounds.top, width:frameWidth, height:frameHeight, borderRadius:frameWidth < window.innerWidth ? 28 : 0, overflowY:"auto", zIndex: 1600, display: "grid", placeItems: "center", padding: 20, background: "rgba(14,19,27,.65)" }}>
    {completedRole === "merchant" ? <MerchantFinale picks={completedPicks} onClose={finish} /> : <div style={{ width: "min(340px, 100%)", padding: 24, borderRadius: 20, background: "white", boxShadow: "0 16px 50px #0004" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800 }}>튜토리얼 완료!</h2>
      <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>{"학생 입장에서 공고 지원, 사장님과 소통, 검증된 작업 기록과 포트폴리오를 살펴봤어요. 이제 자유롭게 둘러보세요."}</p>
      <button type="button" onClick={finish} style={{ width: "100%", marginTop: 20, padding: 12, borderRadius: 12, background: "#202932", color: "white", fontWeight: 700 }}>자유롭게 둘러보기</button>
    </div>}
  </div>;
  if (!tour || !step || !rect || loading || mode !== "mock" || !matchesStep(step, path)) return null;
  const pad = 6;
  const left = Math.min(bounds.right, Math.max(bounds.left, rect.left - pad)), top = Math.min(bounds.bottom, Math.max(bounds.top, rect.top - pad));
  const right = Math.max(left, Math.min(bounds.right, rect.right + pad)), bottom = Math.max(top, Math.min(bounds.bottom, rect.bottom + pad));
  const scrollDirection = rect.top < bounds.top ? "up" : rect.bottom > bounds.bottom ? "down" : null;
  const shade: React.CSSProperties = { position: "fixed", background: "rgba(14, 19, 27, .72)", zIndex: 1500, pointerEvents: "auto" };
  const tipTop = Math.max(bounds.top + 12, Math.min(bounds.bottom - Math.min(tipHeight,frameHeight-24) - 12, bottom + tipHeight + 24 < bounds.bottom ? bottom + 12 : top - tipHeight - 12));
  const inlineReview = step.target.includes('"post-review"');
  const reviewSlot = inlineReview ? document.getElementById("post-review-guide") : null;
  const tip = (
    <div ref={setTipElement} style={{ scrollMarginTop:80, position: inlineReview ? "relative" : "fixed", zIndex: 1502, top: inlineReview ? undefined : tipTop, pointerEvents:"auto", left: inlineReview ? undefined : Math.max(bounds.left+12, Math.min(left, bounds.right - Math.min(310,frameWidth-24) - 12)), width: inlineReview ? "100%" : Math.min(310,frameWidth-24), maxHeight:inlineReview ? undefined : frameHeight-24, overflowY: "auto", padding: 16, borderRadius: 16, background: "white", boxShadow: "0 12px 40px #0004", color: "#1a2029" }}>
      {tour.role === "merchant" ? <div aria-label={`${tour.step + 1} / ${steps.merchant.length}단계`} style={{ display: "flex", gap: 5 }}>
        {steps.merchant.map((_, i) => <span key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i <= tour.step ? "#52a6ff" : "#e3e8ee" }} />)}
      </div> : <p style={{ fontSize: 12, color: "#436991", fontWeight: 700 }}>{tour.step + 1} / {steps[tour.role].length} · {step.action === "next" ? "설명 확인" : "강조된 곳 누르기"}</p>}
      <h2 style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{step.title}</h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 7 }}>{step.description}</p>
      {!inlineReview && scrollDirection && <button type="button" onClick={() => document.querySelector(step.target)?.scrollIntoView({block: scrollDirection === "down" ? "end" : "start", behavior: "smooth"})} style={{width: "100%", marginTop: 12, padding: "10px 8px", borderRadius: 10, background: "#e9f3ff", color: "#285887", fontSize: 13, fontWeight: 700}}>
        {scrollDirection === "down" ? "↓ 아래로 내려 강조된 곳 보기" : "↑ 위로 올려 강조된 곳 보기"}
      </button>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, alignItems: "center" }}>
        <span style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={restartDemo} style={{ fontSize: 12, color: "#68717e" }}>처음으로</button>
          <button type="button" onClick={finish} style={{ fontSize: 12, color: "#68717e" }}>안내 종료</button>
        </span>
        {step.action === "next" ? <button type="button" onClick={advance} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 8, background: "#202932", color: "white" }}>{step.cta ?? (tour.step + 1 === steps[tour.role].length ? "완료" : "다음")}</button> : <span style={{ fontSize: 12, fontWeight: 700, color: "#436991" }}>파란 테두리 안을 눌러주세요</span>}
      </div>
    </div>
  );
  if (reviewSlot) return createPortal(<div aria-label="데모 안내" role="dialog" aria-live="polite">{tip}</div>, reviewSlot);
  return <div aria-label="데모 안내" role="dialog" aria-live="polite" style={{position:"fixed",left:bounds.left,top:bounds.top,width:frameWidth,height:frameHeight,zIndex:1500,pointerEvents:"none",clipPath:`inset(0 round ${frameWidth < window.innerWidth ? 28 : 0}px)`}}>
    <div style={{ ...shade, left: 0, right: 0, top: 0, height: top }} />
    <div style={{ ...shade, left: 0, top, width: left, height: bottom - top }} />
    <div style={{ ...shade, left: right, top, right: 0, height: bottom - top }} />
    <div style={{ ...shade, left: 0, right: 0, top: bottom, bottom: 0 }} />
    <div aria-hidden="true" style={{ position: "fixed", left, top, width: right - left, height: bottom - top, border: "3px solid #52a6ff", borderRadius: 12, boxShadow: "0 0 0 4px rgba(82,166,255,.3)", zIndex: 1501, pointerEvents: "none" }} />
    {tip}
  </div>;
}
