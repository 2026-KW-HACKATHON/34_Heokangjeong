import { useConnectionMotion } from "./ConnectionWorld";
/** Scroll-scrubbed illustration. Limbs advance with distance, not an autoplay loop. */
export default function TalentWalker() {
  return <div className="talent-walker" aria-hidden="true"><WalkingFigure /></div>;
}

export function TalentMotionToggle() {
  const { enabled, toggle } = useConnectionMotion();
  return <button type="button" className="talent-motion-toggle" aria-pressed={enabled} onClick={toggle}>{enabled ? "걷기 효과 끄기" : "걷기 효과 켜기"}</button>;
}

export function WalkingFigure() {
  return <svg viewBox="0 0 40 60" width="40" height="60" focusable="false" aria-hidden="true">
        <ellipse cx="20" cy="56" rx="12" ry="2.5" fill="#70899c" opacity=".15" />
        <g className="talent-walker-body" stroke="#b9c8d3" strokeWidth=".8" strokeLinejoin="round">
          <g className="walker-back-arm"><path d="M18 23 12 32l5 7" fill="none" stroke="#d6e2e9" strokeWidth="5" strokeLinecap="round" /></g>
          <g className="walker-back-leg"><rect x="17" y="34" width="5.5" height="13" rx="2.5" fill="#e5edf2" /><g className="walker-back-shin"><rect x="17" y="43" width="5.5" height="12" rx="2.5" fill="#edf3f7" /><path d="M17 53h9v3h-9Z" fill="#8296a5" stroke="none" /></g></g>
          <g className="walker-front-leg"><rect x="18" y="34" width="5.5" height="13" rx="2.5" fill="#fff" /><g className="walker-front-shin"><rect x="18" y="43" width="5.5" height="12" rx="2.5" fill="#fff" /><path d="M18 53h10v3H18Z" fill="#8ea4b3" stroke="none" /></g></g>
          <path d="M16 19h7l3 18c-4 2-9 2-13 0l1-13Z" fill="#fff" />
          <path d="M18 16v5h5v-5" fill="#fff" />
          <path d="M24 8c-1-5-11-5-12 1-1 4 1 9 6 9 4 0 7-3 7-6l2-1Z" fill="#fff" />
          <path d="m16 21 7 1" stroke="#a8c9dc" strokeWidth="2" />
          <g className="walker-front-arm"><path d="m21 24 5 9 6-5" fill="none" stroke="#b9c8d3" strokeWidth="6" strokeLinecap="round" /><path d="m21 24 5 9 6-5" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" /></g>
        </g>
      </svg>;
}
