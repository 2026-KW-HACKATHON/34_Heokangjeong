"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import EditorialTemplate from "./editorial";
import { exhibitionPortfolioHtml } from "@/lib/portfolio/exhibitionHtml";
import type { TemplateProps } from "./types";

export default function ExhibitionTemplate(props: TemplateProps) {
  const [origin, setOrigin] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<string | null>(null);
  const latest = useRef(props);
  latest.current = props;
  // 입력할 때 iframe을 다시 로드하지 않는다. 저장·취소 후 최신 문서를 그린다.
  const snapshot = useRef(props);
  if (!props.editing || !snapshot.current.editing || snapshot.current.page.projectId !== props.page.projectId) snapshot.current = props;
  const renderProps = snapshot.current;
  const html = useMemo(() => exhibitionPortfolioHtml(renderProps.page, renderProps.content, renderProps.blocks, origin,
    {editing: renderProps.editing, stage: renderProps.editing ? stage.current : null}), [origin, renderProps]);
  useEffect(() => {
    if (props.editing) frame.current?.contentWindow?.postMessage({type: "wolink-image-update", images: props.content.imageOverrides || {}}, "*");
  }, [props.content.imageOverrides, props.editing]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const p = latest.current;
      if (!p.editing || event.source !== frame.current?.contentWindow || event.data?.type !== "wolink-stage-edit") return;
      const {key, body, title, file} = event.data;
      if (typeof key !== "string" || (!p.content.sections.some(s => s.key === key) && key !== "evaluation")) return;
      stage.current = key;
      if (typeof body === "string" && body.length <= 20000 && key !== "evaluation") p.onChange({...p.content, sections: p.content.sections.map(s => s.key === key ? {...s, body} : s)});
      if (typeof title === "string" && title.trim() && title.length <= 200 && key !== "evaluation") p.onChange({...p.content, sections: p.content.sections.map(s => s.key === key ? {...s, title} : s)});
      if (file instanceof File) void p.onReplaceImage?.(`stage-${key}`, file);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => setOrigin(window.location.origin), []);
  return <div>
    <iframe ref={frame} className="print:hidden" title={`${props.content.title} 인터랙티브 전시`} sandbox="allow-scripts"
      srcDoc={html}
      style={{width:"100%",height:"85dvh",minHeight:560,border:0,background:"white"}} />
    <div className="hidden print:block"><EditorialTemplate {...props} /></div>
  </div>;
}
