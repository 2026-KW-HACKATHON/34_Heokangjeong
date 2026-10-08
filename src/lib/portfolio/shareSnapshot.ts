import type { PortfolioPage } from "./page";
import type { PortfolioContent } from "@/types";

// 링크 자체에 공유 시점의 내용을 담아 로그인·데모 저장소·초기화와 독립적으로 연다.
export async function portfolioShareUrl(page: PortfolioPage, content: PortfolioContent, origin: string) {
  const publicPage = { ...page };
  delete publicPage.latestDraft;
  const snapshot = { version: 1, page: { ...publicPage, edit: { ...page.edit, content } } };
  const stream = new Blob([JSON.stringify(snapshot)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (encoded.length > 60000) throw new Error("사진 용량이 커 링크로 공유하기 어려워요. PC 버전의 HTML 다운로드로 파일을 보내 주세요.");
  return new URL(`/portfolio/shared/#v1=${encoded}`, origin).toString();
}

export async function readPortfolioSnapshot(hash: string): Promise<PortfolioPage> {
  const encoded = hash.replace(/^#v1=/, "");
  if (!hash.startsWith("#v1=") || encoded.length > 60000) throw new Error("올바른 포트폴리오 공유 링크가 아니에요.");
  const bytes = Uint8Array.from(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 2_000_000) { await reader.cancel(); throw new Error("공유 내용이 너무 커요."); }
    chunks.push(value);
  }
  const snapshot = JSON.parse(await new Blob(chunks.map(chunk => new Uint8Array(chunk).buffer)).text());
  const page = snapshot?.page;
  if (snapshot?.version !== 1 || !page?.edit?.content?.title || !Array.isArray(page.edit.content.sections) || !Array.isArray(page.evidence) || !page.info) throw new Error("공유 내용을 읽을 수 없어요.");
  return page;
}
