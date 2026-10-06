"use client";

import Icon from "@/components/Icon";
import TalentWalker, { TalentMotionToggle } from "./TalentWalker";
import { HOME_CATEGORIES, type HomeCategory } from "./categories";

export default function CategoryPicker({ category, onChange, resident }: {
  category: HomeCategory;
  onChange: (category: HomeCategory) => void;
  resident: boolean;
}) {
  const selected = HOME_CATEGORIES.find((item) => item.value === category);
  return <>
    <div className="connection-picker-intro">
      <p>{resident ? "어떤 도움이 필요한가요?" : "어떤 재능을 연결해 볼까요?"}</p>
    </div>
    <nav className="category-dock" aria-label="공고 분야 선택">
      <div className="category-dock-summary">
        <span aria-live="polite">{selected ? <><strong>{selected.label}</strong> 보는 중</> : "전체 분야 보는 중"}</span>
        <div className="category-dock-actions">
          <button type="button" onClick={() => onChange("전체")} disabled={!selected}>전체 보기</button>
          <TalentMotionToggle />
        </div>
      </div>
      <div className="category-dock-stage">
        <TalentWalker />
        <div className="connection-category-grid">
          {HOME_CATEGORIES.map((item) => <button key={item.value} type="button" aria-pressed={category === item.value} onClick={() => onChange(category === item.value ? "전체" : item.value)} className="connection-category">
            <span className="connection-category-icon"><Icon name={item.icon} width={22} height={22} /><span className="connection-selected-dot" aria-hidden="true" /></span>
            <span>{item.label}</span>
          </button>)}
        </div>
      </div>
    </nav>
  </>;
}
