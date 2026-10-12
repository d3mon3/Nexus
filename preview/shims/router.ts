import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const current = () => decodeURI(window.location.hash.slice(1) || "/");
window.addEventListener("hashchange", () => listeners.forEach((l) => l()));
export function navigate(href: string, replace = false) {
  const url = `#${href}`;
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  listeners.forEach((l) => l());
}
export function useLocation() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
  );
}
