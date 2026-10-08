import type { DocBlock } from "@shared/portfolio/document";
import type { PortfolioContent } from "@/types";
import type { PortfolioPage } from "@/lib/portfolio/page";
import type { TemplateId } from "./meta";

/**
 * 모든 템플릿이 받는 것. 템플릿은 배치·모양만 정하고, 내용은 blocks 에서만 가져온다.
 * blocks 는 buildDocument() 결과라 어떤 템플릿이든 같은 내용(글 + 잠긴 원본)을 받는다.
 */
export interface TemplateProps {
  page: PortfolioPage;
  content: PortfolioContent;   // 지금 보이는 글 (편집 중이면 고친 글)
  blocks: DocBlock[];          // content + 잠긴 원본으로 만든 문서 블록
  editing: boolean;            // 소유자가 '편집'을 눌렀는가
  onChange: (c: PortfolioContent) => void;
}
export interface PortfolioTemplate {
  id: TemplateId;
  name: string;
  description: string;
  Component: (p: TemplateProps) => JSX.Element;
}
