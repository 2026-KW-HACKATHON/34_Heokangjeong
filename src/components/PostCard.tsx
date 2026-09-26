import Link from "next/link";
import type { Post } from "@/types";
import StatusBadge from "./StatusBadge";
import { formatDistance } from "@/lib/geo";
import Icon from "./Icon";

export default function PostCard({ post, authorName, distance, recommendation }: { post: Post; authorName?: string; distance?: number; recommendation?: string }) {
  return (
    <Link href={`/posts/detail?id=${post.id}`} className="card block active:opacity-80">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--primary)]">{post.category}{post.isTeam ? " · 팀" : ""}</span>
        <StatusBadge status={post.status} />
      </div>
      <h3 className="mt-4 text-xl font-bold leading-snug tracking-tight">{post.title}</h3>
      <p className="sub mt-1 line-clamp-2 text-sm">{post.description}</p>
      <div className="sub mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {authorName && <span>{authorName}</span>}
        {distance !== undefined && <span className="inline-flex items-center gap-1"><Icon name="pin" width={13} height={13} />{formatDistance(distance)}</span>}
        <span>{post.durationDays}일 활동</span>
        {post.reward && <span>{post.reward}</span>}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="sub text-xs">{recommendation ?? "이웃과 함께 만드는 변화"}</span><span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">자세히<Icon name="arrow" width={16} height={16} /></span></div>
    </Link>
  );
}
