"use client";
import { useEffect, useState } from "react";
import { repo } from "./repo";

export const NOTIFICATION_READ_EVENT = "wolgye-notification-read";

export function useUnreadNotifications(userId?: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const reload = () => {
      if (!userId) return setCount(0);
      repo.listNotifications(userId).then((items) => { if (active) setCount(items.filter((item) => !item.read).length); }).catch(() => {});
    };
    reload();
    if (!userId) return () => { active = false; };
    const off = repo.onNotification(userId, () => { if (active) setCount((value) => value + 1); });
    window.addEventListener(NOTIFICATION_READ_EVENT, reload);
    return () => { active = false; off(); window.removeEventListener(NOTIFICATION_READ_EVENT, reload); };
  }, [userId]);
  return count;
}
