export type DemoRole = "student" | "merchant";
/** picks: 방문객이 체험 중에 고른 것 (마지막 결과 카드에 보여 준다) */
export type DemoPicks = { startedAt?: number; studentName?: string; category?: string; title?: string; postId?: string };
export type DemoTourState = { role: DemoRole; step: number; picks?: DemoPicks };
const KEY = "wolgye-demo-tour";

export function startDemoTour(role: DemoRole) {
  sessionStorage.setItem(KEY, JSON.stringify({ role, step: 0, picks: { startedAt: Date.now() } }));
}

export function getDemoTour(): DemoTourState | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return (value?.role === "student" || value?.role === "merchant") && Number.isInteger(value.step) ? value : null;
  } catch { return null; }
}

export function saveDemoTour(state: DemoTourState | null) {
  if (state) sessionStorage.setItem(KEY, JSON.stringify(state));
  else sessionStorage.removeItem(KEY);
}

/** 체험 중 고른 것을 기억한다 (튜토리얼 단계는 그대로) */
export function rememberDemoPick(picks: DemoPicks) {
  const tour = getDemoTour();
  if (tour) saveDemoTour({ ...tour, picks: { ...tour.picks, ...picks } });
  window.dispatchEvent(new Event(DEMO_PICK_EVENT));   // 이미 그려진 화면(홈 등)이 고른 값을 다시 읽게
}
export const DEMO_PICK_EVENT = "wolink-demo-pick";

/** 상인 체험 중인지 (단계와 상관없이). 화면이 그려진 직후 튜토리얼이 다음 단계로 넘어가도 어긋나지 않는다 */
export const inMerchantTour = (tour: DemoTourState | null) => tour?.role === "merchant";


/** 학생 체험: 첫 화면에서 고르는 분야와, 그 분야에서 지원해 볼 데모 공고 */
export const STUDENT_FIELDS = [
  { label: "디자인", icon: "🎨", postId: "p9",
    apply: "안녕하세요. 패키지 디자인을 공부하는 김하늘입니다. 제공해 주시는 로고와 제품 사진으로 선물상자 띠지와 스티커 시안을 만들고, 인쇄용 파일까지 전달하겠습니다.",
    ask: "안녕하세요, 선물상자 띠지와 스티커의 인쇄 크기와 선호하는 색상을 알려주시면 시안에 반영하겠습니다." },
  { label: "사진", icon: "📷", postId: "p13",
    apply: "안녕하세요. 사진 촬영을 공부하는 김하늘입니다. 자연광으로 작품의 질감이 잘 보이게 찍고, 보정한 사진을 SNS용과 원본으로 나눠 전달하겠습니다.",
    ask: "안녕하세요, 촬영할 작품 수와 원하시는 분위기(밝은 톤·따뜻한 톤)를 알려주시면 촬영 계획을 세워 오겠습니다." },
  { label: "영상", icon: "🎬", postId: "p15",
    apply: "안녕하세요. 영상 편집을 공부하는 김하늘입니다. 시술 전후가 한눈에 비교되도록 15초 릴스로 촬영·편집하고 자막까지 넣어 드리겠습니다.",
    ask: "안녕하세요, 촬영 가능한 요일과 손님 촬영 동의 여부를 알려주시면 촬영 일정을 맞추겠습니다." },
  { label: "웹·앱", icon: "💻", postId: "p19",
    apply: "안녕하세요. 웹 개발을 공부하는 김하늘입니다. 휴대폰에서 수업 일정을 보고 바로 신청할 수 있는 페이지를 만들고, 일정 수정 방법까지 안내하겠습니다.",
    ask: "안녕하세요, 한 달에 여는 수업 종류와 회차별 정원을 알려주시면 신청 페이지 항목에 반영하겠습니다." },
  { label: "SNS 홍보", icon: "📣", postId: "p22",
    apply: "안녕하세요. SNS 마케팅을 공부하는 김하늘입니다. 손님들이 궁금해하는 관리법과 시술 사례로 한 달 치 릴스 주제와 대본을 기획하겠습니다.",
    ask: "안녕하세요, 가장 알리고 싶은 시술과 매장 분위기를 알려주시면 첫 주 콘텐츠 기획에 반영하겠습니다." },
] as const;
/** 학생 체험에서 지원해 볼 공고 (고르기 전에는 디자인 공고) */
export const studentDemoPostId = () => getDemoTour()?.picks?.postId ?? "p9";
export const studentDemoField = () => STUDENT_FIELDS.find((f) => f.postId === studentDemoPostId()) ?? STUDENT_FIELDS[0];
