import type { Application, ChatMessage, Notification, Post, PortfolioCard, PortfolioDoc, RankRow, Review, User } from "@/types";
import type { Repo } from "./index";
import { distanceM } from "../geo";
import * as wf from "../workflow/engine";
import { templateDraft } from "@shared/portfolio/narrative";
import { summarizeTrust } from "../trust";
import { fileToDataUrl } from "../files";
import { domainForCategory } from "@shared/portfolio/domains";

// ── 시드 데이터 (월계1동 근방 좌표) ──────────────────────────────────────────
export const users: User[] = [
  { id: "s1", role: "student", name: "김하늘", department: "디자인학과", skills: ["포스터", "일러스트", "Figma"], interests: ["디자인", "SNS홍보"], availableHours: "평일 저녁, 주말", maxDistanceM: 1500, location: { lat: 37.6196, lng: 127.0592 }, school: "광운대학교", age: 22, phone: "010-0000-1001" },
  { id: "s2", role: "student", name: "박도윤", department: "소프트웨어학부", skills: ["React", "웹페이지", "QR"], interests: ["웹/앱", "디지털도움"], availableHours: "주말", maxDistanceM: 2000, location: { lat: 37.6210, lng: 127.0620 }, school: "광운대학교", age: 24, phone: "010-0000-1002" },
  { id: "s3", role: "student", name: "이서준", department: "미디어영상학부", skills: ["숏폼", "프리미어", "촬영"], interests: ["영상", "사진"], availableHours: "평일 오후", maxDistanceM: 1200, location: { lat: 37.6230, lng: 127.0580 }, school: "광운대학교", age: 23, phone: "010-0000-1003" },
  { id: "s4", role: "student", name: "최지우", department: "경영학부", skills: ["인스타그램", "카피", "마케팅"], interests: ["SNS홍보", "기타"], availableHours: "평일 저녁", maxDistanceM: 1000, location: { lat: 37.6250, lng: 127.0610 }, school: "광운대학교", age: 21, phone: "010-0000-1004" },
  { id: "s5", role: "student", name: "윤서연", department: "시각디자인학과", skills: ["브랜딩", "패키지", "Illustrator"], interests: ["디자인", "SNS홍보"], availableHours: "화·목 오후, 주말", maxDistanceM: 1800, location: { lat: 37.6207, lng: 127.0577 }, school: "광운대학교", age: 22, phone: "010-0000-1005" },
  { id: "s6", role: "student", name: "정민재", department: "컴퓨터정보공학부", skills: ["Next.js", "Supabase", "반응형 웹"], interests: ["웹/앱", "디지털도움"], availableHours: "평일 저녁", maxDistanceM: 2200, location: { lat: 37.6218, lng: 127.0640 }, school: "광운대학교", age: 25, phone: "010-0000-1006" },
  { id: "s7", role: "student", name: "한유진", department: "미디어커뮤니케이션학부", skills: ["인터뷰", "영상 기획", "캡컷"], interests: ["영상", "SNS홍보"], availableHours: "월·수 오후", maxDistanceM: 1600, location: { lat: 37.6241, lng: 127.0569 }, school: "광운대학교", age: 21, phone: "010-0000-1007" },
  { id: "s8", role: "student", name: "오지훈", department: "전자통신공학과", skills: ["기기 설정", "와이파이", "키오스크"], interests: ["디지털도움", "웹/앱"], availableHours: "금요일, 주말", maxDistanceM: 2500, location: { lat: 37.6260, lng: 127.0631 }, school: "광운대학교", age: 24, phone: "010-0000-1008" },
  { id: "s9", role: "student", name: "강민서", department: "콘텐츠융합학부", skills: ["사진 촬영", "Lightroom", "숏폼"], interests: ["사진", "영상", "SNS홍보"], availableHours: "평일 오전, 토요일", maxDistanceM: 2000, location: { lat: 37.6275, lng: 127.0590 }, school: "광운대학교", age: 23, phone: "010-0000-1009" },
  { id: "s10", role: "student", name: "배수아", department: "경영학부", skills: ["브랜드 전략", "시장 조사", "카피라이팅"], interests: ["SNS홍보", "디자인"], availableHours: "평일 저녁, 일요일", maxDistanceM: 1700, location: { lat: 37.6280, lng: 127.0618 }, school: "광운대학교", age: 22, phone: "010-0000-1010" },
  { id: "s11", role: "student", name: "임태현", department: "정보융합학부", skills: ["Flutter", "UX 프로토타입", "데이터 시각화"], interests: ["웹/앱", "디자인"], availableHours: "수·금 저녁", maxDistanceM: 2300, location: { lat: 37.6199, lng: 127.0645 }, school: "광운대학교", age: 24, phone: "010-0000-1011" },
  { id: "s12", role: "student", name: "송예린", department: "국어국문학과", skills: ["인터뷰", "블로그 글쓰기", "콘텐츠 교정"], interests: ["SNS홍보", "기타"], availableHours: "평일 오후, 토요일", maxDistanceM: 1400, location: { lat: 37.6258, lng: 127.0575 }, school: "광운대학교", age: 21, phone: "010-0000-1012" },
  { id: "r1", role: "resident", name: "월계 커피", kind: "상인", location: { lat: 37.6248, lng: 127.0598 }, address: "월계로 45길 12" },
  { id: "r2", role: "resident", name: "행복분식", kind: "상인", location: { lat: 37.6272, lng: 127.0615 }, address: "월계1동 광운로 21" },
  { id: "r3", role: "resident", name: "동네책방 소소", kind: "상인", location: { lat: 37.6285, lng: 127.0580 }, address: "석계로 7" },
  { id: "r4", role: "resident", name: "정순자 님", kind: "주민", location: { lat: 37.6238, lng: 127.0632 }, address: "월계1동 주민센터 인근" },
  { id: "r5", role: "resident", name: "삼거리 정육점", kind: "상인", location: { lat: 37.6302, lng: 127.0622 }, address: "월계로 60" },
  { id: "r6", role: "resident", name: "꽃길 공방", kind: "상인", location: { lat: 37.6224, lng: 127.0568 }, address: "광운로 12길 8" },
  { id: "r7", role: "resident", name: "월계 미용실", kind: "상인", location: { lat: 37.6264, lng: 127.0601 }, address: "월계로 53길 4" },
  { id: "r8", role: "resident", name: "햇살 반찬", kind: "상인", location: { lat: 37.6291, lng: 127.0605 }, address: "석계로 18" },
  { id: "r9", role: "resident", name: "깨끗한 세탁소", kind: "상인", location: { lat: 37.6246, lng: 127.0642 }, address: "광운로 33" },
  { id: "r10", role: "resident", name: "우리동네 피아노", kind: "상인", location: { lat: 37.6215, lng: 127.0604 }, address: "월계로 42길 15" },
  { id: "r11", role: "resident", name: "월계 과일상회", kind: "상인", location: { lat: 37.6283, lng: 127.0630 }, address: "초안산로 5길 9" },
  { id: "r12", role: "resident", name: "별빛 베이커리", kind: "상인", location: { lat: 37.6205, lng: 127.0612 }, address: "광운로 8" },
  { id: "r13", role: "resident", name: "다정 약국", kind: "상인", location: { lat: 37.6232, lng: 127.0650 }, address: "월계로 50길 3" },
  { id: "r14", role: "resident", name: "바늘뜸 옷수선", kind: "상인", location: { lat: 37.6270, lng: 127.0572 }, address: "석계로 12길 6" },
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

const applications: Application[] = [
  { id: "a1", postId: "p3", studentId: "s3", message: "숏폼 편집 경험 있습니다. 평일 오후 가능해요.", status: "accepted", createdAt: "2026-09-10T08:00:00Z" },
  { id: "a2", postId: "p1", studentId: "s1", message: "포스터 3종 시안 드릴 수 있어요.", status: "pending", createdAt: "2026-09-14T12:00:00Z" },
];

const messages: ChatMessage[] = [
  { id: "m1", applicationId: "a2", senderId: "s1", body: "안녕하세요! 포스터 공고 보고 연락드려요.", createdAt: "2026-09-14T12:01:00Z" },
  { id: "m2", applicationId: "a2", senderId: "r1", body: "반가워요. 신메뉴 사진 먼저 보내 드릴게요.", createdAt: "2026-09-14T12:30:00Z" },
];

const reviews: Review[] = [
  { postId: "p6", studentId: "s4", rating: 5, comment: "게시물 반응이 정말 좋아졌어요.", verified: true },
  { postId: "p7", studentId: "s3", rating: 5, comment: "사진이 깔끔하고 빨랐어요.", verified: true },
];

const portfolio: PortfolioCard[] = [
  { id: "c1", studentId: "s4", postId: "p6", title: "월계 커피 홍보 프로젝트", roleLabel: "SNS 콘텐츠 기획·디자인", tasks: ["홍보 게시물 6개 제작", "해시태그·업로드 일정 정리"], durationDays: 14, rating: 5, verified: true },
  { id: "c2", studentId: "s3", postId: "p7", title: "행복분식 사진 촬영", roleLabel: "촬영·보정", tasks: ["외관·메뉴 사진 20장 촬영", "네이버 플레이스용 보정"], durationDays: 3, rating: 5, verified: true },
];

const seedNotifications: Notification[] = [
  { id: "n1", userId: "s1", postId: "p1", text: "월계 커피에서 '카페 신메뉴 포스터 디자인' 프로젝트가 등록되었습니다.", distanceM: 580, read: false, createdAt: "2026-09-14T09:01:00Z" },
  { id: "n2", userId: "s1", postId: "p5", text: "삼거리 정육점 팀 프로젝트에 디자인 1명이 필요합니다.", distanceM: 1200, read: true, createdAt: "2026-09-12T07:05:00Z" },
  { id: "n3", userId: "r1", postId: "p1", text: "김하늘 학생이 포스터 공고에 지원했습니다.", read: false, createdAt: "2026-09-14T12:00:00Z" },
];

// ── 저장: 브라우저 localStorage (서버 연결 전 데모용). 새 구조라 키를 v2 로 올렸다 ──
// 확장된 사용자·공고 시드가 기존 브라우저에도 보이도록 키를 올린다. v2 데이터는 삭제하지 않는다.
const KEY = "wolgye-mock-v3";
const fresh = (): wf.WorkflowDB => ({
  ...wf.emptyDB(),
  users: structuredClone(users), posts: structuredClone(posts), applications: structuredClone(applications),
  legacyReviews: structuredClone(reviews), legacyCards: structuredClone(portfolio),
});
let db: wf.WorkflowDB = fresh();
let msgs: ChatMessage[] = structuredClone(messages);
let demoNotifications: Notification[] = structuredClone(seedNotifications);
function load() {
  if (typeof window === "undefined") return;
  try {
    const s = localStorage.getItem(KEY);
    if (s) { const d = JSON.parse(s); db = { ...fresh(), ...d.db, users: structuredClone(users) }; msgs = d.messages ?? msgs; demoNotifications = d.notifications ?? demoNotifications; }
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
  try { localStorage.setItem(KEY, JSON.stringify({ db, messages: msgs, notifications: demoNotifications })); }
  catch { throw new Error("브라우저 저장 공간이 가득 찼어요. 나 › 데모 데이터 초기화 후 다시 시도해 주세요"); }
}
let loaded = false; const ensure = () => { if (!loaded) { load(); loaded = true; } };
const listeners = new Set<(m: ChatMessage) => void>();
const notificationListeners = new Set<(n: Notification) => void>();
const pushNotification = (n: Omit<Notification, "id" | "createdAt" | "read">) => {
  const notification: Notification = { ...n, id: `n${Date.now()}${Math.random().toString(36).slice(2, 7)}`, read: false, createdAt: new Date().toISOString() };
  demoNotifications.unshift(notification);
  notificationListeners.forEach((listener) => listener(structuredClone(notification)));
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

import { chatReads } from "./chatReads";
export const mockRepo: Repo = {
  ...chatReads("mock"),
  async listUsers() { return wait(users); },
  async getUser(id) { return wait(users.find((u) => u.id === id)); },
  async listPosts() { ensure(); return wait([...db.posts].map(withRoleIds).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); },
  async getPost(id) { ensure(); const post = db.posts.find((p) => p.id === id); return wait(post ? withRoleIds(post) : undefined); },
  async createPost(p) { return tx(() => {
    const post = withRoleIds({ ...p, id: `p${Date.now()}`, status: "open", createdAt: new Date().toISOString() }); db.posts.unshift(post);
    for (const student of users.filter((u): u is Extract<User, { role: "student" }> => u.role === "student" && u.interests.includes(post.category))) {
      const distance = distanceM(student.location, post.location);
      if (distance <= student.maxDistanceM) pushNotification({ userId: student.id, postId: post.id, kind: "MATCHED_POST", href: `/posts/detail?id=${post.id}`, text: `${post.title} 공고가 등록됐어요.`, distanceM: Math.round(distance) });
    }
    return post;
  }); },
  async updatePostStatus(id, status) { return tx(() => { const p = db.posts.find((x) => x.id === id); if (p) p.status = status; }); },
  async listApplications(postId) { ensure(); return wait(db.applications.filter((a) => !postId || a.postId === postId)); },
  async apply(postId, studentId, message, roleId) { return tx(() => {
    const application = wf.apply(db, { postId, studentId, message, roleId }); const post = db.posts.find((p) => p.id === postId)!; const student = users.find((u) => u.id === studentId);
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
      return [{ application: a, post, other: users.find((u) => u.id === (a.studentId === userId ? post.authorId : a.studentId)), last }];
    });
    return wait(rooms.sort((x, y) => (y.last?.createdAt ?? y.application.createdAt).localeCompare(x.last?.createdAt ?? x.application.createdAt)));
  },
  async listMessages(applicationId) { ensure(); return wait(msgs.filter((m) => m.applicationId === applicationId)); },
  async sendMessage(applicationId, senderId, body) {
    ensure(); const m: ChatMessage = { id: `m${Date.now()}`, applicationId, senderId, body, createdAt: new Date().toISOString() };
    msgs.push(m); const application = db.applications.find((a) => a.id === applicationId); const post = application && db.posts.find((p) => p.id === application.postId);
    if (application && post) pushNotification({ userId: senderId === application.studentId ? post.authorId : application.studentId, postId: post.id, kind: "CHAT", href: `/chats/room?id=${applicationId}`, text: `${users.find((u) => u.id === senderId)?.name ?? "상대방"}님이 새 메시지를 보냈어요.` });
    save(); listeners.forEach((l) => l(m)); return wait(m);
  },
  onMessage(applicationId, cb) { const l = (m: ChatMessage) => { if (m.applicationId === applicationId) cb(m); }; listeners.add(l); return () => { listeners.delete(l); }; },
  async listReviews(studentId) { ensure(); return wait(db.legacyReviews.filter((r) => !studentId || r.studentId === studentId)); },
  async listPortfolio(studentId) { ensure(); return wait(db.legacyCards.filter((c) => c.studentId === studentId)); },
  async listNotifications(userId) { ensure(); return wait(demoNotifications.filter((n) => n.userId === userId)); },
  async markNotificationRead(id, userId) { ensure(); const notification = demoNotifications.find((n) => n.id === id && n.userId === userId); if (notification) notification.read = true; save(); },
  onNotification(userId, cb) { const listener = (n: Notification) => { if (n.userId === userId) cb(n); }; notificationListeners.add(listener); return () => { notificationListeners.delete(listener); }; },
  async ranking(kind) {
    ensure();
    // 지역 기여 점수 = 해결 수×10 + 평가 평균×4 + 난이도 합×3 (임시 공식, 나중에 조정)
    const students = users.filter((u): u is Extract<User, { role: "student" }> => u.role === "student");
    const rows: RankRow[] = students.map((s) => {
      const cards = db.legacyCards.filter((c) => c.studentId === s.id);
      const solvedPosts = cards.map((c) => db.posts.find((p) => p.id === c.postId)).filter(Boolean) as Post[];
      const avg = cards.length ? cards.reduce((a, c) => a + c.rating, 0) / cards.length : 0;
      const diff = solvedPosts.reduce((a, p) => a + p.difficulty, 0);
      return { id: s.id, label: s.name, sub: s.department, solved: cards.length, score: cards.length * 10 + Math.round(avg * 4) + diff * 3 };
    });
    if (kind === "individual") return wait(rows.sort((a, b) => b.score - a.score));
    if (kind === "department") {
      const by: Record<string, RankRow> = {};
      for (const r of rows) { const k = r.sub; by[k] ??= { id: k, label: k, sub: "학과", score: 0, solved: 0 }; by[k].score += r.score; by[k].solved += r.solved; }
      return wait(Object.values(by).sort((a, b) => b.score - a.score));
    }
    return wait([{ id: "t1", label: "정육점 디지털 개선팀", sub: "디자인·영상·개발", score: 0, solved: 0 }]);
  },

  // ── 검증형 포트폴리오 파이프라인 (규칙은 workflow/engine.ts) ──────────────────
  async selectApplicant(applicationId, actorId) { return tx(() => { const project = wf.selectApplicant(db, { applicationId, actorId }); const application = db.applications.find((a) => a.id === applicationId)!; const post = db.posts.find((p) => p.id === application.postId)!; pushNotification({ userId: application.studentId, postId: post.id, kind: "APPLICATION_ACCEPTED", href: `/projects/detail?id=${project.id}`, text: `'${post.title}' 프로젝트에 선정됐어요.` }); return project; }); },
  async startTeamProject(projectId, actorId, leaderId) { return tx(() => { const project = wf.startTeamProject(db, { projectId, actorId, leaderId }); const post = db.posts.find((p) => p.id === project.postId)!; for (const member of db.members.filter((m) => m.projectId === projectId)) pushNotification({ userId: member.studentId, postId: post.id, kind: "PROJECT_STARTED", href: `/projects/detail?id=${projectId}`, text: `'${post.title}' 팀 프로젝트가 시작됐어요.` }); return project; }); },
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
  async getPortfolioDoc(projectId, studentId) {
    ensure();
    const edit = db.edits.filter((e) => e.projectId === projectId && e.studentId === studentId).sort((a, b) => b.version - a.version)[0];
    return wait<PortfolioDoc | undefined>(edit ? { edit, bundle: wf.getBundle(db, projectId) } : undefined);
  },
  async trustSummary(studentId) {
    ensure();
    const events = db.tierEvents.filter((e) => e.studentId === studentId);
    const projectIds = new Set(events.map((e) => e.projectId));
    return wait(summarizeTrust(events, db.reviews.filter((r) => projectIds.has(r.projectId)), db.badges.filter((b) => b.studentId === studentId), db.peerReviews.filter((r) => r.revieweeId === studentId)));
  },
  async resetDemo() { db = fresh(); msgs = structuredClone(messages); demoNotifications = structuredClone(seedNotifications); loaded = true; save(); },
};

export { distanceM };
