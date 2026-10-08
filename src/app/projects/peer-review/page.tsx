"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";

export default function PeerReviewPage() {
  return <Suspense fallback={<TopBar title="프로젝트" back />}><PeerReviewRemoved /></Suspense>;
}

function PeerReviewRemoved() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  useEffect(() => { router.replace(id ? `/projects/detail?id=${encodeURIComponent(id)}` : "/projects"); }, [id, router]);
  return <><TopBar title="프로젝트" back /><p className="sub p-6 text-center text-sm">프로젝트 화면으로 이동하는 중…</p></>;
}