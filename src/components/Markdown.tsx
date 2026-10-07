/**
 * AI·템플릿이 만든 문서(인수인계서 등)를 읽기 좋게 보여 준다.
 * 외부 라이브러리 없이 필요한 것만 해석한다: 제목(#, ##, ###), 목록(-), 체크 목록(- [ ]), 굵게(**), 빈 줄.
 */
function Inline({ text }: { text: string }) {
  // **굵게** 만 해석한다
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>;
}

export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: { text: string; check: boolean }[] = [];

  const flush = (key: string) => {
    if (!list.length) return;
    const items = list; list = [];
    out.push(
      <ul key={key} className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="sub shrink-0">{it.check ? "☐" : "·"}</span>
            <span><Inline text={it.text} /></span>
          </li>
        ))}
      </ul>,
    );
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `l${i}`;
    if (/^#{1,3} /.test(line)) {
      flush(`u${i}`);
      const level = line.match(/^#+/)![0].length;
      const body = line.replace(/^#+ /, "");
      out.push(level === 1
        ? <h2 key={key} className="mt-1 text-lg font-bold">{body}</h2>
        : <h3 key={key} className={`font-bold ${level === 2 ? "mt-3" : "mt-2 text-sm"}`}>{body}</h3>);
      return;
    }
    const check = line.match(/^- \[[ xX]\] (.*)$/);
    if (check) { list.push({ text: check[1], check: true }); return; }
    const item = line.match(/^[-*] (.*)$/);
    if (item) { list.push({ text: item[1], check: false }); return; }
    flush(`u${i}`);
    if (line.trim()) out.push(<p key={key}><Inline text={line} /></p>);
  });
  flush("u-last");

  return <div className={`flex flex-col gap-1.5 leading-6 ${className}`}>{out}</div>;
}
