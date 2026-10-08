"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 탭·필터 같은 화면 상태를 주소(?key=값)에 둔다.
 * 다른 화면으로 갔다가 뒤로가기로 돌아와도 보던 탭·필터가 그대로 남는다 (화면 안 useState 는 돌아오면 초기화된다).
 * 기본값이면 주소에서 뺀다. replace 라서 뒤로가기 기록은 늘지 않는다. 쓰는 화면은 <Suspense> 안이어야 한다.
 */
export function useUrlState<T extends string>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get(key);
  const value = (raw !== null && (!allowed || (allowed as readonly string[]).includes(raw)) ? raw : initial) as T;
  const set = useCallback((v: T) => {
    const params = new URLSearchParams(window.location.search);
    if (v === initial) params.delete(key); else params.set(key, v);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [key, initial, pathname, router]);
  return [value, set];
}

/** 참/거짓 버전 ("1"/"0") */
export function useUrlFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, set] = useUrlState<"1" | "0">(key, initial ? "1" : "0", ["1", "0"]);
  return [v === "1", useCallback((b: boolean) => set(b ? "1" : "0"), [set])];
}
