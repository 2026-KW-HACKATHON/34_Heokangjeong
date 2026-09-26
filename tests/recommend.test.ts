import { describe, expect, it } from "vitest";
import { recommendationLabel } from "../src/lib/recommend";
import type { Post, Student } from "../src/types";

const student: Student = {
  id: "student", role: "student", name: "학생", department: "소프트웨어학부",
  skills: ["React"], interests: ["디자인"], availableHours: "주말", maxDistanceM: 1500,
  location: { lat: 37.62, lng: 127.06 },
};
const post = (category: Post["category"], title = "도움 요청"): Post => ({
  id: category, title, category, description: "", authorId: "owner", address: "월계동",
  location: { lat: 37.62, lng: 127.06 }, status: "open", durationDays: 3, difficulty: 1,
  isTeam: false, createdAt: "2026-09-26T00:00:00Z",
});

describe("recommendationLabel", () => {
  it("shows a department reason before other matching reasons", () => {
    expect(recommendationLabel(student, post("웹/앱", "React 웹페이지"))).toBe("내 전공과 관련 있는 공고");
  });

  it("uses interest and skill reasons when the department is unrelated", () => {
    expect(recommendationLabel(student, post("디자인"))).toBe("내 관심 분야와 관련 있는 공고");
    expect(recommendationLabel(student, post("기타", "React 사용 도움"))).toBe("내 보유 기술을 활용할 수 있는 공고");
  });
});
