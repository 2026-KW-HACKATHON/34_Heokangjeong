import type { PostStatus } from "@/types";
export const STATUS: Record<PostStatus, { label: string; color: string; dot: string }> = {
  open: { label: "모집 중", color: "status-watercolor status-watercolor-pink", dot: "🔴" },
  in_progress: { label: "진행 중", color: "status-watercolor status-watercolor-green", dot: "🟡" },
  done: { label: "완료", color: "text-[#717378]", dot: "🟢" },
};
export default function StatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${s.color}`}>{status === "done" && <span aria-hidden="true">✓</span>}{s.label}</span>;
}
