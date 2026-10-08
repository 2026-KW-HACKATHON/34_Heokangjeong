// 데모 모드 전용: 김하늘(s1)의 완료된 프로젝트 5개 + 피드 공개 게시물.
// 실제 앱과 같은 엔진 함수(지원 → 선정 → 기록 → 제출 → 승인·평가)로 만들어 같은 규칙을 통과한다.
// HTML 포트폴리오(편집본)는 '한식당 메뉴판' 1개만 만든다 → 그 게시물에만 "자세한 포트폴리오 보기" 버튼이 붙는다.
// 실제 수행 기록이 아닌 화면 확인용 예시다 (실제 DB 모드에서는 쓰지 않는다).
import * as wf from "../workflow/engine";
import { DOMAINS } from "@shared/portfolio/domains";
import type { Category, ChatMessage, DomainKey, EvidenceType, PortfolioContent, Post, PublishedPortfolio } from "@/types";
import type { WorkAgreement } from "../agreement";

export const DEMO_STUDENT = "s1";
const AT = "2026-09-";   // 공고 날짜

interface Spec {
  key: "menu" | "real2sim" | "driving" | "banner" | "cafe" | "class";
  title: string; category: Category; clientId: string; address: string; reward: string;
  problem: string; deliverables: string[]; criteria: string;
  answers: Record<string, string | string[]>;          // 질문 id → 글 또는 선택지
  evidence: { type: EvidenceType; description: string; noImage?: boolean }[];   // noImage: 맞는 샘플 사진이 없어 설명만 남긴다
  review: { satisfaction: number; deadline: number; communication: number; handoff: number; deliverableQuality: number; comment: string };
  card: { summary: string; intro: string; problem: string; solution: string; result: string; insight: string };
  /** 피드 게시물 이름·분류: 예전 샘플 카드와 같게 둔다 (팀원 화면 테스트·피드 모습 유지). 공고·포트폴리오 제목은 title */
  feed: { title: string; category: string };
  portfolio?: PortfolioContent;                          // HTML 포트폴리오 (메뉴판만)
  day: number;                                           // 9월 며칠에 시작했는지 (완료 순서용)
  /** 진행 중 데모: 제출·승인 없이 멈춘다. 약속서 확정 + 그 뒤 대화가 있어 '진행 중' 단계로 보인다 */
  inProgress?: { notes: string[]; chat: { from: "student" | "client"; body: string }[] };
}

const SPECS: Spec[] = [
  {
    key: "menu", feed: { title: "한식당 메뉴판 디자인", category: "디자인" }, title: "외국인 손님을 위한 한식당 영문 메뉴판", category: "디자인", clientId: "r2", address: "월계1동 광운로 21", reward: "식사 쿠폰 5장",
    problem: "메뉴판이 한글로만 되어 있어 외국인 손님이 주문할 때마다 번역기로 설명해야 해요", deliverables: ["A4 영문 메뉴판 인쇄용 PDF", "Figma 원본"], criteria: "외국인 손님이 묻지 않고 메뉴를 고를 수 있는 메뉴판",
    answers: {
      d_target: ["매장 방문 손님", "근처 대학 외국인 교환학생"],
      d_problem: "메뉴 24개가 한글 이름과 가격만 적혀 있어, 외국인 손님이 올 때마다 점주님이 번역기로 하나씩 설명하셨어요. 점심시간에 지켜보니 외국인 손님 5팀 중 4팀이 번역기를 썼어요.",
      d_before: "흑백 A4 메뉴판 한 장, 한글 메뉴 24개, 사진 없음",
      d_constraints: ["정해진 크기", "인쇄 예산"],
      d_goal: "한식을 처음 보는 손님도 점주님께 묻지 않고 메뉴를 고르게 하기",
      d_role: ["기획", "시안 디자인", "최종 디자인"],
      d_reference: "근처 한식당·카페 메뉴판 5곳을 사진으로 모아 메뉴 수와 설명 방식을 비교했어요",
      d_decision: "메뉴를 주요리 6개·디저트 4개 두 구역으로 줄이고, 메뉴 이름 아래에 재료와 맵기를 한 줄로 적었어요",
      d_rationale: "외국인 손님 질문이 대부분 '무엇이 들어가나요?'와 '맵나요?'여서, 그 두 정보를 이름 바로 아래에 두었어요",
      d_alternatives: "QR 메뉴판도 생각했지만 점주님이 휴대폰 화면보다 종이를 편해하셔서 종이 메뉴판으로 정했어요",
      d_process: "손스케치로 정보 구조 잡기 → Figma 시안 2종(사진형·일러스트형) → 점주님과 일러스트형 선택 → 맵기 표시 추가 → 최종본",
      d_validation: ["시안·시제품 시험 사용", "출력본을 테이블에 두고 외국인 손님 3팀이 고르는 모습을 지켜봤는데, 2팀이 묻지 않고 주문했어요"],
      d_deliverable: "A4 인쇄용 PDF 1종 + Figma 원본 파일",
      d_after: "메뉴가 24개에서 10개로 줄고, 대표 메뉴 3개가 일러스트로 먼저 보여요",
      d_feedback: "'매운 메뉴를 한눈에 알았으면 좋겠다'는 요청을 받고, 메뉴 이름 옆에 고추 아이콘으로 맵기를 표시했어요",
      d_tools: ["Figma", "Procreate"],
      d_usage: ["매장에 실제 게시됨"],
      d_reflection: "처음엔 번역이 핵심이라고 생각했는데, 손님에게 필요한 건 음식을 떠올릴 단서였어요. 다음엔 시안 전에 사용자에게 먼저 물어보겠어요",
    },
    evidence: [
      { type: "BEFORE_IMAGE", description: "작업 전: 흑백 A4 한 장에 한글 메뉴 24개와 가격만 적힌 메뉴판", noImage: true },
      { type: "DELIVERABLE_FILE", description: "최종 영문 메뉴판 (A4 인쇄용)" },
      { type: "USAGE_PROOF", description: "코팅해서 테이블 10곳에 비치 (의뢰인 확인)", noImage: true },
    ],
    review: { satisfaction: 5, deadline: 5, communication: 4, handoff: 5, deliverableQuality: 5, comment: "이제 외국인 손님이 메뉴판만 보고 바로 주문해요. 번역기 꺼낼 일이 거의 없어졌어요." },
    card: {
      summary: "번역기 없이 고를 수 있는 A4 영문 메뉴판",
      intro: "광운대 앞 한식당의 외국인 손님을 위해 A4 한 장짜리 영문 메뉴판을 만들었습니다.",
      problem: "메뉴판이 한글로만 되어 있어 외국인 손님이 주문할 때마다 점주님이 번역기로 설명해야 했습니다.",
      solution: "메뉴를 두 구역으로 줄이고, 이름 아래에 재료와 맵기를 한 줄로 적고, 대표 메뉴 3개를 일러스트로 보여 줬습니다.",
      result: "코팅해서 테이블 10곳에 놓였고, 의뢰인이 실제 사용을 확인했습니다.",
      insight: "번역보다 음식을 떠올릴 단서가 더 중요하다는 걸 배웠습니다.",
    },
    day: 15,
  },
  {
    key: "real2sim", feed: { title: "Real2Sim & Sim2Real", category: "웹/앱" }, title: "Real2Sim & Sim2Real 연구 소개 웹페이지", category: "웹/앱", clientId: "r3", address: "석계로 7", reward: "도서 상품권",
    problem: "책방 과학 강연에서 소개할 시뮬레이션 연구를 한눈에 보여 줄 페이지가 없어요", deliverables: ["연구 소개 웹페이지", "강연용 QR 코드"], criteria: "휴대폰으로 QR 을 찍어 바로 볼 수 있는 페이지",
    answers: {
      v_problem: "강연에 온 주민들이 '시뮬레이션과 실제가 왜 다른지'를 말로만 들어서는 이해하기 어렵다고 책방 사장님이 말씀하셨어요",
      v_requirements: "휴대폰에서 바로 열림, 실제·시뮬레이션 비교 이미지, 한 화면 요약",
      v_goal: "강연 중 QR 로 접속해 비교 화면을 직접 보게 하기",
      v_role: ["기획", "프론트엔드", "배포·운영"],
      v_features: "연구 요약, 실제·시뮬레이션 비교 이미지, 강연 자료 링크",
      v_tech: "책방 사장님이 글을 직접 고칠 수 있게 정적 페이지 + 마크다운으로 만들었어요",
      v_alternatives: "블로그 글도 생각했지만 광고가 섞여서 직접 페이지를 만들었어요",
      v_implementation: "이미지가 많아 휴대폰에서 느려지지 않게 크기를 줄이고 순서대로 불러오게 했어요",
      v_testing: ["여러 기기에서 확인"],
      v_delivery: "GitHub Pages 배포 + 강연용 QR 코드 인쇄본",
      v_tools: ["HTML/CSS", "GitHub Pages"],
      v_usage: ["매장에서 사용 중"],
      v_result: "강연 두 번에서 참가자들이 QR 로 비교 화면을 직접 열어 봤어요",
      v_reflection: "전문 용어를 줄이는 데 시간이 가장 많이 들었어요. 다음엔 처음부터 주민 눈높이 문장으로 쓰겠어요",
    },
    evidence: [{ type: "DELIVERABLE_URL", description: "연구 소개 웹페이지" }],
    review: { satisfaction: 5, deadline: 4, communication: 5, handoff: 4, deliverableQuality: 5, comment: "강연 때 다들 휴대폰으로 직접 보면서 질문이 많아졌어요." },
    card: {
      summary: "물리 시뮬레이션 연구를 주민 눈높이로 소개한 웹페이지",
      intro: "서로 다른 물리 시스템의 동작을 비교하는 연구를 강연용 웹페이지로 정리했습니다.",
      problem: "강연에서 시뮬레이션과 실제의 차이를 말로만 설명하기 어려웠습니다.",
      solution: "실제·시뮬레이션 비교 이미지를 중심으로 한 화면 요약 페이지를 만들고 QR 로 열게 했습니다.",
      result: "강연 두 번에서 참가자들이 QR 로 페이지를 직접 열어 봤습니다.",
      insight: "전문 용어를 줄이는 것이 가장 큰 일이었습니다.",
    },
    day: 1,
  },
  {
    key: "driving", feed: { title: "Path2ST 주행 시뮬레이터", category: "웹/앱" }, title: "Path2ST 주행 시뮬레이터 체험 페이지", category: "웹/앱", clientId: "r4", address: "월계1동 주민센터 인근", reward: "감사 인사",
    problem: "주민센터 어린이 과학교실에서 자율주행을 직접 만져 볼 거리가 필요해요", deliverables: ["주행 시뮬레이터 웹 데모"], criteria: "아이들이 경로를 바꿔 보며 차가 따라가는 모습을 볼 수 있음",
    answers: {
      v_problem: "과학교실 아이들이 자율주행을 영상으로만 봐서 금방 지루해한다고 정순자 님이 말씀하셨어요",
      v_requirements: "경로 그리기, 차량이 따라가는 모습, 속도 바꾸기",
      v_goal: "아이들이 직접 경로를 바꿔 보며 차가 따라가는 원리를 느끼게 하기",
      v_role: ["기획", "프론트엔드"],
      v_features: "경로 그리기, 차량 따라가기 애니메이션, 속도 조절 버튼",
      v_tech: "설치 없이 교실 태블릿 브라우저에서 바로 열리도록 웹으로 만들었어요",
      v_alternatives: "게임 엔진도 생각했지만 태블릿에 설치가 어려워 웹으로 만들었어요",
      v_implementation: "아이들이 손가락으로 그리기 쉽게 선을 굵게 하고, 잘못 그려도 한 번에 지우게 했어요",
      v_testing: ["손님 대상 시범 운영"],
      v_delivery: "웹 주소 + 교실 태블릿 바로가기",
      v_tools: ["JavaScript", "HTML/CSS"],
      v_usage: ["매장에서 사용 중"],
      v_result: "과학교실 두 반이 수업 시간에 사용했어요",
      v_reflection: "아이들은 설명보다 직접 실패해 보는 걸 좋아했어요. 다음엔 '일부러 틀려 보기' 단계를 넣겠어요",
    },
    evidence: [{ type: "DELIVERABLE_URL", description: "주행 시뮬레이터 웹 데모" }],
    review: { satisfaction: 5, deadline: 5, communication: 5, handoff: 4, deliverableQuality: 4, comment: "아이들이 서로 경로를 그려 보겠다고 줄을 섰어요." },
    card: {
      summary: "아이들이 경로를 그리면 차가 따라가는 주행 시뮬레이터",
      intro: "경로를 따라 움직이는 차량과 주행 조건을 조작하는 웹 데모를 과학교실용으로 만들었습니다.",
      problem: "아이들이 자율주행을 영상으로만 봐서 금방 지루해했습니다.",
      solution: "손가락으로 경로를 그리면 차가 따라가고, 속도를 바꿔 볼 수 있게 만들었습니다.",
      result: "과학교실 두 반이 수업 시간에 사용했습니다.",
      insight: "아이들은 설명보다 직접 실패해 보는 걸 좋아했습니다.",
    },
    day: 5,
  },
  {
    key: "banner", feed: { title: "가게 홍보 배너", category: "디자인" }, title: "미용실 가게 홍보 배너", category: "디자인", clientId: "r7", address: "월계로 53길 4", reward: "커트 쿠폰 2장",
    problem: "가게 앞을 지나가는 사람들이 미용실인지 잘 모르고 지나쳐요", deliverables: ["가로형 배너 인쇄 파일"], criteria: "멀리서도 업종과 가격대가 보이는 배너",
    answers: {
      d_target: ["매장 방문 손님"],
      d_problem: "원장님 말씀으로는 간판이 작아서 새로 온 손님들이 '여기 미용실이었어요?'라고 자주 물어보신대요",
      d_goal: "길에서 10m 떨어져서도 업종과 대표 가격이 보이게 하기",
      d_role: ["시안 디자인", "최종 디자인"],
      d_decision: "업종 이름을 가장 크게, 대표 시술 3개와 가격만 남기고 나머지는 뺐어요",
      d_rationale: "지나가는 사람은 2~3초만 보기 때문에 정보 수를 줄였어요",
      d_deliverable: "가로형 배너 인쇄용 PDF 1종",
      d_tools: ["Illustrator"],
      d_usage: ["매장에 실제 게시됨"],
    },
    evidence: [{ type: "DELIVERABLE_FILE", description: "가로형 배너 목업" }],
    review: { satisfaction: 4, deadline: 5, communication: 4, handoff: 5, deliverableQuality: 4, comment: "배너 보고 들어왔다는 손님이 생겼어요." },
    card: {
      summary: "멀리서도 업종과 가격이 보이는 가로형 배너",
      intro: "미용실 앞에 걸 가로형 배너를 디자인하고 실제 설치 형태로 확인했습니다.",
      problem: "간판이 작아 지나가는 사람들이 미용실인지 모르고 지나쳤습니다.",
      solution: "업종 이름을 가장 크게 두고 대표 시술 3개와 가격만 남겼습니다.",
      result: "가게 앞에 실제로 걸렸습니다.",
      insight: "지나가는 사람에게는 정보를 줄이는 것이 가장 큰 디자인이었습니다.",
    },
    day: 8,
  },
  {
    key: "cafe", feed: { title: "오늘, 여기서 쉬어가요", category: "SNS 콘텐츠" }, title: "오늘, 여기서 쉬어가요 — 카페 SNS 콘텐츠", category: "SNS홍보", clientId: "r1", address: "월계로 45길 12", reward: "음료 쿠폰 10장",
    problem: "오후 시간대에 손님이 적어 쉬어 가기 좋은 공간이라는 걸 알리고 싶어요", deliverables: ["세로형 홍보 이미지 3장"], criteria: "인스타그램 스토리에 바로 올릴 수 있는 이미지",
    answers: {
      m_problem: "사장님 말씀으로는 오전엔 바쁜데 오후 2~4시에는 자리가 비어 있대요",
      m_audience: ["대학생", "직장인"],
      m_baseline: ["기록 없음"],
      m_goal: "오후에 쉬어 가기 좋은 카페라는 분위기 전하기",
      m_role: ["콘텐츠 제작"],
      m_strategy: "음료보다 창가 자리와 햇빛이 보이는 사진을 앞에 두었어요. 오후 손님이 찾는 건 쉴 자리라고 판단했어요",
      m_alternatives: "할인 이벤트도 생각했지만 사장님이 가격보다 공간을 알리고 싶어 하셔서 분위기 사진으로 정했어요",
      m_channel: ["인스타그램"],
      m_execution: "오후 햇빛 시간에 촬영 → 세로형 이미지 3장 → 문구 '오늘, 여기서 쉬어가요'",
      m_deliverable: "세로형 홍보 이미지 3장",
      m_result: ["아직 측정하지 않음"],
      m_tools: ["Canva"],
    },
    evidence: [{ type: "DELIVERABLE_FILE", description: "세로형 홍보 이미지" }],
    review: { satisfaction: 5, deadline: 4, communication: 5, handoff: 5, deliverableQuality: 5, comment: "사진 분위기가 저희 가게랑 딱 맞아요." },
    card: {
      summary: "오후의 빈자리를 '쉬어 가는 공간'으로 알린 세로형 이미지",
      intro: "음료와 공간의 분위기를 담은 세로형 홍보 이미지를 만들었습니다.",
      problem: "오후 2~4시에 자리가 비어 있었습니다.",
      solution: "음료보다 창가 자리와 햇빛이 보이는 사진을 앞에 둔 이미지 3장을 만들었습니다.",
      result: "인스타그램 스토리에 올라갔습니다. 손님 수 변화는 아직 측정하지 않았습니다.",
      insight: "가격보다 공간을 알리고 싶다는 의뢰인의 말이 방향을 정했습니다.",
    },
    day: 10,
  },
  {
    key: "class", feed: { title: "공방 클래스 안내 카드", category: "디자인" }, title: "꽃길 공방 원데이 클래스 안내 카드", category: "디자인", clientId: "r6", address: "광운로 12길 8", reward: "원데이 클래스 1회",
    problem: "클래스 종류와 준비물을 손님마다 말로 설명하느라 예약 상담이 길어져요", deliverables: ["A5 안내 카드 인쇄 파일", "인스타그램용 이미지 1장"], criteria: "손님이 카드만 보고 클래스를 골라 예약할 수 있음",
    answers: {
      d_target: ["매장 방문 손님", "온라인으로 보는 고객"],
      d_problem: "사장님 말씀으로는 손님 대부분이 '무슨 클래스가 있어요?', '뭘 가져가요?'를 전화로 물어봐서 상담이 한 번에 10분씩 걸린대요",
      d_before: "손글씨 메모 한 장에 클래스 4개와 가격만 적혀 있음",
      d_constraints: ["정해진 크기", "기존 브랜드 색 유지"],
      d_goal: "손님이 카드만 보고 클래스와 준비물을 알고 예약하게 하기",
      d_role: ["기획", "시안 디자인", "최종 디자인"],
      d_reference: "근처 공방 3곳의 클래스 안내 카드를 사진으로 모아 정보 순서를 비교했어요",
    },
    evidence: [{ type: "BEFORE_IMAGE", description: "작업 전: 손글씨 메모 한 장에 클래스 4개와 가격만 적힌 안내", noImage: true }],
    review: { satisfaction: 5, deadline: 5, communication: 5, handoff: 5, deliverableQuality: 5, comment: "" },
    card: { summary: "", intro: "", problem: "", solution: "", result: "", insight: "" },
    day: 28,
    inProgress: {
      notes: ["사장님과 통화: 클래스 4개 중 '꽃바구니'와 '리스' 문의가 가장 많다고 하심 → 카드 맨 위에 두기로"],
      chat: [
        { from: "client", body: "약속서 확인했어요. 시안은 언제쯤 볼 수 있을까요?" },
        { from: "student", body: "이번 주 금요일까지 두 가지 버전으로 보내 드릴게요!" },
        { from: "client", body: "좋아요. 리스 클래스 사진은 오늘 보내 드릴게요." },
      ],
    },
  },
];

const MENU_PORTFOLIO: PortfolioContent = {
  title: "외국인 손님을 위한 한식당 영문 메뉴판",
  summary: "번역기 없이도 고를 수 있도록, 한글 메뉴 24개를 재료와 맵기가 보이는 A4 영문 메뉴판 한 장으로 다시 설계했습니다.",
  sections: [
    { key: "overview", title: "개요", body: "광운대 앞 분식집의 외국인 손님을 위해 테이블에 놓을 A4 영문 메뉴판을 만들었습니다. 목표는 한식을 처음 보는 손님도 점주님께 묻지 않고 메뉴를 고르게 하는 것이었습니다.", evidenceIds: [] },
    { key: "problem", title: "문제", body: "메뉴 24개가 한글 이름과 가격만 적혀 있어, 외국인 손님이 올 때마다 점주님이 번역기로 하나씩 설명하셨습니다. 점심시간에 지켜보니 외국인 손님 5팀 중 4팀이 번역기를 썼습니다.", evidenceIds: [] },
    { key: "decisions", title: "디자인 결정", body: "외국인 손님의 질문이 대부분 '무엇이 들어가나요?'와 '맵나요?'였기 때문에, 메뉴를 주요리 6개·디저트 4개 두 구역으로 줄이고 이름 바로 아래에 재료와 맵기를 한 줄로 적었습니다. QR 메뉴판도 고려했지만 점주님이 종이를 편해하셔서 종이 메뉴판으로 정했습니다.", evidenceIds: [] },
    { key: "process", title: "과정", body: "손스케치로 정보 구조를 잡고 Figma 로 사진형·일러스트형 시안 두 가지를 만들어 점주님과 일러스트형을 골랐습니다. 출력본을 테이블에 두고 외국인 손님 3팀이 고르는 모습을 지켜봤고, 1차 제출 뒤 '매운 메뉴를 한눈에 알았으면 좋겠다'는 요청을 받아 맵기 표시를 더했습니다.", evidenceIds: [] },
    { key: "beforeAfter", title: "작업 전·후", body: "흑백 A4 한 장에 한글 메뉴 24개만 있던 메뉴판이, 10개 메뉴와 대표 메뉴 3개의 일러스트가 먼저 보이는 메뉴판으로 바뀌었습니다.", evidenceIds: [] },
    { key: "deliverable", title: "최종 결과물", body: "인쇄소에 바로 넘길 수 있는 A4 인쇄용 PDF 와 Figma 원본 파일을 전달했습니다.", evidenceIds: [] },
    { key: "usage", title: "실제 사용", body: "메뉴판은 코팅해서 테이블에 놓였고, 의뢰인이 실제로 사용되고 있음을 확인했습니다.", evidenceIds: [] },
    { key: "reflection", title: "회고", body: "처음에는 번역이 핵심이라고 생각했지만, 손님에게 필요한 것은 음식을 떠올릴 단서였습니다. 다음 프로젝트에서는 시안을 만들기 전에 실제 사용자에게 먼저 묻겠습니다.", evidenceIds: [] },
  ],
  skills: ["정보 구조 설계", "편집 디자인", "사용자 관찰"],
  tools: [{ name: "Figma", why: "점주님과 시안 두 가지를 나란히 보며 고르기 위해" }, { name: "Procreate", why: "대표 메뉴 일러스트를 직접 그리기 위해" }],
  templateId: "editorial",
};
SPECS[0].portfolio = MENU_PORTFOLIO;

const COVER = (key: Spec["key"]) => `/portfolio-samples/${key}.png`;
const postId = (key: Spec["key"]) => `demo-post-${key}`;

/** 데모 내용을 바꾸면 올린다 → 이미 넣어 둔 브라우저도 데모 프로젝트만 새로 만든다 */
const SEED_VERSION = 4;   // 3: 진행 중 데모 추가 · 4: 선정(매칭 대기) 시각 — 약속서 확정 = 선정 확정 규칙
const isDemo = (v: unknown) => typeof v === "string" && v.startsWith("demo-");

/**
 * 이미 같은 버전을 넣었으면 아무것도 하지 않는다 (기존 브라우저 저장소에도 안전하게 추가).
 * 버전이 다르면 데모 프로젝트에서 나온 것(id 가 demo- 로 시작)만 지우고 다시 넣는다. 사용자가 만든 데이터는 건드리지 않는다.
 */
export function seedDemoProjects(db: wf.WorkflowDB): boolean {
  const marker = db as wf.WorkflowDB & { demoSeedVersion?: number };
  const seeded = db.posts.some((p) => p.id === postId("menu"));
  if (seeded && marker.demoSeedVersion === SEED_VERSION) return false;
  if (seeded) {
    for (const [k, v] of Object.entries(db)) {
      if (!Array.isArray(v)) continue;
      (db as unknown as Record<string, unknown[]>)[k] = v.filter((row) => {
        const r = row as Record<string, unknown>;
        return !(isDemo(r.id) || isDemo(r.projectId) || isDemo(r.postId));
      });
    }
  }
  for (const s of SPECS) seedOne(db, s);
  marker.demoSeedVersion = SEED_VERSION;
  return true;
}

function seedOne(db: wf.WorkflowDB, s: Spec) {
  let n = 0, step = 0;
  const day = (d: number) => `${AT}${String(d).padStart(2, "0")}`;
  // 시작일부터 한 단계마다 2시간씩 흐른다 (지원 → … → 승인이 며칠에 걸쳐 보이게)
  const ctx: wf.Ctx = { id: () => `demo-${s.key}-${++n}`, now: () => new Date(Date.UTC(2026, 8, s.day, 1 + 2 * step++)).toISOString() };
  const client = db.users.find((u) => u.id === s.clientId)!;
  const post: Post = {
    id: postId(s.key), title: s.title, category: s.category, description: s.problem, authorId: s.clientId,
    location: client.role === "resident" ? client.location : { lat: 37.6255, lng: 127.0605 }, address: s.address, status: "open",
    reward: s.reward, durationDays: 14, difficulty: 2, isTeam: false, createdAt: `${day(s.day)}T00:00:00Z`,
    problem: s.problem, expectedDeliverables: s.deliverables, completionCriteria: s.criteria,
  };
  db.posts.push(post);
  const app = wf.apply(db, { postId: post.id, studentId: DEMO_STUDENT, message: "이 작업 꼭 해 보고 싶어요." }, ctx);
  app.shortlistedAt = app.createdAt;   // 사장님 선정 → 대화·약속서 → 확정 (약속서는 demoAgreementsAndChats 가 넣는다)
  const project = wf.selectApplicant(db, { applicationId: app.id, actorId: s.clientId }, ctx);
  const qs = DOMAINS[project.domain as DomainKey].questions;
  for (const [qid, a] of Object.entries(s.answers)) {
    const q = qs.find((x) => x.id === qid);
    if (!q) continue;
    const opts = q.input.options ?? [];
    const list = Array.isArray(a) ? a : [];
    const choices = list.filter((x) => opts.includes(x));
    const value = Array.isArray(a) ? list.filter((x) => !opts.includes(x)).join(", ") : a;
    wf.saveAnswer(db, { projectId: project.id, actorId: DEMO_STUDENT, questionId: qid, status: "ANSWERED", value, choices }, ctx);
  }
  // 엔진은 http(s)·업로드 파일만 받으므로 설명으로 등록한 뒤, 앱에 들어 있는 샘플 이미지(public/portfolio-samples)를 붙인다 (데모 전용)
  const ev = s.evidence.map((e) => {
    const added = wf.addEvidence(db, { projectId: project.id, actorId: DEMO_STUDENT, type: e.type, description: e.description }, ctx);
    return e.noImage ? added : Object.assign(added, { url: COVER(s.key), fileName: `${s.key}.png`, mimeType: "image/png", source: "STUDENT_UPLOAD" as const });
  });
  const deliverables = ev.filter((e) => e.type !== "BEFORE_IMAGE").map((e) => e.id);
  if (s.inProgress) {
    for (const note of s.inProgress.notes) wf.addLog(db, { projectId: project.id, actorId: DEMO_STUDENT, stage: "PROGRESS", note }, ctx);
    return;
  }
  const v = wf.submitVersion(db, { projectId: project.id, actorId: DEMO_STUDENT, note: "최종본입니다", evidenceIds: deliverables }, ctx);
  wf.approveVersion(db, { versionId: v.id, actorId: s.clientId, claims: { workPerformed: true, roleConfirmed: true, deliverableReceived: true, completionCriteriaMet: true, actuallyUsed: true }, review: s.review }, ctx);
  if (!s.portfolio) return;
  const snap = wf.createSnapshot(db, { projectId: project.id, actorId: DEMO_STUDENT }, ctx);
  const draftId = wf.addDraft(db, { snapshotId: snap.id, actorId: DEMO_STUDENT, generator: "TEMPLATE", content: s.portfolio }, ctx).draft.id;
  const proof = ev.filter((e) => e.type !== "DELIVERABLE_FILE");
  const content: PortfolioContent = {
    ...s.portfolio,
    // 증빙을 해당 섹션에 붙인다 (Before → 작업 전·후, 사용 증빙 → 실제 사용, 결과물 → 최종 결과물)
    sections: s.portfolio.sections.map((x) => ({ ...x, evidenceIds:
      x.key === "beforeAfter" ? proof.filter((e) => e.type === "BEFORE_IMAGE").map((e) => e.id)
      : x.key === "usage" ? proof.filter((e) => e.type === "USAGE_PROOF").map((e) => e.id)
      : x.key === "deliverable" ? ev.filter((e) => e.type === "DELIVERABLE_FILE").map((e) => e.id) : [] })),
  };
  wf.saveEdit(db, { draftId, actorId: DEMO_STUDENT, content }, ctx);
}

/** 피드 게시물 (간단한 앱 화면용 글). 프로젝트에 연결돼 있어 HTML 포트폴리오가 있으면 버튼으로 이어진다 */
export function demoProjectPublications(db: wf.WorkflowDB, studentId: string): PublishedPortfolio[] {
  if (studentId !== DEMO_STUDENT) return [];
  return SPECS.filter((s) => !s.inProgress).map((s) => {
    const project = db.projects.find((p) => p.postId === postId(s.key));
    if (!project) return undefined;
    return {
      studentId, sourceId: project.id, sourceKind: "project" as const, title: s.feed.title, category: s.feed.category, summary: s.card.summary,
      coverUrl: COVER(s.key), publishedAt: project.completedAt ?? project.createdAt, visible: true,
      sections: [
        { title: "경험 소개", body: s.card.intro }, { title: "문제 정의", body: s.card.problem }, { title: "해결 방법", body: s.card.solution },
        { title: "작성할 내용", body: s.card.result }, { title: "인사이트", body: s.card.insight },
      ],
    };
  }).filter((x): x is NonNullable<typeof x> => !!x);
}

/**
 * 진행 중 데모의 약속서·대화 (채팅 저장소가 프로젝트 DB 와 따로라 mock 이 넣는다).
 * 약속서는 양쪽 확인으로 확정, 대화는 확정 뒤 → 채팅·기록 탭에서 '진행 중'으로 보인다.
 */
export function demoInProgressChats(db: wf.WorkflowDB): { agreements: WorkAgreement[]; messages: ChatMessage[] } {
  const agreements: WorkAgreement[] = [], messages: ChatMessage[] = [];
  for (const s of SPECS.filter((x) => x.inProgress)) {
    const app = db.applications.find((a) => a.postId === postId(s.key) && a.studentId === DEMO_STUDENT);
    if (!app) continue;
    const at = (h: number) => new Date(Date.UTC(2026, 8, s.day + 1, h)).toISOString();
    agreements.push({
      applicationId: app.id, version: 1,
      terms: { startDate: "2026-09-29", endDate: "2026-10-12", scope: "클래스 안내 카드 기획·디자인", deliverables: s.deliverables.join(", "), acceptance: s.criteria,
        coupon: s.reward, revisions: 2, exclusions: "인쇄 비용", handoff: "인쇄용 PDF 와 원본 파일 전달" },
      studentConfirmedAt: at(9), ownerConfirmedAt: at(10), finalizedAt: at(10), updatedAt: at(10),
    });
    s.inProgress!.chat.forEach((m, i) => messages.push({ id: `demo-${s.key}-msg-${i + 1}`, applicationId: app.id, senderId: m.from === "student" ? DEMO_STUDENT : s.clientId, body: m.body, createdAt: at(11 + i) }));
  }
  return { agreements, messages };
}
