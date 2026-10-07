"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 예전 랭킹 주소를 저장한 사용자도 새 작업 기록으로 이동한다. */
export default function FormerRanking() {
  const router = useRouter();
  useEffect(() => { router.replace("/activity"); }, [router]);
  return <p role="status" className="p-6 text-sm">작업 기록으로 이동하는 중…</p>;
}
