"use client";
import { useEffect, useState } from "react";
import { readPortfolioSnapshot } from "@/lib/portfolio/shareSnapshot";
import { pageBlocks } from "@/lib/portfolio/page";
import { webPortfolioHtml } from "@/lib/portfolio/webHtml";

/** 기존 HTML 렌더러 그대로: 새 디자인이나 별도 포트폴리오를 생성하지 않는다. */
export default function SharedPortfolio() {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    readPortfolioSnapshot(window.location.hash).then(page => {
      const rendered = webPortfolioHtml(page, page.edit.content, pageBlocks(page));
      if (active) { document.title = page.edit.content.title; setHtml(rendered); }
    }).catch(() => { if (active) setError("포트폴리오 링크를 읽지 못했어요. 보낸 사람에게 링크를 다시 요청해 주세요."); });
    return () => { active = false; };
  }, []);
  return <main style={{ position: "fixed", inset: 0, zIndex: 2000, background: "white" }}>
    {html ? <iframe title="공유 포트폴리오" srcDoc={html} sandbox="allow-scripts allow-downloads" style={{ width: "100%", height: "100%", border: 0 }} /> : <p role="status" style={{ padding: 24 }}>{error || "포트폴리오를 여는 중…"}</p>}
  </main>;
}
