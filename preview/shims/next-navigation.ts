import { navigate, useLocation } from "./router";

export function usePathname() {
  return useLocation().split("?")[0];
}
export function useSearchParams() {
  const loc = useLocation();
  return new URLSearchParams(loc.split("?")[1] ?? "");
}
export function useRouter() {
  return { push: (h: string) => navigate(h), replace: (h: string) => navigate(h, true), back: () => history.back(), refresh: () => {}, prefetch: () => {} };
}
export function redirect(h: string) {
  navigate(h, true);
}
export function notFound() {}
