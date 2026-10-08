// 분야별 Domain Module. 질문·포트폴리오 섹션·준비도 항목을 설정으로만 정의한다.
// 새 분야(VIDEO, PHOTO …)는 모듈 하나를 만들어 DOMAINS 에 넣으면 화면 수정 없이 동작한다.
import type { DomainKey, DomainModule, FieldDef, QuestionDefinition } from "./types.ts";

// v3: 기본 기록은 시작 3개·진행 3개·마무리 2개로 간추린다.
export const QUESTION_SET_VERSION = 3;

const TOOLS_DESIGN = ["Figma", "Photoshop", "Illustrator", "Canva", "미리캔버스", "Procreate"];
const TOOLS_MARKETING = ["인스타그램", "네이버 플레이스", "Canva", "CapCut", "구글 시트", "당근 비즈프로필"];
const TOOLS_DEV = ["React", "Next.js", "HTML/CSS", "JavaScript", "TypeScript", "Firebase", "Supabase", "Vercel", "GitHub Pages"];

// 분야 공통 질문 조각 ─────────────────────────────────────────────────────────
const roleQ = (id: string, options: string[], example: string): QuestionDefinition => ({
  id, field: "role", stage: "START", title: "이 프로젝트에서 맡은 역할은 무엇인가요?", help: "여러 개면 모두 골라 주세요.", example,
  input: { kind: "choice", options, multi: true, allowOther: true },
});
const reflectionQ = (id: string, example: string): QuestionDefinition => ({
  id, field: "reflection", stage: "FINISH", title: "다시 한다면 무엇을 다르게 하고 싶나요?", help: "배운 점이나 아쉬운 점을 한두 문장으로요.", example,
  input: { kind: "long", placeholder: "예: 점주님과 첫 미팅에서 우선순위를 먼저 정했으면 수정이 줄었을 것 같아요" },
  followUp: { minChars: 15, hints: ["그 경험에서 다음 프로젝트에 가져갈 한 가지를 꼽는다면요?"], hintExamples: ["시안을 만들기 전에 실제 사용자에게 질문 세 가지를 먼저 묻는 것"] },
});
const toolsQ = (id: string, options: string[], example: string): QuestionDefinition => ({
  id, field: "tools", stage: "FINISH", title: "어떤 도구를 사용했나요?", help: "쓴 도구를 고르고, 필요하면 직접 적어 주세요.", example,
  input: { kind: "tools", options, multi: true, allowOther: true },
});

/** 다른 방법도 고려했는지: 판단의 근거를 따로 묻는다 */
const alternativesQ = (id: string, example: string, placeholder: string): QuestionDefinition => ({
  id, field: "alternatives", stage: "PROGRESS", title: "다른 방법도 고려했나요? 왜 이 방법을 골랐나요?", help: "비교한 방법이 없었다면 '해당 없음'을 눌러 주세요.", allowNA: true, example,
  input: { kind: "long", placeholder },
});
/** 이 방법이 맞는지 어떻게 확인했는지: 관찰·질문·시험 사용 */
const validationQ = (id: string, example: string): QuestionDefinition => ({
  id, field: "validation", stage: "PROGRESS", title: "이 방법이 맞는지 어떻게 확인했나요?", help: "관찰, 질문, 시험 사용처럼 직접 한 것만 골라 주세요. 무엇을 봤는지도 적어 주면 좋아요.", allowNA: true, example,
  input: { kind: "choice", options: ["직접 관찰", "의뢰인·손님에게 질문", "시안·시제품 시험 사용"], multi: true, allowOther: true, placeholder: "확인한 내용을 덧붙여 주세요" },
});
/** 의뢰인 피드백을 받고 무엇을 바꿨는지 */
const feedbackChangeQ = (id: string, example: string, placeholder: string): QuestionDefinition => ({
  id, field: "feedbackChange", stage: "FINISH", title: "의뢰인 피드백을 받고 무엇을 바꿨나요?", help: "받은 요청과 바꾼 내용을 함께 적어 주세요. 요청이 없었다면 '해당 없음'.", allowNA: true, example,
  input: { kind: "long", placeholder },
});
const NEW_FIELDS: FieldDef[] = [
  { key: "alternatives", label: "고려한 다른 방법" },
  { key: "validation", label: "확인 방법" },
  { key: "feedbackChange", label: "피드백 반영" },
];

// ── DESIGN ───────────────────────────────────────────────────────────────────
const designFields: FieldDef[] = [
  { key: "targetUser", label: "대상 사용자" },
  { key: "existingProblem", label: "기존 문제", core: "problem" },
  { key: "before", label: "기존 모습(Before)" },
  { key: "goal", label: "목표", core: "goal" },
  { key: "role", label: "내 역할", core: "role" },
  { key: "constraints", label: "제약 조건" },
  { key: "researchOrReference", label: "조사·레퍼런스" },
  { key: "designDecision", label: "핵심 디자인 결정" },
  { key: "designRationale", label: "결정 이유" },
  { key: "designProcess", label: "작업 과정", core: "process" },
  { key: "deliverable", label: "최종 결과물", core: "deliverable" },
  { key: "after", label: "달라진 점(After)" },
  { key: "tools", label: "사용 도구", core: "tools" },
  { key: "actualUsage", label: "실제 사용", core: "outcome" },
  { key: "reflection", label: "회고", core: "reflection" },
  ...NEW_FIELDS,
];
const DESIGN: DomainModule = {
  key: "DESIGN",
  label: "디자인",
  fields: designFields,
  questions: [
    { id: "d_target", field: "targetUser", stage: "START", title: "누가 이 결과물을 사용하나요?", example: "매장 방문 손님 + 직접 입력: 근처 대학 외국인 교환학생", help: "결과물을 보게 될 사람을 골라 주세요.",
      input: { kind: "choice", options: ["매장 방문 손님", "어르신 손님", "온라인으로 보는 고객", "직원·점주"], multi: true, allowOther: true } },
    { id: "d_problem", field: "existingProblem", stage: "START", title: "기존에는 어떤 문제가 있었나요?", example: "메뉴 24개가 한글 이름과 가격만 적혀 있어, 외국인 손님이 올 때마다 점주님이 번역기로 하나씩 설명하셨어요. 점심시간에 지켜보니 외국인 손님 5팀 중 4팀이 번역기를 썼어요.", help: "점주님께 들은 이야기나 직접 본 상황을 적어 주세요.",
      input: { kind: "long", placeholder: "예: 메뉴가 한 판에 섞여 있어 손님이 원하는 메뉴를 찾기 어려웠어요" },
      followUp: { minChars: 20, hints: ["그 문제를 어떤 상황에서 확인했나요? (예: 손님 질문, 점주 설명)"], hintExamples: ["점주님 설명을 들었고, 점심시간에 외국인 손님 5팀 중 4팀이 번역기를 쓰는 걸 직접 봤어요"] } },
    { id: "d_before", field: "before", stage: "START", title: "작업 전 모습은 어땠나요?", example: "흑백 A4 메뉴판 한 장, 한글 메뉴 24개, 사진 없음", help: "Before 사진은 증빙에 올리면 더 좋아요.", allowNA: true,
      input: { kind: "short", placeholder: "예: 흑백 A4 메뉴판 한 장, 메뉴 32개" } },
    { id: "d_constraints", field: "constraints", stage: "START", title: "꼭 지켜야 했던 조건이 있었나요?", example: "정해진 크기(A4 단면) + 인쇄 예산(2만 원 이내)", help: "예산, 크기, 가게 색, 기간 같은 것들이요.", allowNA: true,
      input: { kind: "choice", options: ["정해진 크기", "기존 브랜드 색 유지", "인쇄 예산", "짧은 기간"], multi: true, allowOther: true } },
    { id: "d_goal", field: "goal", stage: "START", title: "이 작업으로 무엇을 이루고 싶었나요?", example: "한식을 처음 보는 손님도 점주님께 묻지 않고 메뉴를 고르게 하기", input: { kind: "short", placeholder: "예: 손님이 메뉴를 빨리 고르게 하기" } },
    roleQ("d_role", ["기획", "시안 디자인", "최종 디자인", "인쇄·납품 준비"], "기획, 시안 디자인, 최종 디자인 + 직접 입력: 대표 메뉴 일러스트"),
    { id: "d_reference", field: "researchOrReference", stage: "PROGRESS", title: "참고하거나 조사한 것이 있나요?", example: "근처 한식당·카페 메뉴판 5곳을 사진으로 모아 메뉴 수와 설명 방식을 비교했어요", allowNA: true,
      input: { kind: "short", placeholder: "예: 근처 카페 메뉴판 5곳 비교" } },
    { id: "d_decision", field: "designDecision", stage: "PROGRESS", title: "가장 중요한 디자인 선택은 무엇이었나요?", example: "메뉴를 주요리 6개·디저트 4개 두 구역으로 줄이고, 메뉴 이름 아래에 재료와 맵기를 한 줄로 적었어요",
      input: { kind: "long", placeholder: "예: 메뉴를 4개 카테고리로 나누고 대표 메뉴를 맨 위에 크게 배치" },
      followUp: { minChars: 25, hints: ["어떤 기준으로 정보를 줄이거나 묶었나요?"], hintExamples: ["외국인 손님이 실제로 주문한 메뉴를 점주님과 함께 추려 10개만 남겼어요"] } },
    { id: "d_rationale", field: "designRationale", stage: "PROGRESS", title: "왜 그 선택을 했나요?", example: "외국인 손님 질문이 대부분 '무엇이 들어가나요?'와 '맵나요?'여서, 그 두 정보를 이름 바로 아래에 두었어요",
      input: { kind: "long", placeholder: "예: 손님들이 대표 메뉴를 가장 많이 물어봐서" },
      followUp: { minChars: 20, hints: ["그 선택의 근거가 된 손님 반응이나 점주님 말씀이 있었나요?"], hintExamples: ["점주님이 '맵냐는 질문이 제일 많다'고 하셔서 맵기를 이름 바로 옆에 두었어요"] } },
    alternativesQ("d_alternatives", "QR 메뉴판도 생각했지만 점주님이 휴대폰 화면보다 종이를 편해하셔서 종이 메뉴판으로 정했어요", "예: 사진형 시안도 만들었지만 음식 사진이 어두워 일러스트형을 골랐어요"),
    { id: "d_process", field: "designProcess", stage: "PROGRESS", title: "어떤 순서로 작업했나요?", example: "손스케치로 정보 구조 잡기 → Figma 시안 2종(사진형·일러스트형) → 점주님과 일러스트형 선택 → 최종본", help: "시안 횟수, 점주 피드백 반영 등.",
      input: { kind: "long", placeholder: "예: 스케치 → 시안 2종 → 점주 피드백 → 최종본" } },
    { id: "d_deliverable", field: "deliverable", stage: "FINISH", title: "최종적으로 무엇을 전달했나요?", example: "A4 인쇄용 PDF 1종 + Figma 원본 파일",
      input: { kind: "short", placeholder: "예: A3 메뉴판 인쇄용 PDF 1종 + 원본 Figma 파일" } },
    { id: "d_after", field: "after", stage: "FINISH", title: "작업 후 무엇이 달라졌나요?", example: "메뉴가 24개에서 10개로 줄고, 대표 메뉴 3개가 일러스트로 먼저 보여요", help: "숫자가 없다면 눈에 보이는 변화만 적어도 충분해요.",
      input: { kind: "long", placeholder: "예: 메뉴가 4개 구역으로 나뉘어 대표 메뉴가 먼저 보여요" } },
    toolsQ("d_tools", TOOLS_DESIGN, "Figma, Procreate"),
    { id: "d_usage", field: "actualUsage", stage: "FINISH", title: "결과물이 실제로 쓰이고 있나요?", example: "매장에 실제 게시됨 — 코팅해서 테이블 10곳에 놓였어요",
      input: { kind: "choice", options: ["매장에 실제 게시됨", "온라인에 게시됨", "전달만 완료", "아직 모름"], allowOther: true } },
    validationQ("d_validation", "시안·시제품 시험 사용 — 출력본을 테이블에 두고 외국인 손님 3팀이 고르는 모습을 지켜봤는데, 2팀이 묻지 않고 주문했어요"),
    feedbackChangeQ("d_feedback", "'매운 메뉴를 한눈에 알았으면 좋겠다'는 요청을 받고, 메뉴 이름 옆에 고추 아이콘으로 맵기 3단계를 표시했어요", "예: 가격이 잘 안 보인다는 말씀에 가격을 오른쪽 끝에 맞췄어요"),
    reflectionQ("d_reflection", "처음엔 번역이 핵심이라고 생각했는데, 손님에게 필요한 건 음식을 떠올릴 단서였어요. 다음엔 시안 전에 사용자에게 먼저 물어보겠어요"),
  ],
  sections: [
    { key: "overview", title: "개요", role: "overview", fields: ["goal", "deliverable"] },
    { key: "problem", title: "문제", role: "problem", fields: ["existingProblem"] },
    { key: "targetUser", title: "대상 사용자", role: "context", fields: ["targetUser"] },
    { key: "challenge", title: "디자인 과제", role: "problem", fields: ["goal"] },
    { key: "constraints", title: "제약 조건", role: "context", fields: ["constraints"] },
    { key: "decisions", title: "디자인 결정", role: "decision", fields: ["designDecision", "designRationale", "alternatives", "researchOrReference"] },
    { key: "process", title: "과정", role: "action", fields: ["designProcess", "role", "validation", "feedbackChange"], evidenceTypes: ["PROCESS_IMAGE"] },
    { key: "beforeAfter", title: "작업 전·후", role: "evidence", fields: ["before", "after"], evidenceTypes: ["BEFORE_IMAGE", "AFTER_IMAGE"] },
    { key: "deliverable", title: "최종 결과물", role: "evidence", fields: ["deliverable", "tools"], evidenceTypes: ["DELIVERABLE_FILE", "DELIVERABLE_URL"] },
    { key: "usage", title: "실제 사용", role: "result", fields: ["actualUsage"], evidenceTypes: ["USAGE_PROOF"], usesUsageClaim: true, usesOutcomes: true },
    { key: "feedback", title: "의뢰인 평가", role: "evidence", fields: [], locked: "clientFeedback" },
    { key: "reflection", title: "회고", role: "reflection", fields: ["reflection"] },
  ],
  readiness: [
    { key: "problem", label: "문제 정의", level: "REQUIRED", check: { kind: "field", field: "existingProblem" }, questionId: "d_problem" },
    { key: "role", label: "내 역할", level: "REQUIRED", check: { kind: "field", field: "role" }, questionId: "d_role" },
    { key: "deliverable", label: "최종 결과물", level: "REQUIRED", check: { kind: "any", of: [{ kind: "field", field: "deliverable" }, { kind: "evidence", types: ["DELIVERABLE_FILE", "DELIVERABLE_URL"] }] }, questionId: "d_deliverable" },
    { key: "decision", label: "핵심 디자인 결정", level: "REQUIRED", check: { kind: "field", field: "designDecision" }, questionId: "d_decision" },
    { key: "before", label: "Before", level: "RECOMMENDED", check: { kind: "any", of: [{ kind: "evidence", types: ["BEFORE_IMAGE"] }, { kind: "field", field: "before" }] }, questionId: "d_before" },
    { key: "after", label: "After", level: "RECOMMENDED", check: { kind: "any", of: [{ kind: "evidence", types: ["AFTER_IMAGE"] }, { kind: "field", field: "after" }] }, questionId: "d_after" },
    { key: "targetUser", label: "대상 사용자", level: "RECOMMENDED", check: { kind: "field", field: "targetUser" }, questionId: "d_target" },
    { key: "constraints", label: "제약 조건", level: "RECOMMENDED", check: { kind: "field", field: "constraints" }, questionId: "d_constraints" },
    { key: "alternatives", label: "고려한 다른 방법", level: "RECOMMENDED", check: { kind: "field", field: "alternatives" }, questionId: "d_alternatives" },
    { key: "validation", label: "확인 방법", level: "RECOMMENDED", check: { kind: "field", field: "validation" }, questionId: "d_validation" },
    { key: "feedbackChange", label: "피드백 반영", level: "OPTIONAL", check: { kind: "field", field: "feedbackChange" }, questionId: "d_feedback" },
    { key: "reference", label: "조사·레퍼런스", level: "OPTIONAL", check: { kind: "field", field: "researchOrReference" }, questionId: "d_reference" },
    { key: "reflection", label: "회고", level: "OPTIONAL", check: { kind: "field", field: "reflection" }, questionId: "d_reflection" },
    { key: "outcome", label: "후속 성과", level: "OPTIONAL", check: { kind: "outcome" } },
  ],
};

// ── MARKETING ────────────────────────────────────────────────────────────────
const MARKETING: DomainModule = {
  key: "MARKETING",
  label: "마케팅",
  fields: [
    { key: "businessProblem", label: "비즈니스 문제", core: "problem" },
    { key: "targetAudience", label: "타깃 고객" },
    { key: "baseline", label: "기존 상태(Baseline)" },
    { key: "goal", label: "목표", core: "goal" },
    { key: "role", label: "내 역할", core: "role" },
    { key: "strategy", label: "전략" },
    { key: "channel", label: "채널" },
    { key: "execution", label: "실행", core: "process" },
    { key: "deliverable", label: "결과물", core: "deliverable" },
    { key: "kpi", label: "KPI" },
    { key: "result", label: "측정 결과", core: "outcome" },
    { key: "insight", label: "인사이트" },
    { key: "tools", label: "사용 도구", core: "tools" },
    { key: "improvement", label: "개선점·회고", core: "reflection" },
    ...NEW_FIELDS,
  ],
  questions: [
    { id: "m_problem", field: "businessProblem", stage: "START", title: "가게가 해결하고 싶었던 문제는 무엇인가요?", example: "오픈 3개월 된 분식집인데, 점주님 말씀으로는 점심 손님 대부분이 단골이고 근처 직장인은 가게를 잘 모른대요",
      input: { kind: "long", placeholder: "예: 오픈 3개월인데 동네 주민들이 가게를 잘 몰라요" },
      followUp: { minChars: 20, hints: ["그 문제를 점주님은 어떻게 느끼고 있었나요?"], hintExamples: ["점심엔 단골만 와서 새 손님이 거의 없다고 걱정하셨어요"] } },
    { id: "m_audience", field: "targetAudience", stage: "START", title: "어떤 고객에게 도달하려 했나요?", example: "직장인 + 직접 입력: 반경 500m 오피스 직원",
      input: { kind: "choice", options: ["동네 주민", "대학생", "직장인", "가족 단위 손님"], multi: true, allowOther: true } },
    { id: "m_baseline", field: "baseline", stage: "START", title: "시작 전 상태는 어땠나요?", example: "인스타그램 팔로워 120명, 게시물 평균 조회수 420 (시작 전날 인사이트에서 확인)", help: "팔로워 수, 조회수처럼 기록이 있으면 적고, 없으면 '기록 없음'을 골라 주세요.",
      input: { kind: "choice", options: ["기록 없음"], allowOther: true, placeholder: "예: 팔로워 120명, 게시물 평균 조회수 420" } },
    { id: "m_goal", field: "goal", stage: "START", title: "이번 프로젝트의 목표는 무엇이었나요?", example: "근처 직장인에게 점심 메뉴를 알려 평일 점심 새 손님 늘리기", input: { kind: "short", placeholder: "예: 주변 직장인에게 점심 메뉴 알리기" } },
    roleQ("m_role", ["전략 기획", "콘텐츠 제작", "계정 운영", "성과 측정"], "콘텐츠 제작, 계정 운영 (촬영은 점주님과 함께)"),
    { id: "m_strategy", field: "strategy", stage: "PROGRESS", title: "어떤 전략을 사용했나요?", example: "점심 직전(11시)에 오늘의 메뉴 릴스를 올렸어요. 점주님이 11시 반부터 손님이 몰린다고 하셔서 그 전에 피드에 뜨게 하려고요",
      input: { kind: "long", placeholder: "예: 점심 시간대 메뉴 사진을 릴스로 올려 주변 직장인에게 노출" },
      followUp: { minChars: 25, askWhy: true, hints: ["그 전략을 고른 이유는 무엇인가요?"], hintExamples: ["점주님이 11시 반부터 손님이 몰린다고 하셔서, 그 전에 피드에 뜨게 하려고요"] } },
    alternativesQ("m_alternatives", "전단 배포도 생각했지만 인쇄비가 들고 효과를 셀 수 없어서, 조회수를 바로 볼 수 있는 릴스를 골랐어요", "예: 블로그 체험단도 알아봤지만 비용이 들어서 직접 운영을 골랐어요"),
    { id: "m_channel", field: "channel", stage: "PROGRESS", title: "어떤 채널을 썼나요?", example: "인스타그램, 네이버 플레이스",
      input: { kind: "choice", options: ["인스타그램", "네이버 플레이스", "블로그", "당근", "전단·오프라인"], multi: true, allowOther: true } },
    { id: "m_execution", field: "execution", stage: "PROGRESS", title: "실제로 무엇을 실행했나요?", example: "2주 동안 릴스 5개, 피드 게시물 6개 업로드, 네이버 플레이스 메뉴 사진 12장 교체",
      input: { kind: "long", placeholder: "예: 2주 동안 릴스 5개, 피드 게시물 6개 업로드" } },
    { id: "m_kpi", field: "kpi", stage: "PROGRESS", title: "무엇을 측정했나요?", example: "조회수, 방문·문의 수", allowNA: true,
      input: { kind: "choice", options: ["조회수", "팔로워 수", "저장·공유 수", "방문·문의 수", "매출"], multi: true, allowOther: true } },
    validationQ("m_validation", "직접 관찰 — 첫 주 릴스 3개의 조회수를 비교해, 반응이 좋은 '조리 과정' 형식으로 나머지를 만들었어요"),
    { id: "m_deliverable", field: "deliverable", stage: "FINISH", title: "최종적으로 무엇을 전달했나요?", example: "릴스 5개, 게시물 6개, 점주님용 해시태그 가이드 1장",
      input: { kind: "short", placeholder: "예: 릴스 5개, 게시물 6개, 해시태그 가이드 1장" } },
    { id: "m_result", field: "result", stage: "FINISH", title: "측정 결과가 있나요?", example: "2주 후 릴스 평균 조회수 1,100 (인스타그램 인사이트 화면 캡처 있음)", help: "숫자는 실제로 확인한 것만 적어 주세요. 성과 수치는 '성과' 탭에서 따로 등록할 수 있어요.",
      input: { kind: "choice", options: ["아직 측정하지 않음"], allowOther: true, placeholder: "예: 2주 후 평균 조회수 1,100" } },
    { id: "m_insight", field: "insight", stage: "FINISH", title: "진행하며 알게 된 점은 무엇인가요?", example: "조리 과정을 보여 준 릴스가 완성 사진보다 저장 수가 두 배였어요. 이 가게엔 과정이 보이는 콘텐츠가 더 맞았어요",
      input: { kind: "long" }, followUp: { minChars: 20, hints: ["그렇게 생각하게 된 계기(데이터나 반응)가 있었나요?"], hintExamples: ["조리 과정 릴스의 저장 수가 완성 사진 게시물보다 두 배였어요"] } },
    toolsQ("m_tools", TOOLS_MARKETING, "Canva, CapCut, 인스타그램"),
    feedbackChangeQ("m_feedback", "'메뉴 가격이 안 보인다'는 요청을 받고 릴스 마지막 장면에 가격 자막을 넣었어요", "예: 점주님 얼굴은 빼 달라고 하셔서 손만 나오게 다시 찍었어요"),
    { id: "m_improvement", field: "improvement", stage: "FINISH", title: "다시 한다면 무엇을 개선하고 싶나요?", example: "시작 전 데이터를 하루 단위로 기록해 두지 않아 비교가 어려웠어요. 다음엔 시작 전 일주일 데이터를 먼저 모으겠어요", input: { kind: "long" } },
  ],
  sections: [
    { key: "overview", title: "개요", role: "overview", fields: ["goal", "deliverable"] },
    { key: "problem", title: "비즈니스 문제", role: "problem", fields: ["businessProblem"] },
    { key: "audience", title: "타깃 고객", role: "context", fields: ["targetAudience"] },
    { key: "baseline", title: "시작 전 상태", role: "context", fields: ["baseline"] },
    { key: "strategy", title: "전략", role: "decision", fields: ["strategy", "alternatives", "channel"] },
    { key: "execution", title: "실행", role: "action", fields: ["execution", "role", "validation", "feedbackChange", "deliverable", "tools"], evidenceTypes: ["DELIVERABLE_URL", "DELIVERABLE_FILE", "PROCESS_IMAGE"] },
    { key: "kpi", title: "측정 지표", role: "context", fields: ["kpi"] },
    { key: "result", title: "측정 결과", role: "result", fields: ["result"], evidenceTypes: ["METRIC", "USAGE_PROOF"], usesOutcomes: true, usesUsageClaim: true },
    { key: "insight", title: "인사이트", role: "reflection", fields: ["insight"] },
    { key: "feedback", title: "의뢰인 평가", role: "evidence", fields: [], locked: "clientFeedback" },
    { key: "reflection", title: "회고", role: "reflection", fields: ["improvement"] },
  ],
  readiness: [
    { key: "problem", label: "비즈니스 문제", level: "REQUIRED", check: { kind: "field", field: "businessProblem" }, questionId: "m_problem" },
    { key: "role", label: "내 역할", level: "REQUIRED", check: { kind: "field", field: "role" }, questionId: "m_role" },
    { key: "strategy", label: "전략", level: "REQUIRED", check: { kind: "field", field: "strategy" }, questionId: "m_strategy" },
    { key: "execution", label: "실행 내용", level: "REQUIRED", check: { kind: "any", of: [{ kind: "field", field: "execution" }, { kind: "evidence", types: ["DELIVERABLE_URL", "DELIVERABLE_FILE"] }] }, questionId: "m_execution" },
    { key: "audience", label: "타깃 고객", level: "RECOMMENDED", check: { kind: "field", field: "targetAudience" }, questionId: "m_audience" },
    { key: "baseline", label: "Baseline", level: "RECOMMENDED", check: { kind: "field", field: "baseline" }, questionId: "m_baseline" },
    { key: "kpi", label: "KPI", level: "RECOMMENDED", check: { kind: "field", field: "kpi" }, questionId: "m_kpi" },
    { key: "result", label: "측정 결과", level: "RECOMMENDED", check: { kind: "any", of: [{ kind: "outcome" }, { kind: "evidence", types: ["METRIC"] }, { kind: "field", field: "result" }] }, questionId: "m_result" },
    { key: "alternatives", label: "고려한 다른 방법", level: "RECOMMENDED", check: { kind: "field", field: "alternatives" }, questionId: "m_alternatives" },
    { key: "validation", label: "확인 방법", level: "RECOMMENDED", check: { kind: "field", field: "validation" }, questionId: "m_validation" },
    { key: "feedbackChange", label: "피드백 반영", level: "OPTIONAL", check: { kind: "field", field: "feedbackChange" }, questionId: "m_feedback" },
    { key: "insight", label: "인사이트", level: "OPTIONAL", check: { kind: "field", field: "insight" }, questionId: "m_insight" },
    { key: "reflection", label: "회고", level: "OPTIONAL", check: { kind: "field", field: "improvement" }, questionId: "m_improvement" },
  ],
};

// ── DEVELOPMENT ──────────────────────────────────────────────────────────────
const DEVELOPMENT: DomainModule = {
  key: "DEVELOPMENT",
  label: "개발",
  fields: [
    { key: "userProblem", label: "사용자 문제", core: "problem" },
    { key: "requirements", label: "요구사항" },
    { key: "goal", label: "목표", core: "goal" },
    { key: "role", label: "내 역할", core: "role" },
    { key: "majorFeatures", label: "주요 기능" },
    { key: "architecture", label: "구조" },
    { key: "technologyChoices", label: "기술 선택 이유" },
    { key: "implementation", label: "구현", core: "process" },
    { key: "testing", label: "테스트" },
    { key: "deliveryOrDeployment", label: "전달·배포", core: "deliverable" },
    { key: "tools", label: "사용 기술", core: "tools" },
    { key: "actualUsage", label: "실제 사용" },
    { key: "result", label: "결과", core: "outcome" },
    { key: "reflection", label: "회고", core: "reflection" },
    ...NEW_FIELDS.filter((f) => f.key !== "validation"), // 개발은 '테스트' 질문이 확인 방법을 맡는다
  ],
  questions: [
    { id: "v_problem", field: "userProblem", stage: "START", title: "누구의 어떤 문제를 해결하려 했나요?", example: "손님이 종이 메뉴판을 기다리느라 주문이 늦어졌고, 점주님은 가격이 바뀔 때마다 메뉴판을 다시 인쇄하셨어요",
      input: { kind: "long", placeholder: "예: 손님이 종이 메뉴판을 기다려야 해서 주문이 늦어졌어요" },
      followUp: { minChars: 20, hints: ["그 문제로 누가 가장 불편했나요?"], hintExamples: ["주말 점심에 혼자 서빙하시는 점주님이 가장 불편하셨어요"] } },
    { id: "v_requirements", field: "requirements", stage: "START", title: "반드시 필요한 기능은 무엇이었나요?", example: "QR로 접속, 메뉴 20개 사진과 가격 표시, 점주님이 코드 없이 가격 수정",
      input: { kind: "long", placeholder: "예: QR 로 접속, 메뉴 20개 표시, 점주가 가격 직접 수정" } },
    { id: "v_goal", field: "goal", stage: "START", title: "완성되면 무엇이 가능해지길 바랐나요?", example: "손님이 자리에서 바로 메뉴를 보고, 점주님이 가격을 직접 고치기", input: { kind: "short", placeholder: "예: 손님이 자리에서 바로 메뉴 확인" } },
    roleQ("v_role", ["기획", "프론트엔드", "백엔드", "배포·운영"], "기획, 프론트엔드, 배포·운영"),
    { id: "v_features", field: "majorFeatures", stage: "PROGRESS", title: "만든 주요 기능은 무엇인가요?", example: "QR 메뉴 페이지, 카테고리 탭, 품절 표시, 구글 시트로 메뉴·가격 수정", input: { kind: "long" } },
    { id: "v_architecture", field: "architecture", stage: "PROGRESS", title: "어떤 구조로 만들었나요?", example: "정적 웹페이지(Next.js) + 구글 시트에서 메뉴 데이터 불러오기", allowNA: true,
      input: { kind: "short", placeholder: "예: 정적 웹페이지 + 구글 시트에서 메뉴 불러오기" } },
    { id: "v_tech", field: "technologyChoices", stage: "PROGRESS", title: "왜 이 기술을 선택했나요?", example: "점주님이 코드를 몰라도 메뉴를 고칠 수 있도록, 평소 쓰시던 엑셀과 비슷한 구글 시트를 데이터로 썼어요",
      input: { kind: "long", placeholder: "예: 점주가 코드 없이 메뉴를 고치도록 구글 시트를 데이터로 썼어요" },
      followUp: { minChars: 25, askWhy: true, hints: ["이 프로젝트에서 그 기술을 선택한 이유가 있었나요?"], hintExamples: ["점주님이 엑셀은 쓰셔서, 비슷한 구글 시트면 혼자 고치실 수 있었어요"] } },
    alternativesQ("v_alternatives", "노션 페이지로 만드는 방법도 있었지만 로딩이 느리고 디자인을 바꿀 수 없어서 직접 웹페이지를 만들었어요", "예: 배달앱 메뉴 링크도 생각했지만 수수료 때문에 직접 만들었어요"),
    { id: "v_implementation", field: "implementation", stage: "PROGRESS", title: "구현하면서 가장 신경 쓴 부분은요?", example: "어르신 손님도 보기 쉽게 글자를 18px 이상으로 하고, 시트 칸이 비어도 페이지가 깨지지 않게 처리했어요", input: { kind: "long" } },
    { id: "v_testing", field: "testing", stage: "FINISH", title: "어떻게 테스트했나요?", example: "점주 폰으로 직접 확인 + 여러 기기에서 확인 (아이폰·갤럭시 4대)", allowNA: true,
      input: { kind: "choice", options: ["점주 폰으로 직접 확인", "여러 기기에서 확인", "자동 테스트", "손님 대상 시범 운영"], multi: true, allowOther: true } },
    { id: "v_delivery", field: "deliveryOrDeployment", stage: "FINISH", title: "어떻게 전달하거나 배포했나요?", example: "GitHub Pages 배포 + 테이블용 QR 코드 인쇄본 10장 전달",
      input: { kind: "short", placeholder: "예: GitHub Pages 배포 + QR 코드 인쇄본 전달" } },
    toolsQ("v_tools", TOOLS_DEV, "Next.js, Vercel + 직접 입력: 구글 시트"),
    { id: "v_usage", field: "actualUsage", stage: "FINISH", title: "실제로 쓰이고 있나요?", example: "매장에서 사용 중 — 테이블마다 QR이 붙어 있어요",
      input: { kind: "choice", options: ["매장에서 사용 중", "전달만 완료", "아직 모름"], allowOther: true } },
    { id: "v_result", field: "result", stage: "FINISH", title: "무엇이 달라졌나요?", example: "점주님이 시트에서 가격을 직접 3번 바꾸셨고, 메뉴판을 다시 인쇄할 일이 없어졌어요", help: "측정한 숫자가 없으면 관찰한 변화만 적어 주세요.", input: { kind: "long" } },
    feedbackChangeQ("v_feedback", "'품절 메뉴를 바로 표시하고 싶다'는 요청을 받고, 시트에 품절 칸을 추가해 체크하면 회색으로 보이게 했어요", "예: 글자가 작다고 하셔서 기본 글자 크기를 키웠어요"),
    reflectionQ("v_reflection", "배포 뒤에야 매장 와이파이가 느린 걸 알았어요. 다음엔 실제 매장 환경에서 먼저 테스트하겠어요"),
  ],
  sections: [
    { key: "overview", title: "개요", role: "overview", fields: ["goal", "deliveryOrDeployment"] },
    { key: "problem", title: "문제", role: "problem", fields: ["userProblem"] },
    { key: "requirements", title: "사용자·요구사항", role: "context", fields: ["requirements"] },
    { key: "architecture", title: "구조", role: "decision", fields: ["architecture"] },
    { key: "tech", title: "기술 선택", role: "decision", fields: ["technologyChoices", "alternatives", "tools"] },
    { key: "implementation", title: "구현", role: "action", fields: ["majorFeatures", "implementation", "role", "feedbackChange"], evidenceTypes: ["PROCESS_IMAGE"] },
    { key: "testing", title: "테스트", role: "evidence", fields: ["testing"], evidenceTypes: ["TEST_RECORD"] },
    { key: "delivery", title: "전달·배포", role: "evidence", fields: ["deliveryOrDeployment"], evidenceTypes: ["DELIVERABLE_URL", "DELIVERABLE_FILE"] },
    { key: "usage", title: "실제 사용", role: "result", fields: ["actualUsage"], evidenceTypes: ["USAGE_PROOF"], usesUsageClaim: true },
    { key: "result", title: "결과", role: "result", fields: ["result"], evidenceTypes: ["METRIC"], usesOutcomes: true },
    { key: "feedback", title: "의뢰인 평가", role: "evidence", fields: [], locked: "clientFeedback" },
    { key: "reflection", title: "회고", role: "reflection", fields: ["reflection"] },
  ],
  readiness: [
    { key: "problem", label: "사용자 문제", level: "REQUIRED", check: { kind: "field", field: "userProblem" }, questionId: "v_problem" },
    { key: "role", label: "내 역할", level: "REQUIRED", check: { kind: "field", field: "role" }, questionId: "v_role" },
    { key: "features", label: "주요 기능", level: "REQUIRED", check: { kind: "field", field: "majorFeatures" }, questionId: "v_features" },
    { key: "delivery", label: "전달·배포", level: "REQUIRED", check: { kind: "any", of: [{ kind: "field", field: "deliveryOrDeployment" }, { kind: "evidence", types: ["DELIVERABLE_URL", "DELIVERABLE_FILE"] }] }, questionId: "v_delivery" },
    { key: "requirements", label: "요구사항", level: "RECOMMENDED", check: { kind: "field", field: "requirements" }, questionId: "v_requirements" },
    { key: "tech", label: "기술 선택 이유", level: "RECOMMENDED", check: { kind: "field", field: "technologyChoices" }, questionId: "v_tech" },
    { key: "testing", label: "테스트", level: "RECOMMENDED", check: { kind: "any", of: [{ kind: "field", field: "testing" }, { kind: "evidence", types: ["TEST_RECORD"] }] }, questionId: "v_testing" },
    { key: "usage", label: "실제 사용", level: "RECOMMENDED", check: { kind: "field", field: "actualUsage" }, questionId: "v_usage" },
    { key: "alternatives", label: "고려한 다른 방법", level: "RECOMMENDED", check: { kind: "field", field: "alternatives" }, questionId: "v_alternatives" },
    { key: "feedbackChange", label: "피드백 반영", level: "OPTIONAL", check: { kind: "field", field: "feedbackChange" }, questionId: "v_feedback" },
    { key: "architecture", label: "구조", level: "OPTIONAL", check: { kind: "field", field: "architecture" }, questionId: "v_architecture" },
    { key: "reflection", label: "회고", level: "OPTIONAL", check: { kind: "field", field: "reflection" }, questionId: "v_reflection" },
    { key: "outcome", label: "후속 성과", level: "OPTIONAL", check: { kind: "outcome" } },
  ],
};

// ── GENERAL: 전용 모듈이 아직 없는 분야(영상·사진·디지털도움 등)는 Common Core 만 쓴다 ─────
const GENERAL: DomainModule = {
  key: "GENERAL",
  label: "일반",
  fields: [
    { key: "problem", label: "문제", core: "problem" },
    { key: "goal", label: "목표", core: "goal" },
    { key: "role", label: "내 역할", core: "role" },
    { key: "process", label: "과정", core: "process" },
    { key: "deliverable", label: "결과물", core: "deliverable" },
    { key: "tools", label: "사용 도구", core: "tools" },
    { key: "actualUsage", label: "실제 사용", core: "outcome" },
    { key: "reflection", label: "회고", core: "reflection" },
    ...NEW_FIELDS,
  ],
  questions: [
    { id: "g_problem", field: "problem", stage: "START", title: "의뢰인은 어떤 문제를 겪고 있었나요?", example: "복지관 어르신들이 키오스크 주문이 어려워 카페 이용을 포기하신다고 사회복지사님이 말씀하셨어요", input: { kind: "long" },
      followUp: { minChars: 20, hints: ["그 문제를 어떤 상황에서 확인했나요?"], hintExamples: ["첫 수업에서 어르신 12명 중 9명이 키오스크 첫 화면에서 멈추셨어요"] } },
    { id: "g_goal", field: "goal", stage: "START", title: "이 프로젝트의 목표는 무엇이었나요?", example: "어르신 10명이 혼자서 키오스크로 주문하실 수 있게 하기", input: { kind: "short" } },
    roleQ("g_role", ["기획", "제작", "교육·안내", "전달"], "기획, 교육·안내"),
    { id: "g_process", field: "process", stage: "PROGRESS", title: "어떤 과정으로 진행했나요?", example: "어르신께 어려운 점 여쭤보기 → 주문 단계를 그림 카드 5장으로 정리 → 종이 모형으로 2회 실습 → 실제 카페 방문", input: { kind: "long" },
      followUp: { minChars: 25, hints: ["진행 중 가장 중요했던 판단은 무엇이었나요?"], hintExamples: ["결제 화면 설명을 따로 한 장으로 빼서 한 장에 한 단계만 보이게 한 것"] } },
    alternativesQ("g_alternatives", "영상 강의도 생각했지만 어르신들이 직접 눌러 보며 배우고 싶어 하셔서 종이 모형으로 실습했어요", "예: 단체 수업 대신 1:1로 진행했어요. 질문을 편하게 하시도록요"),
    validationQ("g_validation", "직접 관찰 — 마지막 수업에서 실제 카페에 가서 어르신 10명 중 7명이 도움 없이 주문하시는 걸 확인했어요"),
    { id: "g_deliverable", field: "deliverable", stage: "FINISH", title: "최종적으로 무엇을 전달했나요?", example: "키오스크 주문 그림 카드 5장, 실습용 종이 모형 1세트", input: { kind: "short" } },
    toolsQ("g_tools", ["프리미어", "CapCut", "라이트룸", "Canva", "스마트폰"], "Canva, 스마트폰"),
    { id: "g_usage", field: "actualUsage", stage: "FINISH", title: "결과물이 실제로 쓰이고 있나요?", example: "실제 사용 중 — 복지관이 다음 기수 수업에도 카드를 쓰고 있어요",
      input: { kind: "choice", options: ["실제 사용 중", "전달만 완료", "아직 모름"], allowOther: true } },
    feedbackChangeQ("g_feedback", "'글씨가 작다'는 요청을 받고 카드 글자를 2배로 키우고 한 장에 한 단계만 넣었어요", "예: 수업 시간을 1시간에서 40분으로 줄여 달라고 하셔서 실습 위주로 바꿨어요"),
    reflectionQ("g_reflection", "한 번에 많이 알려 드리면 오히려 헷갈려 하셨어요. 다음엔 한 수업에 한 단계만 다루겠어요"),
  ],
  sections: [
    { key: "overview", title: "개요", role: "overview", fields: ["goal", "deliverable"] },
    { key: "problem", title: "문제", role: "problem", fields: ["problem"] },
    { key: "goal", title: "목표", role: "context", fields: ["goal"] },
    { key: "process", title: "과정", role: "action", fields: ["process", "role", "alternatives", "validation", "feedbackChange"], evidenceTypes: ["PROCESS_IMAGE"] },
    { key: "deliverable", title: "결과물", role: "evidence", fields: ["deliverable", "tools"], evidenceTypes: ["DELIVERABLE_FILE", "DELIVERABLE_URL", "BEFORE_IMAGE", "AFTER_IMAGE", "VIDEO"] },
    { key: "outcome", title: "성과", role: "result", fields: ["actualUsage"], evidenceTypes: ["USAGE_PROOF", "METRIC"], usesOutcomes: true, usesUsageClaim: true },
    { key: "feedback", title: "의뢰인 평가", role: "evidence", fields: [], locked: "clientFeedback" },
    { key: "reflection", title: "회고", role: "reflection", fields: ["reflection"] },
  ],
  readiness: [
    { key: "problem", label: "문제", level: "REQUIRED", check: { kind: "field", field: "problem" }, questionId: "g_problem" },
    { key: "role", label: "내 역할", level: "REQUIRED", check: { kind: "field", field: "role" }, questionId: "g_role" },
    { key: "deliverable", label: "결과물", level: "REQUIRED", check: { kind: "any", of: [{ kind: "field", field: "deliverable" }, { kind: "evidence", types: ["DELIVERABLE_FILE", "DELIVERABLE_URL", "VIDEO"] }] }, questionId: "g_deliverable" },
    { key: "process", label: "과정", level: "RECOMMENDED", check: { kind: "field", field: "process" }, questionId: "g_process" },
    { key: "tools", label: "사용 도구", level: "RECOMMENDED", check: { kind: "field", field: "tools" }, questionId: "g_tools" },
    { key: "usage", label: "실제 사용", level: "RECOMMENDED", check: { kind: "field", field: "actualUsage" }, questionId: "g_usage" },
    { key: "alternatives", label: "고려한 다른 방법", level: "RECOMMENDED", check: { kind: "field", field: "alternatives" }, questionId: "g_alternatives" },
    { key: "validation", label: "확인 방법", level: "RECOMMENDED", check: { kind: "field", field: "validation" }, questionId: "g_validation" },
    { key: "feedbackChange", label: "피드백 반영", level: "OPTIONAL", check: { kind: "field", field: "feedbackChange" }, questionId: "g_feedback" },
    { key: "reflection", label: "회고", level: "OPTIONAL", check: { kind: "field", field: "reflection" }, questionId: "g_reflection" },
    { key: "outcome", label: "후속 성과", level: "OPTIONAL", check: { kind: "outcome" } },
  ],
};

export const DOMAINS: Record<DomainKey, DomainModule> = { DESIGN, MARKETING, DEVELOPMENT, GENERAL };
export const DOMAIN_KEYS = Object.keys(DOMAINS) as DomainKey[];

/** 기본 기록 질문. 예전 프로젝트의 스냅샷에도 같은 기준을 적용하되 저장된 답은 보존한다. */
const CORE_QUESTION_IDS: Record<DomainKey, readonly string[]> = {
  DESIGN: ["d_problem", "d_target", "d_role", "d_decision", "d_process", "d_rationale", "d_deliverable", "d_after"],
  MARKETING: ["m_problem", "m_audience", "m_role", "m_strategy", "m_execution", "m_kpi", "m_deliverable", "m_result"],
  DEVELOPMENT: ["v_problem", "v_requirements", "v_role", "v_features", "v_implementation", "v_tech", "v_delivery", "v_testing"],
  GENERAL: ["g_problem", "g_goal", "g_role", "g_process", "g_validation", "g_alternatives", "g_deliverable", "g_usage"],
};
export function coreQuestions(domain: DomainKey, questions: QuestionDefinition[] = DOMAINS[domain].questions): QuestionDefinition[] {
  const ids = new Set(CORE_QUESTION_IDS[domain]);
  return questions.filter((question) => ids.has(question.id));
}

/** 기존 공고 카테고리 → 분야 모듈. 전용 모듈이 없는 카테고리는 GENERAL. */
const CATEGORY_DOMAIN: Record<string, DomainKey> = { "디자인": "DESIGN", "SNS홍보": "MARKETING", "웹/앱": "DEVELOPMENT" };
export const domainForCategory = (category: string): DomainKey => CATEGORY_DOMAIN[category] ?? "GENERAL";
export const isDomainKey = (v: unknown): v is DomainKey => typeof v === "string" && v in DOMAINS;
export const fieldLabel = (domain: DomainKey, field: string) => DOMAINS[domain].fields.find((f) => f.key === field)?.label ?? field;

/** 질문의 답변 예시. 예전 스냅샷에는 예시가 없어서, 같은 id 의 현재 질문 정의에서 찾는다 (안내 문구일 뿐 데이터가 아니다) */
export function exampleFor(domain: DomainKey, q: QuestionDefinition): string | undefined {
  return q.example ?? DOMAINS[domain]?.questions.find((x) => x.id === q.id)?.example;
}
/** 규칙 기반 후속 질문의 답변 예시 (hints 와 같은 순서). 질문 문구가 지금과 같을 때만 현재 정의에서 빌려 온다 */
export function hintExamplesFor(domain: DomainKey, q: QuestionDefinition): string[] {
  const own = q.followUp?.hintExamples;
  if (own?.length) return own;
  const cur = DOMAINS[domain]?.questions.find((x) => x.id === q.id)?.followUp;
  return cur && cur.hints.join("|") === (q.followUp?.hints ?? []).join("|") ? cur.hintExamples ?? [] : [];
}
