"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

const MotionContext = createContext({ enabled: false, toggle: () => {} });
export const useConnectionMotion = () => useContext(MotionContext);

function Building({ x, y, scale = 1, shop = false }: { x: number; y: number; scale?: number; shop?: boolean }) {
  return <g className="world-building" transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="65" cy="86" rx="85" ry="29" fill="#b8c6d1" opacity=".15" />
    <path className="building-roof" d="M0 0 65-28 130 0 65 28Z" fill="#fff" stroke="#e1e7eb" />
    <path className="building-front" d="M0 0 65 28V98L0 70Z" fill="#f9fbfc" stroke="#e0e7ec" />
    <path className="building-side" d="m65 28 65-28v70L65 98Z" fill="#e6edf2" stroke="#dae3ea" />
    <path className="building-roof-inset" d="m10-1 55-23 55 24-55 23Z" fill="#f0f4f7" />
    <g className="world-watercolor" opacity=".24">
      <path d="M3 8Q24 10 39 25T62 39V89Q42 77 32 71T3 62Z" fill="#d97568" />
      <path d="M69 34Q90 25 126 10V65Q102 68 91 79T69 91Z" fill="#88aec3" />
      <path d="M13 0Q39-15 64-20L111 0Q83 2 64 18Z" fill="#e99987" />
      <path d="m5 6 6 5 2-2 5 6 3-1 5 4 4-1 7 7 5 1 6 5 9 2 3 53-5-5-3 3-5-6-3 2-6-7-3 1-7-6-4 1-7-5-4-1Z" fill="#df8275" opacity=".8" />
      <path d="m9 13 2 49m8-44 2 50m10-45 1 53m13-45 2 52m8-47 1 48" fill="none" stroke="#fff5eb" strokeWidth="1.5" opacity=".75" />
    </g>
    <g transform="matrix(1 .43 0 1 0 0)">
      {[12, 29, 46].map((x) => <g key={x}><rect x={x} y="14" width="9" height="12" rx="1" fill="#c7d4de" /><rect x={x} y="34" width="9" height="12" rx="1" fill="#d2dde5" /></g>)}
      <rect x="25" y="51" width="16" height="19" fill="#c4d1db" />
      {shop && <><path d="M5 32h55l5 12H0Z" fill="#fff" stroke="#d6e0e7" />{[7, 23, 39, 55].map(x => <path key={x} d={`M${x} 32h5l3 12h-8Z`} fill="#dbe5ed" />)}</>}
    </g>
    <g transform="matrix(1 -.43 0 1 65 28)">{[12, 30, 48].map(x => <g key={x}><rect x={x} y="14" width="8" height="12" rx="1" fill="#bacad6" /><rect x={x} y="35" width="8" height="12" rx="1" fill="#c9d6df" /></g>)}</g>
    <g className="world-pencil-lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-2 1 64-29 132 0 66 29-1 1M1 3 0 71 65 100 131 70 130 2M64 29l1 69" />
      <path d="m9-2 56-24 56 26M3 73l61 26m3 1 64-29M67 31l-1 62" opacity=".4" />
      <path d="m74 76 8-4m-8 9 19-8m-19 13 30-13m-30 18 40-18m-28 17 34-15" opacity=".3" />
      <path d="m-3 4 1 23 1 19-1 22m4 7 17 6 18 9 27 10m4-71-1 22 1 18-1 26M-3-1l22-9 19-9 26-11m4 1 20 9 23 9 22 12M132 6l-1 19 1 22-2 24" strokeDasharray="7 2 3 1" opacity=".65" />
      <path d="m7 60 11 7m-11-2 21 13m-20-8 31 18m-27-12 19 12" opacity=".25" />
    </g>
  </g>;
}

function Person({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cy="3" rx="13" ry="4" fill="#a7bac9" opacity=".25" />
    <g className="world-person">
      <path d="m-4-16-2 16m10-16 2 16" stroke="#d0dce5" strokeWidth="6" strokeLinecap="round" />
      <path d="m-4-16-2 15m10-15 2 15M-7-31l-5 15m19-15 5 15" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="-8" y="-35" width="16" height="24" rx="7" fill="#fff" stroke="#dce5eb" />
      <circle cy="-44" r="7.5" fill="#fff" stroke="#d7e1e9" />
    </g>
  </g>;
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cy="2" rx="13" ry="4" fill="#c7d2da" opacity=".3" /><path d="M0 0v-23" stroke="#c5d2db" strokeWidth="4" /><circle cy="-30" r="14" fill="#edf2f5" stroke="#e1e8ed" /><circle cx="-5" cy="-35" r="11" fill="#fff" /></g>;
}

/** Lightweight white architectural models, drawn in the app rather than a raster backdrop. */
export function WhiteVillage({ compact = false }: { compact?: boolean }) {
  const washId = useId().replace(/:/g, "");
  const routes = compact ? [
    "M55 164 C105 172 111 105 185 110",
    "M185 110 C227 110 235 43 320 82",
    "M135 187 C181 166 221 179 252 203",
  ] : [
    "M225 335 C390 110 405 410 700 410",
    "M700 410 C908 408 930 198 1130 333",
    "M320 680 C435 480 542 600 700 410 C868 505 941 662 1170 685",
  ];
  return <svg className={compact ? "world-village world-village-compact" : "world-village world-village-wide"} viewBox={compact ? "0 0 400 240" : "0 0 1400 900"} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    {compact ? <>
      <defs>
        <filter id={washId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".075" numOctaves="3" seed="8" result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="9" />
        </filter>
      </defs>
      <path d="m0 168 210-98 190 92M33 223 281 104" fill="none" stroke="#fff" strokeWidth="15" />
      {[[45, 150], [327, 72]].map(([x, y]) => <g key={x} transform={`translate(${x} ${y})`}>
        <g filter={`url(#${washId})`}>
          <path d="M-38-9-24-29-5-24 9-39 26-21 44-22 39 0 52 14 32 21 26 42 5 32-14 40-18 24-39 20-29 5Z" fill="#96bdce" opacity=".32" />
          <path d="M-40 0Q-12-28 10-12T41 22Q15 42-6 22T-40 18Z" fill="#6da8c4" opacity=".23" />
          <path d="M-32-19Q-4-38 17-21L29 9Q5 28-22 13Z" fill="#e3b78c" opacity=".4" />
        </g>
        <g fill="#6e9db4" opacity=".45"><circle cx="-43" cy="-16" r="1.7"/><circle cx="42" cy="32" r="2"/><circle cx="49" cy="27" r=".9"/><circle cx="-30" cy="33" r="1.3"/><circle cx="-39" cy="29" r=".8"/></g>
      </g>)}
      <Building x={12} y={120} scale={.54} /><Building x={283} y={47} scale={.65} shop />
      <Tree x={19} y={195} scale={.6} /><Tree x={380} y={115} scale={.65} />
      <Tree x={233} y={217} scale={.6} /><Tree x={365} y={73} scale={.48} />
    </> : <>
      <g className="world-far-buildings" opacity=".55">
        <Building x={-10} y={85} scale={1.1} /><Building x={245} y={28} scale={.85} />
        <Building x={120} y={158} scale={.5} /><Building x={355} y={180} scale={.7} />
        <Building x={960} y={65} scale={1.1} /><Building x={1250} y={135} scale={1.3} />
        <Building x={1020} y={710} scale={.7} /><Building x={90} y={782} scale={.9} />
        <Building x={1270} y={775} scale={.85} /><Building x={-65} y={590} scale={1.2} />
      </g>
      <g className="world-near-buildings">
        <path d="m-30 473 440-211M40 758 387 576m630-48 424-205m-421 468 424-205" fill="none" stroke="#fff" strokeWidth="34" />
        <Building x={120} y={265} scale={1.65} /><Building x={1030} y={270} scale={1.5} shop />
        <Building x={227} y={637} scale={1.05} shop /><Building x={1110} y={615} scale={1.25} />
        <Building x={-45} y={431} scale={.7} shop /><Building x={1280} y={453} scale={.7} />
        {[[95,410],[355,375],[55,710],[200,575],[355,740],[1010,429],[1290,384],[1070,610],[1330,730],[1140,160]].map(([x,y]) => <Tree key={`${x}-${y}`} x={x} y={y} scale={1.1} />)}
      </g>
    </>}
    {routes.map((d, index) => <g key={d} className={`world-route world-route-${index + 1}`}>
      <path d={d} className="world-route-track" />
      <path d={d} pathLength="1" className="world-route-glow" />
      <path d={d} pathLength="1" className="world-route-ink" />
    </g>)}
    {compact ? <><Person x={133} y={186} scale={.7} /><Person x={251} y={95} scale={.64} /><Person x={254} y={214} scale={.65} /></> : <>
      <Person x={346} y={438} scale={1.3} /><Person x={393} y={467} scale={1.05} />
      <Person x={1004} y={410} scale={1.3} /><Person x={963} y={448} scale={1.05} />
      <Person x={354} y={657} scale={1.3} /><Person x={1090} y={719} scale={1.3} />
      <g className="world-place-labels"><text x="205" y="241">배움이 시작되는 대학</text><text x="1090" y="245">함께 만드는 동네 가게</text><text x="228" y="805">사람과 사람이 만나</text><text x="1086" y="815">경험으로 이어집니다</text></g>
    </>}
  </svg>;
}

export default function ConnectionWorld({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [systemReduced, setSystemReduced] = useState(true);
  const [override, setOverride] = useState<boolean | null>(null);
  const enabled = override ?? !systemReduced;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(media.matches);
    sync();
    try { const saved = sessionStorage.getItem("wolink-walking-motion"); if (saved !== null) setOverride(saved === "on"); } catch {}
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  function toggle() {
    setOverride(!enabled);
    try { sessionStorage.setItem("wolink-walking-motion", enabled ? "off" : "on"); } catch {}
  }
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduced = !enabled;
    let frame = 0;
    let previousScroll = 0;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    function paint() {
      frame = 0;
      if (!element) return;
      const range = Math.max(1, Math.min(900, element.offsetHeight - window.innerHeight));
      const progress = clamp(-element.getBoundingClientRect().top / range);
      const distance = Math.max(0, -element.getBoundingClientRect().top);
      const walkRange = Math.max(1, Math.min(320, element.offsetHeight - window.innerHeight));
      const walk = reduced ? 0 : clamp(distance / walkRange);
      // Each ~65px of scrolling is one stride. Reverse scrolling reverses the gait.
      const phase = walk * walkRange / 65 * Math.PI * 2;
      const swing = reduced ? 0 : Math.sin(phase) * 28;
      const headerSwing = reduced ? 0 : Math.sin(distance / 65 * Math.PI * 2) * 28;
      element.style.setProperty("--header-swing", `${headerSwing}deg`);
      element.style.setProperty("--header-counter", `${-headerSwing}deg`);
      if (Math.abs(distance - previousScroll) > .5 && !reduced) element.style.setProperty("--walker-facing", distance > previousScroll ? "1" : "-1");
      previousScroll = distance;
      element.style.setProperty("--walker-x", `${20 + walk * 60}%`);
      // Smooth Catmull-Rom curve across the category row.
      const heights = [0, -7, 4, -6, 0];
      const segment = Math.min(3, Math.floor(walk * 4));
      const t = walk === 1 ? 1 : walk * 4 - segment;
      const p0 = heights[Math.max(0, segment - 1)];
      const p1 = heights[segment];
      const p2 = heights[segment + 1];
      const p3 = heights[Math.min(4, segment + 2)];
      const curve = .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      element.style.setProperty("--walker-y", `${reduced ? 0 : curve}px`);
      element.style.setProperty("--walker-swing", `${swing}deg`);
      element.style.setProperty("--walker-counter", `${-swing}deg`);
      element.style.setProperty("--walker-knee-front", `${reduced ? 0 : Math.max(0, Math.sin(phase)) * 28}deg`);
      element.style.setProperty("--walker-knee-back", `${reduced ? 0 : Math.max(0, -Math.sin(phase)) * 28}deg`);
      element.style.setProperty("--walker-bob", `${reduced ? 0 : -Math.abs(Math.sin(phase)) * 1.8}px`);
      element.dataset.scrollProgress = progress.toFixed(3);
      element.style.setProperty("--world-link-1", String(reduced ? 0 : 1 - clamp(progress * 2 + .03)));
      element.style.setProperty("--world-link-2", String(reduced ? 0 : 1 - clamp((progress - .12) * 2)));
      element.style.setProperty("--world-link-3", String(reduced ? 0 : 1 - clamp((progress - .4) * 2)));
      element.style.setProperty("--world-hero-link", String(reduced ? 0 : 1 - clamp(progress * 4 + .03)));
      element.style.setProperty("--world-drift", `${reduced ? 0 : progress * -24}px`);
    }
    function schedule() { if (!frame) frame = window.requestAnimationFrame(paint); }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    paint();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return <MotionContext.Provider value={{ enabled, toggle }}><div ref={root} className="home-world" data-walking-enabled={enabled}>
    <div className="home-world-content">{children}</div>
  </div></MotionContext.Provider>;
}
