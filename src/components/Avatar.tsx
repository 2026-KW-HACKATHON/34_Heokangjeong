import type { User } from "@/types";

/** 동그란 프로필 사진. 사진을 올리지 않은 사람(사장님 포함)은 사람 모양 실루엣을 보여 준다 */
export default function Avatar({ user, size = 36 }: { user?: User; size?: number }) {
  const url = user?.role === "student" ? user.avatarUrl : undefined;
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-full bg-[#d3d8de]" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
          <circle cx="20" cy="15.5" r="6.8" fill="#f1f3f5" />
          <path d="M7 40c0-8 5.8-13.6 13-13.6S33 32 33 40z" fill="#f1f3f5" />
        </svg>
      )}
    </span>
  );
}
