// 체험(데모) 중에는 Gemini 대신 준비된 답을 바로 채운다
import { describe, expect, it } from "vitest";
import { cannedAgreement, cannedPostDraft, CANNED_NOTE } from "@/lib/ai/demo";

const SALON_MEMO = "월계동에서 미용실을 운영하고 있어요. 시술 안내판이 오래돼서 손님들이 커트와 염색 가격을 자주 물어보세요. 매장에 붙일 A3 안내 포스터 한 장과 인스타그램에 올릴 정사각형 이미지 한 장이 필요해요.";

describe("체험용 공고 초안", () => {
  it("기본 예시(미용실)에는 준비된 초안이 나온다", () => {
    const d = cannedPostDraft(SALON_MEMO);
    expect(d.title).toBe("월계 미용실 시술 안내 포스터");
    expect(d.category).toBe("디자인");
    expect(d.deliverables).toContain("A3 매장 부착용 포스터 PDF 1종");
    expect(d.reasons).toContain(CANNED_NOTE);   // 체험용이라는 안내가 붙는다
  });
  it("다른 글은 낱말로 분야를 고른다", () => {
    expect(cannedPostDraft("가게 홈페이지에 예약 페이지를 만들고 싶어요").category).toBe("웹/앱");
    expect(cannedPostDraft("인스타그램 홍보 게시물을 올려 주세요").category).toBe("SNS홍보");
    expect(cannedPostDraft("어르신들께 키오스크 사용법을 알려 주세요").category).toBe("디지털도움");
    expect(cannedPostDraft("그냥 도와주세요").category).toBe("기타");
  });
  it("빈 항목 없이 폼을 채울 수 있다", () => {
    const d = cannedPostDraft("메뉴판을 새로 만들고 싶어요. 음료 쿠폰 5장 드릴게요.");
    expect(d.title).toBeTruthy(); expect(d.description).toBeTruthy(); expect(d.departments.length).toBeGreaterThan(0);
    expect(d.reward).toContain("쿠폰");
  });
});

describe("체험용 계약서 요약", () => {
  it("공고에 적힌 결과물·완료 기준·보상을 그대로 쓴다", () => {
    const a = cannedAgreement("포스터 만들어 주세요", {
      title: "월계 미용실 시술 안내 포스터", description: "매장 부착용 포스터와 SNS 이미지",
      expectedDeliverables: ["A3 포스터 PDF", "SNS 이미지"], completionCriteria: "점주가 가격을 확인하면 완료", reward: "커트 1회 이용권",
    });
    expect(a.source).toBe("DEMO");
    expect(a.deliverables).toBe("A3 포스터 PDF\nSNS 이미지");
    expect(a.acceptance).toBe("점주가 가격을 확인하면 완료");
    expect(a.coupon).toContain("커트 1회 이용권");
    expect(a.scope && a.handoff && a.summary).toBeTruthy();
  });
  it("공고 정보가 없어도 모든 칸이 채워진다", () => {
    const a = cannedAgreement("메뉴판 디자인, 음료 쿠폰 3장");
    expect(a.scope && a.deliverables && a.acceptance && a.handoff).toBeTruthy();
  });
});
