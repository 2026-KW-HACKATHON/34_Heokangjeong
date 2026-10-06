import Link from "next/link";
import type { Post } from "@/types";
import StatusBadge from "./StatusBadge";
import { walkMinutes } from "@/lib/geo";
import Icon from "./Icon";

export default function PostCard({ post, authorName, distance }: { post: Post; authorName?: string; distance?: number }) {
  return (
    <Link href={`/posts/detail?id=${post.id}`} className="card post-card block active:opacity-80">
      <div className="mb-2 flex items-center justify-between">
        <span className="sub text-xs font-medium">{post.category}{post.isTeam ? " · 팀" : ""}</span>
        <StatusBadge status={post.status} />
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight">{post.title}</h3>
      <div className="sub mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {authorName && <span>{authorName}</span>}
        {authorName && distance !== undefined && <span aria-hidden="true">·</span>}
        {distance !== undefined && <span>도보 약 {walkMinutes(distance)}분</span>}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="sub flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>{post.durationDays}일 활동</span>
          {post.reward && <><span aria-hidden="true">·</span><span className="break-words">{post.reward}</span></>}
        </div>
        <span aria-hidden="true" className="post-card-arrow"><Icon name="arrow" width={17} height={17} /></span>
      </div>
    </Link>
  );
}
