"use client";
import Verification from "@/components/Verification";
import type { DocBlock } from "@shared/portfolio/document";
import type { PortfolioContent } from "@/types";
import type { PortfolioPage } from "@/lib/portfolio/page";

function EvidenceGrid({ page, ids }: { page: PortfolioPage; ids: string[] }) {
  const evidence = ids.map(id => page.evidence.find(item => item.id === id)).filter((item): item is PortfolioPage["evidence"][number] => !!item);
  if (!evidence.length) return null;
  return <div className="pf-web-evidence">{evidence.map(item => (
    <figure key={item.id}>
      {item.url && item.mimeType?.startsWith("image/") ? <img src={item.url} alt={item.description} /> : <div className="pf-web-file">↗ {item.fileName || "결과물 열기"}</div>}
      <figcaption>{item.description}</figcaption>
    </figure>
  ))}</div>;
}

export default function WebPortfolio({ page, content, blocks }: { page: PortfolioPage; content: PortfolioContent; blocks: DocBlock[] }) {
  const info = blocks.find((block): block is Extract<DocBlock, { kind: "info" }> => block.kind === "info");
  const sections = blocks.filter((block): block is Extract<DocBlock, { kind: "section" }> => block.kind === "section");
  const review = blocks.find((block): block is Extract<DocBlock, { kind: "feedback" }> => block.kind === "feedback");
  const outcomes = blocks.find((block): block is Extract<DocBlock, { kind: "outcomes" }> => block.kind === "outcomes");
  const verification = blocks.find((block): block is Extract<DocBlock, { kind: "verification" }> => block.kind === "verification");
  const allEvidence = blocks.find((block): block is Extract<DocBlock, { kind: "evidenceList" }> => block.kind === "evidenceList");
  const heroImage = page.evidence.find(item => item.url && item.mimeType?.startsWith("image/"));

  return <article className="pf-web">
    <header className="pf-web-hero">
      <div className="pf-web-brand"><span>WOLINK</span><span>VERIFIED CASE STUDY</span></div>
      <div className="pf-web-banner"><div>
        <p className="pf-web-kicker">검증된 프로젝트 포트폴리오</p>
        <h1>{content.title}</h1>
        <p className="pf-web-summary">{content.summary}</p>
      </div>{heroImage && <figure className="pf-web-hero-image"><img src={heroImage.url} alt={heroImage.description} /><figcaption>{heroImage.description}</figcaption></figure>}</div>
      {info && <dl className="pf-web-facts">{info.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    </header>

    <div className="pf-web-layout">
      <aside className="pf-web-index">
        <p>이 페이지의 목차</p>
        <ol>{sections.map((block, index) => <li key={block.section.key}><a href={`#web-section-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span>{block.section.title}</a></li>)}</ol>
      </aside>
      <main className="pf-web-content">
        {sections.map((block, index) => <section key={block.section.key} id={`web-section-${index + 1}`} className="pf-web-section">
          <div className="pf-web-section-no">{String(index + 1).padStart(2, "0")}</div>
          <div><h2>{block.section.title}</h2><p>{block.section.body}</p><EvidenceGrid page={page} ids={block.evidence.map(item => item.id)} /></div>
        </section>)}

        {review && <figure className="pf-web-quote"><blockquote>“{review.review.comment}”</blockquote><figcaption>의뢰인 평가 원문 · 만족도 {review.review.satisfaction}/5 · 기한 {review.review.deadline}/5 · 소통 {review.review.communication}/5 · 인계 {review.review.handoff}/5</figcaption></figure>}

        {(content.tools.length > 0 || content.skills.length > 0) && <section className="pf-web-meta-section"><p className="pf-web-meta-label">사용 도구와 역량</p><div className="pf-web-chips">{content.tools.map(tool => <span key={tool.name}>{tool.name}{tool.why && <small>{tool.why}</small>}</span>)}{content.skills.map(skill => <span key={skill}>{skill}</span>)}</div></section>}

        {outcomes && <section className="pf-web-meta-section"><p className="pf-web-meta-label">성과</p><ul className="pf-web-outcomes">{outcomes.lines.map((line, index) => <li key={index}>{line.text}</li>)}</ul></section>}

        {verification && <section className="pf-web-verified"><div><p className="pf-web-meta-label">의뢰인 검증</p><h2>의뢰인이 직접 확인한 프로젝트입니다.</h2></div><Verification v={verification.verification} outcomes={page.outcomes} approvedVersion={verification.approvedVersion} /></section>}

        {allEvidence && <section className="pf-web-meta-section"><p className="pf-web-meta-label">증빙 자료와 링크</p><EvidenceGrid page={page} ids={allEvidence.evidence.map(item => item.id)} /></section>}
      </main>
    </div>
    <footer className="pf-web-footer"><b>WOLINK</b><span>월계 재능나눔 · 의뢰인 검증 포트폴리오 · v{page.edit.version}</span><small>Design adapted from Editorial by <a href="https://html5up.net" target="_blank" rel="noreferrer">HTML5 UP</a> · CC BY 3.0</small></footer>
  </article>;
}
