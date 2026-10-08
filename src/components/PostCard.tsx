import Link from "next/link";
import type { Post } from "@/types";
import StatusBadge from "./StatusBadge";
import { walkMinutes } from "@/lib/geo";
import Icon from "./Icon";

export default function PostCard({ post, authorName, distance }: { post: Post; authorName?: string; distance?: number }) {
  return (
    <Link href={`/posts/detail?id=${post.id}`} className="card post-card block active:opacity-80">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {post.urgent && <span className="rounded-full bg-[var(--red)] px-2 py-0.5 font-bold text-white">긴급</span>}
          {post.handoverOfProject && <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 font-bold text-white">이어받기</span>}
          <span className="sub">{post.category}{post.isTeam ? " · 팀" : ""}</span>
        </span>
        <StatusBadge status={post.status} />
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">{post.title}</h3>
      {post.description && <p className="sub mt-2 line-clamp-2 text-sm">{post.description}</p>}
      <div className="sub mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {authorName && <span>{authorName}</span>}
        {authorName && distance !== undefined && <span aria-hidden="true">·</span>}
        {distance !== undefined && <span>도보 약 {walkMinutes(distance)}분</span>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="sub flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{post.durationDays > 0 ? `${post.durationDays}일 활동` : "기간은 계약 시 협의"}</span>
          {post.reward && <><span aria-hidden="true">·</span><span className="break-words">{post.compensationType === "PAID" ? "기존 보상" : "가게 쿠폰"} · {post.reward}</span></>}
        </div>
        <span aria-hidden="true" className="post-card-arrow"><Icon name="arrow" width={17} height={17} /></span>
      </div>
    </Link>
  );
}
