import type { DocBlock } from "@shared/portfolio/document";
import type { Outcome } from "@/types";
import EvidenceItem from "./EvidenceItem";
import Verification from "./Verification";

/** 포트폴리오 문서. Notion 저장도 같은 DocBlock 목록을 쓴다 (supabase/functions/_shared/portfolio/document.ts) */
export default function PortfolioDocument({ title, summary, blocks, outcomes }: { title: string; summary: string; blocks: DocBlock[]; outcomes: Outcome[] }) {
  return (
    <article className="flex flex-col gap-3">
      <header className="card">
        <h2 className="text-xl font-bold leading-snug">{title}</h2>
        {summary && <p className="mt-2 text-[15px] leading-relaxed">{summary}</p>}
      </header>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "info":
            return (
              <section key={i} className="card">
                <h3 className="mb-2 font-bold">Project Information</h3>
                <dl className="grid grid-cols-[64px_1fr] gap-y-1 text-sm">{b.rows.map(([k, v]) => <div key={k} className="contents"><dt className="sub">{k}</dt><dd>{v}</dd></div>)}</dl>
              </section>
            );
          case "section":
            return (
              <section key={i} className="card">
                <h3 className="mb-2 font-bold">{b.section.title}</h3>
                {b.section.body.split(/\n+/).filter(Boolean).map((p, j) => <p key={j} className="mb-2 whitespace-pre-line text-[15px] leading-relaxed last:mb-0">{p}</p>)}
                {b.evidence.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{b.evidence.map((e) => <EvidenceItem key={e.id} e={e} compact />)}</div>}
              </section>
            );
          case "feedback":
            return (
              <section key={i} className="card">
                <h3 className="mb-2 font-bold">Client Feedback <span className="sub text-xs font-normal">· 의뢰인 원문 (수정 불가)</span></h3>
                <blockquote className="border-l-4 border-[var(--primary)] pl-3 text-[15px]">“{b.review.comment}”</blockquote>
                <p className="sub mt-2 text-xs">만족도 {b.review.satisfaction}/5 · 기한 {b.review.deadline}/5 · 소통 {b.review.communication}/5 · 인계 {b.review.handoff}/5</p>
              </section>
            );
          case "tools":
            return (
              <section key={i} className="card">
                <h3 className="mb-2 font-bold">Tools & Why</h3>
                <ul className="flex flex-col gap-1 text-sm">{b.tools.map((t) => <li key={t.name}><b>{t.name}</b>{t.why && <span className="sub"> — {t.why}</span>}</li>)}</ul>
                {b.skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{b.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
              </section>
            );
          case "outcomes":
            return (
              <section key={i} className="card">
                <h3 className="mb-2 font-bold">Outcome</h3>
                <ul className="flex flex-col gap-1 text-sm">{b.lines.map((l, j) => <li key={j} className={l.measured ? "" : "sub"}>{l.text}</li>)}</ul>
              </section>
            );
          case "verification":
            return (
              <section key={i} className="card border border-green-100">
                <h3 className="mb-2 font-bold">Client Verification</h3>
                <Verification v={b.verification} outcomes={outcomes} approvedVersion={b.approvedVersion} />
              </section>
            );
          case "evidenceList":
            return (
              <section key={i} className="card">
                <h3 className="mb-2 font-bold">Evidence / Links</h3>
                <div className="grid grid-cols-2 gap-2">{b.evidence.map((e) => <EvidenceItem key={e.id} e={e} compact />)}</div>
              </section>
            );
        }
      })}
    </article>
  );
}
