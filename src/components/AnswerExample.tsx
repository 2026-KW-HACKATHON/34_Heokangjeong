/** 질문 아래에 늘 보이는 답변 예시. placeholder 와 달리 입력을 시작해도 사라지지 않는다 */
export default function AnswerExample({ text, className = "" }: { text?: string; className?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className={`rounded-xl border border-dashed border-[var(--line)] bg-white/60 px-3 py-2 ${className}`}>
      <p className="text-[11px] font-bold text-[var(--sub)]">답변 예시</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--sub)]">{text}</p>
    </div>
  );
}
