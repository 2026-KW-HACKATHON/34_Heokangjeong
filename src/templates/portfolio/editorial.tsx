"use client";
// 에디토리얼 템플릿 (기능 확인용 단순형): 큰 제목, 사실 줄, 번호 붙은 왼쪽 라벨·오른쪽 본문, 큰 인용.
// 실제 시안(Telha Clarke 풍)은 나중에 이 자리를 바꾼다. 내용은 기본 템플릿과 똑같이 모든 블록을 담는다.
import Verification from "@/components/Verification";
import type { DocBlock } from "@shared/portfolio/document";
import { EditableText, EvidenceFigures, Locked, ToolsEditor, assertNever, setSection } from "./parts";
import type { TemplateProps } from "./types";

function Row({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <section className="pf-ed-row">
      <h3 className="pf-ed-label"><span>{String(n).padStart(2, "0")}</span>{label}</h3>
      <div className="pf-ed-body">{children}</div>
    </section>
  );
}

export default function EditorialTemplate({ page, content, blocks, editing, onChange }: TemplateProps) {
  let n = 0;
  const block = (b: DocBlock, i: number) => {
    switch (b.kind) {
      case "info":
        return (
          <Locked key={i} editing={editing} origin="record">
            <dl className="pf-ed-facts">{b.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </Locked>
        );
      case "section":
        return (
          <Row key={i} n={++n} label={b.section.title}>
            <EditableText label={b.section.title} editing={editing} value={b.section.body} onChange={(v) => onChange(setSection(content, b.section.key, v))} className="pf-ed-text" />
            {b.evidence.length > 0 && (
              <Locked editing={editing} origin="client" className="mt-4">
                <EvidenceFigures evidence={b.evidence} />
              </Locked>
            )}
          </Row>
        );
      case "feedback":
        return (
          <Locked key={i} editing={editing} origin="client">
            <figure className="pf-ed-quote">
              <blockquote>“{b.review.comment}”</blockquote>
              <figcaption>의뢰인 평가 원문 · 만족도 {b.review.satisfaction}/5 · 기한 {b.review.deadline}/5 · 소통 {b.review.communication}/5 · 인계 {b.review.handoff}/5</figcaption>
            </figure>
          </Locked>
        );
      case "tools":
        return (
          <Row key={i} n={++n} label="사용 도구와 이유">
            <div className="pf-ed-text"><ToolsEditor content={content} onChange={onChange} editing={editing} nameClass="font-semibold" whyClass="opacity-70" chipClass="pf-ed-chip" /></div>
          </Row>
        );
      case "outcomes":
        return (
          <Row key={i} n={++n} label="성과">
            <Locked editing={editing} origin="record">
              <ul className="pf-ed-lines">{b.lines.map((l, j) => <li key={j} className={l.measured ? "" : "opacity-60"}>{l.text}</li>)}</ul>
            </Locked>
          </Row>
        );
      case "verification":
        return (
          <Row key={i} n={++n} label="의뢰인 검증">
            <Locked editing={editing} origin="client">
              <Verification v={b.verification} outcomes={page.outcomes} approvedVersion={b.approvedVersion} />
            </Locked>
          </Row>
        );
      case "evidenceList":
        return (
          <Row key={i} n={++n} label="증빙·링크">
            <Locked editing={editing} origin="client">
              <EvidenceFigures evidence={b.evidence} columns={2} />
            </Locked>
          </Row>
        );
      default:
        return assertNever(b);
    }
  };
  return (
    <article className="pf-ed">
      <header className="pf-ed-head">
        <EditableText label="제목" multiline={false} editing={editing} value={content.title} onChange={(v) => onChange({ ...content, title: v })} className="pf-ed-title" />
        <EditableText label="한 줄 요약" editing={editing} value={content.summary} onChange={(v) => onChange({ ...content, summary: v })} className="pf-ed-summary" placeholder="한 줄 요약" />
      </header>
      {blocks.map(block)}
      <footer className="pf-ed-foot">월계 재능나눔 · 의뢰인 검증 포트폴리오 · 편집본 v{page.edit.version}</footer>
    </article>
  );
}
