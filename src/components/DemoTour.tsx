"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getDemoTour, saveDemoTour, type DemoRole, type DemoTourState } from "@/lib/demoTour";
import { useSession } from "@/lib/session";

type Step = { path: string; target: string; title: string; description: string; action?: "next" };
const steps: Record<DemoRole, Step[]> = {
  merchant: [
    { path: "/posts/new/", target: '[data-demo-tour="post-example"]', title: "Gemini 공고 요약", description: "요청 문장을 미리 넣었어요. Gemini 요약을 눌러 공고 초안으로 정리해 보세요." },
    { path: "/posts/new/", target: '[data-demo-tour="post-submit"]', title: "공고 등록", description: "내용을 살펴본 뒤 등록해 보세요. 등록에 성공하면 공고 상세로 이어집니다." },
    { path: "/posts/detail/", target: '[data-demo-tour="post-created"]', title: "공고 등록 완료", description: "방금 올린 공고가 등록됐어요. 제목과 요청 내용을 확인하세요.", action: "next" },
    { path: "/posts/detail/", target: '[data-demo-tour="post-applicants"]', title: "지원자 비교", description: "데모 학생 두 명이 방금 올린 포스터 공고에 지원했어요. 학과와 제안 내용을 비교하세요.", action: "next" },
    { path: "/posts/detail/", target: '[data-demo-tour="merchant-select"]', title: "학생 선정하기", description: "디자인 작업 경험이 맞는 윤서연 학생을 선정해 보세요. 계약서를 양쪽이 확인해야 최종 확정됩니다." },
    { path: "/chats/room/", target: '[data-demo-tour="agreement"]', title: "양쪽이 확인하는 계약서", description: "계약서를 열어 자유 입력칸에 작업 내용을 적고 'Gemini 요약'을 눌러 보세요. 실제 AI 응답이 항목에 반영됩니다. 내용을 확인한 뒤 다음으로 진행하세요." },
    { path: "/chats/room/", target: '[data-demo-tour="merchant-match-status"]', title: "상인 흐름 완료", description: "데모에서는 학생 확인도 자동으로 재현해 선정이 확정되고 프로젝트가 시작됩니다. 실제 이용에서는 학생이 직접 확인해야 해요. 다른 지원자에게는 미선정 안내가 갑니다.", action: "next" },
  ],
  student: [
    { path: "/", target: '[data-demo-tour="student-post"]', title: "추천 공고 살펴보기", description: "김하늘 학생의 디자인 관심 분야와 가까운 베이커리 패키지 공고입니다. 카드를 눌러 자세히 보세요." },
    { path: "/posts/detail/?id=p9", target: '[data-demo-tour="student-apply"]', title: "공고에 지원하기", description: "가게가 원하는 결과물을 확인하세요. 김하늘의 지원 메시지가 미리 작성돼 있으니 바로 지원할 수 있어요." },
    { path: "/posts/detail/?id=p9", target: '[data-demo-tour="student-applied"]', title: "지원 후 채팅", description: "지원하면 사장님과 바로 대화할 수 있어요. 채팅창으로 이동해 보세요." },
    { path: "/chats/room/", target: '[data-demo-tour="student-chat-send"]', title: "사장님과 소통하기", description: "인쇄 크기와 선호 색상을 묻는 메시지가 채워져 있어요. 전송하면 매칭 대기 사례로 이어집니다." },
    { path: "/chats/room/?id=a13", target: '[data-demo-tour="agreement"]', title: "선정 후 작업 계약서", description: "월계 미용실 계약서를 열어 자유 입력 내용을 Gemini로 정리해 보세요. 저장 후 내 확인을 누르면 데모에서 상대방 확인도 재현합니다." },
    { path: "/me/", target: '[data-demo-tour="feed-item"]', title: "검증된 경험과 작업", description: "미용실 계약은 아직 진행 중입니다. 여기서는 의뢰인이 검증을 마친 별도의 한식당 메뉴판 작업을 열어봅니다." },
    { path: "/portfolio/experience/?s=s1&kind=project&id=demo-menu-2", target: '[data-demo-tour="portfolio-detail"]', title: "검증된 작업 기록", description: "작업 과정과 결과를 읽고 자세한 포트폴리오로 이동하세요." },
    { path: "/portfolio/view/?id=demo-menu-2&s=s1", target: '[data-demo-tour="portfolio-web"]', title: "HTML 포트폴리오", description: "PC 버전을 눌러 같은 내용이 웹용 HTML 레이아웃으로 보이는지 확인하세요." },
    { path: "/portfolio/view/?id=demo-menu-2&s=s1", target: '[data-demo-tour="student-me"]', title: "이제 자유롭게 둘러보세요", description: "PC 포트폴리오까지 확인했어요. 아래 '나'를 눌러 작업실로 돌아가면 안내가 끝납니다." },
  ],
};

function matchesStep(step: Step, path: string | null) {
  if (!path) return false;
  const expected = new URL(step.path, window.location.origin);
  const current = new URL(window.location.href);
  return path.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "")
    && [...expected.searchParams].every(([key, value]) => current.searchParams.get(key) === value);
}

export default function DemoTour() {
  const { mode, loading } = useSession();
  const path = usePathname();
  const [tour, setTour] = useState<DemoTourState | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [clicked, setClicked] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedRole, setCompletedRole] = useState<DemoRole>("student");
  const [tipHeight, setTipHeight] = useState(230);
  const [tipElement, setTipElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!tipElement) return;
    const observer = new ResizeObserver(() => setTipHeight(tipElement.getBoundingClientRect().height));
    observer.observe(tipElement);
    return () => observer.disconnect();
  }, [tipElement]);
  useEffect(() => { setTour(getDemoTour()); }, []);
  useEffect(() => { document.body.classList.toggle("guided-demo", !!tour || completed); return () => document.body.classList.remove("guided-demo"); }, [tour, completed]);
  const finish = useCallback(() => { saveDemoTour(null); setTour(null); setRect(null); setCompleted(false); }, []);
  const baseStep = tour && steps[tour.role][tour.step];
  const step = useMemo(() => tour?.role === "student" && tour.step === 1 && alreadyApplied && !clicked
    ? { ...baseStep!, target: '[data-demo-tour="student-applied"]', title: "이미 지원한 공고", description: "이 브라우저에서는 이미 지원했어요. 지원 내역을 확인한 뒤 다음 단계에서 채팅창으로 이동하세요.", action: "next" as const }
    : baseStep, [tour?.role, tour?.step, alreadyApplied, clicked, baseStep]);
  useEffect(() => {
    if (tour?.role !== "student" || tour.step !== 1 || !path?.startsWith("/posts/detail")) return;
    const update = () => setAlreadyApplied(!!document.querySelector('[data-demo-tour="student-applied"]'));
    update();
    const timer = window.setInterval(update, 250);
    return () => clearInterval(timer);
  }, [tour?.role, tour?.step, path]);
  const advance = useCallback(() => {
    if (!tour) return;
    const next = tour.step + 1;
    if (next >= steps[tour.role].length) { saveDemoTour(null); setCompletedRole(tour.role); setTour(null); setRect(null); setCompleted(true); return; }
    const updated = { ...tour, step: next };
    saveDemoTour(updated); setTour(updated); setClicked(false); setRect(null);
    const destination = steps[tour.role][next].path;
    const here = window.location.pathname + window.location.search;
    if (destination !== "/posts/detail/" && destination !== "/chats/room/" && here !== destination) window.location.assign(destination);
  }, [tour]);

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
    const onClick = (event: MouseEvent) => { if (current && current.contains(event.target as Node)) setClicked(true); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    update();
    document.querySelector(step.target)?.scrollIntoView({ block: "center", behavior: "auto" });
    update();
    return () => { observer.disconnect(); clearInterval(timer); document.removeEventListener("click", onClick, true); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [step, path, loading, mode, clicked, tour]);

  useEffect(() => {
    if (!tour || !step || !clicked || step.action === "next") return;
    if (step.target.includes('"post-example"') || step.target.includes('"post-submit"') || step.target.includes('"merchant-select"') || step.target.includes('"student-apply"') || step.target.includes('"agreement"') || step.target.includes('"student-me"')) return;
    advance();
  }, [tour, step, clicked, advance, finish]);

  useEffect(() => {
    if (!step?.target.includes('"post-example"') || !clicked) return;
    const timer = window.setInterval(() => { if (document.querySelector('[data-demo-tour="post-drafted"]')) advance(); }, 200);
    return () => clearInterval(timer);
  }, [step, clicked, advance]);

  useEffect(() => {
    if (step?.target.includes('"student-me"') && clicked && path?.replace(/\/$/, "") === "/me") {
      saveDemoTour(null); setTour(null); setRect(null); setCompleted(true);
    }
  }, [step, clicked, path]);

  useEffect(() => {
    if (step?.target.includes('"post-submit"') && clicked && path?.replace(/\/$/, "") === "/posts/detail") advance();
  }, [tour, step?.target, clicked, path, advance]);

  useEffect(() => {
    if (step?.target.includes('"merchant-select"') && clicked && path?.replace(/\/$/, "") === "/chats/room") advance();
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

  if (completed) return <div role="dialog" aria-modal="true" aria-label="튜토리얼 완료" style={{ position: "fixed", inset: 0, zIndex: 1600, display: "grid", placeItems: "center", padding: 20, background: "rgba(14,19,27,.65)" }}>
    <div style={{ width: "min(340px, 100%)", padding: 24, borderRadius: 20, background: "white", boxShadow: "0 16px 50px #0004" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800 }}>튜토리얼 완료!</h2>
      <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>{completedRole === "merchant" ? "상인 입장에서 Gemini 공고 작성, 지원자 비교·선정, 채팅과 계약서 확정까지 체험했어요. 이제 자유롭게 둘러보세요." : "학생 입장에서 공고 지원, 채팅, 계약서, 검증된 포트폴리오와 PC 버전까지 살펴봤어요. 이제 자유롭게 둘러보세요."}</p>
      <button type="button" onClick={finish} style={{ width: "100%", marginTop: 20, padding: 12, borderRadius: 12, background: "#202932", color: "white", fontWeight: 700 }}>자유롭게 둘러보기</button>
    </div>
  </div>;
  if (!tour || !step || !rect || loading || mode !== "mock" || !matchesStep(step, path)) return null;
  const pad = 6;
  const left = Math.min(window.innerWidth, Math.max(0, rect.left - pad)), top = Math.min(window.innerHeight, Math.max(0, rect.top - pad));
  const right = Math.max(left, Math.min(window.innerWidth, rect.right + pad)), bottom = Math.max(top, Math.min(window.innerHeight, rect.bottom + pad));
  const scrollDirection = rect.top < 0 ? "up" : rect.bottom > window.innerHeight ? "down" : null;
  const shade: React.CSSProperties = { position: "fixed", background: "rgba(14, 19, 27, .72)", zIndex: 1500 };
  const tipTop = Math.max(12, Math.min(window.innerHeight - tipHeight - 12, bottom + tipHeight + 24 < window.innerHeight ? bottom + 12 : top - tipHeight - 12));
  return <div aria-label="데모 안내" role="dialog" aria-live="polite">
    <div style={{ ...shade, left: 0, right: 0, top: 0, height: top }} />
    <div style={{ ...shade, left: 0, top, width: left, height: bottom - top }} />
    <div style={{ ...shade, left: right, top, right: 0, height: bottom - top }} />
    <div style={{ ...shade, left: 0, right: 0, top: bottom, bottom: 0 }} />
    <div aria-hidden="true" style={{ position: "fixed", left, top, width: right - left, height: bottom - top, border: "3px solid #52a6ff", borderRadius: 12, boxShadow: "0 0 0 4px rgba(82,166,255,.3)", zIndex: 1501, pointerEvents: "none" }} />
    <div ref={setTipElement} style={{ position: "fixed", zIndex: 1502, top: tipTop, left: Math.max(12, Math.min(left, window.innerWidth - 322)), width: "min(310px, calc(100vw - 24px))", maxHeight: "calc(100dvh - 24px)", overflowY: "auto", padding: 16, borderRadius: 16, background: "white", boxShadow: "0 12px 40px #0004", color: "#1a2029" }}>
      <p style={{ fontSize: 12, color: "#436991", fontWeight: 700 }}>{tour.step + 1} / {steps[tour.role].length} · {step.action === "next" ? "설명 확인" : "강조된 곳 누르기"}</p>
      <h2 style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{step.title}</h2>
      <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 7 }}>{step.description}</p>
      {scrollDirection && <button type="button" onClick={() => document.querySelector(step.target)?.scrollIntoView({block: scrollDirection === "down" ? "end" : "start", behavior: "smooth"})} style={{width: "100%", marginTop: 12, padding: "10px 8px", borderRadius: 10, background: "#e9f3ff", color: "#285887", fontSize: 13, fontWeight: 700}}>
        {scrollDirection === "down" ? "↓ 아래로 내려 강조된 곳 보기" : "↑ 위로 올려 강조된 곳 보기"}
      </button>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, alignItems: "center" }}>
        <button type="button" onClick={finish} style={{ fontSize: 12, color: "#68717e" }}>안내 종료</button>
        {step.action === "next" ? <button type="button" onClick={advance} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 8, background: "#202932", color: "white" }}>{tour.step + 1 === steps[tour.role].length ? "완료" : "다음"}</button> : <span style={{ fontSize: 12, fontWeight: 700, color: "#436991" }}>파란 테두리 안을 눌러주세요</span>}
      </div>
    </div>
  </div>;
}
