"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { chatReadStorageKey, type ChatReadTimes, unreadChatRoomIds } from "@/lib/chat-unread";
import type { ChatRoom } from "@/types";

interface ChatAlerts {
  hasUnreadChat: boolean;
  unreadChats: ChatRoom[];
  markChatRead: (applicationId: string, through?: string) => void;
}

const ChatAlertsContext = createContext<ChatAlerts>({ hasUnreadChat: false, unreadChats: [], markChatRead: () => {} });

function loadReadTimes(userId: string): ChatReadTimes {
  try { return JSON.parse(localStorage.getItem(chatReadStorageKey(userId)) ?? "{}"); }
  catch { return {}; }
}

export function ChatAlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const readTimes = useRef<ChatReadTimes>({});

  const markChatRead = useCallback((applicationId: string, through?: string) => {
    if (!user) return;
    readTimes.current[applicationId] = through ?? new Date().toISOString();
    try { localStorage.setItem(chatReadStorageKey(user.id), JSON.stringify(readTimes.current)); } catch {}
    setUnread((current) => {
      if (!current.has(applicationId)) return current;
      const next = new Set(current); next.delete(applicationId); return next;
    });
  }, [user]);

  useEffect(() => {
    if (!user) { readTimes.current = {}; setUnread(new Set()); setRooms([]); return; }
    let stopped = false;
    const subscriptions = new Map<string, () => void>();
    readTimes.current = loadReadTimes(user.id);

    async function sync() {
      const rooms = await repo.listChatRooms(user!.id);
      if (stopped) return;
      setRooms(rooms);
      setUnread(new Set(unreadChatRoomIds(rooms, user!.id, readTimes.current)));
      for (const room of rooms) {
        const applicationId = room.application.id;
        if (subscriptions.has(applicationId)) continue;
        subscriptions.set(applicationId, repo.onMessage(applicationId, (message) => {
          if (message.senderId === user!.id) return;
          const readAt = readTimes.current[applicationId];
          if (readAt && message.createdAt <= readAt) return;
          setRooms((current) => current.map((room) => room.application.id === applicationId ? { ...room, last: message } : room));
          setUnread((current) => new Set(current).add(applicationId));
        }));
      }
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 15_000);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  const unreadChats = rooms.filter((room) => unread.has(room.application.id));
  return <ChatAlertsContext.Provider value={{ hasUnreadChat: unreadChats.length > 0, unreadChats, markChatRead }}>{children}</ChatAlertsContext.Provider>;
}

export const useChatAlerts = () => useContext(ChatAlertsContext);
