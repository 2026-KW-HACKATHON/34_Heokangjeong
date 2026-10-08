// 프로필 사진: 사진이 없으면 실루엣, 사장님도 사진을 올릴 수 있다 (데모 저장소 기준)
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Avatar from "@/components/Avatar";
import { mockRepo } from "@/lib/repo/mock";

afterEach(() => vi.unstubAllGlobals());

describe("프로필 사진", () => {
  it("사진이 없으면 실루엣, 있으면 그 사진", () => {
    const none = renderToStaticMarkup(createElement(Avatar, { user: { id: "r", role: "resident", name: "가게", kind: "상인", address: "", location: { lat: 0, lng: 0 } } }));
    const photo = renderToStaticMarkup(createElement(Avatar, { user: { id: "r", role: "resident", name: "가게", kind: "상인", address: "", location: { lat: 0, lng: 0 }, avatarUrl: "https://x/y.png" } }));
    expect(none).toContain("<svg"); expect(none).not.toContain("<img");
    expect(photo).toContain('src="https://x/y.png"'); expect(photo).not.toContain("<svg");
  });
  it("사장님이 올린 사진이 사용자 목록에 반영된다", async () => {
    const owner = (await mockRepo.listUsers()).find((u) => u.role === "resident")!;
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem: () => owner.id });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    await mockRepo.updateAvatar(owner.id, "data:image/png;base64,AAAA");
    const after = (await mockRepo.listUsers()).find((u) => u.id === owner.id)!;
    expect(after.role === "resident" && after.avatarUrl).toBe("data:image/png;base64,AAAA");
  });
});
