import type { Category, Post } from "@/types";
import { supabase } from "../supabase";
import type { PostDraft } from "./draft";
import type { AgreementDraft } from "./agreement";

/**
 * 서버(Supabase) 연결이 아예 없는 데모 빌드에서만 Gemini 대신 준비된 답을 쓴다.
 * 배포 앱의 체험 모드는 방문객이 적은 고민을 진짜 Gemini 가 읽고 정리한다 (서버 함수가 가벼운 모델부터 불러 2초 안팎).
 */
export const cannedAi = () => !supabase;

/** 버튼을 누른 느낌이 나도록 아주 짧게만 기다린다 */
export const cannedPause = (ms = 600) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const CANNED_NOTE = "체험용 예시 답변이에요. 실제 이용 때는 Gemini가 글을 읽고 정리해요.";

const KEYWORDS: [Category, RegExp, string[], string][] = [
  ["디자인", /메뉴판|포스터|전단|간판|로고|안내판|가격표|스티커|패키지|디자인/, ["인쇄용 PDF 1종", "수정 가능한 원본 파일"], "인쇄물·시각 자료를 만드는 일이라 디자인 재능이 필요해요."],
  ["영상", /영상|릴스|숏폼|유튜브|동영상/, ["홍보 영상 1편 (MP4)", "자막을 넣은 SNS용 버전"], "촬영과 편집이 필요한 일이라 영상 재능이 맞아요."],
  ["사진", /사진|촬영/, ["보정한 메뉴·매장 사진 10장", "원본 사진 파일"], "가게와 메뉴를 보기 좋게 찍는 일이라 사진 재능이 맞아요."],
  ["SNS홍보", /인스타|SNS|블로그|홍보|리뷰/, ["SNS 게시물 4개 기획안", "게시용 이미지 4장"], "게시물 기획과 운영이 필요한 일이라 SNS 홍보 재능이 맞아요."],
  ["웹/앱", /웹|홈페이지|앱|QR|예약|주문|사이트/, ["휴대폰에서 열리는 웹페이지 1개", "QR 코드와 사용 안내"], "무언가를 직접 만드는 개발 작업이라 웹/앱 재능이 필요해요."],
  ["디지털도움", /키오스크|스마트폰|어르신|사용법|배달앱/, ["1:1 사용법 안내 2회", "한 장짜리 사용 안내문"], "기기 사용을 알려 드리는 일이라 디지털 도움 재능이 맞아요."],
];
const DEPARTMENTS: Record<Category, string[]> = {
  "디자인": ["시각디자인학과", "미디어커뮤니케이션학부"], "영상": ["미디어커뮤니케이션학부"], "사진": ["미디어커뮤니케이션학부", "전공 무관"],
  "SNS홍보": ["경영학부", "미디어커뮤니케이션학부"], "웹/앱": ["소프트웨어학부", "컴퓨터정보공학부"], "디지털도움": ["전공 무관"], "기타": ["전공 무관"],
} as Record<Category, string[]>;

/** 체험의 기본 요청 문장(미용실)에 맞춘 답 */
const SALON: Omit<PostDraft, "reasons"> & { reasons: string[] } = {
  title: "월계 미용실 시술 안내 포스터",
  category: "디자인",
  description: "새로운 시술과 가격 안내가 매장 안에서 잘 보이지 않아 손님들이 커트·염색 가격을 자주 물어보세요. 시술명·가격 목록과 매장 사진은 제가 드릴게요. 매장에 붙일 A3 안내 포스터 한 장과 인스타그램용 정사각 이미지 한 장을 부탁드립니다. 완성된 PDF와 수정 가능한 원본 파일도 함께 받고 싶어요.",
  deliverables: ["A3 매장 부착용 포스터 PDF 1종", "SNS용 정사각 이미지 1종", "수정 가능한 원본 파일"],
  departments: ["시각디자인학과", "미디어커뮤니케이션학부"],
  durationDays: 7, difficulty: 2, isTeam: false,
  reward: "커트 1회 이용권 · 유효기간 3개월",
  reasons: ["포스터와 SNS 이미지를 만드는 일이라 디자인 재능이 필요해요.", "시술명과 가격을 보기 좋게 정리하는 일이 핵심이라 시각디자인 전공이 잘 맞아요."],
};

const sentences = (text: string) => text.split(/(?<=[.!?。]|요\.|요)\s+/).map((s) => s.trim()).filter(Boolean);

/** 공고 초안: 미용실 예시면 준비된 답, 아니면 글의 낱말로 분야를 골라 간단히 채운다 */
export function cannedPostDraft(text: string): PostDraft {
  const base = /미용실|헤어|커트|염색/.test(text) && /포스터|안내/.test(text) ? SALON : null;
  if (base) return { ...base, reasons: [...base.reasons, CANNED_NOTE] };
  const hit = KEYWORDS.find(([, re]) => re.test(text));
  const category: Category = hit?.[0] ?? "기타";
  const first = sentences(text)[0] ?? text;
  const title = first.length > 28 ? `${first.slice(0, 26).trim()}…` : first;
  const reward = sentences(text).find((s) => /쿠폰|이용권|무료|서비스/.test(s)) ?? "";
  return {
    title: title || "가게 일을 도와주세요", category, description: text.trim(),
    deliverables: hit?.[2] ?? ["합의한 결과물 1종"], departments: DEPARTMENTS[category] ?? ["전공 무관"],
    durationDays: 7, difficulty: 2, isTeam: false, reward,
    reasons: [hit?.[3] ?? "글에 맞는 재능을 학생과 채팅으로 함께 정해요.", CANNED_NOTE],
  };
}

/** 계약서 요약: 공고에 이미 적힌 결과물·완료 기준·보상을 항목에 맞춰 넣는다 */
export function cannedAgreement(text: string, post?: Pick<Post, "title" | "description" | "reward" | "expectedDeliverables" | "completionCriteria" | "compensationDescription">): AgreementDraft {
  const deliverables = post?.expectedDeliverables?.length ? post.expectedDeliverables.join("\n") : cannedPostDraft(text).deliverables.join("\n");
  const coupon = post?.compensationDescription || post?.reward || sentences(text).find((s) => /쿠폰|이용권|사례비|원/.test(s)) || "";
  return {
    summary: `‘${post?.title ?? "요청하신 작업"}’ 작업을 범위·결과물·완료 기준으로 나눠 정리했어요.`,
    scope: post ? `${post.title}. ${post.description}` : text.trim(),
    deliverables,
    acceptance: post?.completionCriteria || "의뢰인이 결과물을 확인하고 원본 파일을 전달받으면 완료합니다.",
    coupon: coupon ? `${coupon} · 결과물 확인 후 3일 이내 제공` : "",
    handoff: "완성 파일과 수정 가능한 원본을 채팅으로 전달하고, 사용 방법을 안내합니다.",
    source: "DEMO",
    model: "체험용 예시",
  };
}
