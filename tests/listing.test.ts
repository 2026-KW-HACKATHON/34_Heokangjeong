import { describe, expect, it } from "vitest";
import { formatPaidAmount, MAX_PAID_AMOUNT, parsePaidAmount } from "@/lib/listing";

describe("유료 공고 금액 입력", () => {
  it("쉼표와 원 표기가 포함된 금액을 정수로 변환한다", () => {
    expect(parsePaidAmount("50,000원")).toBe(50_000);
    expect(parsePaidAmount("₩ 120,000")).toBe(120_000);
  });

  it("입력 금액을 천 단위 쉼표로 표시한다", () => {
    expect(formatPaidAmount("50000")).toBe("50,000");
  });

  it("비어 있거나 DB 범위를 넘는 금액은 거부한다", () => {
    expect(parsePaidAmount("")).toBeUndefined();
    expect(parsePaidAmount("0")).toBeUndefined();
    expect(parsePaidAmount(String(MAX_PAID_AMOUNT + 1))).toBeUndefined();
  });
});
