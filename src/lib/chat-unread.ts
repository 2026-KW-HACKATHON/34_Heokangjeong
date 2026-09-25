import type { ChatRoom } from "@/types";

export type ChatReadTimes = Record<string, string>;

export function unreadChatRoomIds(rooms: ChatRoom[], userId: string, readTimes: ChatReadTimes): string[] {
  return rooms.flatMap((room) => {
    const last = room.last;
    if (!last || last.senderId === userId) return [];
    const readAt = readTimes[room.application.id];
    return !readAt || last.createdAt > readAt ? [room.application.id] : [];
  });
}

export function chatReadStorageKey(userId: string) {
  return `wolgye-chat-read:${userId}`;
}
