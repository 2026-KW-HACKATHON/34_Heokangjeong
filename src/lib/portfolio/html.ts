import type { PublishedPortfolio } from "@/types";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const imageSrc = (value: string) => /^(https?:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value) ? escapeHtml(value) : "";

/** The preview and downloaded file use the exact same, script-free document. */
export function portfolioHtml(item: PublishedPortfolio, author: string): string {
  const images = [item.coverUrl, ...(item.imageUrls ?? [])].filter((url): url is string => !!url)
    .filter((url, index, all) => all.indexOf(url) === index)
    .map((url, index) => ({ src: imageSrc(url), index })).filter(image => image.src);
  const sections = item.sections.filter(section => section.title.trim() || section.body.trim());
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'">
<title>${escapeHtml(item.title)}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#25272b;font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif}main{max-width:760px;margin:auto;padding:24px 22px 64px}.tag{font-size:11px;letter-spacing:.1em;color:#9b8061;font-weight:700}h1{font-size:clamp(26px,5vw,36px);line-height:1.25;letter-spacing:-.04em;margin:12px 0}.byline{font-size:12px;color:#85898d;margin-bottom:26px}figure{margin:0 0 25px}img{display:block;width:100%;height:auto;border-radius:8px}figcaption{font-size:11px;color:#8a9399;margin-top:8px}.summary{font-size:17px;line-height:1.7;font-weight:600;white-space:pre-wrap}section{border-top:1px solid #ebe8e3;padding-top:19px;margin-top:27px}h2{font-size:17px;margin:0 0 12px}section p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.9;color:#53585c}</style></head><body><main>
<p class="tag">${escapeHtml(item.category)}</p><h1>${escapeHtml(item.title)}</h1><p class="byline">${escapeHtml(author)} · ${escapeHtml(item.publishedAt.slice(0, 10))}</p>
${images.slice(0, 1).map(image => `<figure><img src="${image.src}" alt="${escapeHtml(item.title)} 대표 사진"></figure>`).join("")}
<p class="summary">${escapeHtml(item.summary)}</p>
${sections.map(section => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join("")}
${images.slice(1).map(image => `<figure><img src="${image.src}" alt="${escapeHtml(item.title)} 사진 ${image.index + 1}"></figure>`).join("")}
</main></body></html>`;
}

export function downloadPortfolioHtml(item: PublishedPortfolio, author: string) {
  const blob = new Blob([portfolioHtml(item, author)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${item.title.replace(/[\\/:*?"<>|\r\n]/g, "").trim() || "portfolio"}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
