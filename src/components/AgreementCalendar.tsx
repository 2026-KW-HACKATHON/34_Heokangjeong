"use client";
import { useRef, useState } from "react";
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
export default function AgreementCalendar({ start, end, onChange }: { start: string; end: string; onChange: (start: string, end: string) => void }) {
  const [month, setMonth] = useState(() => start ? new Date(`${start}T12:00:00`) : new Date());
  const drag = useRef<string | null>(null);
  const moved = useRef(false);
  const [tapStart, setTapStart] = useState<string | null>(null);
  const year = month.getFullYear(), m = month.getMonth();
  const offset = new Date(year,m,1).getDay();
  const count = new Date(year,m+1,0).getDate();
  const range = (a: string,b: string) => onChange(a < b ? a : b,a < b ? b : a);
  return <div className="agreement-calendar">
    <div className="agreement-month"><button type="button" aria-label="이전 달" onClick={() => setMonth(new Date(year,m-1,1))}>‹</button><strong>{year}년 {m+1}월</strong><button type="button" aria-label="다음 달" onClick={() => setMonth(new Date(year,m+1,1))}>›</button></div>
    <p>첫날부터 마지막 날까지 드래그하거나, 두 날짜를 눌러 주세요.</p>
    <div className="agreement-calendar-days" onPointerDown={e => {
      if (e.button !== 0) return;
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-agreement-day]");
      const day = target?.dataset.agreementDay;
      if (!day) return;
      drag.current = day; moved.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e => {
      if (!drag.current) return;
      const target = document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>("[data-agreement-day]");
      const day = target?.dataset.agreementDay;
      if (day && e.currentTarget.contains(target) && day !== drag.current) { moved.current = true; range(drag.current,day); }
    }} onPointerUp={e => {
      if (moved.current) setTapStart(null);
      else if (drag.current) {
        if (tapStart) { range(tapStart, drag.current); setTapStart(null); }
        else { onChange(drag.current, drag.current); setTapStart(drag.current); }
      }
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    }} onPointerCancel={() => { drag.current=null; moved.current=false; }}>
      {["일","월","화","수","목","금","토"].map(d => <span className="agreement-weekday" key={d}>{d}</span>)}
      {Array.from({length:offset},(_,i) => <span key={`blank${i}`} />)}
      {Array.from({length:count},(_,i) => { const day = dateKey(new Date(year,m,i+1)); return <button key={day} type="button" data-agreement-day={day} aria-label={day} aria-pressed={!!start && day>=start && day<=end} className={`${day===start || day===end ? "is-end" : ""}`} onClick={e => {
        if (e.detail !== 0) return;
        if (tapStart) { range(tapStart,day); setTapStart(null); } else { onChange(day,day); setTapStart(day); }
      }}>{i+1}</button>; })}
    </div>
    <div className="agreement-date-inputs"><label>시작일<input type="date" value={start} onChange={e => onChange(e.target.value,end)} /></label><label>완료 예정일<input type="date" value={end} min={start} onChange={e => onChange(start,e.target.value)} /></label></div>
  </div>;
}
