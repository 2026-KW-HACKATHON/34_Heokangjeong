"use client";
import { useEffect, useRef, useState } from "react";
import { repo } from "@/lib/repo";
import { AGREEMENT_CHANGE, AGREEMENT_SUPPORT, AGREEMENT_USAGE, type AgreementTerms, type WorkAgreement } from "@/lib/agreement";
import type { Application, Post } from "@/types";
import AgreementCalendar from "./AgreementCalendar";
import "./agreement.css";

const initialTerms = (post: Post): AgreementTerms => ({ startDate: "", endDate: "", scope: "", deliverables: post.expectedDeliverables?.join("\n") ?? "", acceptance: post.completionCriteria ?? "", coupon: post.compensationDescription || post.reward || "", revisions: post.revisionLimit ?? 2, exclusions: "", handoff: "원본 파일과 사용 안내를 채팅으로 전달" });
/** 확정 전: 양쪽이 고치고 확인 → 확정 = 선정 확정. 확정 뒤: 수정 제안 → 상대 수락(다시 확정) / 거절·철회(기존 유지) */
export default function ChatAgreement({ application, post, actorId, studentName, ownerName, onChange, autoOpen, canPropose }: { application: Application; post: Post; actorId: string; studentName: string; ownerName: string; onChange?: () => void; autoOpen?: boolean; canPropose?: boolean }) {
  const [agreement,setAgreement] = useState<WorkAgreement | null>(null);
  const [loaded,setLoaded] = useState(false);
  const [loadError,setLoadError] = useState("");
  const [shown,setShown] = useState<WorkAgreement | null>(null);
  const [terms,setTerms] = useState<AgreementTerms>(() => initialTerms(post));
  const [editing,setEditing] = useState(false);
  const [step,setStep] = useState(0);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [consent,setConsent] = useState(false);
  const [opened,setOpened] = useState(false);
  const [proposing,setProposing] = useState(false);   // 확정된 계약서의 수정 제안을 쓰는 중
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let live = true;
    const refresh = () => repo.getAgreement(application.id,actorId).then(value => { if(live) { setAgreement(value); setLoaded(true); setLoadError(""); } }).catch(() => { if(live) setLoadError("계약서를 불러오지 못했어요. 다시 열어 주세요."); });
    refresh(); const timer=setInterval(refresh,5000); window.addEventListener("focus",refresh);
    return () => { live=false; clearInterval(timer); window.removeEventListener("focus",refresh); };
  },[application.id,actorId]);
  useEffect(() => { if(!opened) return; const before=document.body.style.overflow; document.body.style.overflow="hidden"; return () => {document.body.style.overflow=before;}; },[opened]);
  function display(value: WorkAgreement | null) {
    setShown(value); setTerms(value?.terms ?? initialTerms(post)); setEditing(!value); setStep(value ? 3 : 0); setConsent(false); setError(""); setProposing(false);
  }
  async function open() {
    setBusy(true);
    try { const value=await repo.getAgreement(application.id,actorId); setAgreement(value); setLoaded(true); setLoadError(""); display(value); if (dialog.current && !dialog.current.open) dialog.current.showModal(); setOpened(true); }
    catch { setLoadError("계약서를 불러오지 못했어요. 잠시 후 다시 눌러 주세요."); }
    finally {setBusy(false);}
  }
  // 프로젝트 화면의 '계약서 수정 제안' 에서 왔으면 바로 연다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoOpen) open(); }, [autoOpen]);
  const change = <K extends keyof AgreementTerms>(key:K,value:AgreementTerms[K]) => setTerms(t=>({...t,[key]:value}));
  function next() {
    setError("");
    if(step===0 && (!terms.scope.trim() || !terms.deliverables.trim() || !terms.acceptance.trim())) return setError("작업 범위, 결과물, 완료 기준을 적어 주세요.");
    if(step===1 && (!terms.startDate || !terms.endDate || terms.endDate<terms.startDate)) return setError("시작일과 완료 예정일을 확인해 주세요.");
    if(step===2 && (!terms.coupon.trim() || !terms.handoff.trim())) return setError("쿠폰과 인계 방법을 적어 주세요.");
    setStep(s=>s+1); dialog.current?.scrollTo({top:0});
  }
  async function save() {
    setBusy(true); setError("");
    try { const value=proposing ? await repo.proposeAgreementChange(application.id,actorId,terms) : await repo.saveAgreement(application.id,actorId,shown?.version ?? 0,terms); setAgreement(value); display(value); }
    catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function confirm() {
    if(!shown || !consent) return;
    setBusy(true); setError("");
    try {const value=await repo.confirmAgreement(application.id,actorId,shown.version); setAgreement(value); display(value); if (value.finalizedAt) onChange?.();}
    catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function respond(accept: boolean) {
    setBusy(true); setError("");
    try { const value=await repo.respondAgreementChange(application.id,actorId,accept); setAgreement(value); display(value); onChange?.(); }
    catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  const side = actorId===application.studentId ? "student" : "owner";
  const pending = !editing && shown?.proposedTerms ? shown.proposedTerms : null;   // 걸려 있는 수정 제안
  const mineProposal = !!shown?.proposedBy && shown.proposedBy===side;
  const mineConfirmed = shown && (actorId===application.studentId ? shown.studentConfirmedAt : shown.ownerConfirmedAt);
  const changed = !!shown && !!agreement && shown.version!==agreement.version;
  return <>
    <div className="chat-agreement-pin"><button type="button" disabled={busy} onClick={open}><span className="agreement-pin-icon" aria-hidden="true">▤</span><span><strong>작업 계약서</strong><small>{loadError || (!loaded ? "불러오는 중…" : !agreement ? "범위와 일정을 함께 정해요" : agreement.finalizedAt ? (agreement.proposedTerms ? `수정 제안 대기 · v${agreement.version}` : `양쪽 확인 완료 · v${agreement.version}`) : `v${agreement.version} · ${Number(!!agreement.studentConfirmedAt)+Number(!!agreement.ownerConfirmedAt)}/2명 확인`)}</small></span><span>{agreement ? "보기 ›" : "작성 ›"}</span></button></div>
    <dialog className="agreement-dialog" ref={dialog} aria-label="작업 계약서 작성" onClose={()=>setOpened(false)} onCancel={e=>{if(busy)e.preventDefault();}}>
      <header><span>작업 계약서 {shown && <small>v{shown.version}</small>}</span><button type="button" disabled={busy} aria-label="계약서 닫기" onClick={()=>dialog.current?.close()}>×</button></header>
      <div className="agreement-body">
        <p className="agreement-eyebrow">작은 계약, 편안한 협업</p>
        <h2>{editing ? (proposing ? "바꿀 내용을 적어 주세요" : ["어떤 일을 함께 할까요?","언제 시작하고 끝낼까요?","보상과 마무리를 정해요","마지막으로 확인해 주세요"][step]) : pending ? "계약서 수정 제안이 있어요" : shown?.finalizedAt ? "우리의 계약이 확정됐어요" : "같은 내용을 함께 확인해요"}</h2>
        <p className="agreement-subtitle">{post.title}</p>
        <div className="agreement-parties"><span>의뢰인 <b>{ownerName}</b></span><span>작업자 <b>{studentName}</b></span></div>
        {editing && <div className="agreement-progress" aria-label={`${step+1}/4단계`}>{[0,1,2,3].map(n=><span key={n} className={n<=step?"on":""}/>)}</div>}
        {editing && step===0 && <div className="agreement-fields">
          <label>작업 범위<textarea aria-label="작업 범위" maxLength={3000} value={terms.scope} onChange={e=>change("scope",e.target.value)} placeholder="예: 신메뉴 포스터 1장과 SNS 이미지 3장 디자인" /></label>
          <label>전달할 결과물<textarea aria-label="전달할 결과물" maxLength={3000} value={terms.deliverables} onChange={e=>change("deliverables",e.target.value)} placeholder="예: 인쇄용 PDF 1개, 이미지 PNG 3개, 원본 파일" /></label>
          <label>완료 확인 기준<textarea aria-label="완료 확인 기준" maxLength={3000} value={terms.acceptance} onChange={e=>change("acceptance",e.target.value)} placeholder="예: 점주가 문구·가격을 확인하고 인쇄 가능한 파일을 수령" /></label>
        </div>}
        {editing && step===1 && <AgreementCalendar start={terms.startDate} end={terms.endDate} onChange={(startDate,endDate)=>setTerms(t=>({...t,startDate,endDate}))}/>}
        {editing && step===2 && <div className="agreement-fields">
          <label>제공할 쿠폰과 지급 시점<textarea aria-label="제공할 쿠폰과 지급 시점" maxLength={3000} value={terms.coupon} onChange={e=>change("coupon",e.target.value)} placeholder="예: 완료 확인 후 3일 이내 음료 쿠폰 5장 · 유효기간 3개월" /></label>
          <label>완료 전 수정 횟수<select aria-label="완료 전 수정 횟수" value={terms.revisions} onChange={e=>change("revisions",Number(e.target.value))}>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i}회</option>)}</select></label>
          <label>파일·계정 인계 방법<textarea aria-label="파일·계정 인계 방법" maxLength={3000} value={terms.handoff} onChange={e=>change("handoff",e.target.value)} /></label>
          <label>포함하지 않는 작업 <small>선택</small><textarea aria-label="포함하지 않는 작업" maxLength={3000} value={terms.exclusions} onChange={e=>change("exclusions",e.target.value)} placeholder="예: 인쇄 비용, 새 기능 추가, 추가 촬영" /></label>
          <div className="agreement-support"><strong>AS 1개월 · 버그 접수 3개월</strong><p>{AGREEMENT_SUPPORT}</p></div>
        </div>}
        {pending && <div className="agreement-support"><strong>{mineProposal ? "내가 보낸 수정 제안" : `${shown?.proposedBy==="owner" ? ownerName : studentName} 님의 수정 제안`} · 수락하면 이 내용으로 다시 확정돼요</strong>
          <dl className="agreement-review">{[["작업 기간",`${pending.startDate} ~ ${pending.endDate}`],["작업 범위",pending.scope],["결과물",pending.deliverables],["완료 기준",pending.acceptance],["쿠폰·지급",pending.coupon],["완료 전 수정",`${pending.revisions}회`],["인계 방법",pending.handoff],["제외 범위",pending.exclusions || "별도 기재 없음"]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
          <p>아래는 지금 효력이 있는 계약서예요.</p></div>}
        {step===3 && <>
          <dl className="agreement-review">{[["작업 기간",`${terms.startDate} ~ ${terms.endDate}`],["작업 범위",terms.scope],["결과물",terms.deliverables],["완료 기준",terms.acceptance],["쿠폰·지급",terms.coupon],["완료 전 수정",`${terms.revisions}회`],["인계 방법",terms.handoff],["제외 범위",terms.exclusions || "별도 기재 없음"]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
          <div className="agreement-support"><strong>AS 1개월 · 버그 접수 3개월</strong><p>{AGREEMENT_SUPPORT}</p></div>
          <details className="agreement-smallprint"><summary>사용·공개 범위와 변경 원칙</summary><p>{AGREEMENT_USAGE}</p><p>{AGREEMENT_CHANGE}</p></details>
          {!editing && shown && <div className="agreement-confirmations"><p>의뢰인 · {shown.ownerConfirmedAt ? `확인 완료 (${new Date(shown.ownerConfirmedAt).toLocaleString("ko-KR")})` : "확인 대기"}</p><p>작업자 · {shown.studentConfirmedAt ? `확인 완료 (${new Date(shown.studentConfirmedAt).toLocaleString("ko-KR")})` : "확인 대기"}</p></div>}
          {!editing && !shown?.finalizedAt && !mineConfirmed && <label className="agreement-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>작업 범위·쿠폰·지원 기간을 읽고 이 버전에 동의해요.</label>}
        </>}
        {changed && <p role="status" className="agreement-error">상대방이 수정했어요. 최신본을 불러와 다시 확인해 주세요.</p>}
        {error && <p role="alert" className="agreement-error">{error}</p>}
        {(error || changed) && <button className="agreement-text-button" disabled={busy} onClick={open}>최신본 다시 불러오기</button>}
        <footer className="agreement-actions">
          {editing ? <><button type="button" disabled={busy || step===0} onClick={()=>setStep(s=>s-1)}>이전</button><button className="agreement-primary" disabled={busy || changed} onClick={step===3 ? save : next}>{busy?"저장 중…":step===3?(proposing?"수정 제안 보내기":"저장하고 양쪽 확인받기"):"다음"}</button></> : shown?.finalizedAt ? (pending
            ? (mineProposal
              ? <><button disabled={busy} onClick={()=>respond(false)}>제안 철회</button><button className="agreement-primary" onClick={()=>dialog.current?.close()}>상대방 답변 대기</button></>
              : <><button disabled={busy} onClick={()=>respond(false)}>거절</button><button className="agreement-primary" disabled={busy} onClick={()=>respond(true)}>{busy?"처리 중…":"수락하고 다시 확정"}</button></>)
            : <>{canPropose && <button disabled={busy} onClick={()=>{setEditing(true);setProposing(true);setStep(0);setTerms(shown.terms);setConsent(false);}}>수정 제안</button>}<button className="agreement-primary" onClick={()=>dialog.current?.close()}>확인했어요</button></>) : <><button disabled={busy} onClick={()=>{setEditing(true);setStep(0);setConsent(false);}}>내용 수정</button><button className="agreement-primary" disabled={busy || !consent || !!mineConfirmed || changed} onClick={confirm}>{busy?"처리 중…":mineConfirmed?"상대방 확인 대기":"이 버전 최종 확인"}</button></>}
        </footer>
        <p className="agreement-footnote">{shown?.finalizedAt && !canPropose && !pending ? "확정된 계약서예요. 수정 제안은 진행 중인 프로젝트에서만 할 수 있어요." : shown?.finalizedAt ? "확정된 계약서는 한쪽이 수정을 제안하고 상대가 수락해야 바뀌어요. 그 전까지는 지금 계약서가 그대로 효력이 있어요." : "양쪽이 모두 확인하면 최종 확정되고, 그 순간 선정이 확정돼 프로젝트가 시작돼요. 수정 시 기존 확인은 취소됩니다."}</p>
      </div>
    </dialog>
  </>;
}
