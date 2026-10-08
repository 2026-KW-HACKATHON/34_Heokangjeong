import type { User } from "@/types";

/** 사진을 올리지 않은 사람에게 보여 주는 사람 모양 실루엣. 감싸는 틀의 모양(동그라미·둥근 네모)을 그대로 채운다 */
export function Silhouette() {
  return (
    <svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}>
      <rect width="40" height="40" fill="#d3d8de" />
      <circle cx="20" cy="15.5" r="6.8" fill="#f1f3f5" />
      <path d="M7 40c0-8 5.8-13.6 13-13.6S33 32 33 40z" fill="#f1f3f5" />
    </svg>
  );
}

/** 학생·사장님이 올린 프로필 사진 주소 (관리자는 없다) */
export const avatarOf = (user?: User) => user && user.role !== "admin" ? user.avatarUrl : undefined;

/** 동그란 프로필 사진. 사진이 없으면 실루엣 */
export default function Avatar({ user, src, size = 36 }: { user?: User; src?: string; size?: number }) {
  const url = src ?? avatarOf(user);
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <Silhouette />}
    </span>
  );
}
