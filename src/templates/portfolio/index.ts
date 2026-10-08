// 포트폴리오 템플릿 목록. 디자인은 코드(여기), 글은 AI 초안 + 학생 편집이 맡는다.
import ExhibitionTemplate from "./exhibition";
import BasicTemplate from "./basic";
import EditorialTemplate from "./editorial";
import { TEMPLATE_META, templateIdOf, type TemplateId } from "./meta";
import type { PortfolioTemplate, TemplateProps } from "./types";

const COMPONENTS: Record<TemplateId, (p: TemplateProps) => JSX.Element> = { basic: BasicTemplate, editorial: EditorialTemplate, exhibition: ExhibitionTemplate };

export const TEMPLATES: PortfolioTemplate[] = TEMPLATE_META.map((m) => ({ ...m, Component: COMPONENTS[m.id] }));
export const templateFor = (id: unknown): PortfolioTemplate => TEMPLATES.find((t) => t.id === templateIdOf(id))!;
export type { PortfolioTemplate, TemplateProps };
