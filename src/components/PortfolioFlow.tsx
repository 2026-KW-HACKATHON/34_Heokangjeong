"use client";
import { useState } from "react";

/** Interaction prototype only: never represents a simulated step as an OAuth connection. */
export default function PortfolioFlow({ title = "동네 카페 메뉴판 디자인", durationDays = 14 }: { title?: string; durationDays?: number }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(title);
  const [role, setRole] = useState("");
  const [result, setResult] = useState("");
  const [notice, setNotice] = useState("");
  const valid = Boolean(name.trim() && role.trim() && result.trim());
  async function copy() {
    try {
      await navigator.clipboard.writeText(`# ${name}\n\n## 맡은 역할\n${role}\n\n## 작업 기간\n${durationDays}일\n\n## 과정과 결과\n${result}`);
      setNotice("복사했어요. Notion 페이지에 붙여넣어 주세요.");
    } catch { setNotice("복사 권한이 없어요. 아래 미리보기 내용을 직접 선택해 복사해 주세요."); }
  }
  return <section className="card" aria-label="Notion 포트폴리오 흐름 데모">
    <div className="mb-4 flex items-center justify-between"><span className="silver-badge text-xs">포트폴리오</span><span className="sub text-xs">체험용 · 실제 연동 아님</span></div>
    <ol aria-label="작성 단계" className="mb-6 flex gap-3 text-xs">{["완료 확인", "기록 작성", "Notion 내보내기"].map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined} className={step === i ? "font-bold text-[var(--text)]" : "sub"}>{i + 1}. {label}</li>)}</ol>
    {step === 0 && <><h2 className="text-xl font-bold">도움이 경험으로 남도록.</h2><p className="sub mt-3 text-sm leading-6">공고 완료 후 참여자가 자신의 역할과 결과를 정리하고, Notion에 옮기는 흐름을 체험해 보세요. 이 데모는 공고 상태를 변경하지 않습니다.</p><p className="my-5 rounded-xl bg-[var(--bg)] p-4 text-sm">{title} · {durationDays}일</p><button className="btn btn-primary w-full" onClick={() => setStep(1)}>포트폴리오 작성해 보기</button></>}
    {step === 1 && <form onSubmit={e => { e.preventDefault(); if (valid) setStep(2); }} className="flex flex-col gap-4"><h2 className="text-xl font-bold">어떤 일을 해냈나요?</h2><p className="sub text-xs">모든 항목은 필수예요. 입력 내용은 이 화면에서만 유지됩니다.</p><label className="text-sm font-medium">작업 제목 · 필수<input required maxLength={150} className="flow-input" value={name} onChange={e => setName(e.target.value)} /></label><label className="text-sm font-medium">맡은 역할 · 필수<input required maxLength={150} className="flow-input" placeholder="예: 메뉴판 구성 및 그래픽 디자인" value={role} onChange={e => setRole(e.target.value)} /></label><label className="text-sm font-medium">과정과 결과 · 필수<textarea required maxLength={5000} rows={5} className="flow-input" placeholder="해결한 문제, 작업 과정, 달라진 점을 적어주세요." value={result} onChange={e => setResult(e.target.value)} /></label><div className="flex gap-2"><button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>이전</button><button disabled={!valid} className="btn btn-primary flex-1">내보내기 미리보기</button></div></form>}
    {step === 2 && <><h2 className="text-xl font-bold">Notion에 기록 남기기</h2><p className="sub mt-3 text-sm leading-6">자동 연결은 아직 준비 중이에요. 지금은 내용을 복사해서 Notion에 붙여넣을 수 있습니다.</p><article className="my-5 rounded-xl border border-[var(--line)] bg-[#fafafa] p-4 text-sm"><h3 className="break-words text-lg font-bold">{name}</h3><p className="sub mt-2">{durationDays}일 활동</p><h4 className="mt-4 font-semibold">맡은 역할</h4><p className="whitespace-pre-wrap break-words">{role}</p><h4 className="mt-4 font-semibold">과정과 결과</h4><p className="whitespace-pre-wrap break-words">{result}</p></article><button className="btn btn-primary w-full" onClick={copy}>Notion에 붙여넣을 내용 복사</button><button className="btn btn-ghost mt-2 w-full" onClick={() => setStep(1)}>내용 수정</button><p role="status" className="mt-3 text-sm">{notice}</p><details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">정식 연결 시 예정 흐름</summary><p className="sub mt-2 leading-6">Notion 계정 연결 → 접근할 페이지 승인 → 저장 위치 선택 → 내용 확인 → 페이지 생성. 현재는 계정 연결이나 외부 전송이 일어나지 않습니다.</p></details></>}
  </section>;
}
