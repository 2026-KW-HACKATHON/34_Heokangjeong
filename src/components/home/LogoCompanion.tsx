"use client";

import { useEffect, useState } from "react";
import { useConnectionMotion } from "./ConnectionWorld";
import { WalkingFigure } from "./TalentWalker";
import Icon from "../Icon";

export default function LogoCompanion() {
  const { enabled, toggle } = useConnectionMotion();
  const [waving, setWaving] = useState(false);
  useEffect(() => {
    if (!waving) return;
    const timer = window.setTimeout(() => setWaving(false), 900);
    return () => window.clearTimeout(timer);
  }, [waving]);
  return <button type="button" className="logo-companion" data-waving={waving} aria-label="가게로 걸어가는 이웃에게 인사하기" title={enabled ? "스크롤하면 가게를 향해 걸어요 · 눌러서 인사하기" : "누르면 걷기 효과가 켜져요"} onClick={() => {
    if (!enabled) toggle();
    setWaving(true);
  }}><span className="logo-companion-person"><WalkingFigure /></span><span className="logo-companion-path" aria-hidden="true" /><span className="logo-companion-store"><Icon name="store" width={25} height={25} /></span><span className="logo-companion-greeting" aria-hidden="true">안녕!</span></button>;
}
