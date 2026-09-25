import Link from "next/link";
import TopBar from "@/components/TopBar";
import PortfolioFlow from "@/components/PortfolioFlow";

/** Public demo contains no account data or repository queries. */
export default function DesignPreview() {
  return <><TopBar title="디자인 미리보기" /><main className="space-y-6 px-5 pb-8"><header className="py-5"><p className="sub mb-3 text-xs">MATTE / GLASS / SILVER</p><h1 className="page-title">작은 도움을,<br />오래 남는 경험으로.</h1><p className="sub mt-4 text-sm leading-6">새로운 재질과 포트폴리오 작성 흐름을 살펴보세요. 아래 공고는 예시입니다.</p></header><article className="card"><div className="flex items-center justify-between"><span className="sub text-xs">디자인 · 예시 공고</span><span className="silver-badge text-xs">작업 완료 · 예시</span></div><h2 className="mt-5 text-xl font-bold">동네 카페 메뉴판 디자인</h2><p className="sub mt-3 text-sm leading-6">읽기 쉬운 메뉴판과 QR 메뉴로 이웃 가게의 작은 변화를 함께 만들었어요.</p><div className="sub mt-5 border-t border-[var(--line)] pt-4 text-xs">월계동 · 14일 활동</div></article><PortfolioFlow /><Link href="/" className="btn btn-ghost w-full">실제 공고로 돌아가기</Link></main></>;
}
