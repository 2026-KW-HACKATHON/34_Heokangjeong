"use client";
import { useEffect, useState } from "react";
import EditorialTemplate from "./editorial";
import { exhibitionPortfolioHtml } from "@/lib/portfolio/exhibitionHtml";
import type { TemplateProps } from "./types";

export default function ExhibitionTemplate(props: TemplateProps) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  if (props.editing) return <EditorialTemplate {...props} />;
  return <div>
    <iframe className="print:hidden" title={`${props.content.title} 인터랙티브 전시`} sandbox="allow-scripts"
      srcDoc={exhibitionPortfolioHtml(props.page, props.content, props.blocks, origin)}
      style={{width:"100%",height:"85dvh",minHeight:560,border:0,background:"white"}} />
    <div className="hidden print:block"><EditorialTemplate {...props} /></div>
  </div>;
}
