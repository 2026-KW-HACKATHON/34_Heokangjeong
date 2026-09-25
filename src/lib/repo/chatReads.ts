// Device-local receipts, isolated by backend/account. Message bodies are never stored.
export function chatReads(namespace: string) {
  const cache = new Map<string, Set<string>>();
  const key = (user: string, room: string) => `wolgye-chat-read-v1:${namespace}:${user}:${room}`;
  function read(k: string) {
    const ids = cache.get(k) ?? new Set<string>();
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(k) ?? "[]");
      if (Array.isArray(saved)) saved.forEach(id => { if (typeof id === "string") ids.add(id); });
    } catch { /* Keep session receipts if browser storage is unavailable. */ }
    cache.set(k, ids);
    return ids;
  }
  return {
    async readChatMessageIds(user: string, room: string) { return [...read(key(user, room))]; },
    async markChatRead(user: string, room: string, messageIds: string[]) {
      const k = key(user, room), ids = read(k);
      messageIds.forEach(id => ids.add(id));
      try { localStorage.setItem(k, JSON.stringify([...ids])); } catch { /* Session fallback. */ }
      window.dispatchEvent(new Event("wolgye-chat-read"));
    },
  };
}
