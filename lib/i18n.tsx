"use client";

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { PL } from "./i18n/pl";

/**
 * Tiny i18n: English source strings are the keys, Polish comes from lib/i18n/pl.ts.
 * `t()` is a plain function (usable in render, event handlers and helpers); the provider
 * remounts the tree when the language changes. Unknown strings fall back to English,
 * and non-strings pass through unchanged, so wrapping a value is always safe.
 */
import { DEFAULT_LANG, LANG_COOKIE, type Lang } from "./i18n-shared";
export { DEFAULT_LANG, LANG_COOKIE, LANGS, type Lang } from "./i18n-shared";

let current: Lang = DEFAULT_LANG;
export const getLang = () => current;
export function setLang(l: Lang) {
  current = l;
}

type Vars = Record<string, string | number> | (string | number)[];

const interpolate = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => String((vars as Record<string, string | number>)[k] ?? m)) : s);

/** Keys with {placeholders} also translate dynamic strings (e.g. notes from the server). */
let patterns: { re: RegExp; names: string[]; pl: string }[] | null = null;
function patternTranslate(s: string): string | null {
  patterns ??= Object.entries(PL)
    .filter(([k]) => /\{\w+\}/.test(k))
    .map(([k, pl]) => {
      const names: string[] = [];
      const src = k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\w+)\\?\}/g, (_, n) => {
        names.push(n);
        return "(.+?)";
      });
      return { re: new RegExp(`^${src}$`), names, pl };
    });
  for (const p of patterns) {
    const m = p.re.exec(s);
    if (m) return p.pl.replace(/\{(\w+)\}/g, (_, n) => m[p.names.indexOf(n) + 1] ?? "");
  }
  return null;
}

export function t<T>(key: T, vars?: Vars): T {
  if (typeof key !== "string") return key;
  if (current === "en" || !key) return interpolate(key, vars) as T;
  const direct = PL[key] ?? PL[key.trim()];
  if (direct != null) return interpolate(direct, vars) as T;
  if (!vars && /\d/.test(key)) {
    const p = patternTranslate(key);
    if (p != null) return p as T;
  }
  return interpolate(key, vars) as T;
}

export const useT = () => t;

const LangContext = createContext<{ lang: Lang; setLanguage: (l: Lang) => void }>({ lang: DEFAULT_LANG, setLanguage: () => undefined });
export const useLanguage = () => useContext(LangContext);

export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLanguage] = useState<Lang>(initial);
  return (
    <LangContext.Provider value={{ lang, setLanguage }}>
      <LangGate lang={lang}>{children}</LangGate>
    </LangContext.Provider>
  );
}

/** Sets the active language before children render and remounts them when it changes. */
function LangGate({ lang, children }: { lang: Lang; children: ReactNode }) {
  setLang(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked — the language still works for this visit */
    }
  }, [lang]);
  return <Fragment key={lang}>{children}</Fragment>;
}
