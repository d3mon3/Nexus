"use client";

import { useSyncExternalStore } from "react";

/**
 * In-app notifications (the bell in the top bar). Stored in localStorage so they survive a
 * restart; every window of the app sees the same list. Optionally mirrored as a Windows
 * notification while NEXUS isn't the focused window.
 */
export interface AppNotice {
  /** Same id = same notification (not added twice). */
  id: string;
  title: string;
  body: string;
  href?: string;
  kind: "info" | "success" | "warning";
  at: number;
  read: boolean;
}

const KEY = "nexus.notifications.v1";
const MAX = 30;
const listeners = new Set<() => void>();
let cache: AppNotice[] | null = null;

function read(): AppNotice[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    cache = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as AppNotice[];
    if (!Array.isArray(cache)) cache = [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: AppNotice[]) {
  cache = next.slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cache = null;
    listeners.forEach((l) => l());
  });

const EMPTY: AppNotice[] = [];
export function useNotifications(): AppNotice[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

/** Adds a notification (ignored when one with the same id exists). Returns true when added. */
export function notify(n: Omit<AppNotice, "at" | "read">, opts: { system?: boolean } = {}): boolean {
  const list = read();
  if (list.some((x) => x.id === n.id)) return false;
  write([{ ...n, at: Date.now(), read: false }, ...list]);
  if (opts.system && typeof window !== "undefined" && "Notification" in window && !document.hasFocus()) {
    try {
      if (window.Notification.permission === "granted") new window.Notification(n.title, { body: n.body, silent: true });
    } catch {
      /* not supported */
    }
  }
  return true;
}

export function markAllRead() {
  write(read().map((n) => (n.read ? n : { ...n, read: true })));
}

export function clearNotifications() {
  write([]);
}

export function removeNotification(id: string) {
  write(read().filter((n) => n.id !== id));
}
