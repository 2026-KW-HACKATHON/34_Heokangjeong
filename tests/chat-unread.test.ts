import { describe, expect, it } from "vitest";
import { unreadChatRoomIds } from "@/lib/chat-unread";
import type { ChatRoom } from "@/types";

const room = (senderId: string, createdAt: string): ChatRoom => ({
  application: { id: "a1", postId: "p1", studentId: "student", message: "지원", status: "pending", createdAt: "2026-09-20T00:00:00Z" },
  post: { id: "p1", title: "공고", category: "디자인", description: "", authorId: "owner", location: { lat: 0, lng: 0 }, address: "", status: "open", durationDays: 1, difficulty: 1, isTeam: false, createdAt: "2026-09-20T00:00:00Z" },
  other: undefined,
  last: { id: "m1", applicationId: "a1", senderId, body: "새 메시지", createdAt },
});

describe("읽지 않은 채팅", () => {
  it("상대가 보낸 마지막 메시지가 읽은 시각보다 새로우면 표시한다", () => {
    expect(unreadChatRoomIds([room("student", "2026-09-25T10:00:00Z")], "owner", { a1: "2026-09-25T09:00:00Z" })).toEqual(["a1"]);
  });

  it("내 메시지이거나 이미 읽은 메시지는 표시하지 않는다", () => {
    expect(unreadChatRoomIds([room("owner", "2026-09-25T10:00:00Z")], "owner", {})).toEqual([]);
    expect(unreadChatRoomIds([room("student", "2026-09-25T10:00:00Z")], "owner", { a1: "2026-09-25T10:00:00Z" })).toEqual([]);
  });
});
