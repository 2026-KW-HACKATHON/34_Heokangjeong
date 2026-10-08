"use client";
import { useEffect, useState } from "react";
import { repo } from "./repo";

export function useUnreadChatCounts(userId?: string) {
  const [state, setState] = useState<{ userId?: string; counts: Record<string, number> }>({ counts: {} });
  useEffect(() => {
    if (!userId) return;
    let active = true, busy = false, rerun = false;
    const subscriptions = new Map<string, () => void>();
    async function refresh() {
      if (!active || document.visibilityState === "hidden") return;
      if (busy) { rerun = true; return; }
      busy = true;
      try {
        const rooms = await repo.listChatRooms(userId!);
        if (!active) return;
        const entries = await Promise.all(rooms.map(async room => {
          const id = room.application.id;
          if (!subscriptions.has(id)) subscriptions.set(id, repo.onMessage(id, () => { void refresh(); }));
          const [messages, readIds] = await Promise.all([repo.listMessages(id), repo.readChatMessageIds(userId!, id)]);
          const seen = new Set(readIds);
          return [id, messages.filter(m => m.senderId !== userId && !seen.has(m.id)).length] as const;
        }));
        if (active) setState({ userId, counts: Object.fromEntries(entries) });
      } catch { /* Preserve the indicator during temporary connection failures. */ }
      finally { busy = false; if (rerun && active) { rerun = false; void refresh(); } }
    }
    const update = () => { void refresh(); };
    update();
    const timer = window.setInterval(update, 10000);
    window.addEventListener("wolgye-chat-read", update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      window.clearInterval(timer);
      subscriptions.forEach(unsubscribe => unsubscribe());
      window.removeEventListener("wolgye-chat-read", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [userId]);
  return state.userId === userId ? state.counts : {};
}

export function useUnreadChats(userId?: string) {
  const counts = useUnreadChatCounts(userId);
  return Object.values(counts).reduce((total, count) => total + count, 0);
}
