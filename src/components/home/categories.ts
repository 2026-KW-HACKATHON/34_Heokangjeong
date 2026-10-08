import type { IconName } from "@/components/Icon";
import type { Category } from "@/types";

export type HomeCategory = "전체" | "디자인" | "사진/영상" | "웹/앱" | "SNS홍보" | "디지털도움";

export const HOME_CATEGORIES: { value: Exclude<HomeCategory, "전체">; label: string; talent: string; icon: IconName; categories: Category[] }[] = [
  { value: "디자인", label: "디자인", talent: "그리는 재능", icon: "pen", categories: ["디자인"] },
  { value: "사진/영상", label: "사진/영상", talent: "담아내는 재능", icon: "camera", categories: ["사진", "영상"] },
  { value: "웹/앱", label: "웹/앱 개발", talent: "만드는 재능", icon: "web", categories: ["웹/앱"] },
  { value: "SNS홍보", label: "SNS 콘텐츠", talent: "알리는 재능", icon: "megaphone", categories: ["SNS홍보"] },
  { value: "디지털도움", label: "디지털 도움", talent: "함께하는 재능", icon: "phone", categories: ["디지털도움"] },
];

export function categoryMatches(filter: HomeCategory, category: Category) {
  return filter === "전체" || HOME_CATEGORIES.find((item) => item.value === filter)?.categories.includes(category) === true;
}
