"use client";

import { HOME_CATEGORIES, type HomeCategory } from "./categories";

export default function CategoryPicker({ category, counts, onChange }: {
  category: HomeCategory;
  counts?: Record<HomeCategory, number>;
  onChange: (category: HomeCategory) => void;
}) {
  return <nav className="home-category-tabs filter-pill-row" aria-label="공고 분야 선택">
    {([{ value: "전체", label: "전체" }, ...HOME_CATEGORIES] as const).map((item) =>
      <button key={item.value} type="button" className="filter-pill" aria-pressed={category === item.value} onClick={() => onChange(item.value)}>{item.label}{counts && <> <span className="filter-pill-count">{counts[item.value]}</span></>}</button>
    )}
  </nav>;
}
