import { describe, expect, it } from "vitest";
import { nicknameError, nicknameProblem, searchStudents } from "@/lib/nickname";
import { users } from "@/lib/repo/mock";

describe("닉네임", () => {
  it("형식·중복(대소문자 무시)·본인 허용", () => {
    expect(nicknameProblem("", users)).toMatch(/입력/);
    expect(nicknameProblem("a", users)).toMatch(/2~16자/);
    expect(nicknameProblem("공 백", users)).toMatch(/2~16자/);
    expect(nicknameProblem("하늘그림", users)).toMatch(/이미/);
    expect(nicknameProblem("하늘그림", users, "s1")).toBeNull();          // 내 닉네임 그대로 저장
    expect(nicknameProblem("new_name.01", users)).toBeNull();
  });
  it("데모 계정 닉네임은 서로 겹치지 않는다", () => {
    const nicks = users.map((u) => u.nickname?.toLowerCase()).filter(Boolean);
    expect(new Set(nicks).size).toBe(nicks.length);
    expect(nicks.every((n) => nicknameProblem(n!, []) === null)).toBe(true);
  });
  it("DB 오류를 화면 문장으로", () => {
    expect(nicknameError('duplicate key value violates unique constraint "profiles_nickname_unique"')).toBe("이미 쓰는 닉네임이에요");
  });
  it("이름·@닉네임·학과로 학생만 찾는다", () => {
    expect(searchStudents(users, "김하늘").map((u) => u.id)).toEqual(["s1"]);
    expect(searchStudents(users, "@도윤코딩").map((u) => u.id)).toEqual(["s2"]);
    expect(searchStudents(users, "경영학부").map((u) => u.id).sort()).toEqual(["s10", "s4"]);
    expect(searchStudents(users, "행복분식")).toEqual([]);              // 주민·상인은 안 나옴
    expect(searchStudents(users, "  ")).toEqual([]);
  });
});
