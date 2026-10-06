import Link from "next/link";
import type { Post } from "@/types";
import StatusBadge from "./StatusBadge";
import { walkMinutes } from "@/lib/geo";
import Icon from "./Icon";
import { TIERS } from "@shared/portfolio/policy";
import { TierMark } from "./TierCard";

export default function PostCard({ post, authorName, distance, recommendation }: { post: Post; authorName?: string; distance?: number; recommendation?: string }) {
  return (
    <Link href={`/posts/detail?id=${post.id}`} className="card block active:opacity-80">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--primary)]">{post.category}{post.isTeam ? " · 팀" : ""}</span>
        <StatusBadge status={post.status} />
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">{post.title}</h3>
      <p className="post-minimum-tier"><TierMark tier={post.minimumTier ?? "SEED"} size={16}/>{TIERS.find(t => t.key === (post.minimumTier ?? "SEED"))?.label} 이상 지원</p>
      {post.description && <p className="sub mt-2 line-clamp-2 text-sm">{post.description}</p>}
      <div className="sub mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {authorName && <span>{authorName}</span>}
        {authorName && distance !== undefined && <span aria-hidden="true">·</span>}
        {distance !== undefined && <span>도보 약 {walkMinutes(distance)}분</span>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="sub flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{post.durationDays}일 활동</span>
          {post.compensationType === "PAID" && post.paidAmount ? <><span aria-hidden="true">·</span><span className="font-semibold">사례비 {post.paidAmount.toLocaleString()}원</span></> : post.reward && <><span aria-hidden="true">·</span><span className="break-words">{post.reward}</span></>}
        </div>
        <span aria-hidden="true" className="post-card-arrow"><Icon name="arrow" width={17} height={17} /></span>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4"><span className="sub text-xs">{recommendation ?? "이웃과 함께 만드는 변화"}</span><span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">자세히<Icon name="arrow" width={16} height={16} /></span></div>
    </Link>
  );
}
