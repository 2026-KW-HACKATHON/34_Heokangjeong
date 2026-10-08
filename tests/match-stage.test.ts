import { describe, expect, it } from "vitest";
import { matchStage } from "@/lib/matchStage";

const T0 = "2026-10-08T10:00:00Z", T1 = "2026-10-08T11:00:00Z";

describe("채팅·진행 중인 작업 단계", () => {
  it("지원 → (사장님 선정) 매칭 대기 → (선정 취소) 선정 취소", () => {
    expect(matchStage({ applicationStatus: "pending" })).toBe("APPLIED");
    expect(matchStage({ applicationStatus: "pending", shortlisted: true, lastMessageAt: T1 })).toBe("WAITING");
    expect(matchStage({ applicationStatus: "pending", shortlistCancelled: true })).toBe("SHORTLIST_CANCELLED");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", lastMessageAt: T1 })).toBe("IN_PROGRESS");   // 기존 프로젝트도 실제 상태를 따른다
  });
  it("약속서 확정 직후부터 추가 대화 없이 진행 중", () => {
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", agreementFinalizedAt: T1, lastMessageAt: T0 })).toBe("IN_PROGRESS");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", agreementFinalizedAt: T0 })).toBe("IN_PROGRESS");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", agreementFinalizedAt: T0, lastMessageAt: T1 })).toBe("IN_PROGRESS");
  });
  it("제출·보완 단계는 진행 중, 승인은 완료, 합의 취소는 취소됨, 미선정은 거절됨", () => {
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "REVIEW_PENDING" })).toBe("IN_PROGRESS");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "REVISION_REQUESTED" })).toBe("IN_PROGRESS");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "COMPLETED", agreementFinalizedAt: T0, lastMessageAt: T1 })).toBe("COMPLETED");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "CANCELLED" })).toBe("CANCELLED");
    expect(matchStage({ applicationStatus: "rejected", lastMessageAt: T1 })).toBe("REJECTED");
  });
});
