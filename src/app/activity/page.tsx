"use client";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import WorkFieldSummary from "@/components/WorkFieldSummary";
import { useSession } from "@/lib/session";

export default function ActivityPage() {
  const { user } = useSession();
  return <>
    <TopBar title="작업 기록" />
    <section className="flex flex-col gap-4 px-4">
      {user?.role === "student" ? <>
        <p className="sub text-sm">완료한 작업을 분야별로 모았어요. 별점은 의뢰인의 평가를 평균한 값이에요.</p>
        <WorkFieldSummary key={user.id} studentId={user.id} detailed />
        <Link href="/portfolio" className="btn w-full">내 포트폴리오 보기</Link>
      </> : <div className="card text-sm"><p>학생 계정에서 분야별 작업 기록을 볼 수 있어요.</p><Link href="/projects" className="btn mt-3 w-full">내 프로젝트 보기</Link></div>}
    </section>
  </>;
}
