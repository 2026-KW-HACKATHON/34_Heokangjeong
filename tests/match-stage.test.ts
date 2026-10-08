import { describe, expect, it } from "vitest";
import { matchStage } from "@/lib/matchStage";

const T0 = "2026-10-08T10:00:00Z", T1 = "2026-10-08T11:00:00Z";

describe("채팅·진행 중인 작업 단계", () => {
  it("약속서 확정 전은 매칭 대기 (선정 전 대화 포함)", () => {
    expect(matchStage({ applicationStatus: "pending" })).toBe("WAITING");
    expect(matchStage({ applicationStatus: "pending", lastMessageAt: T1 })).toBe("WAITING");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", lastMessageAt: T1 })).toBe("WAITING");
  });
  it("약속서 확정 직후는 매칭됨, 그 뒤 대화가 오가면 진행 중", () => {
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", agreementFinalizedAt: T1, lastMessageAt: T0 })).toBe("MATCHED");
    expect(matchStage({ applicationStatus: "accepted", projectStatus: "IN_PROGRESS", agreementFinalizedAt: T0 })).toBe("MATCHED");
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
