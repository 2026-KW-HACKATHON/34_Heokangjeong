// 문서 보기(인수인계서 등)가 #, -, ** 기호를 글자 그대로 보여 주지 않고 모양으로 바꾸는지 확인한다.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "@/components/Markdown";

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe("Markdown 보기", () => {
  it("제목을 굵은 제목으로 바꾸고 # 기호는 지운다", () => {
    const out = html("# 인수인계서\n## 어디에 무엇이 있나");
    expect(out).toContain("인수인계서");
    expect(out).toContain("<h2");
    expect(out).toContain("<h3");
    expect(out).not.toContain("#");
  });

  it("- 목록을 목록으로 바꾼다", () => {
    const out = html("- 저장소: https://github.com/a/b\n- 배포 주소: https://x.com");
    expect(out).toContain("<ul");
    expect((out.match(/<li/g) ?? []).length).toBe(2);
  });

  it("체크 목록은 네모로 보여 준다", () => {
    const out = html("- [ ] 관리자 계정으로 로그인해 보기");
    expect(out).toContain("\u2610");
    expect(out).not.toContain("[ ]");
  });

  it("**굵게** 는 굵게 보여 주고 별표는 지운다", () => {
    const out = html("결제 명의는 **사장님** 입니다");
    expect(out).toContain("<b>사장님</b>");
    expect(out).not.toContain("**");
  });

  it("빈 줄이 있어도 문단이 깨지지 않는다", () => {
    const out = html("첫 문단\n\n둘째 문단");
    expect((out.match(/<p>/g) ?? []).length).toBe(2);
  });
});
