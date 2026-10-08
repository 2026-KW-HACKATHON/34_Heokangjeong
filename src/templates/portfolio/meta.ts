// 포트폴리오 템플릿 목록 (React 없이 id·이름만). 저장·검증 코드가 이 목록을 쓴다.
// 템플릿을 추가하면 여기와 index.tsx 에 한 줄씩 넣는다. 내용 보장 테스트가 새 템플릿도 자동으로 검사한다.
export const TEMPLATE_META = [
  { id: "basic", name: "기본", description: "카드로 나눈 차분한 구성. 모바일에서 읽기 편해요." },
  { id: "editorial", name: "에디토리얼", description: "큰 제목과 왼쪽 라벨·오른쪽 본문의 잡지형 구성." },
] as const;
export type TemplateId = (typeof TEMPLATE_META)[number]["id"];
export const DEFAULT_TEMPLATE: TemplateId = "basic";
export const isTemplateId = (v: unknown): v is TemplateId => TEMPLATE_META.some((t) => t.id === v);
/** 저장된 값이 없거나 모르는 템플릿이면 기본 템플릿 */
export const templateIdOf = (v: unknown): TemplateId => (isTemplateId(v) ? v : DEFAULT_TEMPLATE);
