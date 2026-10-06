/**
 * 광운대학교 단과대학.
 * 긴급 공고를 올릴 때 사장님이 "어느 쪽 학생이 필요한지" 고르면, 그 단과대학 학생에게만 알림이 간다.
 * 사장님은 학과 이름을 모르므로 각 단과대학이 뭘 하는 곳인지 한 줄로 보여 준다.
 */
export interface College { key: string; label: string; what: string; departments: string[] }

export const COLLEGES: College[] = [
  { key: "AI", label: "인공지능융합대학", what: "앱·웹·프로그램을 만들고 AI, 로봇을 다뤄요",
    departments: ["컴퓨터정보공학부", "소프트웨어학부", "정보융합학부", "로봇학부", "지능형로봇학과"] },
  { key: "ICT", label: "전자정보공과대학", what: "전자기기, 통신, 반도체, 전기를 다뤄요",
    departments: ["전자공학과", "전자통신공학과", "전자융합공학과", "전기공학과", "전자재료공학과", "반도체시스템공학부"] },
  { key: "HSS", label: "인문사회과학대학", what: "홍보·영상·SNS, 글쓰기, 외국어, 사람 심리를 다뤄요",
    departments: ["국어국문학과", "영어산업학과", "미디어커뮤니케이션학부", "산업심리학과", "동북아문화산업학부"] },
  { key: "BIZ", label: "경영대학", what: "장사·마케팅·회계, 해외 거래를 다뤄요",
    departments: ["경영학부", "국제통상학부"] },
  { key: "ENG", label: "공과대학", what: "건축·인테리어, 화학, 환경을 다뤄요",
    departments: ["건축학과", "건축공학과", "화학공학과", "환경공학과"] },
  { key: "SCI", label: "자연과학대학", what: "데이터 분석, 과학 실험, 콘텐츠, 스포츠를 다뤄요",
    departments: ["수학과", "전자바이오물리학과", "화학과", "스포츠융합과학과", "정보콘텐츠학과(야)"] },
  { key: "LAW", label: "정책법학대학", what: "법률·계약, 행정 서류, 국제 업무를 다뤄요",
    departments: ["행정학과", "법학부", "국제학부", "자산관리학과(야)"] },
  { key: "TALENT", label: "참빛인재대학", what: "게임 콘텐츠, 금융·부동산, 전기전자, 스포츠 상담을 다뤄요",
    departments: ["금융부동산법무학과", "게임콘텐츠학과", "스마트전기전자학과", "스포츠상담재활학과"] },
  { key: "INGENIUM", label: "인제니움대학", what: "전공을 정하지 않고 여러 분야를 배우는 학생들이에요",
    departments: ["자율전공학부"] },
];

export const collegeOf = (key?: string) => COLLEGES.find((c) => c.key === key);
export const collegeLabel = (key?: string) => collegeOf(key)?.label ?? "";

/** 학과 이름으로 단과대학을 추측한다 (기존 프로필에 단과대학이 없을 때 기본값으로 쓴다) */
export function guessCollege(department?: string): string | undefined {
  if (!department) return undefined;
  const d = department.replace(/\s/g, "");
  return COLLEGES.find((c) => c.departments.some((x) => x.replace(/\s/g, "") === d))?.key
    ?? COLLEGES.find((c) => c.departments.some((x) => d.includes(x.slice(0, 3))))?.key;
}

/** 긴급 공고 최소 사례비(원). DB 의 public.urgent_min_reward() 와 같은 값이어야 한다. */
export const urgentMinReward = (difficulty: 1 | 2 | 3) => ({ 1: 10000, 2: 30000, 3: 50000 }[difficulty] ?? 30000);
