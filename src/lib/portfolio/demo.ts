import type { PublishedPortfolio } from "@/types";
import { DEMO_STUDENT } from "./demoProjects";

// User-supplied examples for the local demo; never published as verified work.
// 김하늘(s1)은 같은 5개가 실제로 완료된 데모 프로젝트로 들어 있어(demoProjects.ts) 이 샘플 카드를 쓰지 않는다.
export function demoPortfolio(studentId: string): PublishedPortfolio[] {
  if (studentId === DEMO_STUDENT) return [];
  return [
    ["real2sim", "Real2Sim & Sim2Real", "웹/앱", "물리 시뮬레이션 연구 화면", "서로 다른 물리 시스템의 동작을 비교하는 프로젝트 화면입니다."],
    ["driving", "Path2ST 주행 시뮬레이터", "웹/앱", "인터랙티브 주행 화면", "경로를 따라 움직이는 차량과 주행 조건을 조작하는 웹 데모 화면입니다."],
    ["menu", "한식당 메뉴판 디자인", "디자인", "메뉴 정보를 한눈에", "메뉴와 가격을 구분하고 음식 일러스트를 배치한 메뉴판 시안입니다."],
    ["banner", "가게 홍보 배너", "디자인", "공간에 적용한 배너 시안", "가로형 배너를 실제 설치 형태로 살펴볼 수 있는 목업입니다."],
    ["cafe", "오늘, 여기서 쉬어가요", "SNS 콘텐츠", "카페 홍보 콘텐츠", "음료와 공간의 분위기를 담은 세로형 홍보 이미지입니다."],
  ].map(([id, title, category, summary, body]) => ({ studentId, sourceId: `demo-${id}`, sourceKind: "card", title, category, summary, coverUrl: `/portfolio-samples/${id}.png`, publishedAt: "2026-10-07T00:00:00Z", sections: [{ title: "경험 소개", body }, { title: "작성할 내용", body: "해결하려던 문제, 담당한 역할, 작업 과정과 결과를 이곳에 기록합니다. 이 게시물은 첨부 이미지를 활용한 화면 예시이며 실제 수행·평가 기록이 아닙니다." }] }));
}
