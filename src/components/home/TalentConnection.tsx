"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import Icon from "@/components/Icon";
import type { Post } from "@/types";
import { WhiteVillage } from "./ConnectionWorld";
import CategoryPicker from "./CategoryPicker";

import { HOME_CATEGORIES, type HomeCategory } from "./categories";
export { HOME_CATEGORIES, categoryMatches, type HomeCategory } from "./categories";

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
  const [hubPulse, setHubPulse] = useState(0);
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

  return <><div className="talent-connection">
    <div className="connection-scene" aria-label={`${selected?.label ?? "다양한 재능"}과 지역 요청을 연결하는 모습`}>
      <div className="connection-scene-grid" aria-hidden="true" />
      <WhiteVillage compact />
      <svg key={`wires-${category}`} viewBox="0 0 400 240" className="connection-wires" preserveAspectRatio="none" aria-hidden="true">
        <path className="connection-route-base" d="M55 164 C105 172 111 105 185 110 S225 151 296 151" />
        <path className="connection-route-active" pathLength="1" d="M55 164 C105 172 111 105 185 110 S225 151 296 151" />
        <path className="connection-experience-line" d="M185 110 C184 155 153 181 112 208" />
        <circle className="connection-traveler" r="3.5"><animateMotion dur="1.2s" repeatCount="1" fill="freeze" path="M55 164 C105 172 111 105 185 110 S225 151 296 151" /></circle>
      </svg>
      <button type="button" className="connection-hub" onClick={() => { setHubPulse(n => n + 1); onCategoryChange("전체"); onExplore(); }} aria-label="모든 재능의 공고 보기">
        {hubPulse > 0 && <span key={hubPulse} className="connection-hub-pulse" aria-hidden="true" />}
        <span key={category} className="connection-hub-ring" aria-hidden="true" />
        <Image className="connection-held-logo" src="/brand/wolink-held.svg" alt="" width={96} height={80} />
      </button>
      {suggestedPost ? <Link href={`/posts/detail?id=${suggestedPost.id}`} className="connection-request-node">{request}</Link> : <div className="connection-request-node">{request}</div>}
      <Link href="/portfolio" className="connection-experience"><Icon name="folder" width={15} height={15} /><span>경험은 나의 포트폴리오로</span><Icon name="arrow" width={13} height={13} /></Link>
      <span className="connection-scene-note" aria-hidden="true">TALENT → NEIGHBOR</span>
    </div>

    </div>
    <CategoryPicker category={category} onChange={onCategoryChange} />

    <div className="connection-actions">
      <button type="button" className="connection-explore" onClick={onExplore} disabled={loading || failed || count === 0}>
        <span>{loading ? "동네 요청을 불러오는 중" : failed ? "요청을 불러오지 못했어요" : count ? `${selected?.label ?? "우리 동네"} 공고 살펴보기` : "이 분야의 새 요청을 기다려요"}</span>
        <span className="connection-explore-end">{!loading && !failed && count > 0 && <span>{count}</span>}<Icon name="arrow" width={19} height={19} /></span>
      </button>
      <Link href={resident ? "/posts/new" : "/map"} className="connection-secondary">{resident ? "우리 가게에 필요한 도움 요청하기" : "지도에서 가까운 이웃 찾기"}<Icon name={resident ? "plus" : "pin"} width={14} height={14} /></Link>
    </div>
  </>;
}
