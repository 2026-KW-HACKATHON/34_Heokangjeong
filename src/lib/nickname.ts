import type { User } from "@/types";

/** 닉네임 규칙 (DB 0040 profiles_nickname_format 과 같다): 2~16자, 한글·영문·숫자·밑줄·마침표 */
export const NICKNAME_RULE = /^[가-힣A-Za-z0-9_.]{2,16}$/;
export const NICKNAME_HINT = "2~16자, 한글·영문·숫자·_ . 만 쓸 수 있어요 (띄어쓰기 안 됨)";

/** 쓸 수 없으면 이유, 쓸 수 있으면 null. 중복은 대소문자 구분 없이 본다 */
export function nicknameProblem(nickname: string, users: User[], selfId?: string): string | null {
  const v = nickname.trim();
  if (!v) return "닉네임을 입력해 주세요";
  if (!NICKNAME_RULE.test(v)) return NICKNAME_HINT;
  if (users.some((u) => u.id !== selfId && u.nickname?.toLowerCase() === v.toLowerCase())) return "이미 쓰는 닉네임이에요";
  return null;
}

/** DB 중복·형식 오류 → 화면 문장 */
export function nicknameError(message: string) {
  if (/profiles_nickname_unique/.test(message)) return "이미 쓰는 닉네임이에요";
  if (/profiles_nickname_format/.test(message)) return NICKNAME_HINT;
  return message;
}

/** 이름·닉네임·학과로 학생 찾기 */
export function searchStudents(users: User[], query: string) {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!q) return [];
  return users.filter((u) => u.role === "student" && [u.name, u.nickname ?? "", u.department].some((x) => x.toLowerCase().includes(q)));
}
