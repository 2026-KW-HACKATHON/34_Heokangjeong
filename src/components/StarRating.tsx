type Props = {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
};

/** 0~5 값을 별 다섯 개의 채움 비율로 표시한다. 4.3처럼 소수점도 그대로 반영한다. */
export default function StarRating({ value, label = "평판 별점", size = "md", showValue = true }: Props) {
  const score = Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0));
  const percent = `${score / 5 * 100}%`;
  const textSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${label} 5점 중 ${score.toFixed(1)}점`}>
      <span className={`relative inline-block shrink-0 select-none whitespace-nowrap tracking-[0.08em] ${textSize}`} aria-hidden="true">
        <span className="text-[#d1d5db]">★★★★★</span>
        <span className="absolute inset-0 overflow-hidden whitespace-nowrap text-[#f59e0b]" style={{ width: percent }}>★★★★★</span>
      </span>
      {showValue && <strong className="whitespace-nowrap">{score.toFixed(1)} / 5</strong>}
    </span>
  );
}
