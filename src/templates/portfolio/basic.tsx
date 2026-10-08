"use client";
// 기본 템플릿: 지금까지의 카드형 포트폴리오 화면을 템플릿으로 옮긴 것.
import Verification from "@/components/Verification";
import type { DocBlock } from "@shared/portfolio/document";
import { EditableText, EvidenceFigures, Locked, ToolsEditor, assertNever, setSection } from "./parts";
import type { TemplateProps } from "./types";

export default function BasicTemplate({ page, content, blocks, editing, onChange, onReplaceImage, imageBusy }: TemplateProps) {
  const block = (b: DocBlock, i: number) => {
    switch (b.kind) {
      case "info":
        return (
          <Locked key={i} editing={editing} origin="record" className="card">
            <h3 className="mb-2 font-bold">프로젝트 정보</h3>
            <dl className="grid grid-cols-[64px_1fr] gap-y-1 text-sm">{b.rows.map(([k, v]) => <div key={k} className="contents"><dt className="sub">{k}</dt><dd>{v}</dd></div>)}</dl>
          </Locked>
        );
      case "section":
        return (
          <section key={i} className="card">
            <h3 className="mb-2 font-bold">{b.section.title}</h3>
            <EditableText label={b.section.title} editing={editing} value={b.section.body} onChange={(v) => onChange(setSection(content, b.section.key, v))} className="text-[15px] leading-relaxed" />
            {b.evidence.length > 0 && (
              <Locked editing={editing} origin="client" className="mt-3">
                <EvidenceFigures evidence={b.evidence} overrides={content.imageOverrides} editing={editing} onReplaceImage={onReplaceImage} imageBusy={imageBusy} />
              </Locked>
            )}
          </section>
        );
      case "feedback":
        return (
          <Locked key={i} editing={editing} origin="client" className="card">
            <h3 className="mb-2 font-bold">의뢰인 평가 <span className="sub text-xs font-normal">· 원문</span></h3>
            <blockquote className="border-l-4 border-[var(--primary)] pl-3 text-[15px]">“{b.review.comment}”</blockquote>
            <p className="sub mt-2 text-xs">만족도 {b.review.satisfaction}/5 · 기한 {b.review.deadline}/5 · 소통 {b.review.communication}/5 · 인계 {b.review.handoff}/5</p>
          </Locked>
        );
      case "tools":
        return (
          <section key={i} className="card text-sm">
            <h3 className="mb-2 font-bold">사용 도구와 이유</h3>
            <ToolsEditor content={content} onChange={onChange} editing={editing} whyClass="sub" />
          </section>
        );
      case "outcomes":
        return (
          <Locked key={i} editing={editing} origin="record" className="card">
            <h3 className="mb-2 font-bold">성과</h3>
            <ul className="flex flex-col gap-1 text-sm">{b.lines.map((l, j) => <li key={j} className={l.measured ? "" : "sub"}>{l.text}</li>)}</ul>
          </Locked>
        );
      case "verification":
        return (
          <Locked key={i} editing={editing} origin="client" className="card border border-green-100">
            <h3 className="mb-2 font-bold">의뢰인 검증</h3>
            <Verification v={b.verification} outcomes={page.outcomes} approvedVersion={b.approvedVersion} />
          </Locked>
        );
      case "evidenceList":
        return (
          <Locked key={i} editing={editing} origin="client" className="card">
            <h3 className="mb-2 font-bold">증빙·링크</h3>
            <EvidenceFigures evidence={b.evidence} columns={2} />
          </Locked>
        );
      default:
        return assertNever(b);
    }
  };
  return (
    <article className="pf-basic flex flex-col gap-3 px-4 pb-28 pt-2">
      <header className="card">
        <EditableText label="제목" multiline={false} editing={editing} value={content.title} onChange={(v) => onChange({ ...content, title: v })} className="block text-xl font-bold leading-snug" />
        <EditableText label="한 줄 요약" editing={editing} value={content.summary} onChange={(v) => onChange({ ...content, summary: v })} className="mt-2 text-[15px] leading-relaxed" placeholder="한 줄 요약" />
      </header>
      {blocks.map(block)}
    </article>
  );
}
