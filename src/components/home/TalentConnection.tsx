"use client";

import Link from "next/link";
import Image from "next/image";
import Icon, { type IconName } from "@/components/Icon";
import type { Category, Post } from "@/types";
import { WhiteVillage } from "./ConnectionWorld";
import TalentWalker from "./TalentWalker";

export type HomeCategory = "전체" | "디자인" | "사진/영상" | "웹/앱" | "SNS홍보" | "디지털도움";

export const HOME_CATEGORIES: { value: Exclude<HomeCategory, "전체">; label: string; talent: string; icon: IconName; categories: Category[] }[] = [
  { value: "디자인", label: "디자인", talent: "그리는 재능", icon: "pen", categories: ["디자인"] },
  { value: "사진/영상", label: "사진·영상", talent: "담아내는 재능", icon: "camera", categories: ["사진", "영상"] },
  { value: "웹/앱", label: "웹·앱 개발", talent: "만드는 재능", icon: "web", categories: ["웹/앱"] },
  { value: "SNS홍보", label: "SNS 콘텐츠", talent: "알리는 재능", icon: "megaphone", categories: ["SNS홍보"] },
  { value: "디지털도움", label: "디지털 도움", talent: "함께하는 재능", icon: "phone", categories: ["디지털도움"] },
];

export function categoryMatches(filter: HomeCategory, category: Category) {
  return filter === "전체" || HOME_CATEGORIES.find((item) => item.value === filter)?.categories.includes(category) === true;
}

interface Props {
  category: HomeCategory;
  onCategoryChange: (category: HomeCategory) => void;
  onExplore: () => void;
  count: number;
  suggestedPost?: Post;
  authorName?: string;
  loading: boolean;
  failed: boolean;
  resident: boolean;
}

/** Presentation only: the parent supplies the actual filtered posts and navigation. */
export default function TalentConnection({ category, onCategoryChange, onExplore, count, suggestedPost, authorName, loading, failed, resident }: Props) {
  const selected = HOME_CATEGORIES.find((item) => item.value === category);
  const request = suggestedPost ? <>
    <span className="connection-recommendation connection-node-caption"><span className="connection-recommendation-icon" title="추천"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z" /></svg><span className="sr-only">추천</span></span><span>{authorName ?? "우리 동네 이웃"}</span></span>
    <strong className="connection-request-title">{suggestedPost.title}</strong>
    <span className="connection-request-action">요청 보기 <Icon name="arrow" width={13} height={13} /></span>
  </> : <>
    <span className="connection-node-caption">우리 동네 이웃</span>
    <strong className="connection-request-title">{loading ? "요청을 찾고 있어요" : failed ? "잠시 후 다시 만나요" : "아직 요청이 없어요"}</strong>
    <span className="connection-node-caption">{!loading && !failed ? "다른 재능도 살펴보세요" : ""}</span>
  </>;

  return <div className="talent-connection">
    <div className="connection-intro">
      <p className="connection-eyebrow"><span /> SMALL TALENT, REAL CHANGE</p>
      <h2>{resident ? <>작은 요청이,<br />새로운 변화가 되도록.</> : <>가까운 곳에,<br />나의 재능이 닿도록.</>}</h2>
      <p className="connection-description">{resident ? "이웃의 재능과 함께, 우리 가게의 다음을 만들어보세요." : "동네에서 함께한 일이, 나만의 경험이 됩니다."}</p>
    </div>

    <div className="connection-scene" aria-label={`${selected?.label ?? "다양한 재능"}과 지역 요청을 연결하는 모습`}>
      <div className="connection-scene-grid" aria-hidden="true" />
      <WhiteVillage compact />
      <svg key={`wires-${category}`} viewBox="0 0 400 240" className="connection-wires" preserveAspectRatio="none" aria-hidden="true">
        <path className="connection-route-base" d="M55 164 C105 172 111 105 185 110 S225 151 296 151" />
        <path className="connection-route-active" pathLength="1" d="M55 164 C105 172 111 105 185 110 S225 151 296 151" />
        <path className="connection-experience-line" d="M185 110 C184 155 153 181 112 208" />
        <circle className="connection-traveler" r="3.5"><animateMotion dur="1.2s" repeatCount="1" fill="freeze" path="M55 164 C105 172 111 105 185 110 S225 151 296 151" /></circle>
      </svg>
      <button type="button" className="connection-hub" onClick={() => onCategoryChange("전체")} aria-label="모든 재능의 공고 보기">
        <span key={category} className="connection-hub-ring" aria-hidden="true" />
        <Image src="/brand/wolgye-symbol.svg" alt="" width={29} height={29} />
      </button>
      {suggestedPost ? <Link href={`/posts/detail?id=${suggestedPost.id}`} className="connection-request-node">{request}</Link> : <div className="connection-request-node">{request}</div>}
      <Link href="/portfolio" className="connection-experience"><Icon name="folder" width={15} height={15} /><span>경험은 나의 포트폴리오로</span><Icon name="arrow" width={13} height={13} /></Link>
      <span className="connection-scene-note" aria-hidden="true">TALENT → NEIGHBOR</span>
    </div>

    <fieldset className="connection-picker">
      <legend>{resident ? "어떤 도움이 필요한가요?" : "어떤 재능을 연결해 볼까요?"}</legend>
      <TalentWalker />
      <div className="connection-category-grid">
        {HOME_CATEGORIES.map((item) => <button key={item.value} type="button" aria-pressed={category === item.value} onClick={() => onCategoryChange(category === item.value ? "전체" : item.value)} className="connection-category">
          <span className="connection-category-icon"><Icon name={item.icon} width={22} height={22} /><span className="connection-selected-dot" /></span>
          <span>{item.label}</span>
        </button>)}
      </div>
    </fieldset>

    <div className="connection-actions">
      <button type="button" className="connection-explore" onClick={onExplore} disabled={loading || failed || count === 0}>
        <span>{loading ? "동네 요청을 불러오는 중" : failed ? "요청을 불러오지 못했어요" : count ? `${selected?.label ?? "우리 동네"} 공고 살펴보기` : "이 분야의 새 요청을 기다려요"}</span>
        <span className="connection-explore-end">{!loading && !failed && count > 0 && <span>{count}</span>}<Icon name="arrow" width={19} height={19} /></span>
      </button>
      <Link href={resident ? "/posts/new" : "/map"} className="connection-secondary">{resident ? "우리 가게에 필요한 도움 요청하기" : "지도에서 가까운 이웃 찾기"}<Icon name={resident ? "plus" : "pin"} width={14} height={14} /></Link>
    </div>
  </div>;
}
