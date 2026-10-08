import { pageFromBundle, type PortfolioPage } from "../portfolio/page";
import type {
  Application, ChatMessage, ClientReview, Club, HandoverDoc, MaintenanceTicket, Notification, Post, PortfolioCard, PortfolioDoc, Review, TierScoreEvent, User,
} from "@/types";
import type { Repo } from "./index";
import { distanceM } from "../geo";
import { guessCollege } from "../colleges";
import * as wf from "../workflow/engine";
import { templateDraft } from "@shared/portfolio/narrative";
import { summarizeTrust } from "../trust";
import { fileToDataUrl } from "../files";
import { domainForCategory } from "@shared/portfolio/domains";
import type { PublishedPortfolio } from "@/types";
import { nicknameProblem } from "../nickname";
import { demoInProgressChats, demoProjectPublications, seedDemoProjects } from "../portfolio/demoProjects";
import { publicationFromSource } from "../portfolio/publication";
import { assertArchiveCapacity, feedCollection, withFeedCollection } from "../portfolio/collection";
import { reviseAgreement, confirmAgreement, type WorkAgreement, proposeAgreementChange, respondAgreementChange } from "../agreement";

// ── 시드 데이터 (월계1동 근방 좌표) ──────────────────────────────────────────
export const users: User[] = [
  { id: "s1", role: "student", name: "김하늘", nickname: "하늘그림", department: "디자인학과", skills: ["포스터", "일러스트", "Figma"], interests: ["디자인", "SNS홍보"], availableHours: "평일 저녁, 주말", maxDistanceM: 1500, location: { lat: 37.6196, lng: 127.0592 }, school: "광운대학교", age: 22, phone: "010-0000-1001" },
  { id: "s2", role: "student", name: "박도윤", nickname: "도윤코딩", department: "소프트웨어학부", skills: ["React", "웹페이지", "QR"], interests: ["웹/앱", "디지털도움"], availableHours: "주말", maxDistanceM: 2000, location: { lat: 37.6210, lng: 127.0620 }, school: "광운대학교", age: 24, phone: "010-0000-1002" },
  { id: "s3", role: "student", name: "이서준", nickname: "서준필름", department: "미디어영상학부", skills: ["숏폼", "프리미어", "촬영"], interests: ["영상", "사진"], availableHours: "평일 오후", maxDistanceM: 1200, location: { lat: 37.6230, lng: 127.0580 }, school: "광운대학교", age: 23, phone: "010-0000-1003" },
  { id: "s4", role: "student", name: "최지우", nickname: "지우마케팅", department: "경영학부", skills: ["인스타그램", "카피", "마케팅"], interests: ["SNS홍보", "기타"], availableHours: "평일 저녁", maxDistanceM: 1000, location: { lat: 37.6250, lng: 127.0610 }, school: "광운대학교", age: 21, phone: "010-0000-1004" },
  { id: "s5", role: "student", name: "윤서연", nickname: "서연브랜딩", department: "시각디자인학과", skills: ["브랜딩", "패키지", "Illustrator"], interests: ["디자인", "SNS홍보"], availableHours: "화·목 오후, 주말", maxDistanceM: 1800, location: { lat: 37.6207, lng: 127.0577 }, school: "광운대학교", age: 22, phone: "010-0000-1005" },
  { id: "s6", role: "student", name: "정민재", nickname: "민재웹", department: "컴퓨터정보공학부", skills: ["Next.js", "Supabase", "반응형 웹"], interests: ["웹/앱", "디지털도움"], availableHours: "평일 저녁", maxDistanceM: 2200, location: { lat: 37.6218, lng: 127.0640 }, school: "광운대학교", age: 25, phone: "010-0000-1006" },
  { id: "s7", role: "student", name: "한유진", nickname: "유진기록", department: "미디어커뮤니케이션학부", skills: ["인터뷰", "영상 기획", "캡컷"], interests: ["영상", "SNS홍보"], availableHours: "월·수 오후", maxDistanceM: 1600, location: { lat: 37.6241, lng: 127.0569 }, school: "광운대학교", age: 21, phone: "010-0000-1007" },
  { id: "s8", role: "student", name: "오지훈", nickname: "지훈설정", department: "전자통신공학과", skills: ["기기 설정", "와이파이", "키오스크"], interests: ["디지털도움", "웹/앱"], availableHours: "금요일, 주말", maxDistanceM: 2500, location: { lat: 37.6260, lng: 127.0631 }, school: "광운대학교", age: 24, phone: "010-0000-1008" },
  { id: "s9", role: "student", name: "강민서", nickname: "민서사진", department: "콘텐츠융합학부", skills: ["사진 촬영", "Lightroom", "숏폼"], interests: ["사진", "영상", "SNS홍보"], availableHours: "평일 오전, 토요일", maxDistanceM: 2000, location: { lat: 37.6275, lng: 127.0590 }, school: "광운대학교", age: 23, phone: "010-0000-1009" },
  { id: "s10", role: "student", name: "배수아", nickname: "수아전략", department: "경영학부", skills: ["브랜드 전략", "시장 조사", "카피라이팅"], interests: ["SNS홍보", "디자인"], availableHours: "평일 저녁, 일요일", maxDistanceM: 1700, location: { lat: 37.6280, lng: 127.0618 }, school: "광운대학교", age: 22, phone: "010-0000-1010" },
  { id: "s11", role: "student", name: "임태현", nickname: "태현앱", department: "정보융합학부", skills: ["Flutter", "UX 프로토타입", "데이터 시각화"], interests: ["웹/앱", "디자인"], availableHours: "수·금 저녁", maxDistanceM: 2300, location: { lat: 37.6199, lng: 127.0645 }, school: "광운대학교", age: 24, phone: "010-0000-1011" },
  { id: "s12", role: "student", name: "송예린", nickname: "예린글", department: "국어국문학과", skills: ["인터뷰", "블로그 글쓰기", "콘텐츠 교정"], interests: ["SNS홍보", "기타"], availableHours: "평일 오후, 토요일", maxDistanceM: 1400, location: { lat: 37.6258, lng: 127.0575 }, school: "광운대학교", age: 21, phone: "010-0000-1012" },
  { id: "s13", role: "student", name: "정만교", nickname: "만교도우미", department: "전자공학과", skills: ["스마트폰 활용", "키오스크", "디지털 교육"], interests: ["디지털도움"], availableHours: "주말 오후", maxDistanceM: 1500, location: { lat: 37.6225, lng: 127.0605 }, school: "광운대학교", age: 23, phone: "010-0000-1013" },
  { id: "s14", role: "student", name: "이지민", nickname: "지민숏폼", department: "미디어커뮤니케이션학부", skills: ["영상 촬영", "Premiere Pro", "숏폼 편집"], interests: ["영상", "SNS홍보"], availableHours: "화·목 오후, 주말", maxDistanceM: 1800, location: { lat: 37.6217, lng: 127.0588 }, school: "광운대학교", age: 22, phone: "010-0000-1014" },
  { id: "s15", role: "student", name: "문서현", nickname: "서현디자인", department: "시각디자인학과", skills: ["Figma", "Illustrator", "편집 디자인"], interests: ["디자인", "SNS홍보"], availableHours: "평일 저녁", maxDistanceM: 1600, location: { lat: 37.6244, lng: 127.0624 }, school: "광운대학교", age: 23, phone: "010-0000-1015" },
  { id: "r1", role: "resident", name: "월계 커피", nickname: "월계커피", kind: "상인", location: { lat: 37.6248, lng: 127.0598 }, address: "월계로 45길 12" },
  { id: "r2", role: "resident", name: "행복분식", nickname: "행복분식", kind: "상인", location: { lat: 37.6272, lng: 127.0615 }, address: "월계1동 광운로 21" },
  { id: "r3", role: "resident", name: "동네책방 소소", nickname: "책방소소", kind: "상인", location: { lat: 37.6285, lng: 127.0580 }, address: "석계로 7" },
  { id: "r4", role: "resident", name: "정순자 님", nickname: "순자님", kind: "주민", location: { lat: 37.6238, lng: 127.0632 }, address: "월계1동 주민센터 인근" },
  { id: "r5", role: "resident", name: "삼거리 정육점", nickname: "삼거리정육", kind: "상인", location: { lat: 37.6302, lng: 127.0622 }, address: "월계로 60" },
  { id: "r6", role: "resident", name: "꽃길 공방", nickname: "꽃길공방", kind: "상인", location: { lat: 37.6224, lng: 127.0568 }, address: "광운로 12길 8" },
  { id: "r7", role: "resident", name: "월계 미용실", nickname: "월계미용실", kind: "상인", location: { lat: 37.6264, lng: 127.0601 }, address: "월계로 53길 4" },
  { id: "r8", role: "resident", name: "햇살 반찬", nickname: "햇살반찬", kind: "상인", location: { lat: 37.6291, lng: 127.0605 }, address: "석계로 18" },
  { id: "r9", role: "resident", name: "깨끗한 세탁소", nickname: "깨끗세탁", kind: "상인", location: { lat: 37.6246, lng: 127.0642 }, address: "광운로 33" },
  { id: "r10", role: "resident", name: "우리동네 피아노", nickname: "동네피아노", kind: "상인", location: { lat: 37.6215, lng: 127.0604 }, address: "월계로 42길 15" },
  { id: "r11", role: "resident", name: "월계 과일상회", nickname: "월계과일", kind: "상인", location: { lat: 37.6283, lng: 127.0630 }, address: "초안산로 5길 9" },
  { id: "r12", role: "resident", name: "별빛 베이커리", nickname: "별빛빵집", kind: "상인", location: { lat: 37.6205, lng: 127.0612 }, address: "광운로 8" },
  { id: "r13", role: "resident", name: "다정 약국", nickname: "다정약국", kind: "상인", location: { lat: 37.6232, lng: 127.0650 }, address: "월계로 50길 3" },
  { id: "r14", role: "resident", name: "바늘뜸 옷수선", nickname: "바늘뜸수선", kind: "상인", location: { lat: 37.6270, lng: 127.0572 }, address: "석계로 12길 6" },
  { id: "r15", role: "resident", name: "봄날꽃집", nickname: "봄날꽃집", kind: "상인", location: { lat: 37.6220, lng: 127.0581 }, address: "광운로 14길 5" },
  { id: "r16", role: "resident", name: "온기반찬", nickname: "온기반찬", kind: "상인", location: { lat: 37.6251, lng: 127.0629 }, address: "월계로 48길 11" },
];

const locationOf = (userId: string) => users.find((user) => user.id === userId)!.location;

export const posts: Post[] = [
  { id: "p1", title: "카페 신메뉴 포스터 디자인", category: "디자인", description: "가을 신메뉴 3종 포스터(A3) 1장과 인스타용 정사각 이미지 3장이 필요해요. 사진은 저희가 드립니다.", authorId: "r1", location: users[4].location, address: "월계로 45길 12", status: "open", reward: "음료 쿠폰 10장 + 사례비 5만원", durationDays: 7, difficulty: 2, isTeam: false, createdAt: "2026-09-14T09:00:00Z" },
  { id: "p2", title: "QR 메뉴판 만들어 주실 분", category: "웹/앱", description: "종이 메뉴판을 QR 로 볼 수 있게 간단한 웹 메뉴판을 만들고 싶어요. 메뉴 20개 정도.", authorId: "r2", location: users[5].location, address: "광운로 21", status: "open", reward: "식사권 5장", durationDays: 10, difficulty: 2, isTeam: false, createdAt: "2026-09-15T02:00:00Z" },
  { id: "p3", title: "책방 소개 숏폼 영상 1편", category: "영상", description: "30초 내외 릴스 영상. 책방 분위기와 이달의 책 소개. 촬영은 평일 오후 가능.", authorId: "r3", location: users[6].location, address: "석계로 7", status: "in_progress", reward: "도서 2권", durationDays: 14, difficulty: 2, isTeam: false, createdAt: "2026-09-10T05:00:00Z" },
  { id: "p4", title: "키오스크·스마트폰 사용 도움", category: "디지털도움", description: "주민센터 근처 어르신 5분께 키오스크 주문, 카카오톡 사진 보내기 등을 알려드릴 분. 주 1회 1시간, 4주.", authorId: "r4", location: users[7].location, address: "월계1동 주민센터", status: "open", durationDays: 28, difficulty: 1, isTeam: false, createdAt: "2026-09-13T01:00:00Z" },
  { id: "p5", title: "정육점 디지털 개선 프로젝트 (팀)", category: "웹/앱", description: "간판·메뉴판 디자인 새로 하고, 홍보 영상 1편, 네이버 예약/주문 페이지 연결까지. 팀으로 진행해요.", authorId: "r5", location: users[8].location, address: "월계로 60", status: "open", reward: "팀 사례비 30만원", durationDays: 21, difficulty: 3, isTeam: true, teamSlots: [{ category: "디자인", count: 1, filled: [] }, { category: "영상", count: 1, filled: ["s3"] }, { category: "웹/앱", count: 1, filled: [] }], createdAt: "2026-09-12T07:00:00Z" },
  { id: "p6", title: "인스타그램 계정 운영 도움 (2주)", category: "SNS홍보", description: "게시물 6개 기획·제작과 해시태그 정리. 사진은 함께 찍어요.", authorId: "r1", location: users[4].location, address: "월계로 45길 12", status: "done", reward: "사례비 8만원", durationDays: 14, difficulty: 2, isTeam: false, createdAt: "2026-08-20T09:00:00Z" },
  { id: "p8", title: "분식집 메뉴판 정보 구조 개선", category: "디자인", description: "메뉴가 40개 가까이 한 판에 섞여 있어 손님들이 원하는 메뉴를 못 찾고 계속 물어보세요. 벽에 붙일 메뉴판을 새로 만들고 싶어요.", authorId: "r2", location: users[5].location, address: "광운로 21", status: "open", reward: "식사권 5장", durationDays: 10, difficulty: 2, isTeam: false, createdAt: "2026-09-16T02:00:00Z",
    problem: "메뉴가 한 판에 섞여 있어 손님이 원하는 메뉴를 찾기 어렵고, 주문 때마다 같은 질문을 반복해요", domain: "DESIGN", expectedDeliverables: ["벽 부착용 A2 메뉴판 인쇄 파일 1종", "원본 디자인 파일"], completionCriteria: "점주 확인 후 인쇄소에 바로 넘길 수 있는 PDF", deadline: "2026-10-10", revisionLimit: 2, compensationType: "NON_MONETARY", compensationDescription: "식사권 5장" },
  { id: "p7", title: "가게 외관·메뉴 사진 촬영", category: "사진", description: "네이버 플레이스에 올릴 사진 20장. 1시간 정도 촬영.", authorId: "r2", location: users[5].location, address: "광운로 21", status: "done", reward: "식사 제공", durationDays: 3, difficulty: 1, isTeam: false, createdAt: "2026-08-28T03:00:00Z" },
  { id: "p9", title: "베이커리 선물상자 패키지 디자인", category: "디자인", description: "쿠키 선물상자 띠지와 스티커를 따뜻한 분위기로 디자인해 주세요. 로고와 제품 사진은 제공해요.", authorId: "r12", location: locationOf("r12"), address: "광운로 8", status: "open", reward: "사례비 9만원 + 빵 쿠폰", durationDays: 10, difficulty: 2, isTeam: false, createdAt: "2026-10-05T08:30:00Z" },
  { id: "p10", title: "미용실 가격표와 시술 안내판 새단장", category: "디자인", description: "매장 벽 가격표와 A4 시술 안내지의 글자와 구성을 읽기 쉽게 정리하고 싶어요.", authorId: "r7", location: locationOf("r7"), address: "월계로 53길 4", status: "open", reward: "사례비 7만원", durationDays: 7, difficulty: 2, isTeam: false, createdAt: "2026-10-04T10:10:00Z" },
  { id: "p11", title: "과일상회 계절 할인 현수막 디자인", category: "디자인", description: "가을 제철 과일 4종과 배달 안내가 한눈에 보이는 가로형 현수막 시안이 필요해요.", authorId: "r11", location: locationOf("r11"), address: "초안산로 5길 9", status: "open", reward: "과일 바구니 + 사례비 5만원", durationDays: 5, difficulty: 1, isTeam: false, createdAt: "2026-10-03T06:20:00Z" },
  { id: "p12", title: "약국 복약 안내 리플릿 디자인", category: "디자인", description: "어르신도 쉽게 읽을 수 있도록 복약 시간과 주의사항을 정리한 양면 리플릿을 만들어 주세요.", authorId: "r13", location: locationOf("r13"), address: "월계로 50길 3", status: "open", reward: "사례비 10만원", durationDays: 12, difficulty: 3, isTeam: false, createdAt: "2026-10-02T07:40:00Z" },
  { id: "p13", title: "공방 원데이클래스 작품 사진 촬영", category: "사진", description: "수강생 작품과 작업 과정을 자연광 느낌으로 30장 촬영하고 기본 보정을 부탁드려요.", authorId: "r6", location: locationOf("r6"), address: "광운로 12길 8", status: "open", reward: "원데이클래스 수강권 + 사례비 4만원", durationDays: 4, difficulty: 2, isTeam: false, createdAt: "2026-10-05T05:30:00Z" },
  { id: "p14", title: "반찬 12종 배달앱 제품 사진", category: "사진", description: "흰 배경 제품 사진과 식탁 연출 사진을 각각 촬영해 배달앱에 올리고 싶어요.", authorId: "r8", location: locationOf("r8"), address: "석계로 18", status: "open", reward: "사례비 12만원 + 반찬 세트", durationDays: 6, difficulty: 2, isTeam: false, createdAt: "2026-10-04T04:15:00Z" },
  { id: "p15", title: "미용실 전후 변화 릴스 촬영·편집", category: "영상", description: "시술 전후와 디자이너 소개를 담은 20초 릴스 3편을 함께 기획하고 제작해 주세요.", authorId: "r7", location: locationOf("r7"), address: "월계로 53길 4", status: "open", reward: "사례비 15만원", durationDays: 10, difficulty: 3, isTeam: false, createdAt: "2026-10-03T09:00:00Z" },
  { id: "p16", title: "피아노 발표회 하이라이트 영상", category: "영상", description: "작은 발표회를 촬영하고 학생별 연주와 현장 분위기를 담은 3분 하이라이트 영상을 만들어 주세요.", authorId: "r10", location: locationOf("r10"), address: "월계로 42길 15", status: "open", reward: "팀 사례비 20만원", durationDays: 14, difficulty: 3, isTeam: true, teamSlots: [{ category: "영상", count: 1, filled: [] }, { category: "사진", count: 1, filled: [] }], createdAt: "2026-10-02T11:20:00Z" },
  { id: "p31", title: "옷수선 작업 과정 숏폼 제작", category: "영상", description: "낡은 옷이 새롭게 바뀌는 과정을 30초 숏폼 2편으로 촬영하고 자막을 넣어 주세요.", authorId: "r14", location: locationOf("r14"), address: "석계로 12길 6", status: "open", reward: "사례비 8만원", durationDays: 7, difficulty: 2, isTeam: false, createdAt: "2026-10-01T12:10:00Z" },
  { id: "p17", title: "세탁소 서비스 소개 한 페이지 웹사이트", category: "웹/앱", description: "영업시간, 가격, 수거 배달 지역을 휴대폰에서 보기 편한 한 페이지 사이트로 만들고 싶어요.", authorId: "r9", location: locationOf("r9"), address: "광운로 33", status: "open", reward: "사례비 15만원", durationDays: 14, difficulty: 2, isTeam: false, createdAt: "2026-10-05T03:00:00Z" },
  { id: "p18", title: "베이커리 케이크 사전예약 폼 제작", category: "웹/앱", description: "케이크 종류와 수령일을 선택하고 주문 내용을 매장에서 확인할 수 있는 간단한 예약 화면이 필요해요.", authorId: "r12", location: locationOf("r12"), address: "광운로 8", status: "open", reward: "사례비 18만원", durationDays: 18, difficulty: 3, isTeam: true, teamSlots: [{ category: "웹/앱", count: 1, filled: [] }, { category: "디자인", count: 1, filled: [] }], createdAt: "2026-10-04T02:30:00Z" },
  { id: "p19", title: "공방 수업 일정·신청 페이지", category: "웹/앱", description: "월별 수업 일정과 남은 자리를 보여주고 네이버 폼으로 연결되는 모바일 페이지를 만들어 주세요.", authorId: "r6", location: locationOf("r6"), address: "광운로 12길 8", status: "open", reward: "사례비 12만원 + 수강권", durationDays: 12, difficulty: 2, isTeam: false, createdAt: "2026-10-03T01:45:00Z" },
  { id: "p20", title: "약 복용 시간표 모바일 웹 만들기", category: "웹/앱", description: "약 이름과 복용 시간을 입력하면 큰 글씨 시간표로 보여주고 인쇄할 수 있는 간단한 도구가 필요해요.", authorId: "r13", location: locationOf("r13"), address: "월계로 50길 3", status: "open", reward: "사례비 20만원", durationDays: 21, difficulty: 3, isTeam: false, createdAt: "2026-10-02T00:20:00Z" },
  { id: "p21", title: "과일상회 인스타그램 첫 달 운영", category: "SNS홍보", description: "제철 과일 소개와 보관 팁을 주제로 카드뉴스 6개와 업로드 일정을 만들어 주세요.", authorId: "r11", location: locationOf("r11"), address: "초안산로 5길 9", status: "open", reward: "사례비 10만원 + 과일", durationDays: 21, difficulty: 2, isTeam: false, createdAt: "2026-10-05T01:10:00Z" },
  { id: "p22", title: "미용실 릴스 콘텐츠 한 달 기획", category: "SNS홍보", description: "고객이 궁금해하는 관리법과 시술 사례를 중심으로 릴스 8편의 주제와 대본을 기획해 주세요.", authorId: "r7", location: locationOf("r7"), address: "월계로 53길 4", status: "open", reward: "사례비 12만원", durationDays: 20, difficulty: 2, isTeam: false, createdAt: "2026-10-04T00:40:00Z" },
  { id: "p23", title: "반찬가게 네이버 블로그 콘텐츠", category: "SNS홍보", description: "가게 이야기와 주간 메뉴를 담은 블로그 글 4편을 사진과 함께 작성해 주세요.", authorId: "r8", location: locationOf("r8"), address: "석계로 18", status: "open", reward: "반찬 정기권 + 사례비 6만원", durationDays: 14, difficulty: 2, isTeam: false, createdAt: "2026-10-03T00:10:00Z" },
  { id: "p24", title: "피아노 학원 학부모 뉴스레터", category: "SNS홍보", description: "수업 소식과 연습 팁을 전하는 월간 뉴스레터의 구성과 첫 호 콘텐츠를 만들어 주세요.", authorId: "r10", location: locationOf("r10"), address: "월계로 42길 15", status: "open", reward: "사례비 7만원", durationDays: 10, difficulty: 2, isTeam: false, createdAt: "2026-10-02T03:50:00Z" },
  { id: "p25", title: "동네책방 이달의 책 콘텐츠", category: "SNS홍보", description: "책방지기가 고른 책 5권을 소개하는 인스타 카드뉴스와 짧은 소개 문구를 제작해 주세요.", authorId: "r3", location: locationOf("r3"), address: "석계로 7", status: "open", reward: "도서 3권 + 사례비 5만원", durationDays: 9, difficulty: 2, isTeam: false, createdAt: "2026-10-01T04:30:00Z" },
  { id: "p32", title: "옷수선 전후 사례 블로그 정리", category: "SNS홍보", description: "수선 전후 사진과 작업 설명을 활용해 네이버 블로그 사례 글 5편을 작성해 주세요.", authorId: "r14", location: locationOf("r14"), address: "석계로 12길 6", status: "open", reward: "사례비 8만원", durationDays: 12, difficulty: 2, isTeam: false, createdAt: "2026-09-30T05:20:00Z" },
  { id: "p26", title: "반찬가게 포스 메뉴 정리 도움", category: "디지털도움", description: "포스기에 중복 등록된 메뉴를 정리하고 가격 변경 방법을 사장님께 알려 주세요.", authorId: "r8", location: locationOf("r8"), address: "석계로 18", status: "open", reward: "반찬 세트 + 사례비 3만원", durationDays: 2, difficulty: 1, isTeam: false, createdAt: "2026-10-05T00:20:00Z" },
  { id: "p27", title: "세탁소 네이버 플레이스 정보 수정", category: "디지털도움", description: "영업시간, 가격표, 사진을 최신 정보로 바꾸고 사장님이 직접 수정하는 방법을 안내해 주세요.", authorId: "r9", location: locationOf("r9"), address: "광운로 33", status: "open", reward: "사례비 4만원", durationDays: 3, difficulty: 1, isTeam: false, createdAt: "2026-10-04T01:20:00Z" },
  { id: "p28", title: "스마트폰 사진 정리와 클라우드 교육", category: "디지털도움", description: "주민 6분께 사진 앨범 정리, 백업, 가족에게 공유하는 방법을 천천히 알려 주세요.", authorId: "r4", location: locationOf("r4"), address: "월계1동 주민센터 인근", status: "open", durationDays: 7, difficulty: 1, isTeam: false, createdAt: "2026-10-03T02:10:00Z" },
  { id: "p29", title: "카페 태블릿 주문 화면 설정", category: "디지털도움", description: "태블릿에 메뉴 사진을 등록하고 주문 알림과 프린터 연결을 점검해 주세요.", authorId: "r1", location: locationOf("r1"), address: "월계로 45길 12", status: "open", reward: "음료 쿠폰 + 사례비 5만원", durationDays: 3, difficulty: 2, isTeam: false, createdAt: "2026-10-02T02:00:00Z" },
  { id: "p30", title: "과일 재고 엑셀 장부 만들기", category: "디지털도움", description: "매일 입고·판매·폐기량을 쉽게 입력하고 남은 수량을 확인할 수 있는 엑셀 양식이 필요해요.", authorId: "r11", location: locationOf("r11"), address: "초안산로 5길 9", status: "open", reward: "과일 바구니 + 사례비 6만원", durationDays: 5, difficulty: 2, isTeam: false, createdAt: "2026-10-01T02:40:00Z" },
];

export const applications: Application[] = [
  { id: "a1", postId: "p3", studentId: "s3", message: "숏폼 편집 경험 있습니다. 평일 오후 가능해요.", status: "accepted", createdAt: "2026-09-10T08:00:00Z" },
  { id: "a2", postId: "p1", studentId: "s1", message: "포스터 3종 시안 드릴 수 있어요.", status: "pending", createdAt: "2026-09-14T12:00:00Z" },
  { id: "a3", postId: "p10", studentId: "s5", message: "가격표와 안내물 디자인 경험이 있어요. 먼저 정보 구조부터 정리해 볼게요.", status: "pending", createdAt: "2026-10-04T11:00:00Z" },
  { id: "a4", postId: "p18", studentId: "s6", roleId: "p18-role-1", message: "Next.js와 Supabase로 예약 화면을 만든 경험이 있습니다.", status: "pending", createdAt: "2026-10-04T04:00:00Z" },
  { id: "a5", postId: "p16", studentId: "s7", roleId: "p16-role-1", message: "공연 영상 기획과 현장 촬영을 맡고 싶습니다.", status: "pending", createdAt: "2026-10-03T03:30:00Z" },
  { id: "a6", postId: "p21", studentId: "s10", message: "시장 조사와 콘텐츠 일정표까지 함께 제안드릴 수 있어요.", status: "accepted", createdAt: "2026-10-05T03:10:00Z" },
  { id: "a7", postId: "p26", studentId: "s8", message: "포스기 메뉴 정리와 사용법 안내를 차근차근 도와드릴게요.", status: "pending", createdAt: "2026-10-05T01:20:00Z" },
  { id: "a8", postId: "p13", studentId: "s9", message: "제품과 작업 과정 촬영을 자주 했고 Lightroom 보정도 가능합니다.", status: "pending", createdAt: "2026-10-05T06:10:00Z" },
  { id: "a9", postId: "p17", studentId: "s11", message: "모바일 우선으로 빠르게 한 페이지 사이트를 제작하겠습니다.", status: "rejected", createdAt: "2026-10-05T04:20:00Z" },
  { id: "a10", postId: "p25", studentId: "s12", message: "책 소개 글과 카드뉴스 문구를 자연스럽게 다듬을 수 있어요.", status: "pending", createdAt: "2026-10-01T06:00:00Z" },
  { id: "a11", postId: "p12", studentId: "s1", message: "큰 글씨와 명확한 색상 체계로 읽기 쉬운 리플릿을 제안할게요.", status: "pending", createdAt: "2026-10-02T09:20:00Z" },
  { id: "a12", postId: "p29", studentId: "s2", message: "태블릿과 주문 프린터 연결을 점검하고 사용 설명도 남기겠습니다.", status: "pending", createdAt: "2026-10-02T04:10:00Z" },
  { id: "a13", postId: "p10", studentId: "s1", message: "정보가 많은 가격표를 읽기 쉽게 정리한 경험이 있어요. 인쇄 파일까지 전달하겠습니다.", status: "pending", createdAt: "2026-10-04T11:08:00Z" },
  { id: "a14", postId: "p10", studentId: "s10", message: "고객이 자주 찾는 시술을 먼저 보여주는 구성과 문구를 제안드릴게요.", status: "pending", createdAt: "2026-10-04T11:12:00Z" },
  { id: "a15", postId: "p10", studentId: "s11", message: "모바일 시안으로 먼저 확인받고 인쇄용 디자인으로 마무리할 수 있습니다.", status: "pending", createdAt: "2026-10-04T11:16:00Z" },
];

export const messages: ChatMessage[] = [
  { id: "m1", applicationId: "a2", senderId: "s1", body: "안녕하세요! 포스터 공고 보고 연락드려요.", createdAt: "2026-09-14T12:01:00Z" },
  { id: "m2", applicationId: "a2", senderId: "r1", body: "반가워요. 신메뉴 사진 먼저 보내 드릴게요.", createdAt: "2026-09-14T12:30:00Z" },
  { id: "m3", applicationId: "a3", senderId: "s5", body: "현재 가격표 사진을 보내주시면 메뉴 분류부터 살펴볼게요.", createdAt: "2026-10-04T11:02:00Z" },
  { id: "m4", applicationId: "a3", senderId: "r7", body: "사진 보냈어요. 커트와 염색 가격이 특히 복잡해요.", createdAt: "2026-10-04T11:25:00Z" },
  { id: "m5", applicationId: "a3", senderId: "s5", body: "확인했습니다. 내일까지 두 가지 구성안을 보내드릴게요.", createdAt: "2026-10-04T11:32:00Z" },
  { id: "m6", applicationId: "a4", senderId: "s6", body: "예약할 때 꼭 받아야 하는 정보가 종류, 날짜, 문구 세 가지일까요?", createdAt: "2026-10-04T04:02:00Z" },
  { id: "m7", applicationId: "a4", senderId: "r12", body: "네, 알레르기 여부도 하나 추가하면 좋겠어요.", createdAt: "2026-10-04T04:18:00Z" },
  { id: "m8", applicationId: "a5", senderId: "s7", body: "발표회 장소와 전체 진행 시간을 알려주실 수 있을까요?", createdAt: "2026-10-03T03:32:00Z" },
  { id: "m9", applicationId: "a5", senderId: "r10", body: "학원 연주실에서 90분 정도 진행할 예정이에요.", createdAt: "2026-10-03T04:05:00Z" },
  { id: "m10", applicationId: "a6", senderId: "s10", body: "첫 주에는 사과와 배 보관법 콘텐츠부터 시작하면 어떨까요?", createdAt: "2026-10-05T03:12:00Z" },
  { id: "m11", applicationId: "a6", senderId: "r11", body: "좋아요. 이번 주 할인 품목도 같이 넣고 싶어요.", createdAt: "2026-10-05T03:40:00Z" },
  { id: "m12", applicationId: "a6", senderId: "s10", body: "그 내용을 반영한 1주차 일정표를 오늘 저녁에 공유할게요.", createdAt: "2026-10-05T03:52:00Z" },
  { id: "m13", applicationId: "a7", senderId: "s8", body: "사용 중인 포스기 모델명을 확인할 수 있을까요?", createdAt: "2026-10-05T01:22:00Z" },
  { id: "m14", applicationId: "a7", senderId: "r8", body: "화면 사진을 찍어서 보내드렸어요. 토요일 오전 가능할까요?", createdAt: "2026-10-05T01:45:00Z" },
  { id: "m15", applicationId: "a8", senderId: "s9", body: "공방이 가장 밝은 시간이 언제인지 궁금해요.", createdAt: "2026-10-05T06:12:00Z" },
  { id: "m16", applicationId: "a8", senderId: "r6", body: "오후 2시부터 창가로 빛이 잘 들어옵니다.", createdAt: "2026-10-05T06:35:00Z" },
  { id: "m17", applicationId: "a8", senderId: "s9", body: "그럼 목요일 2시에 방문해서 한 시간 정도 촬영할게요.", createdAt: "2026-10-05T06:42:00Z" },
  { id: "m18", applicationId: "a9", senderId: "s11", body: "원하시는 참고 사이트가 있으면 보내주세요.", createdAt: "2026-10-05T04:22:00Z" },
  { id: "m19", applicationId: "a9", senderId: "r9", body: "이번에는 다른 지원자와 진행하게 됐어요. 지원해 주셔서 감사합니다.", createdAt: "2026-10-05T05:10:00Z" },
  { id: "m20", applicationId: "a10", senderId: "s12", body: "책마다 추천하고 싶은 독자층을 알려주시면 문구에 반영할게요.", createdAt: "2026-10-01T06:02:00Z" },
  { id: "m21", applicationId: "a10", senderId: "r3", body: "좋습니다. 책 목록과 제가 쓴 짧은 메모를 보내드릴게요.", createdAt: "2026-10-01T06:25:00Z" },
  { id: "m22", applicationId: "a11", senderId: "s1", body: "리플릿에 꼭 들어갈 복약 주의사항 목록이 있을까요?", createdAt: "2026-10-02T09:22:00Z" },
  { id: "m23", applicationId: "a11", senderId: "r13", body: "네, 식전·식후 구분과 졸림 주의를 가장 크게 보여주세요.", createdAt: "2026-10-02T09:50:00Z" },
  { id: "m24", applicationId: "a12", senderId: "s2", body: "태블릿과 프린터 모델 사진을 부탁드려요.", createdAt: "2026-10-02T04:12:00Z" },
  { id: "m25", applicationId: "a12", senderId: "r1", body: "사진 보냈습니다. 점심 이후 방문 가능하신가요?", createdAt: "2026-10-02T04:35:00Z" },
  { id: "m26", applicationId: "a13", senderId: "s1", body: "가격표 크기와 인쇄 예정 수량을 알려주실 수 있을까요?", createdAt: "2026-10-04T11:10:00Z" },
  { id: "m27", applicationId: "a13", senderId: "r7", body: "A2 크기로 두 장 인쇄할 예정이에요.", createdAt: "2026-10-04T11:27:00Z" },
  { id: "m28", applicationId: "a14", senderId: "s10", body: "손님들이 가장 많이 묻는 시술 세 가지가 무엇인지 궁금해요.", createdAt: "2026-10-04T11:14:00Z" },
  { id: "m29", applicationId: "a14", senderId: "r7", body: "커트, 뿌리 염색, 클리닉 가격을 가장 많이 물어봐요.", createdAt: "2026-10-04T11:31:00Z" },
  { id: "m30", applicationId: "a15", senderId: "s11", body: "기존 로고 파일과 선호하는 색상이 있나요?", createdAt: "2026-10-04T11:18:00Z" },
  { id: "m31", applicationId: "a15", senderId: "r7", body: "로고는 없고 매장에 있는 연두색을 살리고 싶어요.", createdAt: "2026-10-04T11:34:00Z" },
];

const reviews: Review[] = [
  { postId: "p6", studentId: "s4", rating: 5, comment: "게시물 반응이 정말 좋아졌어요.", verified: true },
  { postId: "p7", studentId: "s3", rating: 5, comment: "사진이 깔끔하고 빨랐어요.", verified: true },
];

// 평판 별점 UI를 바로 확인할 수 있는 학생 계정용 데모 평가 원본.
const demoReputationEvents: TierScoreEvent[] = [
  { id: "demo-score-1", studentId: "s1", projectId: "demo-project-1", kind: "PROJECT_VERIFIED", points: 16, createdAt: "2026-08-18T09:00:00Z" },
  { id: "demo-score-2", studentId: "s1", projectId: "demo-project-2", kind: "PROJECT_VERIFIED", points: 13, createdAt: "2026-09-02T09:00:00Z" },
];
const demoReputationReviews: ClientReview[] = [
  { projectId: "demo-project-1", reviewerId: "r1", satisfaction: 5, deadline: 4, communication: 5, handoff: 4, deliverableQuality: 5, comment: "요청한 내용을 빠르게 반영해 줬어요.", createdAt: "2026-08-18T09:00:00Z", status: "NORMAL", reviewerReliability: 1, evidenceConsistency: 1, adjustedRating: 4.6, anomalyReasons: [], policyVersion: "2026-10-evidence-v1" },
  { projectId: "demo-project-2", reviewerId: "r2", satisfaction: 4, deadline: 5, communication: 4, handoff: 5, deliverableQuality: 5, comment: "결과물과 설명이 모두 좋았습니다.", createdAt: "2026-09-02T09:00:00Z", status: "NORMAL", reviewerReliability: 1, evidenceConsistency: 0.95, adjustedRating: 4.5, anomalyReasons: [], policyVersion: "2026-10-evidence-v1" },
];

function demoReputationFor(studentId: string) {
  const projectId = (id: string) => `${id}-${studentId}`;
  return {
    events: demoReputationEvents.map((event) => ({
      ...event,
      id: `${event.id}-${studentId}`,
      studentId,
      projectId: projectId(event.projectId),
    })),
    reviews: demoReputationReviews.map((review) => ({
      ...review,
      projectId: projectId(review.projectId),
    })),
  };
}

const portfolio: PortfolioCard[] = [
  { id: "c1", studentId: "s4", postId: "p6", title: "월계 커피 홍보 프로젝트", roleLabel: "SNS 콘텐츠 기획·디자인", tasks: ["홍보 게시물 6개 제작", "해시태그·업로드 일정 정리"], durationDays: 14, rating: 5, verified: true },
  { id: "c2", studentId: "s3", postId: "p7", title: "행복분식 사진 촬영", roleLabel: "촬영·보정", tasks: ["외관·메뉴 사진 20장 촬영", "네이버 플레이스용 보정"], durationDays: 3, rating: 5, verified: true },
];

export const seedNotifications: Notification[] = [
  { id: "n1", userId: "s1", postId: "p1", text: "월계 커피에서 '카페 신메뉴 포스터 디자인' 프로젝트가 등록되었습니다.", distanceM: 580, read: false, createdAt: "2026-09-14T09:01:00Z" },
  { id: "n2", userId: "s1", postId: "p5", text: "삼거리 정육점 팀 프로젝트에 디자인 1명이 필요합니다.", distanceM: 1200, read: true, createdAt: "2026-09-12T07:05:00Z" },
  { id: "n3", userId: "r1", postId: "p1", text: "김하늘 학생이 포스터 공고에 지원했습니다.", read: false, createdAt: "2026-09-14T12:00:00Z" },
  { id: "n4", userId: "s5", postId: "p10", kind: "MATCHED_POST", href: "/posts/detail?id=p10", text: "월계 미용실의 가격표 디자인 공고가 관심 분야와 가까워요.", distanceM: 640, read: true, createdAt: "2026-10-04T10:12:00Z" },
  { id: "n5", userId: "r7", postId: "p10", kind: "APPLICATION", href: "/chats/room?id=a3", text: "윤서연 학생이 가격표 디자인 공고에 지원했어요.", read: false, createdAt: "2026-10-04T11:00:00Z" },
  { id: "n6", userId: "s5", postId: "p10", kind: "CHAT", href: "/chats/room?id=a3", text: "월계 미용실에서 새 메시지를 보냈어요.", read: false, createdAt: "2026-10-04T11:25:00Z" },
  { id: "n7", userId: "r12", postId: "p18", kind: "APPLICATION", href: "/chats/room?id=a4", text: "정민재 학생이 케이크 예약 페이지 개발 역할에 지원했어요.", read: false, createdAt: "2026-10-04T04:00:00Z" },
  { id: "n8", userId: "s6", postId: "p18", kind: "CHAT", href: "/chats/room?id=a4", text: "별빛 베이커리에서 예약 항목을 답변했어요.", read: false, createdAt: "2026-10-04T04:18:00Z" },
  { id: "n9", userId: "r10", postId: "p16", kind: "APPLICATION", href: "/chats/room?id=a5", text: "한유진 학생이 발표회 영상 촬영 역할에 지원했어요.", read: false, createdAt: "2026-10-03T03:30:00Z" },
  { id: "n10", userId: "s7", postId: "p16", kind: "CHAT", href: "/chats/room?id=a5", text: "우리동네 피아노에서 발표회 일정을 보냈어요.", read: false, createdAt: "2026-10-03T04:05:00Z" },
  { id: "n11", userId: "s10", postId: "p21", kind: "APPLICATION_ACCEPTED", href: "/posts/detail?id=p21", text: "과일상회 SNS 콘텐츠 지원이 수락됐어요.", read: false, createdAt: "2026-10-05T03:30:00Z" },
  { id: "n12", userId: "r11", postId: "p21", kind: "CHAT", href: "/chats/room?id=a6", text: "배수아 학생이 1주차 콘텐츠 일정을 보냈어요.", read: false, createdAt: "2026-10-05T03:52:00Z" },
  { id: "n13", userId: "s8", postId: "p26", kind: "MATCHED_POST", href: "/posts/detail?id=p26", text: "햇살 반찬의 포스 메뉴 정리 공고가 보유 기술과 잘 맞아요.", distanceM: 720, read: true, createdAt: "2026-10-05T00:22:00Z" },
  { id: "n14", userId: "r8", postId: "p26", kind: "APPLICATION", href: "/chats/room?id=a7", text: "오지훈 학생이 포스 메뉴 정리 공고에 지원했어요.", read: false, createdAt: "2026-10-05T01:20:00Z" },
  { id: "n15", userId: "s9", postId: "p13", kind: "CHAT", href: "/chats/room?id=a8", text: "꽃길 공방에서 촬영 가능한 시간을 알려줬어요.", read: false, createdAt: "2026-10-05T06:35:00Z" },
  { id: "n16", userId: "s11", postId: "p17", kind: "APPLICATION_REJECTED", href: "/chats/room?id=a9", text: "세탁소 웹사이트 지원 결과를 확인해 주세요.", read: false, createdAt: "2026-10-05T05:10:00Z" },
  { id: "n17", userId: "r3", postId: "p25", kind: "APPLICATION", href: "/chats/room?id=a10", text: "송예린 학생이 이달의 책 콘텐츠 공고에 지원했어요.", read: false, createdAt: "2026-10-01T06:00:00Z" },
  { id: "n18", userId: "s12", postId: "p25", kind: "CHAT", href: "/chats/room?id=a10", text: "동네책방 소소에서 책 목록을 보냈어요.", read: false, createdAt: "2026-10-01T06:25:00Z" },
  { id: "n19", userId: "s1", postId: "p12", kind: "MATCHED_POST", href: "/posts/detail?id=p12", text: "다정 약국의 복약 안내 리플릿 공고가 디자인 관심 분야와 가까워요.", distanceM: 980, read: true, createdAt: "2026-10-02T07:42:00Z" },
  { id: "n20", userId: "r13", postId: "p12", kind: "APPLICATION", href: "/chats/room?id=a11", text: "김하늘 학생이 복약 안내 리플릿 공고에 지원했어요.", read: false, createdAt: "2026-10-02T09:20:00Z" },
  { id: "n21", userId: "s2", postId: "p29", kind: "CHAT", href: "/chats/room?id=a12", text: "월계 커피에서 방문 가능한 시간을 물어봤어요.", read: false, createdAt: "2026-10-02T04:35:00Z" },
  { id: "n22", userId: "r1", postId: "p29", kind: "APPLICATION", href: "/chats/room?id=a12", text: "박도윤 학생이 태블릿 주문 설정 공고에 지원했어요.", read: false, createdAt: "2026-10-02T04:10:00Z" },
  { id: "n23", userId: "r7", postId: "p10", kind: "APPLICATION", href: "/chats/room?id=a13", text: "김하늘 학생이 가격표 디자인 공고에 지원했어요.", read: false, createdAt: "2026-10-04T11:08:00Z" },
  { id: "n24", userId: "s1", postId: "p10", kind: "CHAT", href: "/chats/room?id=a13", text: "월계 미용실에서 인쇄 크기를 알려줬어요.", read: false, createdAt: "2026-10-04T11:27:00Z" },
  { id: "n25", userId: "r7", postId: "p10", kind: "APPLICATION", href: "/chats/room?id=a14", text: "배수아 학생이 가격표 디자인 공고에 지원했어요.", read: false, createdAt: "2026-10-04T11:12:00Z" },
  { id: "n26", userId: "s10", postId: "p10", kind: "CHAT", href: "/chats/room?id=a14", text: "월계 미용실에서 자주 묻는 시술 정보를 보냈어요.", read: false, createdAt: "2026-10-04T11:31:00Z" },
  { id: "n27", userId: "r7", postId: "p10", kind: "APPLICATION", href: "/chats/room?id=a15", text: "임태현 학생이 가격표 디자인 공고에 지원했어요.", read: false, createdAt: "2026-10-04T11:16:00Z" },
  { id: "n28", userId: "s11", postId: "p10", kind: "CHAT", href: "/chats/room?id=a15", text: "월계 미용실에서 선호 색상을 알려줬어요.", read: false, createdAt: "2026-10-04T11:34:00Z" },
];

// ── 저장: 브라우저 localStorage (서버 연결 전 데모용). 새 구조라 키를 v2 로 올렸다 ──
// 확장된 사용자·공고·상호작용 시드가 기존 브라우저에도 보이도록 키를 올린다. 이전 데이터는 삭제하지 않는다.
const KEY = "wolgye-mock-v5";
const fresh = (): wf.WorkflowDB => {
  const d: wf.WorkflowDB = {
    ...wf.emptyDB(),
    users: structuredClone(users), posts: structuredClone(posts), applications: structuredClone(applications),
    legacyReviews: structuredClone(reviews), legacyCards: structuredClone(portfolio),
  };
  seedDemoProjects(d);   // 김하늘의 완료된 데모 프로젝트 5개 (HTML 포트폴리오는 메뉴판 1개)
  return d;
};
let db: wf.WorkflowDB = fresh();
/** 예전에 모든 학생 계정에 붙던 화면 확인용 샘플 카드 (김하늘은 같은 5개가 실제 데모 프로젝트라 sourceKind 가 다르다) */
const SAMPLE_CARD = /^demo-(real2sim|driving|menu|banner|cafe)$/;
let msgs: ChatMessage[] = structuredClone(messages);
let demoNotifications: Notification[] = structuredClone(seedNotifications);
let publications: PublishedPortfolio[] = [];
let agreements: Record<string, WorkAgreement> = {};
let profileExtras: Record<string, { about: string; avatarUrl?: string; department?: string; nickname?: string; skills?: string[]; interests?: import("@/types").Category[] }> = {};
const withPortfolioProfile = (user: User): User => user.role === "student" ? { ...user, ...profileExtras[user.id] }
  : user.role === "resident" && profileExtras[user.id]?.avatarUrl ? { ...user, avatarUrl: profileExtras[user.id].avatarUrl } : user;
function load() {
  if (typeof window === "undefined") return;
  try {
    const s = localStorage.getItem(KEY);
    if (s) { const d = JSON.parse(s); db = { ...fresh(), ...d.db, users: structuredClone(users) }; msgs = d.messages ?? msgs; demoNotifications = d.notifications ?? demoNotifications; publications = (d.publications ?? []).filter((p: PublishedPortfolio) => !SAMPLE_CARD.test(p.sourceId)); profileExtras = d.profileExtras ?? {}; agreements = d.agreements ?? {}; db.posts = db.posts.map(post => {
      const updatedSeed = posts.find(seed => seed.id === post.id);
      return updatedSeed && /사례비/.test(post.reward ?? "") ? { ...post, reward: updatedSeed.reward, compensationType: "NON_MONETARY", compensationDescription: updatedSeed.reward, paidAmount: undefined } : post;
    }); }
    else {
      const legacy = localStorage.getItem("wolgye-mock-v1");
      if (legacy) {
        const previous = JSON.parse(legacy);
        if (Array.isArray(previous.posts)) db.posts = previous.posts;
        if (Array.isArray(previous.applications)) db.applications = previous.applications;
        if (Array.isArray(previous.messages)) msgs = previous.messages;
        save(); // Retain v1 untouched so migration is recoverable.
      }
    }
  } catch {}
}
function save() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify({ db, messages: msgs, notifications: demoNotifications, publications, profileExtras, agreements })); }
  catch { throw new Error("브라우저 저장 공간이 가득 찼어요. 나 › 데모 데이터 초기화 후 다시 시도해 주세요"); }
}
/** 진행 중 데모의 계약서·대화를 채운다 (없는 것만). 바뀌었으면 true */
/** 데모의 선정 전 대화 → 이미 선정된(매칭 대기) 대화로. 월계 미용실(p10)은 지원자 4명 중 김하늘(a13)만 (개인 공고는 한 명씩) */
const DEMO_SHORTLISTED = ["a2", "a4", "a5", "a7", "a8", "a10", "a11", "a12", "a13"];
function seedDemoChats(): boolean {
  const extra = demoInProgressChats(db);
  let changed = false;
  for (const a of extra.agreements) if (!agreements[a.applicationId]) { agreements[a.applicationId] = a; changed = true; }
  for (const m of extra.messages) if (!msgs.some((x) => x.id === m.id)) { msgs.push(m); changed = true; }
  for (const app of db.applications) {
    if (DEMO_SHORTLISTED.includes(app.id) && app.status === "pending" && !app.shortlistedAt && !app.shortlistCancelledAt) { app.shortlistedAt = app.createdAt; changed = true; }
    // 이 규칙 전에 선정된 지원(accepted)은 공고 내용으로 확정된 계약서를 만들어 둔다 (DB 0037 과 같은 규칙)
    if (app.status === "accepted" && !agreements[app.id]) {
      const post = db.posts.find((p) => p.id === app.postId);
      if (!post) continue;
      const at = app.shortlistedAt ?? app.createdAt;
      const day = at.slice(0, 10), end = new Date(Date.parse(at) + 14 * 864e5).toISOString().slice(0, 10);
      agreements[app.id] = {
        applicationId: app.id, version: 1,
        terms: { startDate: day, endDate: end, scope: post.title, deliverables: post.expectedDeliverables?.join(", ") || "공고에 적힌 결과물",
          acceptance: post.completionCriteria || "공고에 적힌 완료 기준", coupon: post.compensationDescription || post.reward || "공고에 적힌 보상",
          revisions: post.revisionLimit ?? 2, exclusions: "", handoff: "결과물 파일 전달" },
        studentConfirmedAt: at, ownerConfirmedAt: at, finalizedAt: at, updatedAt: at,
      };
      if (!app.shortlistedAt) app.shortlistedAt = app.createdAt;
      changed = true;
    }
  }
  return changed;
}
let loaded = false; const ensure = () => { if (!loaded) { load(); loaded = true; try { const a = seedDemoProjects(db); const b = seedDemoChats(); if (a || b) save(); } catch { /* 예전 저장소와 충돌하면 데모 프로젝트 없이 진행 */ } } };
const listeners = new Set<(m: ChatMessage) => void>();
const notificationListeners = new Set<(n: Notification) => void>();
const pushNotification = (n: Omit<Notification, "id" | "createdAt" | "read">) => {
  const notification: Notification = { ...n, id: `n${Date.now()}${Math.random().toString(36).slice(2, 7)}`, read: false, createdAt: new Date().toISOString() };
  demoNotifications.unshift(notification);
  notificationListeners.forEach((listener) => listener(structuredClone(notification)));
  return notification;
};
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v === undefined ? v : structuredClone(v)), 60));
/** 엔진 호출 → 저장. 엔진이 던진 에러는 그대로 화면에 간다 (실패하면 저장하지 않는다) */
const tx = <T,>(f: () => T): Promise<T> => {
  ensure();
  const backup = JSON.stringify(db);
  try { const r = f(); save(); return wait(r); } catch (e) { db = JSON.parse(backup); return Promise.reject(e); }
};
const withRoleIds = (post: Post): Post => {
  if (!post.isTeam || !post.teamSlots) return post;
  post.teamSlots = post.teamSlots.map((slot, index) => ({
    ...slot,
    id: slot.id ?? `${post.id}-role-${index + 1}`,
    label: slot.label ?? slot.category,
    domain: slot.domain ?? domainForCategory(slot.category),
    filledCount: slot.filledCount ?? slot.filled.length,
  }));
  return post;
};

function agreementParty(applicationId: string, actorId: string): "student" | "owner" {
  const application = db.applications.find(a => a.id === applicationId);
  const post = db.posts.find(p => p.id === application?.postId);
  if (!application || !post) throw new Error("채팅방을 찾을 수 없어요.");
  if (actorId === application.studentId) return "student";
  if (actorId === post.authorId) return "owner";
  throw new Error("이 계약서는 채팅 당사자만 볼 수 있어요.");
}

function agreementNotification(applicationId: string, actorId: string, version: number, finalized = false, custom?: (title: string) => string) {
  const application = db.applications.find(a => a.id === applicationId)!;
  const post = db.posts.find(p => p.id === application.postId)!;
  const recipientId = actorId === application.studentId ? post.authorId : application.studentId;
  return pushNotification({
    userId: recipientId,
    postId: post.id,
    kind: "AGREEMENT",
    href: `/chats/room?id=${applicationId}`,
    text: custom ? custom(post.title) : finalized
      ? `'${post.title}' 계약서가 양쪽 확인으로 확정됐어요.`
      : `'${post.title}' 계약서 v${version}을 확인해 주세요.`,
  });
}

import { chatReads } from "./chatReads";
/** 이 지원서로 만든 프로젝트가 끝났는지 (완료·취소) — 끝난 계약서는 못 바꾼다 */
function projectClosed(applicationId: string) {
  const projectId = db.members.find((m) => m.applicationId === applicationId)?.projectId;
  const status = db.projects.find((p) => p.id === projectId)?.status;
  return status === "COMPLETED" || status === "CANCELLED";
}

export const mockRepo: Repo = {
  async getAgreement(applicationId, actorId) { ensure(); load(); agreementParty(applicationId, actorId); return wait(agreements[applicationId] ?? null); },
  async saveAgreement(applicationId, actorId, expectedVersion, terms) {
    ensure(); load(); agreementParty(applicationId, actorId);
    const previous = agreements[applicationId];
    if (previous?.finalizedAt) throw new Error("이미 확정된 최종본이에요 (바꾸려면 수정 제안을 보내 주세요).");
    const app = db.applications.find((a) => a.id === applicationId)!;
    if (app.status !== "pending" || !app.shortlistedAt) throw new Error("사장님이 선정한 뒤에 계약서를 쓸 수 있어요.");
    const next = reviseAgreement(previous ?? null, applicationId, expectedVersion, terms);
    agreements[applicationId] = next;
    const notification = agreementNotification(applicationId, actorId, next.version);
    try { save(); } catch (e) {
      if (previous) agreements[applicationId] = previous; else delete agreements[applicationId];
      demoNotifications = demoNotifications.filter(n => n.id !== notification.id);
      throw e;
    }
    return wait(next);
  },
  async confirmAgreement(applicationId, actorId, version) {
    ensure(); load(); const side = agreementParty(applicationId, actorId);
    const previous = agreements[applicationId];
    if (!previous) throw new Error("먼저 계약서를 저장해 주세요.");
    const app = db.applications.find((a) => a.id === applicationId)!;
    if (!previous.finalizedAt && (app.status !== "pending" || !app.shortlistedAt)) throw new Error("선정이 취소됐거나 마감된 지원이에요.");
    const next = confirmAgreement(previous, version, side); agreements[applicationId] = next;
    const newlyConfirmed = side === "student" ? !previous.studentConfirmedAt : !previous.ownerConfirmedAt;
    const notification = newlyConfirmed
      ? agreementNotification(applicationId, actorId, next.version, Boolean(next.finalizedAt && !previous.finalizedAt))
      : null;
    try { save(); } catch (e) {
      agreements[applicationId] = previous;
      if (notification) demoNotifications = demoNotifications.filter(n => n.id !== notification.id);
      throw e;
    }
    // 양쪽이 확인해 확정되면 그 자리에서 선정 확정 → 프로젝트 시작 (DB confirm_chat_agreement 와 같은 규칙)
    if (next.finalizedAt && !previous.finalizedAt) {
      const post = db.posts.find((p) => p.id === app.postId)!;
      try { await mockRepo.selectApplicant(applicationId, post.authorId); }
      catch (e) {
        agreements[applicationId] = previous;
        if (notification) demoNotifications = demoNotifications.filter(n => n.id !== notification.id);
        save();
        throw e;
      }
    }
    return wait(next);
  },
  async proposeAgreementChange(applicationId, actorId, terms) {
    ensure(); load(); const side = agreementParty(applicationId, actorId);
    const previous = agreements[applicationId];
    if (!previous) throw new Error("계약서가 없어요.");
    if (projectClosed(applicationId)) throw new Error("끝난 프로젝트의 계약서는 수정할 수 없어요");   // 0039 와 같은 규칙
    const next = proposeAgreementChange(previous, side, terms); agreements[applicationId] = next;
    // 0043 과 같은 알림: 상대방에게 수정 제안 도착
    const notification = agreementNotification(applicationId, actorId, next.version, false, (t) => `'${t}' 계약서 수정 제안이 왔어요. 수락하거나 거절해 주세요.`);
    try { save(); } catch (e) { agreements[applicationId] = previous; demoNotifications = demoNotifications.filter(n => n.id !== notification.id); throw e; }
    return wait(next);
  },
  async respondAgreementChange(applicationId, actorId, accept) {
    ensure(); load(); const side = agreementParty(applicationId, actorId);
    const previous = agreements[applicationId];
    if (!previous) throw new Error("계약서가 없어요.");
    if (accept && projectClosed(applicationId)) throw new Error("끝난 프로젝트의 계약서는 수정할 수 없어요");   // 거절·철회는 허용
    const next = respondAgreementChange(previous, side, accept); agreements[applicationId] = next;
    // 0043 과 같은 알림: 수락 → 제안한 쪽에 재확정, 거절 → 제안한 쪽에, 철회 → 상대방에
    const notification = agreementNotification(applicationId, actorId, next.version, false, (t) => accept
      ? `'${t}' 계약서 수정 제안이 수락돼 v${next.version}로 다시 확정됐어요.`
      : previous.proposedBy === side ? `'${t}' 계약서 수정 제안이 철회됐어요. 기존 계약서가 그대로 유지돼요.`
      : `'${t}' 계약서 수정 제안이 거절됐어요. 기존 계약서가 그대로 유지돼요.`);
    try { save(); } catch (e) { agreements[applicationId] = previous; demoNotifications = demoNotifications.filter(n => n.id !== notification.id); throw e; }
    return wait(next);
  },
  async shortlistApplicant(applicationId, actorId) { return tx(() => {
    const a = db.applications.find((x) => x.id === applicationId);
    const post = a && db.posts.find((p) => p.id === a.postId);
    if (!a || !post) throw new Error("지원서를 찾을 수 없어요.");
    if (post.authorId !== actorId) throw new Error("공고 작성자만 선정할 수 있어요.");
    if (a.status !== "pending") throw new Error("이미 끝난 지원서예요.");
    if (a.shortlistedAt) return;
    const active = db.applications.filter((x) => x.postId === post.id && x.id !== a.id && x.status === "pending" && x.shortlistedAt);
    if (post.isTeam) {
      const role = post.teamSlots?.find((r) => r.id === a.roleId);
      if (!role || (role.filled?.length ?? 0) + active.filter((x) => x.roleId === a.roleId).length >= role.count) throw new Error("이 역할은 이미 선정 중이거나 모집 인원이 찼어요. 선정을 취소한 뒤 다시 선정해 주세요.");
    } else if (active.length) throw new Error("선정 중인 지원자가 있어요. 선정을 취소한 뒤 다시 선정해 주세요.");
    a.shortlistedAt = new Date().toISOString(); a.shortlistCancelledAt = undefined;
    pushNotification({ userId: a.studentId, postId: post.id, kind: "APPLICATION_SHORTLISTED", href: `/chats/room?id=${a.id}`, text: `'${post.title}' 공고에 선정됐어요. 대화하며 계약서를 확정하면 시작해요.` });
  }); },
  async cancelShortlist(applicationId, actorId) {
    ensure(); load(); const side = agreementParty(applicationId, actorId);
    return tx(() => {
      const a = db.applications.find((x) => x.id === applicationId)!;
      const post = db.posts.find((p) => p.id === a.postId)!;
      if (a.status !== "pending" || !a.shortlistedAt) throw new Error("선정 중인 지원서가 아니에요 (확정 뒤에는 합의 취소를 써 주세요).");
      if (agreements[applicationId] && !agreements[applicationId].finalizedAt) delete agreements[applicationId];   // 쓰던 초안은 지운다
      a.shortlistedAt = undefined; a.shortlistCancelledAt = new Date().toISOString();
      pushNotification({ userId: side === "owner" ? a.studentId : post.authorId, postId: post.id, kind: "SHORTLIST_CANCELLED", href: `/chats/room?id=${a.id}`, text: `'${post.title}' 선정이 취소됐어요.` });
    });
  },
  ...chatReads("mock"),
  async listUsers() { ensure(); return wait(users.map(withPortfolioProfile)); },
  async getUser(id) { ensure(); const user = users.find((u) => u.id === id); return wait(user ? withPortfolioProfile(user) : undefined); },
  async updatePortfolioProfile(studentId, data) {
    ensure();
    if (!users.some(user => user.id === studentId && user.role === "student")) throw new Error("학생 프로필을 찾을 수 없어요.");
    if (typeof localStorage !== "undefined" && (localStorage.getItem("wolgye-user") || "s1") !== studentId) throw new Error("본인의 프로필만 수정할 수 있어요.");
    if (data.nickname !== undefined) { const problem = nicknameProblem(data.nickname, users.map(withPortfolioProfile), studentId); if (problem) throw new Error(problem); }
    profileExtras[studentId] = { ...profileExtras[studentId], ...data, avatarUrl: data.avatarUrl ?? profileExtras[studentId]?.avatarUrl };
    save();
  },
  async uploadPortfolioImage(_studentId, file) { return fileToDataUrl(file, 450_000); },
  async updateAvatar(userId, avatarUrl) {
    ensure();
    if (!users.some(user => user.id === userId && user.role !== "admin")) throw new Error("프로필을 찾을 수 없어요.");
    if (typeof localStorage !== "undefined" && (localStorage.getItem("wolgye-user") || "s1") !== userId) throw new Error("본인의 프로필만 수정할 수 있어요.");
    profileExtras[userId] = { ...profileExtras[userId], about: profileExtras[userId]?.about ?? "", avatarUrl };
    save();
  },
  async listPosts() { ensure(); return wait([...db.posts].map(withRoleIds).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); },
  async getPost(id) { ensure(); const post = db.posts.find((p) => p.id === id); return wait(post ? withRoleIds(post) : undefined); },
  async createPost(p) { return tx(() => {
    const post = withRoleIds({ ...p, id: `p${Date.now()}`, status: "open", createdAt: new Date().toISOString() }); db.posts.unshift(post);
    // 평소 공고는 알림을 보내지 않는다. 긴급 공고만 사장님이 고른 단과대학 학생에게 즉시 알린다.
    if (post.urgent) {
      const targets = post.urgentColleges ?? [];
      for (const student of users.filter((u): u is Extract<User, { role: "student" }> => u.role === "student")) {
        if (targets.length && !targets.includes(student.college ?? guessCollege(student.department) ?? "")) continue;
        pushNotification({ userId: student.id, postId: post.id, kind: "URGENT_POST", href: `/posts/detail?id=${post.id}`, text: `긴급 공고: ${post.title}`, distanceM: Math.round(distanceM(student.location, post.location)) });
      }
    }
    return post;
  }); },
  async updatePostStatus(id, status) { return tx(() => { const p = db.posts.find((x) => x.id === id); if (p) p.status = status; }); },
  // ── 합의 취소 (DB 0034 와 같은 규칙) ────────────────────────────────────
  async getCancellation(projectId) {
    ensure();
    const now = new Date().toISOString();
    for (const c of db.cancellations) if (c.status === "PENDING" && c.expiresAt < now) { c.status = "EXPIRED"; c.respondedAt = now; }
    return wait(db.cancellations.filter((c) => c.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null);
  },
  async requestCancellation(projectId, reason, actorId) { return tx(() => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) throw new Error("프로젝트를 찾을 수 없어요");
    if (project.status === "COMPLETED") throw new Error("이미 완료된 프로젝트는 취소할 수 없어요");
    if (project.status === "CANCELLED") throw new Error("이미 취소된 프로젝트예요");
    if (reason.trim().length < 10) throw new Error("취소 사유를 10자 이상 적어 주세요");
    if (db.cancellations.some((c) => c.projectId === projectId && c.status === "PENDING")) throw new Error("이미 응답을 기다리는 취소 요청이 있어요");
    const members = db.members.filter((m) => m.projectId === projectId);
    const lead = members.find((m) => m.isLead)?.studentId ?? members[0]?.studentId;
    const responder = actorId === project.ownerId ? lead : actorId === lead ? project.ownerId : undefined;
    if (!responder) throw new Error("의뢰인 또는 학생 쪽 대표만 취소를 요청할 수 있어요");
    const now = new Date();
    db.cancellations.push({
      id: `pc${Date.now()}`, projectId, requestedBy: actorId, responderId: responder, reason: reason.trim(),
      status: "PENDING", expiresAt: new Date(now.getTime() + 3 * 86400000).toISOString(), createdAt: now.toISOString(),
    });
    pushNotification({ userId: responder, kind: "CANCEL_REQUESTED", href: `/projects/detail?id=${projectId}`, text: "상대방이 프로젝트 취소를 요청했어요. 3일 안에 수락하거나 거절해 주세요." });
  }); },
  async respondCancellation(cancellationId, accept, actorId) { return tx(() => {
    const c = db.cancellations.find((x) => x.id === cancellationId);
    if (!c) throw new Error("취소 요청을 찾을 수 없어요");
    if (c.responderId !== actorId) throw new Error("상대방만 수락하거나 거절할 수 있어요");
    if (c.status !== "PENDING" || c.expiresAt < new Date().toISOString()) throw new Error("이미 처리된 요청이에요");
    c.respondedAt = new Date().toISOString();
    if (!accept) {
      c.status = "REJECTED";
      pushNotification({ userId: c.requestedBy, kind: "CANCEL_REJECTED", href: `/projects/detail?id=${c.projectId}`, text: "취소 요청이 거절됐어요. 채팅으로 상대방과 합의해 주세요." });
      return;
    }
    c.status = "ACCEPTED";
    const project = db.projects.find((p) => p.id === c.projectId)!;
    project.status = "CANCELLED";
    const post = db.posts.find((p) => p.id === project.postId);
    if (post) post.status = "done";
    for (const uid of [project.ownerId, ...db.members.filter((m) => m.projectId === c.projectId).map((m) => m.studentId)])
      pushNotification({ userId: uid, kind: "CANCELLED", href: `/projects/detail?id=${c.projectId}`, text: "프로젝트가 합의 취소됐어요." });
  }); },

  async deletePost(postId, actorId) { return tx(() => {
    const i = db.posts.findIndex((x) => x.id === postId);
    if (i < 0) throw new Error("공고를 찾을 수 없어요");
    if (db.posts[i].authorId !== actorId) throw new Error("내가 올린 공고만 지울 수 있어요");
    if (db.projects.some((pr) => pr.postId === postId)) throw new Error("이미 학생이 선정된 공고예요. 학생의 활동 기록이 사라지지 않도록 지울 수 없어요");
    db.posts.splice(i, 1);
    db.applications = db.applications.filter((a) => a.postId !== postId);
  }); },
  async listApplications(postId) { ensure(); return wait(db.applications.filter((a) => !postId || a.postId === postId)); },
  async apply(postId, studentId, message, roleId, clubId) { return tx(() => {
    const application = wf.apply(db, { postId, studentId, message, roleId, clubId });
    if (clubId) application.clubId = clubId; const post = db.posts.find((p) => p.id === postId)!; const student = users.find((u) => u.id === studentId);
    pushNotification({ userId: post.authorId, postId, kind: "APPLICATION", href: `/posts/detail?id=${postId}`, text: `${student?.name ?? "학생"}님이 '${post.title}' 공고에 지원했어요.` });
    return application;
  }); },
  async getApplication(id) { ensure(); return wait(db.applications.find((a) => a.id === id)); },
  async updateApplicationStatus(id, status) { return tx(() => {
    const application = db.applications.find((x) => x.id === id); if (!application) return;
    application.status = status;
    if (status === "rejected") { const post = db.posts.find((p) => p.id === application.postId)!; pushNotification({ userId: application.studentId, postId: post.id, kind: "APPLICATION_REJECTED", href: `/posts/detail?id=${post.id}`, text: `'${post.title}' 지원 결과를 확인해 주세요.` }); }
  }); },
  async listChatRooms(userId) {
    ensure();
    const rooms = db.applications.flatMap((a) => {
      const post = db.posts.find((p) => p.id === a.postId);
      if (!post || (a.studentId !== userId && post.authorId !== userId)) return [];
      const last = msgs.filter((m) => m.applicationId === a.id).at(-1);
      // 단계 표시용: 계약서 확정 시각, 이 학생이 들어간 프로젝트
      const project = db.projects.find((p) => p.postId === a.postId && db.members.some((m) => m.projectId === p.id && m.studentId === a.studentId));
      return [{ application: a, post, other: users.find((u) => u.id === (a.studentId === userId ? post.authorId : a.studentId)), last,
        agreementFinalizedAt: agreements[a.id]?.finalizedAt ?? null, projectId: project?.id, projectStatus: project?.status }];
    });
    return wait(rooms.sort((x, y) => (y.last?.createdAt ?? y.application.createdAt).localeCompare(x.last?.createdAt ?? x.application.createdAt)));
  },
  async listMessages(applicationId) { ensure(); return wait(msgs.filter((m) => m.applicationId === applicationId)); },
  async sendMessage(applicationId, senderId, body) {
    ensure();
    const target = db.applications.find((a) => a.id === applicationId);
    if (!target || !(target.status === "accepted" || target.status === "pending")) throw new Error("종료된 지원은 메시지를 보낼 수 없어요.");
    if (senderId !== target.studentId && senderId !== db.posts.find(p => p.id === target.postId)?.authorId) throw new Error("채팅은 당사자만 보낼 수 있어요."); const m: ChatMessage = { id: `m${Date.now()}`, applicationId, senderId, body, createdAt: new Date().toISOString() };
    msgs.push(m); const application = db.applications.find((a) => a.id === applicationId); const post = application && db.posts.find((p) => p.id === application.postId);
    if (application && post) pushNotification({ userId: senderId === application.studentId ? post.authorId : application.studentId, postId: post.id, kind: "CHAT", href: `/chats/room?id=${applicationId}`, text: `${users.find((u) => u.id === senderId)?.name ?? "상대방"}님이 새 메시지를 보냈어요.` });
    save(); listeners.forEach((l) => l(m)); return wait(m);
  },
  onMessage(applicationId, cb) { const l = (m: ChatMessage) => { if (m.applicationId === applicationId) cb(m); }; listeners.add(l); return () => { listeners.delete(l); }; },
  async listReviews(studentId) { ensure(); return wait(db.legacyReviews.filter((r) => !studentId || r.studentId === studentId)); },
  async listPortfolio(studentId) { ensure(); return wait(db.legacyCards.filter((c) => c.studentId === studentId)); },
  async createPortfolioFeed(actorId, item) {
    ensure();
    if (actorId !== item.studentId || item.sourceKind !== "manual" || (typeof localStorage !== "undefined" && (localStorage.getItem("wolgye-user") || "s1") !== actorId)) throw new Error("본인의 피드만 올릴 수 있어요.");
    if (!item.title.trim() || !item.coverUrl || !item.imageUrls?.includes(item.coverUrl) || !item.sections.some(section => section.body.trim())) throw new Error("제목, 대표사진, 내용을 확인해 주세요.");
    assertArchiveCapacity(item, await mockRepo.listPublishedPortfolio(actorId, true));
    if (publications.some(p => p.studentId === actorId && p.sourceKind === "manual" && p.sourceId === item.sourceId)) throw new Error("이미 등록된 피드예요.");
    const previous = publications;
    publications = [structuredClone(item), ...publications];
    try { save(); } catch (e) { publications = previous; throw e; }
  },
  async updatePublishedPortfolio(actorId, item) {
    ensure();
    if (actorId !== item.studentId || (typeof localStorage !== "undefined" && (localStorage.getItem("wolgye-user") || "s1") !== actorId)) throw new Error("본인의 게시물만 수정할 수 있어요.");
    const existing = publications.find(p => p.studentId === actorId && p.sourceId === item.sourceId && p.sourceKind === item.sourceKind);
    if (!existing && !demoProjectPublications(db, actorId).some(p => p.sourceId === item.sourceId && p.sourceKind === item.sourceKind)) throw new Error("공개된 게시물을 찾을 수 없어요.");
    if (!item.title.trim()) throw new Error("제목을 입력해 주세요.");
    assertArchiveCapacity(item, await mockRepo.listPublishedPortfolio(actorId, true));
    const previous = publications;
    publications = [structuredClone(item), ...publications.filter(p => !(p.studentId === actorId && p.sourceId === item.sourceId && p.sourceKind === item.sourceKind))];
    try { save(); } catch(e) { publications = previous; throw e; }
  },
  async listPublishedPortfolio(studentId, includeHidden = false) {
    ensure();
    const own = typeof localStorage !== "undefined" && (localStorage.getItem("wolgye-user") || "s1") === studentId;
    const saved = publications.filter(p => p.studentId === studentId);
    const samples = demoProjectPublications(db, studentId).filter(p => !saved.some(s => s.sourceId === p.sourceId && s.sourceKind === p.sourceKind));
    return wait([...saved, ...samples].filter(p => p.visible !== false || (includeHidden && own)));
  },
  async publishPortfolio(studentId, sourceId, sourceKind, coverUrl) {
    ensure();
    const item = await publicationFromSource(mockRepo, studentId, sourceId, sourceKind);
    const existing = publications.find(p => p.studentId === studentId && p.sourceId === sourceId && p.sourceKind === sourceKind);
    item.coverUrl = coverUrl ?? existing?.coverUrl;
    if (existing) item.sections = withFeedCollection(item, feedCollection(existing)).sections;
    assertArchiveCapacity(item, await mockRepo.listPublishedPortfolio(studentId, true));
    const previous = publications;
    publications = [item, ...publications.filter(p => !(p.studentId === studentId && p.sourceId === sourceId && p.sourceKind === sourceKind))];
    try { save(); } catch (e) { publications = previous; throw e; }
  },
  async unpublishPortfolio(studentId, sourceId, sourceKind) {
    ensure(); const previous = publications;
    publications = publications.map(p => p.studentId === studentId && p.sourceId === sourceId && p.sourceKind === sourceKind ? { ...p, visible: false } : p);
    try { save(); } catch (e) { publications = previous; throw e; }
  },
  async listNotifications(userId) { ensure(); return wait(demoNotifications.filter((n) => n.userId === userId)); },
  async markNotificationRead(id, userId) { ensure(); const notification = demoNotifications.find((n) => n.id === id && n.userId === userId); if (notification) notification.read = true; save(); },
  onNotification(userId, cb) { const listener = (n: Notification) => { if (n.userId === userId) cb(n); }; notificationListeners.add(listener); return () => { notificationListeners.delete(listener); }; },
  // ── 검증형 포트폴리오 파이프라인 (규칙은 workflow/engine.ts) ──────────────────
  async selectApplicant(applicationId, actorId) { return tx(() => {
    if (!agreements[applicationId]?.finalizedAt) throw new Error("계약서를 양쪽이 확인해 확정하면 선정돼요.");
    const application = db.applications.find((a) => a.id === applicationId)!;
    const post = db.posts.find((p) => p.id === application.postId)!;
    const wasPending = application.status === "pending";
    const rejected = post.isTeam || !wasPending ? [] : db.applications.filter((candidate) => candidate.postId === post.id && candidate.id !== applicationId && candidate.status === "pending");
    const project = wf.selectApplicant(db, { applicationId, actorId });
    if (wasPending && post.handoverOfProject) {
      const operations = db.operations.find((item) => item.projectId === post.handoverOfProject);
      if (operations && operations.maintainerId !== application.studentId) {
        operations.status = "OPERATING";
        operations.maintainerId = application.studentId;
        db.terms.push({ id: `mt${Date.now()}`, projectId: post.handoverOfProject, studentId: application.studentId, startedOn: new Date().toISOString().slice(0, 10), ticketsClosed: 0 });
        pushNotification({ userId: application.studentId, kind: "HANDOVER_TAKEN", href: `/projects/handover?id=${post.handoverOfProject}`, text: "프로젝트를 이어받았어요. 인수인계서를 먼저 확인해 주세요." });
      }
    }
    if (wasPending) {
      pushNotification({ userId: application.studentId, postId: post.id, kind: "APPLICATION_ACCEPTED", href: `/projects/detail?id=${project.id}`, text: `'${post.title}' 프로젝트에 선정됐어요.` });
      for (const candidate of rejected) pushNotification({ userId: candidate.studentId, postId: post.id, kind: "APPLICATION_REJECTED", href: `/posts/detail?id=${post.id}`, text: `'${post.title}' 지원 결과를 확인해 주세요.` });
    }
    return project;
  }); },  async startTeamProject(projectId, actorId, leaderId) { return tx(() => { const project = wf.startTeamProject(db, { projectId, actorId, leaderId }); const post = db.posts.find((p) => p.id === project.postId)!; for (const member of db.members.filter((m) => m.projectId === projectId)) pushNotification({ userId: member.studentId, postId: post.id, kind: "PROJECT_STARTED", href: `/projects/detail?id=${projectId}`, text: `'${post.title}' 팀 프로젝트가 시작됐어요.` }); return project; }); },
  async getProjectByPost(postId) { ensure(); return wait(db.projects.find((p) => p.postId === postId)); },
  async listMyProjects(userId) {
    ensure();
    const mine = db.projects.filter((p) => p.ownerId === userId || db.members.some((m) => m.projectId === p.id && m.studentId === userId));
    return wait(mine.map((project) => ({ project, post: db.posts.find((p) => p.id === project.postId)! })).sort((a, b) => b.project.createdAt.localeCompare(a.project.createdAt)));
  },
  async getBundle(projectId) { ensure(); return wait(wf.getBundle(db, projectId)); },
  async saveAnswer(a) { return tx(() => wf.saveAnswer(db, a)); },
  async addLog(a) { return tx(() => wf.addLog(db, a)); },
  async uploadEvidenceFile(_projectId, file) { return { url: await fileToDataUrl(file), fileName: file.name, mimeType: file.type.startsWith("image/") && file.type !== "image/gif" ? "image/jpeg" : file.type }; },
  async addEvidence(a) { return tx(() => wf.addEvidence(db, a)); },
  async submitVersion(a) { return tx(() => { const version = wf.submitVersion(db, a); const project = wf.getProject(db, a.projectId); const post = db.posts.find((p) => p.id === project.postId)!; pushNotification({ userId: project.ownerId, postId: post.id, kind: "SUBMISSION", href: `/projects/detail?id=${project.id}`, text: `'${post.title}' 결과물이 제출됐어요.` }); return version.id; }); },
  async requestRevision(versionId, actorId, comment) { return tx(() => { wf.requestRevision(db, { versionId, actorId, comment }); const version = db.versions.find((v) => v.id === versionId)!; const project = wf.getProject(db, version.projectId); pushNotification({ userId: version.submittedBy, postId: project.postId, kind: "REVISION", href: `/projects/detail?id=${project.id}`, text: "결과물 보완 요청이 도착했어요." }); }); },
  async approveVersion(a) { return tx(() => { wf.approveVersion(db, a); const version = db.versions.find((v) => v.id === a.versionId)!; const project = wf.getProject(db, version.projectId); for (const member of db.members.filter((m) => m.projectId === project.id)) pushNotification({ userId: member.studentId, postId: project.postId, kind: "COMPLETED", href: `/projects/detail?id=${project.id}`, text: "프로젝트가 승인·완료됐어요." }); }); },
  async savePeerReview(a) { return tx(() => { const review = wf.savePeerReview(db, a); const project = wf.getProject(db, a.projectId); pushNotification({ userId: a.revieweeId, postId: project.postId, kind: "PEER_REVIEW", href: `/projects/peer-review?id=${project.id}`, text: "팀원 상호평가가 등록됐어요." }); return review; }); },
  async addOutcome(a) { return tx(() => wf.addOutcome(db, a)); },
  async verifyOutcome(outcomeId, actorId) { return tx(() => { wf.verifyOutcome(db, { outcomeId, actorId }); }); },
  async generatePortfolio(projectId, actorId, opts) {
    // mock 에는 AI 서버가 없다 → 템플릿 초안 (화면에 "템플릿 초안 · AI 미사용" 로 표시)
    return tx(() => {
      const snap = wf.createSnapshot(db, { projectId, actorId });
      const r = wf.addDraft(db, { snapshotId: snap.id, actorId, generator: "TEMPLATE", content: templateDraft(snap.data), regenerate: opts?.regenerate });
      return { ...r, aiError: r.reused ? undefined : "가짜 데이터 모드라 AI 서버 없이 템플릿으로 만들었어요" };
    });
  },
  async savePortfolioEdit(draftId, actorId, content) { return tx(() => wf.saveEdit(db, { draftId, actorId, content })); },
  async listPortfolioDocs(studentId) {
    ensure();
    const latest = new Map<string, (typeof db.edits)[number]>();
    for (const e of db.edits.filter((x) => x.studentId === studentId)) if ((latest.get(e.projectId)?.version ?? 0) < e.version) latest.set(e.projectId, e);
    return wait([...latest.values()].map((edit) => { const project = wf.getProject(db, edit.projectId); return { edit, project, post: db.posts.find((p) => p.id === project.postId)! }; }));
  },
  async getPublicPortfolio(projectId, studentId) {
    ensure();
    // DB 의 get_public_portfolio 와 같은 규칙: 피드에 공개 중인 작업만 (본인은 숨김이어도)
    const me = typeof localStorage !== "undefined" ? localStorage.getItem("wolgye-user") || "s1" : "";
    const pub = [...publications, ...demoProjectPublications(db, studentId)].find((p) => p.studentId === studentId && p.sourceKind === "project" && p.sourceId === projectId);
    if (!pub || (pub.visible === false && me !== studentId)) return wait<PortfolioPage | undefined>(undefined);
    const edit = db.edits.filter((e) => e.projectId === projectId && e.studentId === studentId).sort((a, b) => b.version - a.version)[0];
    if (!edit) return wait<PortfolioPage | undefined>(undefined);
    const b = wf.getBundle(db, projectId);
    const approved = b.versions.find((v) => v.id === b.project.approvedVersionId);
    const page = pageFromBundle({ ...b, drafts: [], evidence: b.evidence.filter((e) => e.authorId === studentId || e.source === "CLIENT" || approved?.evidenceIds.includes(e.id)), outcomes: b.outcomes.filter((o) => o.authorId === studentId) }, edit, studentId, users);
    return wait<PortfolioPage | undefined>({ ...page, latestDraft: undefined });
  },
  async getPortfolioDoc(projectId, studentId) {
    ensure();
    const edit = db.edits.filter((e) => e.projectId === projectId && e.studentId === studentId).sort((a, b) => b.version - a.version)[0];
    return wait<PortfolioDoc | undefined>(edit ? { edit, bundle: wf.getBundle(db, projectId) } : undefined);
  },
  // ── 유지보수·인수인계 (DB 의 0018 마이그레이션과 같은 규칙) ────────────────
  async getOperations(projectId) {
    ensure();
    const operations = db.operations.find((o) => o.projectId === projectId);
    if (!operations) return wait(null);
    return wait({
      operations,
      history: db.terms.filter((t) => t.projectId === projectId),
      tickets: db.tickets.filter((t) => t.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      doc: db.handoverDocs.filter((d) => d.projectId === projectId).at(-1) ?? null,
    });
  },
  async saveHandover(projectId, actorId, data) { return tx(() => {
    const o = db.operations.find((x) => x.projectId === projectId);
    if (!o) throw new Error("운영 중인 프로젝트가 아니에요");
    if (o.maintainerId !== actorId) throw new Error("현재 담당자만 인수인계 정보를 저장할 수 있어요");
    Object.assign(o, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
  }); },
  async generateHandoverDoc(projectId) { return tx(() => {
    const o = db.operations.find((x) => x.projectId === projectId)!;
    const post = db.posts.find((p) => p.id === db.projects.find((x) => x.id === projectId)?.postId);
    // 가짜 데이터 모드에는 AI 가 없으므로 입력한 값으로 문서를 만든다 (서버 연결 시 Gemini 가 대신 쓴다)
    const doc: HandoverDoc = {
      id: `hd${Date.now()}`, projectId, generatedAt: new Date().toISOString(), model: "TEMPLATE",
      markdown: [`# ${post?.title ?? "프로젝트"} 인수인계서`, "",
        `- 저장소: ${o.repoUrl ?? "미입력"}`, `- 배포 주소: ${o.deployUrl ?? "미입력"}`,
        `- 관리자 계정 전달: ${o.adminHanded ? "완료" : "미완료"}`, `- 월 비용: ${o.monthlyCost ?? "미입력"}`,
        `- 결제 명의: ${o.billingOwner === "CLIENT" ? "사장님" : o.billingOwner === "STUDENT" ? "학생(이관 필요)" : "미입력"}`,
        `- 외부 서비스: ${o.envList ?? "미입력"}`, `- 만료 예정일: ${o.expiresOn ?? "미입력"}`,
        `- 백업: ${o.backupNote ?? "미입력"}`, "", "## 알려진 문제", o.knownIssues || "없음"].join("\n"),
    };
    db.handoverDocs.push(doc);
    return doc;
  }); },
  async openHandover(projectId, actorId) { return tx(() => {
    const o = db.operations.find((x) => x.projectId === projectId);
    if (!o || o.maintainerId !== actorId) throw new Error("현재 담당자만 인계를 요청할 수 있어요");
    if (!o.repoUrl) throw new Error("인수인계 정보(저장소 주소)를 먼저 채워 주세요");
    o.status = "HANDOVER_OPEN";
    const term = db.terms.find((t) => t.projectId === projectId && t.studentId === actorId && !t.endedOn);
    if (term) term.endedOn = new Date().toISOString().slice(0, 10);
    const project = db.projects.find((p) => p.id === projectId)!;
    const origin = db.posts.find((p) => p.id === project.postId)!;
    if (!db.posts.some((p) => p.handoverOfProject === projectId && p.status === "open")) {
      db.posts.unshift({
        ...origin, id: `p${Date.now()}`, title: `[이어받기] ${origin.title}`, status: "open", createdAt: new Date().toISOString(),
        description: "이미 운영 중인 서비스를 이어받아 관리할 학생을 찾습니다. 인수인계서가 준비되어 있어 바로 시작할 수 있어요.",
        problem: "담당 학생이 빠져 유지보수할 사람이 필요해요", durationDays: 30, isTeam: false, teamSlots: undefined,
        urgent: false, urgentColleges: [], handoverOfProject: projectId,
      });
    }
    pushNotification({ userId: project.ownerId, kind: "HANDOVER_OPEN", href: "/", text: "담당 학생이 인계를 요청해 이어받기 공고를 올렸어요." });
  }); },
  async takeOver() { throw new Error("이어받기 공고에 지원하면 사장님이 선정해요"); },
  async listHandoverOpenings() {
    ensure();
    return wait(db.operations.filter((o) => o.status === "HANDOVER_OPEN").flatMap((operations) => {
      const project = db.projects.find((p) => p.id === operations.projectId);
      const post = db.posts.find((p) => p.id === project?.postId);
      return project && post ? [{ operations, project, post }] : [];
    }));
  },
  async createTicket(projectId, actorId, kind, body) { return tx(() => {
    const o = db.operations.find((x) => x.projectId === projectId);
    const project = db.projects.find((p) => p.id === projectId);
    if (!o || !project) throw new Error("운영 중인 프로젝트가 아니에요");
    if (project.ownerId !== actorId) throw new Error("의뢰인만 유지보수를 요청할 수 있어요");
    const post = db.posts.find((p) => p.id === project.postId);
    const today = new Date().toISOString().slice(0, 10);
    const coverage: MaintenanceTicket["coverage"] =
      kind === "FEATURE" ? "NEW_POST"
      : kind === "BUG" && (o.warrantyDefectUntil ?? "") >= today ? "FREE_DEFECT"
      : kind !== "BUG" && (o.warrantyRequestUntil ?? "") >= today && o.requestUsed < (post?.warrantyRequestCount ?? 3) ? "FREE_REQUEST"
      : "EXPIRED";
    const ticket: MaintenanceTicket = {
      id: `mt${Date.now()}`, projectId, authorId: actorId, kind, body, coverage,
      assigneeId: coverage.startsWith("FREE") ? o.maintainerId : undefined, status: "OPEN", createdAt: new Date().toISOString(),
    };
    db.tickets.push(ticket);
    if (coverage === "FREE_REQUEST") o.requestUsed += 1;
    if (ticket.assigneeId) pushNotification({ userId: ticket.assigneeId, kind: "MAINTENANCE", href: `/projects/detail?id=${projectId}`, text: "유지보수 요청이 도착했어요." });
    return ticket;
  }); },
  async closeTicket(ticketId, actorId) { return tx(() => {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) throw new Error("요청을 찾을 수 없어요");
    if (t.assigneeId !== actorId && t.authorId !== actorId) throw new Error("담당자나 요청한 분만 처리할 수 있어요");
    t.status = "DONE"; t.closedAt = new Date().toISOString();
    const term = db.terms.find((x) => x.projectId === t.projectId && x.studentId === t.assigneeId && !x.endedOn);
    if (term) term.ticketsClosed += 1;
  }); },
  async recordUptime(projectId, okFlag) { return tx(() => {
    const o = db.operations.find((x) => x.projectId === projectId);
    if (o) { o.lastCheckAt = new Date().toISOString(); o.lastCheckOk = okFlag; }
  }); },
  async listOperatingProjects(userId) {
    ensure();
    return wait(db.operations.flatMap((operations) => {
      const project = db.projects.find((p) => p.id === operations.projectId);
      const post = db.posts.find((p) => p.id === project?.postId);
      if (!project || !post || (operations.maintainerId !== userId && project.ownerId !== userId)) return [];
      return [{ operations, project, post }];
    }));
  },

  // ── 단체 (DB 0022 와 같은 규칙) ──────────────────────────────────────────
  async listClubs() { ensure(); return wait(db.clubs.filter((c) => c.status === "APPROVED").map((c) => ({ ...c, memberCount: db.clubMembers.filter((m) => m.clubId === c.id).length }))); },
  async myClubs(studentId) {
    ensure();
    return wait(db.clubMembers.filter((m) => m.studentId === studentId && m.status === "ACTIVE").flatMap((m) => {
      const club = db.clubs.find((c) => c.id === m.clubId);
      return club ? [{ club: { ...club, memberCount: db.clubMembers.filter((x) => x.clubId === club.id).length }, role: m.role }] : [];
    }));
  },
  async listClubMembers(clubId) { ensure(); return wait(db.clubMembers.filter((m) => m.clubId === clubId)); },
  async createClub(actorId, input) { return tx(() => {
    if (users.find((u) => u.id === actorId)?.role !== "student") throw new Error("학생만 단체를 만들 수 있어요");
    if (db.clubs.some((c) => c.name === input.name.trim())) throw new Error("같은 이름의 단체가 이미 있어요");
    const club: Club = {
      id: `c${Date.now()}`, name: input.name.trim(), kind: input.kind,
      kindOther: input.kind === "OTHER" ? input.kindOther?.trim() || undefined : undefined,
      description: input.description, college: input.college, createdBy: actorId, status: "PENDING",
    };
    db.clubs.push(club);
    db.clubMembers.push({ clubId: club.id, studentId: actorId, role: "LEADER", status: "ACTIVE", joinedAt: new Date().toISOString() });
    return club;
  }); },
  async joinClub(clubId, actorId) { return tx(() => {
    const club = db.clubs.find((c) => c.id === clubId);
    if (club?.status !== "APPROVED") throw new Error("아직 등록 심사 중인 단체예요");
    if (!db.clubMembers.some((m) => m.clubId === clubId && m.studentId === actorId))
      db.clubMembers.push({ clubId, studentId: actorId, role: "MEMBER", status: "PENDING", joinedAt: new Date().toISOString() });
    for (const leader of db.clubMembers.filter((m) => m.clubId === clubId && m.role === "LEADER" && m.status === "ACTIVE"))
      pushNotification({ userId: leader.studentId, kind: "CLUB_JOIN", href: `/clubs/detail?id=${clubId}`, text: `${users.find((u) => u.id === actorId)?.name ?? "학생"}님이 "${club.name}" 가입을 신청했어요.` });
  }); },
  async reviewMember(clubId, studentId, approve, actorId) { return tx(() => {
    if (!db.clubMembers.some((m) => m.clubId === clubId && m.studentId === actorId && m.role === "LEADER" && m.status === "ACTIVE"))
      throw new Error("단체 대표만 가입을 수락할 수 있어요");
    const i = db.clubMembers.findIndex((m) => m.clubId === clubId && m.studentId === studentId);
    if (i < 0) return;
    if (approve) {
      db.clubMembers[i].status = "ACTIVE";
      pushNotification({ userId: studentId, kind: "CLUB_JOIN", href: `/clubs/detail?id=${clubId}`, text: `"${db.clubs.find((c) => c.id === clubId)?.name}" 가입이 수락됐어요.` });
    } else db.clubMembers.splice(i, 1);
  }); },
  async leaveClub(clubId, actorId) { return tx(() => {
    if (db.operations.some((o) => o.clubId === clubId && o.maintainerId === actorId && (o.status === "WARRANTY" || o.status === "OPERATING")))
      throw new Error("맡고 있는 서비스의 담당자를 먼저 넘겨 주세요");
    const i = db.clubMembers.findIndex((m) => m.clubId === clubId && m.studentId === actorId);
    if (i >= 0) db.clubMembers.splice(i, 1);
  }); },
  // ── 관리자 ──────────────────────────────────────────────────────────────
  async listPendingClubs() { ensure(); return wait(db.clubs.filter((c) => c.status === "PENDING")); },
  async listClubsByStatus(status) { ensure(); return wait(db.clubs.filter((c) => c.status === status)); },
  async reviewClub(clubId, approve, reason, actorId) { return tx(() => {
    if (users.find((u) => u.id === actorId)?.role !== "admin") throw new Error("관리자만 심사할 수 있어요");
    const club = db.clubs.find((c) => c.id === clubId);
    if (!club) throw new Error("단체를 찾을 수 없어요");
    club.status = approve ? "APPROVED" : "REJECTED";
    club.rejectReason = approve ? undefined : reason;
    pushNotification({ userId: club.createdBy, kind: "CLUB_REVIEW", href: "/clubs", text: approve ? `신청한 단체 "${club.name}" 가 등록됐어요.` : `단체 "${club.name}" 등록이 반려됐어요. ${reason ?? ""}` });
  }); },
  async adminOverview() {
    ensure();
    const title = (projectId: string) => db.posts.find((p) => p.id === db.projects.find((x) => x.id === projectId)?.postId)?.title ?? "프로젝트";
    const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    return wait({
      pendingClubs: db.clubs.filter((c) => c.status === "PENDING").length,
      students: users.filter((u) => u.role === "student").length,
      residents: users.filter((u) => u.role === "resident").length,
      posts: db.posts.length,
      urgentOpen: db.posts.filter((p) => p.urgent && p.status === "open").length,
      operating: db.operations.filter((o) => o.status === "WARRANTY" || o.status === "OPERATING").length,
      handoverOpen: db.operations.filter((o) => o.status === "HANDOVER_OPEN").length,
      warrantyEndingSoon: db.operations.filter((o) => o.warrantyDefectUntil && o.warrantyDefectUntil <= soon)
        .map((o) => ({ projectId: o.projectId, title: title(o.projectId), until: o.warrantyDefectUntil! })),
      downSites: db.operations.filter((o) => o.lastCheckOk === false).map((o) => ({ projectId: o.projectId, title: title(o.projectId) })),
      openTickets: db.tickets.filter((t) => t.status === "OPEN").length,
    });
  },

  async transferLeader(clubId, studentId, actorId) { return tx(() => {
    const me = db.clubMembers.find((m) => m.clubId === clubId && m.studentId === actorId);
    if (me?.role !== "LEADER" || me.status !== "ACTIVE") throw new Error("현재 대표만 대표를 넘길 수 있어요");
    const target = db.clubMembers.find((m) => m.clubId === clubId && m.studentId === studentId && m.status === "ACTIVE");
    if (!target) throw new Error("소속이 확정된 부원에게만 넘길 수 있어요");
    me.role = "MEMBER"; target.role = "LEADER";
  }); },
  async addClubWorker(projectId, studentId, roleLabel, actorId) { return tx(() => {
    const project = db.projects.find((p) => p.id === projectId);
    const clubId = db.operations.find((o) => o.projectId === projectId)?.clubId
      ?? db.applications.find((a) => db.members.some((m) => m.projectId === projectId && m.applicationId === a.id))?.clubId;
    if (!project || !clubId) throw new Error("단체가 맡은 프로젝트만 부원을 추가할 수 있어요");
    if (!db.clubMembers.some((m) => m.clubId === clubId && m.studentId === actorId && m.role === "LEADER" && m.status === "ACTIVE"))
      throw new Error("단체 대표만 참여 부원을 추가할 수 있어요");
    if (!db.clubMembers.some((m) => m.clubId === clubId && m.studentId === studentId && m.status === "ACTIVE"))
      throw new Error("같은 단체 소속 부원만 추가할 수 있어요");
    if (db.members.some((m) => m.projectId === projectId && m.studentId === studentId)) return;
    db.members.push({ projectId, studentId, roleLabel: roleLabel.trim() || "참여", domain: project.domain, joinedAt: new Date().toISOString() });
  }); },
  async listClubProjects(clubId) {
    ensure();
    const ids = new Set(db.applications.filter((a) => a.clubId === clubId).map((a) => a.id));
    return wait(db.projects.flatMap((project) => {
      const belongs = db.members.some((m) => m.projectId === project.id && m.applicationId && ids.has(m.applicationId))
        || db.operations.some((o) => o.projectId === project.id && o.clubId === clubId);
      const post = db.posts.find((p) => p.id === project.postId);
      return belongs && post ? [{ project, post }] : [];
    }));
  },

  async assignMaintainer(projectId, studentId, actorId) { return tx(() => {
    const o = db.operations.find((x) => x.projectId === projectId);
    if (!o) throw new Error("운영 중인 프로젝트가 아니에요");
    if (!o.clubId) throw new Error("단체가 맡은 프로젝트만 내부에서 담당자를 바꿀 수 있어요");
    const leader = db.clubMembers.some((m) => m.clubId === o.clubId && m.studentId === actorId && m.role === "LEADER" && m.status === "ACTIVE");
    if (o.maintainerId !== actorId && !leader) throw new Error("현재 담당자나 단체 대표만 담당자를 바꿀 수 있어요");
    if (!db.clubMembers.some((m) => m.clubId === o.clubId && m.studentId === studentId && m.status === "ACTIVE")) throw new Error("같은 단체 소속 학생에게만 넘길 수 있어요");
    const term = db.terms.find((t) => t.projectId === projectId && t.studentId === o.maintainerId && !t.endedOn);
    if (term) term.endedOn = new Date().toISOString().slice(0, 10);
    o.maintainerId = studentId;
    if (o.status === "HANDOVER_OPEN") o.status = "OPERATING";
    db.terms.push({ id: `mt${Date.now()}`, projectId, studentId, startedOn: new Date().toISOString().slice(0, 10), ticketsClosed: 0 });
    pushNotification({ userId: studentId, kind: "HANDOVER_TAKEN", href: `/projects/handover?id=${projectId}`, text: "단체에서 맡고 있는 서비스의 담당자가 되었어요." });
  }); },

  async trustSummary(studentId) {
    ensure();
    const storedEvents = db.tierEvents.filter((e) => e.studentId === studentId);
    const demo = demoReputationFor(studentId);
    const events = storedEvents.length === 0 ? demo.events : storedEvents;
    const projectIds = new Set(events.map((e) => e.projectId));
    const storedReviews = db.reviews.filter((r) => projectIds.has(r.projectId));
    const studentReviews = storedReviews.length === 0 ? demo.reviews : storedReviews;
    const projectCount = Math.max(new Set(db.members.filter(m => m.studentId === studentId).map(m => m.projectId)).size, 2);
    const allReviews = [...db.reviews, ...demo.reviews];
    return wait(summarizeTrust(events, studentReviews, db.badges.filter((b) => b.studentId === studentId), [], allReviews, [], projectCount));
  },
  async disputeReview(projectId, studentId, reason) { return tx(() => {
    const member = db.members.find(m => m.projectId === projectId && m.studentId === studentId);
    if (!member) throw new Error("프로젝트에 참여한 학생만 이의를 제기할 수 있어요.");
    const review = db.reviews.find(r => r.projectId === projectId);
    if (!review) throw new Error("평가를 찾을 수 없어요.");
    review.status = "DISPUTED";
    review.disputeReason = reason.trim().slice(0, 1000);
  }); },
  async resetDemo() { db = fresh(); msgs = structuredClone(messages); demoNotifications = structuredClone(seedNotifications); publications = []; profileExtras = {}; agreements = {}; loaded = true; seedDemoChats(); save(); },};

export { distanceM };
