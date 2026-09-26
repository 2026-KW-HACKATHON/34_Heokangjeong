import type { Post, Student } from "@/types";
import { distanceM } from "./geo";

const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  디자인: ["디자인", "시각", "산업", "조형"],
  영상: ["미디어", "영상", "콘텐츠", "디자인"],
  사진: ["미디어", "사진", "영상", "디자인"],
  SNS홍보: ["경영", "미디어", "광고", "홍보", "마케팅", "콘텐츠"],
  "웹/앱": ["소프트웨어", "컴퓨터", "정보", "AI", "인공지능", "데이터", "전자"],
  디지털도움: ["소프트웨어", "컴퓨터", "정보", "AI", "인공지능", "데이터", "전자"],
  기타: [],
};

export function isDepartmentRelated(student: Student, post: Post): boolean {
  const department = student.department.toLowerCase();
  return (DEPARTMENT_KEYWORDS[post.category] ?? []).some((keyword) => department.includes(keyword.toLowerCase()));
}

function hasRelatedSkill(student: Student, post: Post): boolean {
  const text = `${post.title} ${post.description}`.toLowerCase();
  return student.skills.some((skill) => skill.trim() && text.includes(skill.toLowerCase()));
}

/** 추천 퍼센트 대신 카드에 보여 줄, 사용자가 바로 이해할 수 있는 추천 근거. */
export function recommendationLabel(student: Student, post: Post): string {
  if (isDepartmentRelated(student, post)) return "내 전공과 관련 있는 공고";
  if (student.interests.includes(post.category)) return "내 관심 분야와 관련 있는 공고";
  if (hasRelatedSkill(student, post)) return "내 보유 기술을 활용할 수 있는 공고";
  if (distanceM(student.location, post.location) <= student.maxDistanceM) return "내 활동 가능 거리 안의 공고";
  return "새로운 분야에 도전할 수 있는 공고";
}

/** 학과 + 관심분야 + 보유기술 + 거리 기반 추천 점수 (0~100). 규칙은 단순하게 두고, 나중에 가중치·ML 로 교체 가능. */
export function recommendScore(student: Student, post: Post): number {
  let s = 0;
  if (student.interests.includes(post.category)) s += 40;
  if (isDepartmentRelated(student, post)) s += 25;
  if (hasRelatedSkill(student, post)) s += 15;
  const d = distanceM(student.location, post.location);
  if (d <= student.maxDistanceM) s += Math.round(20 * (1 - d / student.maxDistanceM));
  return Math.min(100, s);
}
