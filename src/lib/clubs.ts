import type { Club, ClubKind } from "@/types";

/** 단체 유형. 5개 중에 없으면 '기타'를 고르고 직접 적는다. */
export const CLUB_KINDS: { key: ClubKind; label: string; hint: string }[] = [
  { key: "CENTRAL", label: "중앙동아리", hint: "학교 전체 대상 동아리 (사진·영상·프로그래밍 등)" },
  { key: "DEPARTMENT", label: "과 동아리·학회", hint: "학과 소속 동아리나 전공 학회" },
  { key: "COUNCIL", label: "학생회", hint: "총학생회, 단과대·과 학생회" },
  { key: "VOLUNTEER", label: "봉사단체", hint: "교내 봉사단, 봉사 동아리" },
  { key: "OTHER", label: "기타", hint: "위에 없으면 직접 적어 주세요 (예: 교내 방송국, 캡스톤 팀)" },
];

export const clubKindLabel = (c: Pick<Club, "kind" | "kindOther">) =>
  c.kind === "OTHER" ? (c.kindOther?.trim() || "기타") : CLUB_KINDS.find((k) => k.key === c.kind)!.label;
