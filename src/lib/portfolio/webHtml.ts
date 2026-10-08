import { CLAIM_KEYS, CLAIM_LABEL, EVIDENCE_LABEL, type DocBlock } from "@shared/portfolio/document";
import type { PortfolioContent } from "@/types";
import type { PortfolioPage } from "./page";
import { menuEditorialHtml } from "./menuEditorialHtml";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const safeUrl = (value?: string) => value && /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value) ? esc(value) : "";

function evidenceHtml(page: PortfolioPage, ids: string[]) {
  return ids.map(id => page.evidence.find(item => item.id === id)).filter(Boolean).map(item => {
    const src = safeUrl(item!.url);
    const media = src && item!.mimeType?.startsWith("image/") ? `<img data-pf-image="${esc(item!.id)}" src="${src}" alt="${esc(item!.description)}">` : `<div class="file">↗ ${esc(item!.fileName || EVIDENCE_LABEL[item!.type])}</div>`;
    return `<figure>${media}<figcaption><b>${esc(EVIDENCE_LABEL[item!.type])}</b> ${esc(item!.description)}</figcaption></figure>`;
  }).join("");
}

export function webPortfolioHtml(page: PortfolioPage, content: PortfolioContent, blocks: DocBlock[]) {
  if (page.projectId === "demo-menu-2") return menuEditorialHtml(page, content);
  const info = blocks.find((b): b is Extract<DocBlock, { kind: "info" }> => b.kind === "info");
  const order = content.webDesign?.sectionOrder ?? [];
  const sections = blocks.filter((b): b is Extract<DocBlock, { kind: "section" }> => b.kind === "section").sort((a, b) => {
    const ai = order.indexOf(a.section.key), bi = order.indexOf(b.section.key);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  const feedback = blocks.find((b): b is Extract<DocBlock, { kind: "feedback" }> => b.kind === "feedback");
  const outcomes = blocks.find((b): b is Extract<DocBlock, { kind: "outcomes" }> => b.kind === "outcomes");
  const verification = blocks.find((b): b is Extract<DocBlock, { kind: "verification" }> => b.kind === "verification");
  const evidence = blocks.find((b): b is Extract<DocBlock, { kind: "evidenceList" }> => b.kind === "evidenceList");
  const verifiedClaims = verification?.verification ? CLAIM_KEYS.filter(key => verification.verification?.[key]) : [];
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'"><title>${esc(content.title)}</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f4f2ed;color:#191919;font-family:Arial,'Noto Sans KR','Malgun Gothic',sans-serif}.page{max-width:1180px;margin:auto;background:#fff}.hero{min-height:72vh;padding:42px 7vw 64px;background:#152b28;color:#f9f4e8;display:flex;flex-direction:column}.brand{display:flex;justify-content:space-between;font-size:11px;font-weight:700;letter-spacing:.14em}.kicker{margin-top:auto;color:#e0b85d;font-size:12px;letter-spacing:.2em}h1{max-width:900px;margin:18px 0;font-size:clamp(42px,7vw,92px);line-height:1.02;letter-spacing:-.055em}.summary{max-width:720px;font-size:clamp(17px,2vw,23px);line-height:1.65;color:#d6ded8}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:55px;background:#ffffff2b}.facts div{padding:16px;background:#152b28}.facts dt{font-size:10px;color:#a6b6ae}.facts dd{margin:7px 0 0;font-size:14px}.layout{display:grid;grid-template-columns:240px 1fr;gap:60px;padding:72px 7vw}.index{position:sticky;top:30px;align-self:start}.index>p,.label{font-size:10px;letter-spacing:.16em;color:#877f71;font-weight:700}.index ol{list-style:none;padding:12px 0;margin:0;border-top:1px solid #ddd}.index li{padding:8px 0;font-size:12px}.index li span{display:inline-block;width:32px;color:#aaa}.section{display:grid;grid-template-columns:60px 1fr;gap:24px;padding:0 0 68px;margin-bottom:68px;border-bottom:1px solid #ddd}.num{color:#b6ad9d;font:12px monospace}.section h2,.verified h2{margin:0 0 20px;font-size:clamp(25px,3vw,42px);letter-spacing:-.035em}.section p{margin:0;white-space:pre-wrap;font-size:17px;line-height:1.9;color:#464646}.evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:28px}figure{margin:0}img{display:block;width:100%;height:auto;background:#eee}.file{padding:24px;background:#f1efe9;font-weight:700}figcaption{margin-top:8px;color:#777;font-size:11px;line-height:1.6}.quote{margin:0 0 70px;padding:50px;background:#e8b951}.quote blockquote{font-size:clamp(25px,4vw,48px);line-height:1.35;letter-spacing:-.035em}.quote figcaption{color:#51441f}.meta{padding:36px 0;border-bottom:1px solid #ddd}.chips{display:flex;flex-wrap:wrap;gap:8px}.chips span{border:1px solid #222;border-radius:999px;padding:8px 13px}.chips small{margin-left:7px;color:#777}.outcomes{font-size:17px;line-height:1.8}.verified{margin:70px 0;padding:40px;background:#e5eee9;border-left:6px solid #245b4e}.checks{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:25px}.checks span{padding:12px;background:#fff}.footer{display:flex;justify-content:space-between;padding:34px 7vw;background:#152b28;color:#d6ded8;font-size:11px}@media(max-width:760px){.hero{min-height:auto}.facts{grid-template-columns:repeat(2,1fr)}.layout{display:block;padding:44px 22px}.index{display:none}.section{grid-template-columns:36px 1fr;gap:8px}.evidence,.checks{grid-template-columns:1fr}.quote{padding:30px}.footer{gap:20px}}
@media print{body{background:#fff}.page{max-width:none}.hero{min-height:0}.index{display:none}.layout{grid-template-columns:1fr}.section,.quote,.verified{break-inside:avoid}}
/* Notion과 같은 문서형 웹 포트폴리오 */
body{background:#f5f5f3;color:#242424}.page{max-width:1040px;margin:30px auto;border:1px solid #e8e8e5;border-radius:10px;box-shadow:0 12px 38px #0f0f0f14}.hero{display:block;min-height:0;padding:62px 72px 28px;border-bottom:1px solid #e9e9e6;background:#fff;color:#242424}.brand{color:#9b9a97}.kicker{margin-top:44px;color:#9b9a97;letter-spacing:.04em}h1{max-width:820px;margin:10px 0 12px;font-size:clamp(36px,5vw,58px);line-height:1.12}.summary{max-width:760px;color:#5f5e5b;font-size:17px}.facts{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 32px;max-width:760px;margin-top:30px;background:transparent}.facts div{display:grid;grid-template-columns:82px 1fr;gap:12px;padding:9px 0;border-bottom:1px solid #efefec;background:transparent}.facts dt{color:#9b9a97;font-size:12px}.facts dd{margin:0;color:#454441;font-size:13px}.layout{grid-template-columns:170px minmax(0,1fr);gap:54px;padding:48px 72px 72px}.index{top:30px}.index>p,.label{color:#9b9a97;letter-spacing:0}.index ol{border-top-color:#e9e9e6}.index li{color:#6b6a67;font-size:11px}.index a{display:block;margin:0 -8px;padding:6px 8px;border-radius:5px;color:inherit;text-decoration:none;transition:.16s ease}.index a:hover,.index a:focus{background:#f1f1ef;color:#242424;transform:translateX(2px);outline:none}.section{grid-template-columns:34px minmax(0,1fr);gap:8px;margin-bottom:42px;padding-bottom:42px;border-bottom-color:#eeeeeb;scroll-margin-top:28px}.num{padding-top:7px;color:#b4b3af;font-size:10px}.section h2,.verified h2{margin-bottom:14px;color:#2f2e2b;font-size:25px}.section p{color:#484744;font-size:15px;line-height:1.85}.file{border:1px solid #e7e7e3;border-radius:6px;background:#f7f7f5}.quote{margin-bottom:46px;padding:24px 28px;border-radius:4px;background:#fbf3db}.quote blockquote{color:#4d432e;font-size:22px}.quote figcaption{color:#87795e}.meta{padding:30px 0;border-bottom-color:#eeeeeb}.chips span{border-color:#dfdfdb;background:#f7f7f5}.verified{margin:46px 0;padding:26px 28px;border:1px solid #dce8df;border-left:4px solid #5d8c68;border-radius:5px;background:#f3f8f4}.footer{padding:22px 72px;border-radius:0 0 10px 10px;background:#f7f7f5;color:#8b8a86}@media(max-width:760px){.page{margin:0;border-width:1px 0;border-radius:0}.hero{padding:44px 22px 24px}.facts{grid-template-columns:1fr}.layout{padding:36px 22px 60px}.footer{padding:22px}}
/* Editorial-inspired WOLINK adaptation */
body{background:#eef0f1;color:#3d4449}.page{max-width:1180px;border:0;border-radius:0}.hero{padding:34px 56px 38px}.brand{padding-bottom:14px;border-bottom:5px solid #f56a6a}.brand span:first-child{color:#3d4449;font-size:14px}.kicker{margin-top:48px;color:#f56a6a;font-weight:800;letter-spacing:.12em}h1{color:#3d4449;font-size:clamp(40px,5vw,68px)}.summary{color:#7f888f}.facts{grid-template-columns:repeat(4,1fr);max-width:none}.facts div{display:block;padding:14px 16px;border:1px solid #e5e7e8}.facts dt{color:#f56a6a;font-weight:700}.facts dd{margin-top:6px}.layout{grid-template-columns:230px minmax(0,1fr);gap:0;padding:0}.index{top:0;min-height:100vh;padding:48px 30px;background:#f5f6f7}.index>p{display:inline-block;padding-bottom:9px;border-bottom:3px solid #f56a6a;color:#3d4449;font-size:14px}.index li{border-bottom:1px solid #dfe2e3}.index a:hover,.index a:focus{background:#fff;color:#f56a6a}main{padding:50px 56px 72px}.num{color:#f56a6a;font-weight:800}.section h2,.verified h2{display:table;padding-bottom:8px;border-bottom:3px solid #f56a6a;color:#3d4449}.quote{border-left:5px solid #f56a6a;background:#fff4f4}.footer{display:grid;grid-template-columns:auto 1fr;background:#f5f6f7;color:#7f888f}.credit{grid-column:1/-1;margin-top:10px;font-size:10px}.credit a{color:inherit}@media(max-width:760px){.hero{padding:24px 22px 30px}.facts{grid-template-columns:1fr 1fr}.layout{display:block}.index{display:none}main{padding:38px 22px 60px}.footer{display:block}}
</style></head><body><div class="page"><header class="hero"><div class="brand"><span>WOLINK</span><span>검증된 프로젝트 포트폴리오</span></div><p class="kicker">검증된 프로젝트 포트폴리오</p><h1>${esc(content.title)}</h1><p class="summary">${esc(content.summary)}</p>${info ? `<dl class="facts">${info.rows.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}</header><div class="layout"><aside class="index"><p>이 페이지의 목차</p><ol>${sections.map((s,i)=>`<li><a href="#section-${i+1}"><span>${String(i+1).padStart(2,"0")}</span>${esc(s.section.title)}</a></li>`).join("")}</ol></aside><main>${sections.map((s,i)=>`<section class="section" id="section-${i+1}"><div class="num">${String(i+1).padStart(2,"0")}</div><div><h2>${esc(s.section.title)}</h2><p>${esc(s.section.body)}</p><div class="evidence">${evidenceHtml(page,s.evidence.map(e=>e.id))}</div></div></section>`).join("")}${feedback ? `<figure class="quote"><blockquote>“${esc(feedback.review.comment)}”</blockquote><figcaption>의뢰인 평가 원문 · 만족도 ${feedback.review.satisfaction}/5 · 기한 ${feedback.review.deadline}/5 · 소통 ${feedback.review.communication}/5 · 인계 ${feedback.review.handoff}/5</figcaption></figure>`:""}${content.tools.length||content.skills.length?`<section class="meta"><p class="label">사용 도구와 역량</p><div class="chips">${content.tools.map(t=>`<span>${esc(t.name)}${t.why?`<small>${esc(t.why)}</small>`:""}</span>`).join("")}${content.skills.map(s=>`<span>${esc(s)}</span>`).join("")}</div></section>`:""}${outcomes?`<section class="meta"><p class="label">성과</p><ul class="outcomes">${outcomes.lines.map(l=>`<li>${esc(l.text)}</li>`).join("")}</ul></section>`:""}${verification?`<section class="verified"><p class="label">의뢰인 검증</p><h2>의뢰인이 직접 확인한 프로젝트입니다.</h2><div class="checks">${verifiedClaims.map(k=>`<span>✓ ${esc(CLAIM_LABEL[k])}</span>`).join("")}</div></section>`:""}${evidence?`<section class="meta"><p class="label">증빙 자료와 링크</p><div class="evidence">${evidenceHtml(page,evidence.evidence.map(e=>e.id))}</div></section>`:""}</main></div><footer class="footer"><b>WOLINK</b><span>월계 재능나눔 · 의뢰인 검증 포트폴리오 · v${page.edit.version}</span><small class="credit">Design adapted from Editorial by <a href="https://html5up.net">HTML5 UP</a> · CC BY 3.0</small></footer></div></body></html>`;
  const imageStyle = (id: string) => `width:${Math.max(50, Math.min(100, Number(content.webDesign?.imageWidths?.[id]) || 100))}%;margin:${content.webDesign?.imageAligns?.[id] === "right" ? "auto 0 0 auto" : content.webDesign?.imageAligns?.[id] === "center" ? "auto" : "0 auto 0 0"}`;
  const customImages = (content.portfolioImages ?? []).filter(image => safeUrl(image.url)).map(image => `<figure><img data-pf-image="${esc(image.id)}" style="${imageStyle(image.id)}" src="${safeUrl(image.url)}" alt="${esc(image.caption)}"><figcaption>${esc(image.caption)}</figcaption></figure>`).join("");
  const gallery = customImages ? `<section class="meta"><h2>포트폴리오 사진</h2><div class="evidence">${customImages}</div></section>` : "";
  let illustratedHtml = html;
  for (const evidence of page.evidence) {
    const override = content.imageOverrides?.[evidence.id];
    const source = `<img data-pf-image="${esc(evidence.id)}" src="${safeUrl(evidence.url)}" alt="${esc(evidence.description)}">`;
    const shown = override && safeUrl(override.url) ? `<img data-pf-image="${esc(evidence.id)}" style="${imageStyle(evidence.id)}" src="${safeUrl(override.url)}" alt="${esc(override.caption)}">` : `<img data-pf-image="${esc(evidence.id)}" style="${imageStyle(evidence.id)}" src="${safeUrl(evidence.url)}" alt="${esc(evidence.description)}">`;
    illustratedHtml = illustratedHtml.replace(source, shown);
  }
  const design = content.webDesign ?? {};
  const font = ({ sans: 'Arial,"Noto Sans KR","Malgun Gothic",sans-serif', serif: 'Georgia,"Noto Serif KR",serif', modern: '"Trebuchet MS",Arial,"Noto Sans KR",sans-serif' } as const)[design.fontFamily ?? "sans"];
  const accent = ({ coral: "#f56a6a", blue: "#3976a8", green: "#43895c", charcoal: "#394148" } as const)[design.accent ?? "coral"];
  const sectionGap = ({ compact: 34, balanced: 68, airy: 94 } as const)[design.spacing ?? "balanced"];
  const fontScale = Math.max(.85, Math.min(1.25, Number(design.fontScale) || 1));
  const designCss = `body{font-family:${font}}.section{padding-bottom:${sectionGap}px;margin-bottom:${sectionGap}px}.evidence{grid-template-columns:${design.imageLayout === "stack" ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))"}}.brand,.index>p,.num{color:${accent}}.brand,.section h2,.quote,.verified{border-color:${accent}}.section p{font-size:${15 * fontScale}px}.summary{font-size:${17 * fontScale}px}`;
  return illustratedHtml
    .replace("</style>", `${designCss}</style>`)
    .replace(`<h1>${esc(content.title)}</h1>`, `<h1 data-pf-edit="title">${esc(content.title)}</h1>`)
    .replace(`<p class="summary">${esc(content.summary)}</p>`, `<p class="summary" data-pf-edit="summary">${esc(content.summary)}</p>`)
    .replace(/<section class="section" id="section-(\d+)">/g, (_match, n: string) => `<section class="section" id="section-${n}" data-pf-section="${esc(sections[Number(n) - 1]?.section.key)}">`)
    .replace(/<section class="section" id="section-(\d+)" data-pf-section="([^"]+)">([\s\S]*?)<p>/g, (match, _n: string, key: string) => match.replace("<p>", `<p data-pf-edit="section:${key}">`))
    .replace("</main>", `${gallery}</main>`);
}

export async function createWebPortfolioFile(page: PortfolioPage, content: PortfolioContent, blocks: DocBlock[]) {
  let html = webPortfolioHtml(page, content, blocks);
  if (page.projectId === "demo-menu-2") {
    const embedded: Record<string, string> = {};
    for (const evidence of page.evidence.filter(e => e.url?.startsWith("/portfolio-samples/") && e.mimeType?.startsWith("image/"))) {
      const response = await fetch(evidence.url!);
      if (!response.ok) throw new Error("포트폴리오 이미지를 HTML에 포함하지 못했어요.");
      const blob = await response.blob();
      embedded[evidence.url!] = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("포트폴리오 이미지를 읽지 못했어요."));
        reader.readAsDataURL(blob);
      });
    }
    html = menuEditorialHtml(page, content, embedded);
  }
  const name = `${content.title.replace(/[\\/:*?"<>|\r\n]/g, "").trim() || "portfolio"}-web.html`;
  return new File([html], name, { type: "text/html;charset=utf-8" });
}

export function downloadWebPortfolioFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("링크를 복사하지 못했어요.");
  }
}

export async function sharePortfolioLink(title: string, url: string): Promise<"shared" | "copied"> {
  if (Capacitor.isNativePlatform()) {
    await Share.share({
      title,
      text: `${title} 포트폴리오`,
      url,
      dialogTitle: "포트폴리오 공유",
    });
    return "shared";
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `${title} 포트폴리오`, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      // 앱 내부 브라우저가 공유창을 막는 경우 링크 복사로 이어진다.
    }
  }
  await copyText(url);
  return "copied";
}
