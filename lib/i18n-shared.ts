/** Language helpers safe to import from server components (no React state here). */
export type Lang = "pl" | "en";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
];
export const DEFAULT_LANG: Lang = "pl";
export const LANG_COOKIE = "nexus-lang";

/** Language from the cookie, or from Accept-Language when there is none (Polish by default). */
export function pickLang(cookie: string | undefined, acceptLanguage: string | null): Lang {
  if (cookie === "pl" || cookie === "en") return cookie;
  if (!acceptLanguage) return DEFAULT_LANG;
  return /\bpl\b/i.test(acceptLanguage) || !/\ben\b/i.test(acceptLanguage) ? "pl" : "en";
}
